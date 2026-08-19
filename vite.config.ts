import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

function apiProxy(target: string): Record<string, ProxyOptions> {
  return {
    '/api': {
      target,
      changeOrigin: true,
      // Forward Set-Cookie / Cookie for httpOnly refresh tokens (path=/api/auth)
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq, req) => {
          if (req.headers.cookie) proxyReq.setHeader('cookie', req.headers.cookie);
        });
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname), '');
  const backendOrigin = (env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:3001').replace(/\/+$/, '');

  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist'),
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: apiProxy(backendOrigin),
    },
    preview: {
      port: 5173,
      host: '0.0.0.0',
      proxy: apiProxy(backendOrigin),
    },
  };
});
