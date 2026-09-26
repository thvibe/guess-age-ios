// Offline render harness: screenshots a grid of cartoon faces so we can review
// the procedural art without a device. Uses the pre-installed Chromium.
//   node tools/render_faces.js [outfile.png]
// Requires playwright-core (dev-only; not needed by the app or CI).
const path = require('path');
const { chromium } = require(process.env.PW_CORE || 'playwright-core');

const EXE = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const INDEX = 'file://' + path.resolve(__dirname, '../web/index.html') + '?render';
const OUT = process.argv[2] || path.resolve(__dirname, '../.render/faces.png');

// A spread of ages; a few seeds each to sample hair/gender/features variety.
const AGES = [4, 8, 14, 22, 30, 42, 55, 68, 80];
const SEEDS = [12345, 777, 90210, 42];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1200, height: 3000 }, deviceScaleFactor: 2 });
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__drawFace === 'function', { timeout: 5000 });

  const CW = 250, CH = 280;
  await page.evaluate(({ ages, seeds, CW, CH }) => {
    document.body.innerHTML = '';
    Object.assign(document.body.style, { margin: '0', background: '#20242b' });
    const grid = document.createElement('div');
    grid.id = 'grid';
    grid.style.cssText = `display:flex;flex-wrap:wrap;gap:12px;padding:14px;width:${seeds.length * (CW + 12) + 16}px;box-sizing:border-box`;
    document.body.appendChild(grid);
    for (const age of ages) for (const seed of seeds) {
      const cell = document.createElement('div');
      // Fixed-size cell so canvas.clientWidth/Height are deterministic.
      cell.style.cssText = `position:relative;flex:0 0 auto;width:${CW}px;height:${CH}px;border-radius:18px;overflow:hidden;background:#000`;
      const cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:100%;display:block';
      cell.appendChild(cv);
      const tag = document.createElement('div');
      tag.textContent = 'age ' + age;
      tag.style.cssText = 'position:absolute;left:8px;top:8px;font:600 13px system-ui;color:#fff;background:rgba(0,0,0,.45);padding:2px 8px;border-radius:8px';
      cell.appendChild(tag);
      grid.appendChild(cell);
      window.__drawFace(cv, age, seed, null);
    }
  }, { ages: AGES, seeds: SEEDS, CW, CH });

  await page.waitForTimeout(150);
  const fs = require('fs');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await (await page.$('#grid')).screenshot({ path: OUT });
  await browser.close();
  console.log('Wrote', OUT);
})().catch(e => { console.error(e); process.exit(1); });
