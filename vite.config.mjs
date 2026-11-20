import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves project sites from /<repository>/; Vercel/local use the domain root.
  base: process.env.GITHUB_ACTIONS === 'true' ? '/NutriSalud-/' : '/',
});