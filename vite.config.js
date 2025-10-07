import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy Mangafire during local dev to avoid CORS and mixed-origin issues
      '/api/mf': {
        target: 'https://mangafire-xi.vercel.app',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/mf\/?/, '/'),
      },
    },
  },
});


