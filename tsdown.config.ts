import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/main.ts", "./src/database/**/*.ts"],
  format: "esm",
  outDir: "./dist",
  clean: true,
  unbundle: true,
});
