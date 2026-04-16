import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        timeout: 60000, // 增加到 60s
        proxyTimeout: 60000,
        // 增加一些稳定性配置，防止某些环境下的重试行为
        xfwd: true,
      },
      '/public': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      }
    }
  }
})
