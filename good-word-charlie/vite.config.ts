import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works from a sub-folder of the household site's GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
});
