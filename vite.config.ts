
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel 部署在根目录，不需要 base 配置 (或者设为 '/')
  // base: '/WW1-Skies/', 
  build: {
    outDir: 'dist',
  }
})
