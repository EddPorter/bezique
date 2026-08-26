import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves a project site from https://<user>.github.io/bezique/, not the domain
// root, so production asset URLs need that path prefix. Dev stays at '/' so `npm run dev`
// is unaffected.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/bezique/' : '/',
  plugins: [react()],
}));
