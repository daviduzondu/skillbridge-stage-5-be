import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/main.ts",
  format: "cjs",
  outDir: "./dist",
  clean: true,
  unbundle: true,
  failOnWarn: true,
});
