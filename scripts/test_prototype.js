// Exécute la logique pure de la maquette (quotas, répartition) hors navigateur.
// Usage : node scripts/test_prototype.js prototype/index.html
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const cut = js.indexOf('// ---------- état et rendu ----------');
const logic = js.slice(0, cut);
const sandbox = {};
new Function('exports', logic + '\nexports.buildSeats = buildSeats; exports.islands = islands; exports.baseHeadcount = baseHeadcount; exports.propose = propose; exports.DIRS = DIRS; exports.FLOORS = FLOORS;')(sandbox);
const { buildSeats, islands, baseHeadcount, propose, DIRS, FLOORS } = sandbox;
for (const rdc of [false, true]) {
  const seats = buildSeats(rdc); islands(seats);
  const params = baseHeadcount();
  const r = propose(seats, params, 0);
  console.log(`--- rdcFree=${rdc} P=${r.P} alloc=${r.alloc} Ntot=${r.Ntot} rate=${(r.rate*100).toFixed(2)}%`);
  for (const d of DIRS) console.log(`${d.id.padEnd(9)} N=${r.N[d.id]} fixed=${params[d.id].fixed} current=${r.current[d.id]} quota=${r.quota[d.id]} delta=${r.delta[d.id]}`);
  const perFloor = {};
  let changes = 0;
  for (const s of seats) { const a = s.dir, b = r.proposed[s.id]; if (a !== b) { changes++; const k = `${s.floor} ${a}->${b}`; perFloor[k] = (perFloor[k] || 0) + 1; } }
  console.log('changes', changes, perFloor);
  for (const d of DIRS) {
    const before = FLOORS.filter(f => seats.some(s => s.floor === f && s.dir === d.id));
    const after = FLOORS.filter(f => seats.some(s => s.floor === f && r.proposed[s.id] === d.id));
    const cnt = seats.filter(s => r.proposed[s.id] === d.id).length;
    console.log(`  ${d.id}: floors ${before} -> ${after}; proposed count=${cnt}`);
  }
  console.log('  vides after:', seats.filter(s => r.proposed[s.id] === 'VIDE').length);
}
