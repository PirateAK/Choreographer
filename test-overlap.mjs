import { createShow, scanOverlaps, overlapFix, applyOverlapFix, CLEARANCE, posOfContent } from './src/model.js';

const mk = () => {
  const show = createShow();
  show.cast.length = 0;
  return show;
};
const dancer = (show, name, number, keys) => {
  const d = { id: 'd' + number, name, number, color: '#fff', visible: true, keys };
  show.cast.push(d);
  return d;
};
const run = (label, show) => {
  const t0 = performance.now();
  const list = scanOverlaps(show);
  const t1 = performance.now();
  console.log(label, 'overlaps:', list.map((o) => ({ at: o.at, gap: +o.gap.toFixed(2) })), `scan ${(t1 - t0).toFixed(0)}ms`);
  let t2 = performance.now();
  for (const o of list) {
    const fix = overlapFix(show, o);
    console.log('  ', o.id, 'fix:', fix ? `${fix.kind} — ${fix.label} (cost ${fix.cost.toFixed(2)})` : 'none');
  }
  console.log('   fixes took', (performance.now() - t2).toFixed(0) + 'ms');
  for (const o of list) {
    const fix = overlapFix(show, o);
    if (fix) applyOverlapFix(show, fix);
  }
  const after = scanOverlaps(show);
  console.log('   after applying every fix:', after.length, 'overlaps left');
  return after;
};

// 1. One stands, one walks through her.
{
  const show = mk();
  dancer(show, 'Ada', 1, [{ x: 0, y: 2, t: 0, pose: 'none' }, { x: 0, y: 2, t: 8000, pose: 'none' }]);
  dancer(show, 'Bea', 2, [{ x: -4, y: 2, t: 0, pose: 'none' }, { x: 4, y: 2, t: 8000, pose: 'none' }]);
  run('CASE 1 walk-through', show);
}

// 2. Two crossing each other on the same line.
{
  const show = mk();
  dancer(show, 'Cy', 1, [{ x: -3, y: 3, t: 0, pose: 'none' }, { x: 3, y: 3, t: 6000, pose: 'none' }]);
  dancer(show, 'Dee', 2, [{ x: 3, y: 3, t: 0, pose: 'none' }, { x: -3, y: 3, t: 6000, pose: 'none' }]);
  run('CASE 2 crossing', show);
}

// 3. Two standing in nearly the same spot with one station each.
{
  const show = mk();
  dancer(show, 'Eve', 1, [{ x: 1, y: 2, t: 2000, pose: 'fifth' }]);
  dancer(show, 'Fay', 2, [{ x: 1.2, y: 2.1, t: 2000, pose: 'fifth' }]);
  run('CASE 3 standing', show);
}

// 4. Nothing wrong.
{
  const show = mk();
  dancer(show, 'Gia', 1, [{ x: 0, y: 2, t: 0, pose: 'none' }, { x: 0, y: 2, t: 8000, pose: 'none' }]);
  dancer(show, 'Hal', 2, [{ x: -4, y: 4, t: 0, pose: 'none' }, { x: 4, y: 4, t: 8000, pose: 'none' }]);
  console.log('CASE 4 clean:', scanOverlaps(show).length, 'overlaps');
}

// 5. A pass through a spot a dancer has just arrived at: a small displacement of time is the cheap
// fix, and it should beat moving a path.
{
  const show = mk();
  dancer(show, 'Ivy', 1, [{ x: 0, y: 2, t: 0, pose: 'none' }, { x: 4, y: 2, t: 4000, pose: 'none' }]);
  dancer(show, 'Jon', 2, [{ x: 2, y: 2, t: 1800, pose: 'none' }, { x: 2, y: 2, t: 6200, pose: 'none' }]);
  run('CASE 5 pass-through', show);
}

// 6. A planted-foot conflict: the station the fix wants to move is pinned by a plant, so a nudge
// should either keep the feet valid or be refused.
{
  const show = mk();
  dancer(show, 'Kit', 1, [
    { x: 0, y: 2, t: 0, pose: 'first', plant: 'both' },
    { x: 0.1, y: 2, t: 3000, pose: 'first', plant: 'both' },
  ]);
  dancer(show, 'Lou', 2, [{ x: 0.3, y: 2, t: 3000, pose: 'first', plant: 'both' }]);
  run('CASE 6 planted', show);
}

// 8. Two travelling bodies meeting at the same point at the same moment: nothing is standing, so a
// wait is the cheap fix here, and it should be offered instead of a moved path.
{
  const show = mk();
  dancer(show, 'Mia', 1, [{ x: -3, y: 0, t: 0, pose: 'none' }, { x: 3, y: 0, t: 6000, pose: 'none' }]);
  dancer(show, 'Ned', 2, [{ x: 0, y: -4, t: 0, pose: 'none' }, { x: 0, y: 4, t: 6000, pose: 'none' }]);
  run('CASE 8 crossing at a point', show);
}

// 7. A whole company crossing at once — the cost of a scan on a real-sized show.
{
  const show = mk();
  for (let i = 0; i < 8; i++) {
    const y = 1 + i * 0.7;
    const keys = [];
    for (let k = 0; k < 6; k++) {
      keys.push({ x: (k % 2 ? -1 : 1) * (2 + (i % 3)), y, t: k * 2500, pose: k % 2 ? 'arabesque' : 'fifth' });
    }
    dancer(show, 'D' + i, i + 1, keys);
  }
  const t0 = performance.now();
  const list = scanOverlaps(show);
  const t1 = performance.now();
  let t2 = performance.now();
  const fixes = list.map((o) => overlapFix(show, o));
  const t3 = performance.now();
  console.log(`CASE 7 company of 8: ${list.length} overlaps, scan ${(t1 - t0).toFixed(0)}ms, ${list.length} fixes ${(t3 - t2).toFixed(0)}ms, ${fixes.filter(Boolean).length} of them have a fix`);
  for (const f of fixes) if (f) applyOverlapFix(show, f);
  console.log('   after applying every fix:', scanOverlaps(show).length, 'overlaps left');
}

console.log('clearance', CLEARANCE, 'posOfContent sanity', !!posOfContent);
