const fs = require('fs')
const path = require('path')

const sharp = require('sharp')

const sourceIcon = path.join(__dirname, '../newicon.png')
const outputDir = path.join(__dirname, '../apps/reader/public/icons')

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

async function processIcons() {
  try {
    console.log('📦 Processing icons (Trimming & Resizing)...\n')

    // 1. Load the source image and TRIM transparent whitespace
    // This makes the icon content as large as possible
    const trimmedBuffer = await sharp(sourceIcon)
      .trim() // Removes transparent border
      .toBuffer()

    // 2. Generate 192x192 (Standard)
    // fit: 'contain' ensures it fits within the box.
    // background: transparent
    await sharp(trimmedBuffer)
      .resize({
        width: 192,
        height: 192,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(outputDir, '192.png'))
    console.log('✅ Created 192.png (Maximized)')

    // 3. Generate 512x512 (Standard)
    await sharp(trimmedBuffer)
      .resize({
        width: 512,
        height: 512,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(outputDir, '512.png'))
    console.log('✅ Created 512.png (Maximized)')

    // 4. Generate Maskable icons (Need some padding, ~10%)
    // Maskable icons are cropped by the OS, so we need a "safe zone"
    await sharp(trimmedBuffer)
      .resize({
        width: 154, // ~80% of 192
        height: 154,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: 19,
        bottom: 19,
        left: 19,
        right: 19,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(outputDir, 'maskable-192.png'))
    console.log('✅ Created maskable-192.png')

    await sharp(trimmedBuffer)
      .resize({
        width: 410, // ~80% of 512
        height: 410,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: 51,
        bottom: 51,
        left: 51,
        right: 51,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(outputDir, 'maskable-512.png'))
    console.log('✅ Created maskable-512.png')

    console.log('\n🎉 Icons resized and maximized successfully!')
  } catch (error) {
    console.error('❌ Error processing icons:', error)
  }
}

processIcons()
