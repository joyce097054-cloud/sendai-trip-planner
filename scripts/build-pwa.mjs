import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..'), dist = resolve(root, 'dist')
async function walk(folder, prefix = '') {
  const result = []
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const name = prefix + entry.name
    if (entry.isDirectory()) result.push(...await walk(resolve(folder, entry.name), `${name}/`))
    else if (/\.(?:html|js|css|svg|png|jpe?g|webp|webmanifest|ttf|woff2)$/.test(name) && name !== 'sw.js') result.push(name)
  }
  return result
}
const assets = (await walk(dist)).sort()
if (!assets.includes('index.html') || !assets.includes('manifest.webmanifest') || !assets.includes('icons/apple-touch-icon.png')) throw new Error('PWA entry or icons missing.')
const digest = createHash('sha256')
const template = await readFile(resolve(root, 'scripts/service-worker.js'), 'utf8')
digest.update(template)
for (const asset of assets) digest.update(asset).update(await readFile(resolve(dist, asset)))
const version = digest.digest('hex').slice(0, 16)
await writeFile(resolve(dist, 'sw.js'), template.replace('__SENDAI_VERSION__', version).replace('__SENDAI_ASSETS__', JSON.stringify(assets)))
await writeFile(resolve(dist, 'pwa-build.json'), JSON.stringify({ app: 'sendai-trip-planner', version, assets }, null, 2) + '\n')
console.log(`PWA shell ${version}: ${assets.length} project assets; no API or private ledger data cached.`)
