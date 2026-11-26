// src/ui.js と src/worker.js を、Cloudflareへ単一ファイルで
// アップロードできる dist/index.js に束ねる（ビルド依存なし）。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ui = readFileSync(join(here, "src", "ui.js"), "utf-8").replace(/^export const HTML/m, "const HTML");
const worker = readFileSync(join(here, "src", "worker.js"), "utf-8")
  .replace(/^import \{ HTML \} from "\.\/ui\.js";$/m, "")
  .replace(/^export default/m, "const __worker =");
const bundle = ui + "\n" + worker + "\nexport default __worker;\n";
mkdirSync(join(here, "dist"), { recursive: true });
writeFileSync(join(here, "dist", "index.js"), bundle);
console.log("built dist/index.js", bundle.length, "bytes");
