/**
 * מעתיק את קבצי Stockfish מ-node_modules אל public/engine
 * כדי שלא נצטרך לשמור בינאריים של 3.7MB בתוך הריפו.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'stockfish', 'src');
const dest = join(root, 'public', 'engine');

mkdirSync(dest, { recursive: true });

for (const file of ['stockfish.js', 'stockfish.wasm']) {
  const from = join(src, file);
  if (!existsSync(from)) {
    console.error(`[copy-engine] חסר: ${from} — הריצו npm install`);
    process.exit(1);
  }
  copyFileSync(from, join(dest, file));
  console.log(`[copy-engine] ${file} הועתק ל-public/engine`);
}
