import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // Isse Netlify ke saare variables load ho jayenge
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react(), tailwindcss()],
    base: '/',
    define: {
      // Ye line zaroori hai taaki Gemini aur Firebase dono chalein
      'process.env': env,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        // Express backend ko build se bahar rakhne ke liye
        external: ['express'],
      },
    },
  };
});
