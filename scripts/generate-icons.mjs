import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (!existsSync(chromium.executablePath()) && existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
const browser = await chromium.launch({ executablePath })
try {
  const page = await browser.newPage()
  const svg = await readFile(resolve(root, 'public/icons/journal.svg'), 'utf8')
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const base64 = await page.evaluate(async ({ src, size }) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      canvas.getContext('2d').drawImage(img, 0, 0, size, size)
      return canvas.toDataURL('image/png').split(',')[1]
    }, { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, size })
    await writeFile(resolve(root, 'public/icons', name), Buffer.from(base64, 'base64'))
  }
  console.log('Generated 192px, 512px, maskable and Apple touch icons from the project SVG.')
} finally { await browser.close() }
