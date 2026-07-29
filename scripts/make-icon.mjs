// Generate app icons from resources/source-icon.png (the 秘書 hanko stamp).
// Source is 3:4, so fit-and-pad onto a square tile coloured to match the paper
// (sampled from a corner pixel) — shows the whole stamp with no cropping.
// Outputs: resources/app.ico (multi-res), resources/icon.png (256, tray/notify),
// and src/renderer/assets/hisho.png (128, sidebar brand).
import Jimp from 'jimp'
import pngToIco from 'png-to-ico'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'resources', 'source-icon.png')

const master = await Jimp.read(src)
const bg = master.getPixelColor(3, 3) // paper colour from a corner

async function square(size, out) {
  const canvas = new Jimp(size, size, bg)
  const img = master.clone().contain(size, size)
  canvas.composite(img, 0, 0)
  await canvas.writeAsync(out)
  return out
}

const icon256 = await square(256, join(root, 'resources', 'icon.png'))

mkdirSync(join(root, 'src', 'renderer', 'assets'), { recursive: true })
await square(128, join(root, 'src', 'renderer', 'assets', 'hisho.png'))

// Multi-resolution .ico so Windows has crisp frames at every size
// (taskbar 16/24/32, shortcuts 48, tiles 256) instead of downscaling one 256.
const tmp = join(root, 'resources', '.ico-tmp')
mkdirSync(tmp, { recursive: true })
const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoFrames = []
for (const s of icoSizes) icoFrames.push(await square(s, join(tmp, `${s}.png`)))
const ico = await pngToIco(icoFrames)
writeFileSync(join(root, 'resources', 'app.ico'), ico)
rmSync(tmp, { recursive: true, force: true })

console.log('wrote resources/app.ico, resources/icon.png, src/renderer/assets/hisho.png')
