import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

async function generateIcons() {
  const iconSvgPath = resolve('public/icon.svg')
  const maskableSvgPath = resolve('public/icon-maskable.svg')

  const iconSvg = readFileSync(iconSvgPath)
  const maskableSvg = readFileSync(maskableSvgPath)

  console.log('Rendering icons from SVG...')

  // 1. icon-512.png (512x512)
  await sharp(iconSvg)
    .resize(512, 512)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(resolve('public/icon-512.png'))
  console.log('Generated public/icon-512.png')

  // 2. icon-maskable-512.png (512x512 maskable)
  await sharp(maskableSvg)
    .resize(512, 512)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(resolve('public/icon-maskable-512.png'))
  console.log('Generated public/icon-maskable-512.png')

  // 3. icon-192.png (192x192)
  await sharp(iconSvg)
    .resize(192, 192)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(resolve('public/icon-192.png'))
  console.log('Generated public/icon-192.png')

  // 4. icon-maskable-192.png (192x192 maskable)
  await sharp(maskableSvg)
    .resize(192, 192)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(resolve('public/icon-maskable-192.png'))
  console.log('Generated public/icon-maskable-192.png')

  // 5. apple-touch-icon.png (180x180)
  await sharp(iconSvg)
    .resize(180, 180)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(resolve('public/apple-touch-icon.png'))
  console.log('Generated public/apple-touch-icon.png')

  // 6. favicon.png (64x64)
  await sharp(iconSvg)
    .resize(64, 64)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(resolve('public/favicon.png'))
  console.log('Generated public/favicon.png')

  console.log('All icons successfully generated!')
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err)
  process.exit(1)
})
