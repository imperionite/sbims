import * as esbuild from "esbuild";
import { denoPlugin } from "@deno/esbuild-plugin";

await esbuild.build({
  entryPoints: ["src/worker.ts"],
  outfile: "dist/server.js",
  format: "esm",
  bundle: true,
  minify: false,
  treeShaking: true,
  keepNames: true,
  target: "es2022",
  plugins: [denoPlugin()],
});

await esbuild.stop();
