import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

// Serve the production output only at the repository subpath. A Vite dev server
// would mask root-relative asset bugs and SPA fallback errors on GitHub Pages.
const root = resolve(import.meta.dirname, '../dist')
const prefix = '/sendai-trip-planner/'
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' }
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405).end(); return }
  let pathname
  try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1:4180').pathname) } catch { response.writeHead(400).end(); return }
  if (pathname === prefix.slice(0, -1)) { response.writeHead(308, { Location: prefix }).end(); return }
  if (!pathname.startsWith(prefix) || pathname.includes('\0')) { response.writeHead(404).end('Not found'); return }
  const file = resolve(root, pathname.slice(prefix.length) || 'index.html')
  if (!file.startsWith(root + sep)) { response.writeHead(404).end('Not found'); return }
  try {
    const content = await readFile(file)
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(request.method === 'HEAD' ? undefined : content)
  } catch { response.writeHead(404).end('Not found') }
})
server.on('error', error => { console.error(error); process.exitCode = 1 })
server.listen(4180, '127.0.0.1', () => console.log('Production Pages test: http://127.0.0.1:4180/sendai-trip-planner/'))
