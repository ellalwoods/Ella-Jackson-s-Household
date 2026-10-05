import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Relative base so the build works from any static host path (e.g. GitHub Pages /repo-name/).
export default defineConfig({
    base: './',
    plugins: [react()],
});
