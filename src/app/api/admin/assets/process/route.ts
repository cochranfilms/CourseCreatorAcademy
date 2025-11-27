import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage, adminAuth } from '@/lib/firebaseAdmin';
import * as FirebaseFirestore from 'firebase-admin/firestore';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as yauzl from 'yauzl';
import { Readable } from 'stream';

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
 * Send progress update via SSE
 */
function sendProgress(writer: WritableStreamDefaultWriter, progress: number, step: string, status?: string) {
  const data = JSON.stringify({ progress, step, status });
  writer.write(new TextEncoder().encode(`data: ${data}\n\n`));
}

/**
 * Unzip file and extract files by type
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
      const writer = controller.getWriter();
      const encoder = new TextEncoder();

      try {
        // Parse form data
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const category = formData.get('category') as string;

        if (!file || !category) {
          writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'Missing file or category' })}\n\n`));
          writer.close();
          return;
        }

        sendProgress(writer, 5, 'Uploading ZIP file to Storage...', 'uploading');

        // Upload ZIP to Storage
        const zipFileName = file.name;
        const categoryFolder = CATEGORY_MAP[category] || 'overlays';
        const packName = zipFileName.replace(/\.zip$/i, '');
        const zipStoragePath = `assets/${categoryFolder}/${zipFileName}`;

        const zipBuffer = Buffer.from(await file.arrayBuffer());
        const zipFile = bucket.file(zipStoragePath);
        await zipFile.save(zipBuffer, {
          metadata: { contentType: 'application/zip' },
        });

        sendProgress(writer, 10, 'Creating main asset document...', 'processing');

        // Create main asset document
        const title = filenameToTitle(zipFileName);
        const assetRef = adminDb.collection('assets').doc();
        const assetId = assetRef.id;

        const thumbnailFolderPath = `assets/${categoryFolder}/${packName}`;
        const thumbnailPath = `${thumbnailFolderPath}/preview.png`;

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

        // Check if thumbnail exists
        let thumbnailUrl: string | null = null;
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

        await assetRef.set({
          title,
          category,
          storagePath: zipStoragePath,
          fileType: 'zip',
          ...(thumbnailUrl ? { thumbnailUrl } : {}),
          createdAt: FirebaseFirestore.FieldValue.serverTimestamp(),
          updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
        });

        sendProgress(writer, 15, 'Extracting ZIP file...', 'processing');

        // Extract ZIP
        const tempDir = path.join(os.tmpdir(), `asset-process-${assetId}-${Date.now()}`);
        const zipLocalPath = path.join(tempDir, 'asset.zip');
        await fs.ensureDir(tempDir);
        await fs.writeFile(zipLocalPath, zipBuffer);

        const extractDir = path.join(tempDir, 'extracted');
        await fs.ensureDir(extractDir);

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
          sendProgress(writer, 20, 'Processing overlay files...', 'processing');
          
          const overlayFiles = await unzipFile(zipLocalPath, extractDir, OVERLAY_EXTENSIONS);
          results.filesProcessed = overlayFiles.length;

          const batch = adminDb.batch();
          let processed = 0;

          for (const overlayFile of overlayFiles) {
            try {
              let finalStoragePath = `assets/overlays/${packName}/${overlayFile.fileName}`;
              let previewStoragePath: string | undefined;
              let needsConversion = false;

              // Convert .mov to .mp4 if needed
              if (overlayFile.extension === '.mov') {
                const mp4Path = overlayFile.localPath.replace(/\.mov$/i, '.mp4');
                const converted = await convertMovToMp4(overlayFile.localPath, mp4Path);
                if (converted) {
                  finalStoragePath = finalStoragePath.replace(/\.mov$/i, '.mp4');
                  overlayFile.localPath = mp4Path;
                  overlayFile.fileName = overlayFile.fileName.replace(/\.mov$/i, '.mp4');
                  overlayFile.extension = '.mp4';
                  results.conversionsCompleted++;
                  needsConversion = true;
                } else {
                  results.errors.push(`Could not convert ${overlayFile.fileName} (ffmpeg not available)`);
                }
              }

              // Upload original/converted file
              const contentType = getContentType(overlayFile.extension);
              await uploadFile(bucket, overlayFile.localPath, finalStoragePath, contentType);

              // Generate 720p preview for videos
              if (['.mp4', '.mov'].includes(overlayFile.extension.toLowerCase())) {
                const previewPath = overlayFile.localPath.replace(/\.(mp4|mov)$/i, '_720p.mp4');
                const previewGenerated = await generate720pPreview(
                  needsConversion ? overlayFile.localPath : overlayFile.localPath,
                  previewPath
                );
                if (previewGenerated) {
                  previewStoragePath = finalStoragePath.replace(/\.(mp4|mov)$/i, '_720p.mp4');
                  await uploadFile(bucket, previewPath, previewStoragePath, 'video/mp4');
                  results.previewsGenerated++;
                }
              }

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
              sendProgress(writer, 20 + (processed / overlayFiles.length) * 60, `Processing overlay ${processed}/${overlayFiles.length}...`, 'processing');
            } catch (error: any) {
              results.errors.push(`Error processing ${overlayFile.fileName}: ${error.message}`);
            }
          }

          await batch.commit();
          results.documentsCreated = processed;

        } else if (category === 'SFX & Plugins') {
          sendProgress(writer, 20, 'Processing audio files...', 'processing');
          
          const audioFiles = await unzipFile(zipLocalPath, extractDir, AUDIO_EXTENSIONS);
          results.filesProcessed = audioFiles.length;

          const batch = adminDb.batch();
          let processed = 0;

          for (const audioFile of audioFiles) {
            try {
              const storagePath = `assets/sfx/${packName}/sounds/${audioFile.fileName}`;
              
              // Get duration
              const duration = await getAudioDuration(audioFile.localPath);
              if (duration > 0) {
                results.durationsExtracted++;
              }

              // Upload audio file
              const contentType = getContentType(audioFile.extension);
              await uploadFile(bucket, audioFile.localPath, storagePath, contentType);

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
              sendProgress(writer, 20 + (processed / audioFiles.length) * 60, `Processing audio ${processed}/${audioFiles.length}...`, 'processing');
            } catch (error: any) {
              results.errors.push(`Error processing ${audioFile.fileName}: ${error.message}`);
            }
          }

          await batch.commit();
          results.documentsCreated = processed;

        } else if (category === 'LUTs & Presets') {
          sendProgress(writer, 20, 'Processing LUT files...', 'processing');
          
          // Extract .cube files from CUBE folder in ZIP
          const cubeFiles: Array<{ fileName: string; localPath: string; extension: string; relativePath: string; lutName: string }> = [];
          
          // Extract .cube files preserving folder structure
          await new Promise<void>((resolve, reject) => {
            yauzl.open(zipLocalPath, { lazyEntries: true }, (err, zipfile) => {
              if (err) {
                reject(err);
                return;
              }

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

                // Look for .cube files in CUBE folder
                if (entry.fileName.toLowerCase().includes('/cube/') && entry.fileName.toLowerCase().endsWith('.cube')) {
                  const fileName = path.basename(entry.fileName);
                  const lutName = path.basename(fileName, '.cube');
                  const extractPath = path.join(extractDir, entry.fileName);

                  zipfile.openReadStream(entry, (err, readStream) => {
                    if (err) {
                      zipfile.readEntry();
                      return;
                    }

                    fs.ensureDirSync(path.dirname(extractPath));
                    const writeStream = fs.createWriteStream(extractPath);
                    readStream.pipe(writeStream);

                    writeStream.on('close', () => {
                      cubeFiles.push({
                        fileName,
                        localPath: extractPath,
                        extension: '.cube',
                        relativePath: entry.fileName,
                        lutName,
                      });
                      zipfile.readEntry();
                    });
                  });
                } else {
                  zipfile.readEntry();
                }
              });

              zipfile.on('end', () => resolve());
              zipfile.on('error', reject);
            });
          });

          results.filesProcessed = cubeFiles.length;

          // Find before/after videos in Storage (they should already be uploaded)
          const lutPreviews: Array<{ lutName: string; beforePath?: string; afterPath?: string; cubePath: string }> = [];

          for (const cubeFile of cubeFiles) {
            const cubeStoragePath = `assets/luts/${packName}/CUBE/${cubeFile.fileName}`;
            
            // Upload .cube file
            await uploadFile(bucket, cubeFile.localPath, cubeStoragePath, 'application/octet-stream');

            // Try to find matching videos (they should be in Storage already)
            const beforePath = `assets/luts/${packName}/${cubeFile.lutName}/before.mp4`;
            const afterPath = `assets/luts/${packName}/${cubeFile.lutName}/after.mp4`;

            let beforeExists = false;
            let afterExists = false;

            try {
              const [beforeFile] = await bucket.file(beforePath).exists();
              const [afterFile] = await bucket.file(afterPath).exists();
              beforeExists = beforeFile;
              afterExists = afterFile;
            } catch {}

            lutPreviews.push({
              lutName: cubeFile.lutName,
              beforePath: beforeExists ? beforePath : undefined,
              afterPath: afterExists ? afterPath : undefined,
              cubePath: cubeStoragePath,
            });
          }

          // Create LUT preview documents
          const batch = adminDb.batch();
          let processed = 0;

          for (const preview of lutPreviews) {
            const lutRef = adminDb.collection('assets').doc(assetId).collection('lutPreviews').doc();
            batch.set(lutRef, {
              assetId,
              assetTitle: title,
              lutName: preview.lutName,
              ...(preview.beforePath ? { beforeVideoPath: preview.beforePath } : {}),
              ...(preview.afterPath ? { afterVideoPath: preview.afterPath } : {}),
              lutFilePath: preview.cubePath,
              fileName: path.basename(preview.cubePath),
              createdAt: FirebaseFirestore.FieldValue.serverTimestamp(),
            });
            processed++;
          }

          await batch.commit();
          results.lutPreviewsCreated = processed;
          results.documentsCreated = processed;
        }

        // Cleanup
        await fs.remove(tempDir).catch(() => {});

        sendProgress(writer, 100, 'Processing complete!', 'completed');
        writer.write(encoder.encode(`data: ${JSON.stringify({ complete: true, results })}\n\n`));
        writer.close();
      } catch (error: any) {
        writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message || 'Processing failed' })}\n\n`));
        writer.close();
      }
    },
  });

      } catch (error: any) {
        writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message || 'Processing failed' })}\n\n`));
        writer.close();
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

