import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'OrcaBilibiliCoverimgExtractPlugins',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['react', 'valtio'],
      output: {
        globals: {
          react: 'React',
          valtio: 'Valtio'
        },
        entryFileNames: 'index.js'
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
    // 确保输出符合 Orca 插件规范
    target: 'es2020',
    minify: false, // 保持代码可读性
    sourcemap: true
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
})