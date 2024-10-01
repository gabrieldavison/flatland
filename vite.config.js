// vite.config.js
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: "esnext",
    cssCodeSplit: false,
    brotliSize: false,
    minify: false, // Disable minification
  },
});
