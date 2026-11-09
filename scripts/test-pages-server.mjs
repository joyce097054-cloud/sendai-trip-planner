import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

// Serve the production output only at the repository subpath. A Vite dev server
// would mask root-relative asset bugs and SPA fallback errors on GitHub Pages.
const root = resolve(import.meta.dirname, '../dist')
const prefix = '/sendai-trip-planner/'
const port = Number(process.env.SENDAI_TEST_PORT ?? 4180)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid test port')
// Local PWA tests can simulate a new worker or a failed asset download. These
// controls are disabled for normal Pages tests and never enter the site build.
const pwaTest = process.env.SENDAI_PWA_TEST === '1'
let workerRevision = '', blockedAsset = ''
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' }
const server = createServer(async (request, response) => {
  let pathname, url
  try { url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`); pathname = decodeURIComponent(url.pathname) } catch { response.writeHead(400).end(); return }
  if (pwaTest && pathname === '/__pwa-test__/control' && request.method === 'POST') {
    const revision = url.searchParams.get('revision') ?? '', blocked = url.searchParams.get('blocked') ?? ''
    if ((revision && !/^[a-f0-9]{16}$/.test(revision)) || (blocked && !/^[a-zA-Z0-9_./-]+$/.test(blocked))) { response.writeHead(400).end(); return }
    workerRevision = revision; blockedAsset = blocked
    response.writeHead(204).end(); return
  }
  if (!['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405).end(); return }
  if (pwaTest && pathname === prefix + 'private-ledger.json') { response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end('{"testOnly":"private-response-never-cache"}'); return }
  if (pathname === prefix.slice(0, -1)) { response.writeHead(308, { Location: prefix }).end(); return }
  if (!pathname.startsWith(prefix) || pathname.includes('\0')) { response.writeHead(404).end('Not found'); return }
  if (pwaTest && blockedAsset && pathname === prefix + blockedAsset) { response.writeHead(503).end('Simulated PWA asset failure'); return }
  const file = resolve(root, pathname.slice(prefix.length) || 'index.html')
  if (!file.startsWith(root + sep)) { response.writeHead(404).end('Not found'); return }
  try {
    let content = await readFile(file)
    if (pwaTest && workerRevision && pathname === prefix + 'sw.js') content = Buffer.from(content.toString().replace(/const VERSION = '[a-f0-9]{16}'/, `const VERSION = '${workerRevision}'`))
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(request.method === 'HEAD' ? undefined : content)
  } catch { response.writeHead(404).end('Not found') }
})
server.on('error', error => { console.error(error); process.exitCode = 1 })
server.listen(port, '127.0.0.1', () => console.log(`Production Pages test: http://127.0.0.1:${port}/sendai-trip-planner/`))
