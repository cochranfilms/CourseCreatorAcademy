import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage, adminAuth } from '@/lib/firebaseAdmin';
import * as FirebaseFirestore from 'firebase-admin/firestore';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as yauzl from 'yauzl';
import * as unzipper from 'unzipper';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

// Category mapping
const CATEGORY_MAP: Record<string, string> = {
  'Overlays & Transitions': 'overlays',
  'SFX & Plugins': 'sfx',
  'LUTs & Presets': 'luts',
};

// File extensions
const OVERLAY_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.tif', '.mov', '.mp4', '.avi', '.mkv', '.webm', '.m4v'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aiff', '.m4a', '.ogg', '.flac'];

/**
 * Verify user is authorized (info@cochranfilms.com)
 */
async function verifyAuth(req: NextRequest): Promise<{ uid: string; email: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.email !== 'info@cochranfilms.com') {
      return null;
    }
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

/**
 * Generate title from filename
 */
function filenameToTitle(filename: string): string {
  let title = filename.replace(/\.zip$/i, '');
  title = title.replace(/[-_]/g, ' ');
  title = title.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return title;
}

/**
 * Get content type from extension
 */
function getContentType(extension: string): string {
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mov': 'video/quicktime',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.aiff': 'audio/aiff',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.cube': 'application/octet-stream',
  };
  return map[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Upload file to Firebase Storage
 */
async function uploadFile(bucket: any, localPath: string, storagePath: string, contentType: string): Promise<void> {
  const file = bucket.file(storagePath);
  const buffer = await fs.readFile(localPath);
  await file.save(buffer, {
    metadata: { contentType },
  });
}

/**
 * Download file from Firebase Storage
 */
async function downloadFile(bucket: any, storagePath: string, localPath: string): Promise<void> {
  const file = bucket.file(storagePath);
  const [buffer] = await file.download();
  await fs.ensureDir(path.dirname(localPath));
  await fs.writeFile(localPath, buffer);
}

/**
 * Send progress update via SSE
 */
function sendProgress(controller: ReadableStreamDefaultController, progress: number, step: string, status?: string) {
  const data = JSON.stringify({ progress, step, status });
  controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
}

/**
 * Stream ZIP directly from Firebase Storage and process files one at a time (no disk download needed)
 */
async function processZipFromStorageStreaming(
  bucket: any,
  storagePath: string,
  extractTo: string,
  fileTypes: string[],
  processor: (file: { fileName: string; localPath: string; extension: string; relativePath: string }) => Promise<void>
): Promise<number> {
  return new Promise((resolve, reject) => {
    let fileCount = 0;
    let pendingOperations = 0;
    const errors: string[] = [];

    // Create a readable stream from Firebase Storage
    const file = bucket.file(storagePath);
    const readStream = file.createReadStream();

    // Parse ZIP stream directly without downloading
    readStream
      .pipe(unzipper.Parse())
      .on('entry', async (entry: unzipper.Entry) => {
        const entryPath = entry.path;
        
        // Skip directories and macOS metadata
        if (entry.type === 'Directory' || entryPath.includes('/._') || path.basename(entryPath).startsWith('._')) {
          entry.autodrain();
          return;
        }

        const ext = path.extname(entryPath).toLowerCase();
        if (!fileTypes.includes(ext)) {
          entry.autodrain();
          return;
        }

        const fileName = path.basename(entryPath);
        if (fileName.startsWith('._')) {
          entry.autodrain();
          return;
        }

        const extractPath = path.join(extractTo, `temp_${Date.now()}_${fileName}`);
        const relativePath = entryPath;

        pendingOperations++;
        fs.ensureDirSync(path.dirname(extractPath));
        const writeStream = fs.createWriteStream(extractPath);

        entry.pipe(writeStream);

        writeStream.on('close', async () => {
          try {
            const fileInfo = { fileName, localPath: extractPath, extension: ext, relativePath };
            await processor(fileInfo);
            // Delete file immediately after processing
            await fs.remove(extractPath).catch(() => {});
            fileCount++;
          } catch (error: any) {
            errors.push(`Error processing ${fileName}: ${error.message}`);
            await fs.remove(extractPath).catch(() => {});
          } finally {
            pendingOperations--;
          }
        });

        writeStream.on('error', async (err) => {
          pendingOperations--;
          errors.push(`Error extracting ${fileName}: ${err.message}`);
          await fs.remove(extractPath).catch(() => {});
        });
      })
      .on('close', () => {
        // Wait for any remaining processing to finish
        const checkComplete = setInterval(() => {
          if (pendingOperations === 0) {
            clearInterval(checkComplete);
            if (errors.length > 0) {
              reject(new Error(errors.join('; ')));
            } else {
              resolve(fileCount);
            }
          }
        }, 100);
      })
      .on('error', reject);
  });
}

/**
 * Unzip file and extract files by type (streaming - processes one at a time)
 */
async function processZipFilesStreaming(
  zipPath: string,
  extractTo: string,
  fileTypes: string[],
  processor: (file: { fileName: string; localPath: string; extension: string; relativePath: string }) => Promise<void>,
  onExtractionComplete?: () => Promise<void>
): Promise<number> {
  return new Promise((resolve, reject) => {
    let fileCount = 0;
    let pendingOperations = 0;
    const errors: string[] = [];
    let extractionComplete = false;

    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }

        // Skip macOS metadata
        if (entry.fileName.includes('/._') || path.basename(entry.fileName).startsWith('._')) {
          zipfile.readEntry();
          return;
        }

        const ext = path.extname(entry.fileName).toLowerCase();
        if (fileTypes.includes(ext)) {
          const fileName = path.basename(entry.fileName);
          if (fileName.startsWith('._')) {
            zipfile.readEntry();
            return;
          }

          const extractPath = path.join(extractTo, `temp_${Date.now()}_${fileName}`);
          const relativePath = entry.fileName;

          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipfile.readEntry();
              return;
            }

            pendingOperations++;
            fs.ensureDirSync(path.dirname(extractPath));
            const writeStream = fs.createWriteStream(extractPath);

            readStream.pipe(writeStream);

            writeStream.on('close', async () => {
              try {
                const fileInfo = { fileName, localPath: extractPath, extension: ext, relativePath };
                await processor(fileInfo);
                // Delete file immediately after processing
                await fs.remove(extractPath).catch(() => {});
                fileCount++;
              } catch (error: any) {
                errors.push(`Error processing ${fileName}: ${error.message}`);
                await fs.remove(extractPath).catch(() => {});
              } finally {
                pendingOperations--;
                zipfile.readEntry();
              }
            });

            writeStream.on('error', async (err) => {
              pendingOperations--;
              errors.push(`Error extracting ${fileName}: ${err.message}`);
              await fs.remove(extractPath).catch(() => {});
              zipfile.readEntry();
            });
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', async () => {
        extractionComplete = true;
        // Delete ZIP file immediately after extraction completes (before processing finishes)
        if (onExtractionComplete) {
          await onExtractionComplete().catch(() => {});
        }
        
        // Wait for any remaining processing to finish
        const checkComplete = setInterval(() => {
          if (pendingOperations === 0) {
            clearInterval(checkComplete);
            if (errors.length > 0) {
              reject(new Error(errors.join('; ')));
            } else {
              resolve(fileCount);
            }
          }
        }, 100);
      });

      zipfile.on('error', reject);
    });
  });
}

/**
 * Unzip file and extract files by type (legacy - extracts all first)
 */
function unzipFile(zipPath: string, extractTo: string, fileTypes: string[]): Promise<Array<{ fileName: string; localPath: string; extension: string; relativePath: string }>> {
  return new Promise((resolve, reject) => {
    const files: Array<{ fileName: string; localPath: string; extension: string; relativePath: string }> = [];

    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }

        // Skip macOS metadata
        if (entry.fileName.includes('/._') || path.basename(entry.fileName).startsWith('._')) {
          zipfile.readEntry();
          return;
        }

        const ext = path.extname(entry.fileName).toLowerCase();
        if (fileTypes.includes(ext)) {
          const fileName = path.basename(entry.fileName);
          if (fileName.startsWith('._')) {
            zipfile.readEntry();
            return;
          }

          const extractPath = path.join(extractTo, fileName);
          const relativePath = entry.fileName;

          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipfile.readEntry();
              return;
            }

            fs.ensureDirSync(path.dirname(extractPath));
            const writeStream = fs.createWriteStream(extractPath);
            readStream.pipe(writeStream);

            writeStream.on('close', () => {
              files.push({ fileName, localPath: extractPath, extension: ext, relativePath });
              zipfile.readEntry();
            });
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => resolve(files));
      zipfile.on('error', reject);
    });
  });
}

/**
 * Get audio duration using ffprobe (if available)
 */
async function getAudioDuration(filePath: string): Promise<number> {
  try {
    // Try to use ffprobe if available
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`);
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) ? 0 : Math.round(duration);
  } catch {
    // If ffprobe not available, return 0 (can be updated later)
    return 0;
  }
}

/**
 * Convert .mov to .mp4 using ffmpeg (if available)
 */
async function convertMovToMp4(inputPath: string, outputPath: string): Promise<boolean> {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(`ffmpeg -i "${inputPath}" -c:v libx264 -c:a aac -movflags +faststart "${outputPath}" -y`);
    return true;
  } catch {
    // If ffmpeg not available, return false
    return false;
  }
}

/**
 * Generate 720p preview using ffmpeg (if available)
 */
async function generate720pPreview(inputPath: string, outputPath: string): Promise<boolean> {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(`ffmpeg -i "${inputPath}" -vf scale=-2:720 -c:v libx264 -c:a aac -movflags +faststart "${outputPath}" -y`);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
  const bucket = adminStorage.bucket(`${projectId}.firebasestorage.app`);

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let tempDir: string | undefined;

      try {
        // Parse request body (JSON with storage path)
        const body = await req.json();
        const { storagePath, category, fileName, thumbnailStoragePath, thumbnailDownloadURL, previewVideoStoragePath, subCategory } = body;

        if (!storagePath || !category || !fileName) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Missing storagePath, category, or fileName' })}\n\n`));
          controller.close();
          return;
        }

        sendProgress(controller, 30, 'Copying ZIP file to final location...', 'processing');

        // Copy ZIP directly in Firebase Storage (no download needed)
        // Determine folder based on category and subcategory
        let categoryFolder = CATEGORY_MAP[category] || 'overlays';
        if (category === 'Overlays & Transitions' && subCategory === 'Transitions') {
          categoryFolder = 'transitions';
        } else if (category === 'Overlays & Transitions') {
          categoryFolder = 'overlays'; // Default to overlays if no subcategory or Overlays selected
        } else if (category === 'SFX & Plugins' && subCategory === 'Plugins') {
          categoryFolder = 'plugins';
        } else if (category === 'SFX & Plugins') {
          categoryFolder = 'sfx'; // Default to sfx if no subcategory or SFX selected
        }
        const packName = fileName.replace(/\.zip$/i, '');
        const zipStoragePath = `assets/${categoryFolder}/${fileName}`;

        // Copy file directly in Storage (no temp download)
        const sourceFile = bucket.file(storagePath);
        const destFile = bucket.file(zipStoragePath);
        await sourceFile.copy(destFile);

        sendProgress(controller, 35, 'Processing thumbnail...', 'processing');

        // Create temp directory for extracted files only (ZIP will be streamed directly, not downloaded)
        tempDir = path.join(os.tmpdir(), `asset-process-${Date.now()}`);
        await fs.ensureDir(tempDir);

        // Create main asset document
        const title = filenameToTitle(fileName);
        const assetRef = adminDb.collection('assets').doc();
        const assetId = assetRef.id;

        const thumbnailFolderPath = `assets/${categoryFolder}/${packName}`;
        const thumbnailPath = `${thumbnailFolderPath}/preview.png`;
        const previewVideoPath = `${thumbnailFolderPath}/preview.mp4`;

        // Create thumbnail folder structure (by creating a .keep file)
        try {
          const keepFilePath = `${thumbnailFolderPath}/.keep`;
          const keepFile = bucket.file(keepFilePath);
          const [keepExists] = await keepFile.exists();
          if (!keepExists) {
            await keepFile.save('', {
              metadata: { contentType: 'text/plain' },
            });
          }
        } catch {}

        // Handle thumbnail upload if provided
        let thumbnailUrl: string | null = null;
        if (thumbnailStoragePath) {
          try {
            // Copy thumbnail to final location
            const thumbnailSourceFile = bucket.file(thumbnailStoragePath);
            const thumbnailDestFile = bucket.file(thumbnailPath);
            await thumbnailSourceFile.copy(thumbnailDestFile);
            
            // Delete temporary thumbnail file
            await thumbnailSourceFile.delete().catch(() => {});

            // Generate signed URL for thumbnail
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 10);
            [thumbnailUrl] = await thumbnailDestFile.getSignedUrl({
              action: 'read',
              expires: expiresAt,
            });
          } catch (error: any) {
            console.error('Failed to process thumbnail:', error);
            // Don't fail the entire process if thumbnail fails
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: `Warning: Failed to process thumbnail: ${error.message}` })}\n\n`));
          }
        }
        
        // Check if thumbnail already exists at the expected location (fallback)
        if (!thumbnailUrl) {
          // Check if thumbnail already exists at the expected location
          try {
            const thumbnailFile = bucket.file(thumbnailPath);
            const [exists] = await thumbnailFile.exists();
            if (exists) {
              const expiresAt = new Date();
              expiresAt.setFullYear(expiresAt.getFullYear() + 10);
              [thumbnailUrl] = await thumbnailFile.getSignedUrl({
                action: 'read',
                expires: expiresAt,
              });
            }
          } catch {}
        }

        // Handle preview video upload if provided (for Plugins)
        let previewVideoUrl: string | null = null;
        if (previewVideoStoragePath) {
          try {
            // Copy preview video to final location
            const previewVideoSourceFile = bucket.file(previewVideoStoragePath);
            const previewVideoDestFile = bucket.file(previewVideoPath);
            await previewVideoSourceFile.copy(previewVideoDestFile);
            
            // Delete temporary preview video file
            await previewVideoSourceFile.delete().catch(() => {});

            // Generate signed URL for preview video
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 10);
            [previewVideoUrl] = await previewVideoDestFile.getSignedUrl({
              action: 'read',
              expires: expiresAt,
            });
          } catch (error: any) {
            console.error('Failed to process preview video:', error);
            // Don't fail the entire process if preview video fails
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: `Warning: Failed to process preview video: ${error.message}` })}\n\n`));
          }
        }

        sendProgress(controller, 40, 'Creating main asset document...', 'processing');

        await assetRef.set({
          title,
          category,
          storagePath: zipStoragePath,
          fileType: 'zip',
          ...(thumbnailUrl ? { thumbnailUrl } : {}),
          ...(previewVideoUrl ? { previewVideoPath, previewVideoUrl } : {}),
          createdAt: FirebaseFirestore.FieldValue.serverTimestamp(),
          updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
        });

        sendProgress(controller, 45, 'Extracting ZIP file...', 'processing');

        // Extract ZIP (reuse tempDir and zipLocalPath from download above)
        const extractDir = path.join(tempDir, 'extracted');
        await fs.ensureDir(extractDir);
        
        // Note: We'll delete the ZIP file after extraction to free disk space

        // Process based on category
        let results = {
          assetId,
          filesProcessed: 0,
          conversionsCompleted: 0,
          previewsGenerated: 0,
          durationsExtracted: 0,
          lutPreviewsCreated: 0,
          documentsCreated: 0,
          errors: [] as string[],
        };

        if (category === 'Overlays & Transitions') {
          const isTransition = subCategory === 'Transitions';
          sendProgress(controller, 50, isTransition ? 'Processing transition files...' : 'Processing overlay files...', 'processing');
          
          const batch = adminDb.batch();
          let processed = 0;
          let totalFiles = 0;

          // Determine storage folder based on subcategory
          const storageFolder = isTransition ? 'transitions' : 'overlays';

          // Process files one at a time using streaming
          const processOverlayFile = async (overlayFile: { fileName: string; localPath: string; extension: string; relativePath: string }) => {
            totalFiles++;
            try {
              let finalStoragePath = `assets/${storageFolder}/${packName}/${overlayFile.fileName}`;
              let previewStoragePath: string | undefined;
              let needsConversion = false;
              let currentFilePath = overlayFile.localPath;

              // Convert .mov to .mp4 if needed
              if (overlayFile.extension === '.mov') {
                const mp4Path = overlayFile.localPath.replace(/\.mov$/i, '.mp4');
                const converted = await convertMovToMp4(overlayFile.localPath, mp4Path);
                if (converted) {
                  finalStoragePath = finalStoragePath.replace(/\.mov$/i, '.mp4');
                  currentFilePath = mp4Path;
                  overlayFile.fileName = overlayFile.fileName.replace(/\.mov$/i, '.mp4');
                  overlayFile.extension = '.mp4';
                  results.conversionsCompleted++;
                  needsConversion = true;
                  // Delete original .mov file immediately after conversion
                  await fs.remove(overlayFile.localPath).catch(() => {});
                } else {
                  results.errors.push(`Could not convert ${overlayFile.fileName} (ffmpeg not available)`);
                }
              }

              // Generate 720p preview for videos BEFORE uploading (need file for preview generation)
              // Check original extension to catch both .mov and .mp4 files
              const originalExtension = overlayFile.extension.toLowerCase();
              const isVideoFile = ['.mp4', '.mov'].includes(originalExtension);
              
              if (isVideoFile) {
                const previewPath = path.join(path.dirname(currentFilePath), path.basename(currentFilePath, path.extname(currentFilePath)) + '_720p.mp4');
                const previewGenerated = await generate720pPreview(currentFilePath, previewPath);
                if (previewGenerated) {
                  previewStoragePath = finalStoragePath.replace(/\.(mp4|mov)$/i, '_720p.mp4');
                  await uploadFile(bucket, previewPath, previewStoragePath, 'video/mp4');
                  // Delete preview file immediately to free disk space
                  await fs.remove(previewPath).catch(() => {});
                  results.previewsGenerated++;
                } else {
                  console.warn(`Failed to generate 720p preview for ${overlayFile.fileName} - ffmpeg may not be available`);
                  results.errors.push(`Could not generate 720p preview for ${overlayFile.fileName} (ffmpeg not available)`);
                }
              }

              // Upload original/converted file
              const contentType = getContentType(overlayFile.extension);
              await uploadFile(bucket, currentFilePath, finalStoragePath, contentType);
              
              // Delete file immediately after upload to free disk space
              await fs.remove(currentFilePath).catch(() => {});

              // Create overlay document
              const overlayRef = adminDb.collection('assets').doc(assetId).collection('overlays').doc();
              batch.set(overlayRef, {
                assetId,
                assetTitle: title,
                fileName: overlayFile.fileName,
                storagePath: finalStoragePath,
                fileType: overlayFile.extension.replace('.', ''),
                ...(previewStoragePath ? { previewStoragePath } : {}),
                createdAt: FirebaseFirestore.FieldValue.serverTimestamp(),
              });

              processed++;
              const fileTypeLabel = isTransition ? 'transition' : 'overlay';
              sendProgress(controller, 50 + Math.min(30, (processed / Math.max(1, totalFiles)) * 30), `Processing ${fileTypeLabel} ${processed}...`, 'processing');
            } catch (error: any) {
              results.errors.push(`Error processing ${overlayFile.fileName}: ${error.message}`);
            }
          };

          // Stream ZIP directly from Firebase Storage (no download needed)
          results.filesProcessed = await processZipFromStorageStreaming(
            bucket,
            zipStoragePath,
            extractDir,
            OVERLAY_EXTENSIONS,
            processOverlayFile
          );

          await batch.commit();
          results.documentsCreated = processed;

        } else if (category === 'SFX & Plugins') {
          const isPlugin = subCategory === 'Plugins';
          sendProgress(controller, 50, isPlugin ? 'Processing plugin files...' : 'Processing audio files...', 'processing');
          
          const batch = adminDb.batch();
          let processed = 0;
          let totalFiles = 0;

          // Determine storage folder based on subcategory
          const storageFolder = isPlugin ? 'plugins' : 'sfx';

          // Process files one at a time using streaming
          const processAudioFile = async (audioFile: { fileName: string; localPath: string; extension: string; relativePath: string }) => {
            totalFiles++;
            try {
              const storagePath = `assets/${storageFolder}/${packName}/sounds/${audioFile.fileName}`;
              
              // Get duration
              const duration = await getAudioDuration(audioFile.localPath);
              if (duration > 0) {
                results.durationsExtracted++;
              }

              // Upload audio file
              const contentType = getContentType(audioFile.extension);
              await uploadFile(bucket, audioFile.localPath, storagePath, contentType);
              
              // Delete audio file immediately to free disk space
              await fs.remove(audioFile.localPath).catch(() => {});

              // Create sound effect document
              const sfxRef = adminDb.collection('assets').doc(assetId).collection('soundEffects').doc();
              batch.set(sfxRef, {
                assetId,
                assetTitle: title,
                fileName: audioFile.fileName,
                storagePath,
                fileType: audioFile.extension.replace('.', ''),
                duration,
                createdAt: FirebaseFirestore.FieldValue.serverTimestamp(),
              });

              processed++;
              const fileTypeLabel = isPlugin ? 'plugin' : 'audio';
              sendProgress(controller, 50 + Math.min(30, (processed / Math.max(1, totalFiles)) * 30), `Processing ${fileTypeLabel} ${processed}...`, 'processing');
            } catch (error: any) {
              results.errors.push(`Error processing ${audioFile.fileName}: ${error.message}`);
            }
          };

          // Stream ZIP directly from Firebase Storage (no download needed)
          results.filesProcessed = await processZipFromStorageStreaming(
            bucket,
            zipStoragePath,
            extractDir,
            AUDIO_EXTENSIONS,
            processAudioFile
          );

          await batch.commit();
          results.documentsCreated = processed;

        } else if (category === 'LUTs & Presets') {
          sendProgress(controller, 50, 'Processing LUT files...', 'processing');
          
          const batch = adminDb.batch();
          let processed = 0;
          let fileCount = 0;

          // Stream ZIP directly from Firebase Storage and process .cube files
          await new Promise<void>((resolve, reject) => {
            const file = bucket.file(zipStoragePath);
            const readStream = file.createReadStream();

            readStream
              .pipe(unzipper.Parse())
              .on('entry', async (entry: unzipper.Entry) => {
                const entryPath = entry.path;
                
                // Skip directories and macOS metadata
                if (entry.type === 'Directory' || entryPath.includes('/._') || path.basename(entryPath).startsWith('._')) {
                  entry.autodrain();
                  return;
                }

                // Look for .cube files in CUBE folder
                if (entryPath.toLowerCase().includes('/cube/') && entryPath.toLowerCase().endsWith('.cube')) {
                  const fileName = path.basename(entryPath);
                  const lutName = path.basename(fileName, '.cube');
                  const extractPath = path.join(extractDir, `temp_${Date.now()}_${fileName}`);

                  fs.ensureDirSync(path.dirname(extractPath));
                  const writeStream = fs.createWriteStream(extractPath);
                  entry.pipe(writeStream);

                  writeStream.on('close', async () => {
                    try {
                      fileCount++;
                      const cubeStoragePath = `assets/luts/${packName}/CUBE/${fileName}`;
                      
                      // Upload .cube file
                      await uploadFile(bucket, extractPath, cubeStoragePath, 'application/octet-stream');
                      
                      // Delete .cube file immediately to free disk space
                      await fs.remove(extractPath).catch(() => {});

                      // Try to find matching videos (they should be in Storage already)
                      const beforePath = `assets/luts/${packName}/${lutName}/before.mp4`;
                      const afterPath = `assets/luts/${packName}/${lutName}/after.mp4`;

                      let beforeExists = false;
                      let afterExists = false;

                      try {
                        const [beforeFile] = await bucket.file(beforePath).exists();
                        const [afterFile] = await bucket.file(afterPath).exists();
                        beforeExists = beforeFile;
                        afterExists = afterFile;
                      } catch {}

                      // Create LUT preview document
                      const lutRef = adminDb.collection('assets').doc(assetId).collection('lutPreviews').doc();
                      batch.set(lutRef, {
                        assetId,
                        assetTitle: title,
                        lutName,
                        ...(beforeExists ? { beforeVideoPath: beforePath } : {}),
                        ...(afterExists ? { afterVideoPath: afterPath } : {}),
                        lutFilePath: cubeStoragePath,
                        fileName: fileName,
                        createdAt: FirebaseFirestore.FieldValue.serverTimestamp(),
                      });
                      processed++;
                      sendProgress(controller, 50 + Math.min(30, (processed / Math.max(1, fileCount)) * 30), `Processing LUT ${processed}...`, 'processing');
                    } catch (error: any) {
                      results.errors.push(`Error processing ${fileName}: ${error.message}`);
                      await fs.remove(extractPath).catch(() => {});
                    }
                  });

                  writeStream.on('error', async (err) => {
                    results.errors.push(`Error extracting ${fileName}: ${err.message}`);
                    await fs.remove(extractPath).catch(() => {});
                  });
                } else {
                  entry.autodrain();
                }
              })
              .on('close', async () => {
                await batch.commit();
                results.filesProcessed = fileCount;
                results.lutPreviewsCreated = processed;
                results.documentsCreated = processed;
                resolve();
              })
              .on('error', reject);
          });
        }

        // Cleanup temp directory
        if (tempDir) {
          await fs.remove(tempDir).catch(() => {});
        }

        sendProgress(controller, 100, 'Processing complete!', 'completed');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ complete: true, results })}\n\n`));
        controller.close();
      } catch (error: any) {
        // Cleanup temp directory even on error
        if (typeof tempDir !== 'undefined') {
          await fs.remove(tempDir).catch(() => {});
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message || 'Processing failed' })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

