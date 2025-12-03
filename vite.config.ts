import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 关键配置：必须与你的 GitHub 仓库名一致，否则资源加载会 404
  base: '/WW1-Skies/', 
  build: {
    outDir: 'dist',
  }
})