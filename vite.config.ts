import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base 设为仓库名，GitHub Pages 部署在 用户名.github.io/starrest-poc/
export default defineConfig({
  plugins: [react()],
  base: '/starrest-poc/',
  server: { host: true },
})
