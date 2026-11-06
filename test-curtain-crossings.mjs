import { createShow, state, addScenery, scanCurtainCrossings, curtainCovers } from './src/model.js';

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
const curtain = (show, { y = 3.2, open = 1, cues = [], name = 'Main curtain' } = {}) => {
  const c = addScenery(show, 'curtain');
  c.name = name;
  c.y = y;
  c.depthSet = true;
  c.open = open;
  c.cues = cues;
  return c;
};
// Walks straight up from downstage (y 1) to upstage (y 5) at x, crossing y 3.2 near 2 s.
const crossing = (x = 0) => [{ x, y: 1, t: 0, pose: 'none' }, { x, y: 5, t: 4000, pose: 'none' }];

// 1. A shut curtain blocks a crossing at centre.
{
  const show = mk();
  curtain(show, { open: 0 });
  dancer(show, 'Ada', crossing(0));
  const hits = scanCurtainCrossings(show);
  check('shut curtain: centre crossing warns', hits.length === 1, JSON.stringify(hits.map((h) => h.at)));
}

// 2. A fully open curtain leaves the centre clear.
{
  const show = mk();
  curtain(show, { open: 1 });
  dancer(show, 'Ada', crossing(0));
  check('open curtain: centre crossing is clear', scanCurtainCrossings(show).length === 0);
}

// 3. An open curtain still covers its outer stack.
{
  const show = mk();
  curtain(show, { open: 1 });
  dancer(show, 'Ada', crossing(-5.8));
  check('open curtain: edge stack still warns', scanCurtainCrossings(show).length === 1);
}

// 4. A curtain that shuts after the crossing does not warn for it.
{
  const show = mk();
  curtain(show, { open: 1, cues: [{ id: 'c1', at: 3000, dur: 0, open: 0 }] });
  dancer(show, 'Ada', crossing(0));
  check('curtain shut after the crossing: no warning', scanCurtainCrossings(show).length === 0);
}

// 5. A curtain that is shut before the crossing warns when crossed.
{
  const show = mk();
  curtain(show, { open: 1, cues: [{ id: 'c1', at: 0, dur: 0, open: 0 }] });
  dancer(show, 'Ada', crossing(0));
  check('curtain shut before the crossing: warns', scanCurtainCrossings(show).length === 1);
}

// 6. No crossing, no warning, even with a shut curtain.
{
  const show = mk();
  curtain(show, { open: 0 });
  dancer(show, 'Ada', [{ x: 0, y: 1, t: 0, pose: 'none' }, { x: 2, y: 2, t: 4000, pose: 'none' }]);
  check('stays downstage: no warning', scanCurtainCrossings(show).length === 0);
}

// 7. The cover test itself at the edges of an open curtain.
{
  const show = mk();
  const c = curtain(show, { open: 0.5 });
  check('half-open centre clear', !curtainCovers(c, 0, 0));
  check('half-open outer edge covered', curtainCovers(c, 0, -5.9));
}

if (failures) {
  console.log(`${failures} failing`);
  process.exit(1);
}
console.log('all curtain crossing checks pass');
