import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', 'node:sqlite', ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
    },
  },
});
