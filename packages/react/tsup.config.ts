import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./index.ts"], // Your entry file
  format: ["cjs", "esm"], // CommonJS format
  outDir: "dist",
  sourcemap: true, // Enable source maps for debugging
  clean: true, // Clean the output directory before building
  external: ["react", "react-dom"], // Keep React and ReactDOM as external
  dts: true, // Generate .d.ts files
  noExternal: [
    "@convoform/websocket-client",
    "@convoform/db",
    "@convoform/common",
  ],
  minify: true,
  treeshake: true,
  splitting: false,
});
