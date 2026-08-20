import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = 'http://127.0.0.1:4173/';
const shot = (n) => `/tmp/shots/${n}.png`;
fs.mkdirSync('/tmp/shots', { recursive: true });

const errors = [];

async function newPage(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${label}] console: ${m.text().slice(0, 200)}`);
  });
  return page;
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream'],
});

// ---------------------------------------------------------------- LOBBY
const p = await newPage(browser, 'lobby');
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
await p.screenshot({ path: shot('1-lobby') });
console.log('lobby title:', await p.title());
console.log('hero:', (await p.locator('.hero h1').innerText()).replace(/\n/g, ' '));

// ------------------------------------------------------------- VS COMPUTER
await p.locator('.mode-card').nth(1).click();
await p.waitForTimeout(400);
await p.screenshot({ path: shot('2-computer-dialog') });
await p.locator('.modal .btn.primary').click();
await p.waitForTimeout(2500);
await p.screenshot({ path: shot('3-game') });

// play e4 by clicking squares
const clickSquare = async (page, sq) => {
  await page.locator(`[data-square="${sq}"]`).click({ force: true });
  await page.waitForTimeout(120);
};
await clickSquare(p, 'e2');
await p.waitForTimeout(200);
await p.screenshot({ path: shot('4-selected') });
await clickSquare(p, 'e4');
await p.waitForTimeout(4000);
await p.screenshot({ path: shot('5-after-engine') });
const moves = await p.locator('.move-cell').allInnerTexts();
console.log('moves after engine reply:', JSON.stringify(moves));

// -------------------------------------------------------------- ONLINE P2P
const host = await newPage(browser, 'host');
await host.goto(URL, { waitUntil: 'networkidle' });
await host.locator('.mode-card').nth(0).click();
await host.waitForTimeout(300);
await host.locator('.modal .btn.primary').click();
console.log('waiting for room code...');
let code = null;
try {
  await host.waitForSelector('.room-code .ch', { timeout: 30000 });
  code = (await host.locator('.room-code .ch').allInnerTexts()).join('');
  console.log('ROOM CODE:', code);
  await host.screenshot({ path: shot('6-waiting-room') });
} catch {
  console.log('!! could not create room (signalling server unreachable?)');
  await host.screenshot({ path: shot('6-waiting-fail') });
}

if (code) {
  const guest = await newPage(browser, 'guest');
  await guest.goto(`${URL}?room=${code}`, { waitUntil: 'networkidle' });
  await guest.waitForTimeout(800);
  await guest.screenshot({ path: shot('7-guest-join-dialog') });
  await guest.locator('.modal .btn.primary').click();
  try {
    await guest.waitForSelector('.board-frame', { timeout: 40000 });
    await host.waitForSelector('.board-frame', { timeout: 40000 });
    console.log('P2P CONNECTED — both in game');
    await host.waitForTimeout(1500);
    await host.screenshot({ path: shot('8-host-game') });
    await guest.screenshot({ path: shot('9-guest-game') });

    // figure out who is white
    const hostIsWhite = (await host.locator('.player-bar').last().locator('.avatar').getAttribute('class')).includes('w');
    const mover = hostIsWhite ? host : guest;
    const watcher = hostIsWhite ? guest : host;
    await clickSquare(mover, 'd2');
    await clickSquare(mover, 'd4');
    await watcher.waitForTimeout(2500);
    const remoteMoves = await watcher.locator('.move-cell').allInnerTexts();
    console.log('moves seen by opponent:', JSON.stringify(remoteMoves));
    await watcher.screenshot({ path: shot('10-remote-move') });

    // chat
    await mover.locator('.side-tabs button').nth(1).click();
    await mover.locator('.chat-input .field').fill('שלום מהצד השני');
    await mover.locator('.chat-send').click();
    await watcher.waitForTimeout(1200);
    await watcher.locator('.side-tabs button').nth(1).click();
    await watcher.waitForTimeout(400);
    const bubbles = await watcher.locator('.bubble').allInnerTexts();
    console.log('chat received:', JSON.stringify(bubbles));
    await watcher.screenshot({ path: shot('11-chat') });
  } catch (e) {
    console.log('!! P2P handshake failed:', e.message.slice(0, 150));
    await host.screenshot({ path: shot('8-host-fail') });
    await guest.screenshot({ path: shot('9-guest-fail') });
  }
}

// mobile view
const m = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2 });
const mp = await m.newPage();
await mp.goto(URL, { waitUntil: 'networkidle' });
await mp.waitForTimeout(600);
await mp.screenshot({ path: shot('12-mobile-lobby'), fullPage: true });
await mp.locator('.mode-card').nth(2).click();
await mp.waitForTimeout(300);
await mp.locator('.modal .btn.primary').click();
await mp.waitForTimeout(1200);
await mp.screenshot({ path: shot('13-mobile-game'), fullPage: true });

console.log('\n--- ERRORS ---');
console.log(errors.length ? errors.slice(0, 25).join('\n') : 'none');
await browser.close();
