#!/usr/bin/env node
/*
  Replace "OVERLAY" text with "Creator Collective" on product box images

  Usage:
    node scripts/replace-overlay-text.js [input-directory] [output-directory] [--overwrite]

  Examples:
    # Process images and save to new directory
    node scripts/replace-overlay-text.js ./downloaded-images ./modified-images
    
    # Overwrite original images (be careful!)
    node scripts/replace-overlay-text.js ./downloaded-images ./downloaded-images --overwrite
*/

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function replaceOverlayText(inputPath, outputPath, overwrite = false) {
  const stats = fs.statSync(inputPath);
  
  if (stats.isFile()) {
    // Process single file
    console.log(`Processing: ${path.basename(inputPath)}\n`);
    await processImage(inputPath, outputPath);
    console.log(`✓ Successfully processed: ${path.basename(outputPath)}`);
    console.log(`\nOutput saved to: ${path.resolve(outputPath)}`);
    return;
  }
  
  // Process directory
  const files = fs.readdirSync(inputPath);
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
  
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext);
  });
  
  console.log(`Found ${imageFiles.length} image(s) to process\n`);
  
  // Create output directory if it doesn't exist and not overwriting
  if (!overwrite && !fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  let processed = 0;
  let failed = 0;
  
  for (const file of imageFiles) {
    const inputFile = path.join(inputPath, file);
    const outputFile = overwrite ? inputFile : path.join(outputPath, file);
    
    try {
      await processImage(inputFile, outputFile);
      console.log(`[${processed + failed + 1}/${imageFiles.length}] ✓ ${file}`);
      processed++;
    } catch (error) {
      console.error(`[${processed + failed + 1}/${imageFiles.length}] ✗ ${file}`);
      console.error(`  Error: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`\nImages saved to: ${path.resolve(outputPath)}`);
}

async function processImage(inputPath, outputPath) {
  // Get image metadata
  const metadata = await sharp(inputPath).metadata();
  const { width, height } = metadata;
  
  // Define the perspective quadrilateral for the top edge of the 3D box
  // These coordinates define the 4 corners of the top edge (in order: top-left, top-right, bottom-right, bottom-left)
  // Adjust these percentages based on your specific box perspective
  const topLeft = {
    x: width * 0.15,    // Left edge starts at 15% from left
    y: height * 0.05    // Top edge at 5% from top
  };
  const topRight = {
    x: width * 0.85,     // Right edge at 85% from left
    y: height * 0.08     // Slightly lower on right (perspective)
  };
  const bottomRight = {
    x: width * 0.88,     // Bottom right corner
    y: height * 0.15     // Further down on right
  };
  const bottomLeft = {
    x: width * 0.12,     // Bottom left corner
    y: height * 0.12     // Further down on left
  };
  
  // Calculate center point of the quadrilateral for text positioning
  const centerX = (topLeft.x + topRight.x + bottomRight.x + bottomLeft.x) / 4;
  const centerY = (topLeft.y + topRight.y + bottomRight.y + bottomLeft.y) / 4;
  
  // Calculate dimensions for text sizing
  const topWidth = topRight.x - topLeft.x;
  const bottomWidth = bottomRight.x - bottomLeft.x;
  const leftHeight = bottomLeft.y - topLeft.y;
  const rightHeight = bottomRight.y - topRight.y;
  const avgWidth = (topWidth + bottomWidth) / 2;
  const avgHeight = (leftHeight + rightHeight) / 2;
  const fontSize = Math.min(avgWidth * 0.12, avgHeight * 0.6);
  
  // Calculate the angle of the top edge
  const topAngleRad = Math.atan2(topRight.y - topLeft.y, topRight.x - topLeft.x);
  const topAngleDeg = (topAngleRad * 180) / Math.PI;
  
  // Calculate the angle of the left edge
  const leftAngleRad = Math.atan2(bottomLeft.y - topLeft.y, bottomLeft.x - topLeft.x);
  const leftAngleDeg = (leftAngleRad * 180) / Math.PI;
  
  // Calculate skew based on perspective
  // Horizontal skew (shear X) - difference between top and bottom
  const horizontalSkew = Math.atan((bottomWidth - topWidth) / avgHeight) * (180 / Math.PI);
  
  // Vertical skew (shear Y) - difference between left and right edges
  const verticalSkew = Math.atan((rightHeight - leftHeight) / avgWidth) * (180 / Math.PI);
  
  // Calculate scale to fit the quadrilateral
  const scaleX = topWidth / avgWidth;
  const scaleY = leftHeight / avgHeight;
  
  // Build transform string with proper order: translate to origin, rotate, skew, scale, translate back
  const transform = `
    translate(${centerX}, ${centerY})
    rotate(${topAngleDeg})
    skewX(${horizontalSkew})
    skewY(${verticalSkew})
    scale(${scaleX}, ${scaleY})
    translate(${-centerX}, ${-centerY})
  `.replace(/\s+/g, ' ').trim();
  
  // Create SVG with black polygon and perspective-distorted text
  const svgWithPerspective = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="textClip">
          <polygon 
            points="${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}" 
          />
        </clipPath>
      </defs>
      <!-- Black polygon covering the OVERLAY area with perspective -->
      <polygon 
        points="${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}" 
        fill="black"
      />
      <!-- Creator Collective text with perspective transform -->
      <g clip-path="url(#textClip)">
        <text 
          x="${centerX}" 
          y="${centerY}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-size="${fontSize}" 
          font-weight="bold" 
          fill="white" 
          text-anchor="middle"
          dominant-baseline="middle"
          transform="${transform}"
        >Creator Collective</text>
      </g>
    </svg>
  `;
  
  // Composite the SVG onto the image
  await sharp(inputPath)
    .composite([
      {
        input: Buffer.from(svgWithPerspective),
        top: 0,
        left: 0
      }
    ])
    .toFile(outputPath);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node scripts/replace-overlay-text.js [input-directory] [output-directory] [--overwrite]');
    console.error('\nExamples:');
    console.error('  # Process images and save to new directory');
    console.error('  node scripts/replace-overlay-text.js ./downloaded-images ./modified-images');
    console.error('\n  # Overwrite original images');
    console.error('  node scripts/replace-overlay-text.js ./downloaded-images ./downloaded-images --overwrite');
    process.exit(1);
  }
  
  const inputPath = args[0];
  const outputPath = args[1] || inputPath;
  const overwrite = args.includes('--overwrite');
  
  // Validate input path
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input path does not exist: ${inputPath}`);
    process.exit(1);
  }
  
  // Warn if overwriting
  if (overwrite) {
    console.warn('⚠️  WARNING: Overwrite mode enabled. Original images will be modified!');
    console.warn('   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  try {
    await replaceOverlayText(inputPath, outputPath, overwrite);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

