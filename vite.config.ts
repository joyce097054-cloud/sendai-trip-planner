import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode,process.cwd(),'VITE_')
  const key = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
  if (key) {
    let allowed = key.startsWith('sb_publishable_')
    if (!allowed && key.split('.').length===3) {
      try { allowed=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon' } catch { /* reject unknown keys */ }
    }
    if (!allowed) throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY 只能使用 publishable 或 legacy anon 公開金鑰；私人金鑰不得打包進前端。')
  }
  return { base: './', plugins: [react(), tailwindcss()] }
})
