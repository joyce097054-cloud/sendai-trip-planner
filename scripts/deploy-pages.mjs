import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const prepareOnly = process.argv.includes('--prepare-only')
const publish = process.argv.includes('--publish')
if ((!prepareOnly && !publish) || (prepareOnly && publish)) throw new Error('Use npm run prepare:pages to prepare only. Publishing requires npm run deploy:pages -- --publish after review.')
function run(program, args, options = {}) {
  const result = spawnSync(program, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${program} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

const sourceCommit = run('git', ['rev-parse', 'HEAD'])
const sourceDirty = Boolean(run('git', ['status', '--porcelain']))
if (!prepareOnly && sourceDirty) throw new Error('Commit source changes before publishing, so the deployed source is reviewable.')
const settings = loadEnv('production', root, 'VITE_')
const publicUrl = (process.env.VITE_SUPABASE_URL ?? settings.VITE_SUPABASE_URL ?? '').trim()
const publicKey = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? settings.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
let ledgerClientConfigured = false
try {
  const url = new URL(publicUrl)
  ledgerClientConfigured = Boolean(publicKey) && url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password
} catch { /* Report only readiness, never credential values. */ }
if (publish && !ledgerClientConfigured) throw new Error('Production ledger client settings are missing or invalid. Set VITE_SUPABASE_URL to the HTTPS project root and use the public publishable key before publishing.')
let previous = ''
if (!prepareOnly) {
  const remote = run('git', ['ls-remote', 'origin', 'refs/heads/gh-pages'])
  if (remote) {
    const match = remote.match(/^([a-f0-9]{40,64})\s+refs\/heads\/gh-pages$/)
    if (!match) throw new Error('Cannot establish the existing Pages branch; nothing was changed.')
    previous = match[1]
    run('git', ['fetch', 'origin', 'refs/heads/gh-pages'])
    const marker = JSON.parse(run('git', ['show', `${previous}:deployment.json`]))
    if (marker.app !== 'sendai-trip-planner') throw new Error('The existing Pages branch is not owned by this app; refusing to replace it.')
  }
}
console.log(process.platform === 'win32' ? run('cmd.exe', ['/d', '/s', '/c', 'npm run build']) : run('npm', ['run', 'build']))
await writeFile(resolve(dist, '.nojekyll'), '')
const pwa = JSON.parse(await readFile(resolve(dist, 'pwa-build.json'), 'utf8'))
await writeFile(resolve(dist, 'deployment.json'), JSON.stringify({ app: 'sendai-trip-planner', sourceCommit, sourceDirty, pwaVersion: pwa.version, ledgerClientConfigured, builtAt: new Date().toISOString() }, null, 2))
if (prepareOnly) {
  console.log('Pages artifact prepared in dist/. No branch was pushed and no website was enabled.')
} else {
  const temporary = await mkdtemp(resolve(tmpdir(), 'sendai-pages-'))
  try {
    // Separate index and work-tree: publishing never resets the source checkout.
    const env = { ...process.env, GIT_INDEX_FILE: resolve(temporary, 'index') }
    const gitDir = run('git', ['rev-parse', '--absolute-git-dir'])
    run('git', [`--git-dir=${gitDir}`, `--work-tree=${dist}`, 'add', '--all', '.'], { cwd: dist, env })
    const tree = run('git', ['write-tree'], { env })
    const parent = previous ? ['-p', previous] : []
    const commit = run('git', ['commit-tree', tree, ...parent, '-m', `Deploy travel app from ${sourceCommit.slice(0, 7)}`])
    console.log(run('git', ['push', 'origin', `${commit}:refs/heads/gh-pages`]))
    console.log(`Published artifact to gh-pages (${commit.slice(0, 7)}).`)
    console.log('First-time setup: GitHub repository Settings > Pages > Deploy from a branch > gh-pages / (root) > Save.')
    console.log('Uploading a branch does not prove Pages is enabled. Verify the resulting HTTPS site before sharing it.')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}
