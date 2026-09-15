import sharp from 'sharp'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

async function generateAllIcons() {
  const iconSvgPath = resolve('public/icon.svg')
  const maskableSvgPath = resolve('public/icon-maskable.svg')

  const iconSvg = readFileSync(iconSvgPath)
  const maskableSvg = readFileSync(maskableSvgPath)

  console.log('1. Generating Web PWA icons...')
  await sharp(iconSvg).resize(512, 512).png({ quality: 100 }).toFile(resolve('public/icon-512.png'))
  await sharp(maskableSvg).resize(512, 512).png({ quality: 100 }).toFile(resolve('public/icon-maskable-512.png'))
  await sharp(iconSvg).resize(192, 192).png({ quality: 100 }).toFile(resolve('public/icon-192.png'))
  await sharp(maskableSvg).resize(192, 192).png({ quality: 100 }).toFile(resolve('public/icon-maskable-192.png'))
  await sharp(iconSvg).resize(180, 180).png({ quality: 100 }).toFile(resolve('public/apple-touch-icon.png'))
  await sharp(iconSvg).resize(64, 64).png({ quality: 100 }).toFile(resolve('public/favicon.png'))

  console.log('2. Generating Android mipmap icons...')
  const densities = [
    { name: 'mipmap-mdpi', launcherSize: 48, fgSize: 108 },
    { name: 'mipmap-hdpi', launcherSize: 72, fgSize: 162 },
    { name: 'mipmap-xhdpi', launcherSize: 96, fgSize: 216 },
    { name: 'mipmap-xxhdpi', launcherSize: 144, fgSize: 324 },
    { name: 'mipmap-xxxhdpi', launcherSize: 192, fgSize: 432 },
  ]

  for (const d of densities) {
    const dir = resolve(`android/app/src/main/res/${d.name}`)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // Full launcher icon
    await sharp(iconSvg)
      .resize(d.launcherSize, d.launcherSize)
      .png({ quality: 100 })
      .toFile(resolve(`${dir}/ic_launcher.png`))

    // Round launcher icon
    await sharp(iconSvg)
      .resize(d.launcherSize, d.launcherSize)
      .png({ quality: 100 })
      .toFile(resolve(`${dir}/ic_launcher_round.png`))

    // Foreground icon for adaptive icon
    await sharp(maskableSvg)
      .resize(d.fgSize, d.fgSize)
      .png({ quality: 100 })
      .toFile(resolve(`${dir}/ic_launcher_foreground.png`))

    console.log(`Generated Android icons for ${d.name}`)
  }

  // Also generate clean splash image if needed
  const splashDir = resolve('android/app/src/main/res/drawable')
  if (existsSync(splashDir)) {
    await sharp(iconSvg)
      .resize(480, 480)
      .png({ quality: 100 })
      .toFile(resolve(`${splashDir}/splash.png`))
    console.log('Updated android/app/src/main/res/drawable/splash.png')
  }

  console.log('All icons generated successfully!')
}

generateAllIcons().catch((err) => {
  console.error(err)
  process.exit(1)
})
