import * as esbuild from "esbuild";
import { denoPlugin } from "@deno/esbuild-plugin";

await esbuild.build({
  entryPoints: ["src/worker.ts"],
  outfile: "dist/worker.js",
  format: "esm",
  bundle: true,
  minify: true,
  treeShaking: true,
  keepNames: true,
  platform: "neutral",
  target: "esnext",
  plugins: [denoPlugin()],
});

await esbuild.stop();
