import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: './',
    server: {
        port: 5173,
        host: true
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        // 确保资源路径是相对的
        assetsInlineLimit: 0
    }
})
