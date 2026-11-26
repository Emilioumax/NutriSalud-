import { defineConfig } from 'vite';

export default defineConfig({
  // The repository path applies to github.io; the custom domain serves from its root.
  base: process.env.GITHUB_ACTIONS === 'true' && process.env.NUTRISALUD_CUSTOM_DOMAIN !== 'true'
    ? '/NutriSalud-/'
    : '/',
});
