import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  plugins: [
    react(),
    // 自定义插件：复制CSS文件到dist目录
    {
      name: 'copy-css-files',
      writeBundle() {
        const srcCssPath = 'src/styles/bilibili-link.css'
        const distCssPath = 'dist/styles/bilibili-link.css'
        
        if (existsSync(srcCssPath)) {
          // 确保dist/styles目录存在
          mkdirSync('dist/styles', { recursive: true })
          // 复制CSS文件
          copyFileSync(srcCssPath, distCssPath)
          console.log(`✓ Copied ${srcCssPath} to ${distCssPath}`)
        }
      }
    }
  ],
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
    sourcemap: false // Orca插件不需要sourcemap
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
})