// scripts/generate-404.ts
import { copyFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
var __dirname = dirname(fileURLToPath(import.meta.url));
var dist = join(process.cwd(), "dist");
var indexHtml = join(dist, "index.html");
var notFoundHtml = join(dist, "404.html");
if (existsSync(indexHtml)) {
  copyFileSync(indexHtml, notFoundHtml);
  console.log("Created dist/404.html for SPA fallback");
} else {
  console.warn("dist/index.html not found \u2014 skipping 404.html generation");
}
