import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The Node service has a strict CSP (script-src 'unsafe-inline', no external origins)
// and ships zero runtime dependencies. Building to ONE self-contained HTML file keeps
// both true: React is inlined, nothing is fetched, and the server still serves a string.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist', assetsInlineLimit: 100000000, cssCodeSplit: false, reportCompressedSize: false }
});
