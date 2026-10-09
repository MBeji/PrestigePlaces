// Capture d'écran de la maquette (bureau, mobile, sombre) et contrôle du débordement horizontal.
// Usage : NODE_PATH=/opt/node22/lib/node_modules node scripts/check_prototype.js prototype/index.html <dossier_sortie>
const { chromium } = require('playwright');
(async () => {
  const [path, out] = process.argv.slice(2);
  const b = await chromium.launch();
  for (const [name, w, h, dark] of [['desktop', 1280, 1400, false], ['phone', 400, 1600, false], ['dark', 1280, 1400, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: dark ? 'dark' : 'light' });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${m.type()}: ${m.text()}`); });
    pg.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
    await pg.goto('file://' + path);
    await pg.waitForTimeout(1000);
    const sw = await pg.evaluate('document.documentElement.scrollWidth'), cw = await pg.evaluate('document.documentElement.clientWidth');
    await pg.screenshot({ path: `${out}/shot_${name}.png`, fullPage: true });
    console.log(name, 'scrollWidth', sw, 'clientWidth', cw, 'errors', errs.slice(0, 5));
    await ctx.close();
  }
  await b.close();
})();
