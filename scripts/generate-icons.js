const fs = require('fs')
const path = require('path')

const sharp = require('sharp')

const sourceIcon = path.join(__dirname, '../apps/reader/public/icons/512.png')
const destDir = path.join(__dirname, '../apps/reader/public/icons')

const sizes = [16, 48, 128]

async function generateIcons() {
  if (!fs.existsSync(sourceIcon)) {
    console.error('Source icon not found:', sourceIcon)
    process.exit(1)
  }

  for (const size of sizes) {
    const destPath = path.join(destDir, `icon-${size}.png`)
    console.log(`Generating ${size}x${size} icon...`)
    await sharp(sourceIcon).resize(size, size).toFile(destPath)
  }
  console.log('Icons generated successfully!')
}

generateIcons()
