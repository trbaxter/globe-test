import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => ({
  assetsInclude: ['**/*, .ktx2'],
  base: mode === 'production' ? '/globe-test/' : '/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }
}));
