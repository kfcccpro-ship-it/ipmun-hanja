// Real DOM, pointer, canvas, storage and navigation regression. Only the external
// stroke animation and speech APIs are stubbed; no microphone input is requested.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const name = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end(); return;
  }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
  fs.createReadStream(file).pipe(res);
});

async function draw(page, canvas, y) {
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert(box, 'active canvas must be visible');
  await page.mouse.move(box.x + 55, box.y + y);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + y, { steps: 5 });
  await page.mouse.up();
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 850 }, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.addInitScript(() => {
    // The animation provider is external; keep real app transitions and timers.
    window.HanziWriter = { create: () => ({ hideCharacter() {}, animateCharacter(o) { setTimeout(() => o?.onComplete?.(), 10) }, animateStroke() {} }) };
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: undefined });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: undefined });
  });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const fixture = await page.evaluate(() => {
      const w = ITEMS.find(x => x.detailPage >= 29 && +x.hoek >= 2 && +x.hoek <= 4 && x.id % 2 === 1);
      if (!w) throw Error('No small-stroke word fixture');
      const start = today(), end = new Date(Date.now() + 4 * 86400000).toLocaleDateString('sv-SE');
      db.fiveDayPlan = { start, end, set1WordIds: [w.id], set2EndPage: w.detailPage, set2EndWordId: w.id };
      save(); go('home');
      return { id: w.id, eum: w.eum, hun: w.hun.split('/')[0], hoek: +w.hoek };
    });
    await page.locator('#v25Set1').click();
    await page.locator('#v251CharNext:not([disabled])').waitFor();
    await page.locator('#v251CharNext').click();
    await page.locator('#v26WriteGrid .pad.active canvas:last-of-type').waitFor();

    // Two separate pointer strokes: touching the second must leave the first.
    let canvas = page.locator('#v26WriteGrid .pad.active canvas:last-of-type');
    await draw(page, canvas, 45);
    await draw(page, canvas, 110);
    await page.waitForFunction(n => document.querySelector('#v26WriteCount')?.textContent.includes(`2/${n}획`), fixture.hoek);
    await page.locator('#v26WriteGrid .pad.active .padEraserMini').click();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 76, box.y + 110);
    await page.mouse.down(); await page.mouse.up();
    await page.waitForFunction(n => document.querySelector('#v26WriteCount')?.textContent.includes(`1/${n}획`), fixture.hoek);
    assert.equal(await page.evaluate(() => {
      const c = document.querySelector('#v26WriteGrid .pad.active canvas:last-of-type');
      const x = c.getContext('2d');
      return x.getImageData(75, 45, 1, 1).data[3] > 0 && x.getImageData(75, 110, 1, 1).data[3] === 0;
    }), true, 'eraser must preserve the untouched ink');
    await page.locator('#v26WriteGrid .pad.active .padEraserMini').click();

    // Finish each cell by actual pointer strokes and wait for the app's timer.
    for (let cell = 0; cell < 5; cell++) {
      canvas = page.locator('#v26WriteGrid .pad.active canvas:last-of-type');
      if (cell === 0) for (let i = 1; i < fixture.hoek; i++) await draw(page, canvas, 45 + i * 40);
      else for (let i = 0; i < fixture.hoek; i++) await draw(page, canvas, 35 + i * 40);
      if (cell < 4) await page.locator(`#v26WriteGrid .pad:nth-child(${cell + 2}).active`).waitFor({ timeout: 12000 });
    }
    await page.locator('#v27RecallCheck').waitFor({ timeout: 12000 });
    assert.equal(await page.evaluate(id => !!db.dailySetPlans[today()].set1.writeCheckpoint[id + ':0'], fixture.id), true);
    await page.locator('#v27RecallVoiceRepeat').click();
    await page.waitForFunction(() => document.querySelector('#v27RecallVoiceStatus')?.textContent.includes('지원하지 않아요'));

    await page.locator('#v27RecallHome').click();
    await page.reload();
    await page.locator('#v25Set1').click();
    await page.locator('#v27RecallCheck').waitFor(); // checkpoint skips five-write screen
    await page.locator('#v27CharEum').fill(fixture.eum);
    await page.locator('#v27CharHun').fill(fixture.hun);
    await page.locator('#v27CharHoek').fill(String(fixture.hoek + 1));
    await page.locator('#v27RecallCheck').click();
    await page.waitForFunction(() => document.querySelector('#v27RecallFb')?.textContent.includes('획수'));
    assert.equal(await page.locator('#v27RecallCheck').count(), 1, 'wrong stroke count blocks progress');

    await page.evaluate(() => {
      window.SpeechRecognition = class {
        start() { setTimeout(() => this.onerror({ error: 'not-allowed' }), 0) }
      };
    });
    await page.locator('#v27RecallVoiceRepeat').click();
    await page.waitForFunction(() => document.querySelector('#v27RecallVoiceStatus')?.textContent.includes('마이크 사용 권한이 필요해요'));
    await page.locator('#v27CharHoek').fill(String(fixture.hoek));
    await page.locator('#v27RecallCheck').click();
    await page.locator('#v251CharNext').waitFor();
    assert.equal(await page.evaluate(id => !!db.dailySetPlans[today()].set1.writeCheckpoint[id + ':0'], fixture.id), false);
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    console.log('v0.27 browser interactions PASS');
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1 });
