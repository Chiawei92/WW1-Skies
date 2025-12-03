
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 使用相对路径 './'，这样构建出来的 index.html 可以同时在 Vercel (根目录) 和 GitHub Pages (子目录) 运行
  base: './', 
  build: {
    outDir: 'dist',
  }
})
