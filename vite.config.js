import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // 確保在 GitHub Pages 子路徑下能正確讀取 assets
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
