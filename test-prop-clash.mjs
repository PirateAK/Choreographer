import { createShow, state, addScenery, scanPropClashes, propPlacementHint } from './src/model.js';

let failures = 0;
const check = (label, cond, detail = '') => {
  console.log(cond ? 'PASS' : 'FAIL', label, detail);
  if (!cond) failures++;
};

const mk = () => {
  const show = createShow();
  show.cast.length = 0;
  show.scenery = [];
  state.show = show;
  return show;
};
const dancer = (show, id, keys) => {
  const d = { id, name: id, number: show.cast.length + 1, color: '#fff', visible: true, keys };
  show.cast.push(d);
  return d;
};
const prop = (show, { x, y, name = 'Chair', carriedBy } = {}) => {
  const p = addScenery(show, 'prop');
  p.name = name;
  p.x = x;
  p.y = y;
  if (carriedBy) p.carriedBy = carriedBy;
  return p;
};
// Walks straight across the stage at y 3 from x -4 to x 4.
const across = [{ x: -4, y: 3, t: 0, pose: 'none' }, { x: 4, y: 3, t: 8000, pose: 'none' }];

// 1. A prop placed on a dancer's path clashes.
{
  const show = mk();
  dancer(show, 'Ada', across);
  const p = prop(show, { x: 0, y: 3 });
  const hits = scanPropClashes(show, p);
  check('prop on the path: clashes once', hits.length === 1, JSON.stringify(hits.map((h) => h.at)));
  check('prop on the path: names the dancer', hits.length === 1 && hits[0].dancerId === 'Ada');
  check('prop on the path: hint says so', /Ada's path/.test(propPlacementHint(show, p)), propPlacementHint(show, p));
}

// 2. A prop well clear of the path does not.
{
  const show = mk();
  dancer(show, 'Ada', across);
  const p = prop(show, { x: 0, y: 6 });
  check('prop clear of the path: no clash', scanPropClashes(show, p).length === 0);
  check('prop clear of the path: hint says clear', /clear of every/.test(propPlacementHint(show, p)), propPlacementHint(show, p));
}

// 3. The dancer carrying a prop is not checked against it; another dancer is.
{
  const show = mk();
  const carrier = dancer(show, 'Ada', across);
  dancer(show, 'Bea', [{ x: 0.55, y: 2.45, t: 0, pose: 'none' }, { x: 0.55, y: 2.45, t: 8000, pose: 'none' }]);
  const p = prop(show, { x: 0, y: 3, carriedBy: carrier.id });
  const hits = scanPropClashes(show, p);
  check('carried prop: carrier not checked', hits.every((h) => h.dancerId !== 'Ada'), JSON.stringify(hits.map((h) => h.dancerId)));
  check('carried prop: a passer-by is checked', hits.length >= 1 && hits.some((h) => h.dancerId === 'Bea'));
}

// 4. A prop with no dancers on stage has nothing to clash with.
{
  const show = mk();
  const p = prop(show, { x: 0, y: 3 });
  check('no dancers: no clash', scanPropClashes(show, p).length === 0);
}

if (failures) {
  console.log(`${failures} failing`);
  process.exit(1);
}
console.log('all prop clash checks pass');
