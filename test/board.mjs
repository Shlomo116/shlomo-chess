import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = 'http://127.0.0.1:4173/';
fs.mkdirSync('/tmp/shots2', { recursive: true });
const errors = [];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
p.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text().slice(0, 160)));

await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await p.screenshot({ path: '/tmp/shots2/lobby.png' });

// local two-player game
await p.locator('.mode-card').nth(2).click();
await p.waitForTimeout(300);
await p.locator('.modal .btn.primary').click();
await p.waitForTimeout(1200);

// verify board orientation: a1 must be left-bottom for white orientation
const geo = await p.evaluate(() => {
  const r = (s) => {
    const el = document.querySelector(`[data-square="${s}"]`);
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y) };
  };
  return { a1: r('a1'), h1: r('h1'), a8: r('a8'), h8: r('h8') };
});
console.log('geometry:', JSON.stringify(geo));
console.log('a1 left of h1 :', geo.a1.x < geo.h1.x, '| a1 below a8 :', geo.a1.y > geo.a8.y);

const click = async (s) => {
  await p.locator(`[data-square="${s}"]`).click({ force: true });
  await p.waitForTimeout(220);
};

// scholar-ish opening to test castling, capture, check, promotion path
const seq = [
  ['e2', 'e4'], ['e7', 'e5'],
  ['g1', 'f3'], ['b8', 'c6'],
  ['f1', 'c4'], ['g8', 'f6'],
  ['e1', 'g1'], // white castles short
  ['f8', 'c5'],
  ['f3', 'e5'], // capture
  ['c6', 'e5'], // recapture
];
for (const [a, b] of seq) {
  await click(a);
  await click(b);
}
await p.waitForTimeout(600);
await p.screenshot({ path: '/tmp/shots2/midgame.png' });
const moves = await p.locator('.move-cell').allInnerTexts();
console.log('moves:', JSON.stringify(moves));

// clocks running?
const c1 = await p.locator('.clock').allInnerTexts();
await p.waitForTimeout(1500);
const c2 = await p.locator('.clock').allInnerTexts();
console.log('clocks before/after:', JSON.stringify(c1), JSON.stringify(c2));

// browse back
await p.locator('.move-nav button').nth(1).click();
await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/shots2/browsing.png' });
console.log('browsing banner visible:', await p.locator('.browsing-banner').isVisible());
await p.locator('.move-nav button').nth(3).click();
await p.waitForTimeout(300);

// select a piece to view hints
await click('d2');
await p.waitForTimeout(300);
await p.screenshot({ path: '/tmp/shots2/hints.png' });

// resign -> result overlay
await p.locator('.btn.danger').click();
await p.waitForTimeout(900);
await p.screenshot({ path: '/tmp/shots2/result.png' });
console.log('result overlay:', await p.locator('.result-card h2').innerText());

// promotion flow in a fresh local game via engine-free fast path
await p.locator('.result-actions .btn').nth(2).click(); // back to lobby
await p.waitForTimeout(600);
await p.locator('.mode-card').nth(0).click();
await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/shots2/online-dialog.png' });
await p.locator('.side-tabs button').nth(1).click();
await p.waitForTimeout(300);
await p.screenshot({ path: '/tmp/shots2/join-dialog.png' });

console.log('\n--- ERRORS ---');
console.log(errors.length ? errors.slice(0, 15).join('\n') : 'none');
await browser.close();
