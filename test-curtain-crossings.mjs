import { createShow, state, addScenery, scanClothCrossings, clothCovers } from './src/model.js';

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
const drop = (show, { y = 3.2, fly = 1, span, x = 0, screen = false, name = 'Drop' } = {}) => {
  const c = addScenery(show, 'drop');
  c.name = name;
  c.y = y;
  c.fly = fly;
  c.x = x;
  if (span !== undefined) c.span = span;
  if (screen) c.screen = true;
  return c;
};
// Walks straight up from downstage (y 1) to upstage (y 5) at x, crossing y 3.2 near 2 s.
const crossing = (x = 0) => [{ x, y: 1, t: 0, pose: 'none' }, { x, y: 5, t: 4000, pose: 'none' }];

// 1. A shut curtain blocks a crossing at centre.
{
  const show = mk();
  curtain(show, { open: 0 });
  dancer(show, 'Ada', crossing(0));
  const hits = scanClothCrossings(show);
  check('shut curtain: centre crossing warns', hits.length === 1 && hits[0].kind === 'curtain', JSON.stringify(hits.map((h) => h.kind)));
}

// 2. A fully open curtain leaves the centre clear.
{
  const show = mk();
  curtain(show, { open: 1 });
  dancer(show, 'Ada', crossing(0));
  check('open curtain: centre crossing is clear', scanClothCrossings(show).length === 0);
}

// 3. An open curtain still covers its outer stack.
{
  const show = mk();
  curtain(show, { open: 1 });
  dancer(show, 'Ada', crossing(-5.8));
  check('open curtain: edge stack still warns', scanClothCrossings(show).length === 1);
}

// 4. A curtain that shuts after the crossing does not warn for it.
{
  const show = mk();
  curtain(show, { open: 1, cues: [{ id: 'c1', at: 3000, dur: 0, open: 0 }] });
  dancer(show, 'Ada', crossing(0));
  check('curtain shut after the crossing: no warning', scanClothCrossings(show).length === 0);
}

// 5. A curtain that is shut before the crossing warns when crossed.
{
  const show = mk();
  curtain(show, { open: 1, cues: [{ id: 'c1', at: 0, dur: 0, open: 0 }] });
  dancer(show, 'Ada', crossing(0));
  check('curtain shut before the crossing: warns', scanClothCrossings(show).length === 1);
}

// 6. No crossing, no warning, even with a shut curtain.
{
  const show = mk();
  curtain(show, { open: 0 });
  dancer(show, 'Ada', [{ x: 0, y: 1, t: 0, pose: 'none' }, { x: 2, y: 2, t: 4000, pose: 'none' }]);
  check('stays downstage: no warning', scanClothCrossings(show).length === 0);
}

// 7. The cover test itself at the edges of an open curtain.
{
  const show = mk();
  const c = curtain(show, { open: 0.5 });
  check('half-open centre clear', !clothCovers(c, 0, 0));
  check('half-open outer edge covered', clothCovers(c, 0, -5.9));
}

// 8. A hanging drop blocks a crossing; a flown-out drop does not.
{
  const show = mk();
  drop(show, { fly: 1 });
  dancer(show, 'Ada', crossing(0));
  const hits = scanClothCrossings(show);
  check('hanging drop: crossing warns as a drop', hits.length === 1 && hits[0].kind === 'drop', JSON.stringify(hits.map((h) => h.kind)));
}
{
  const show = mk();
  drop(show, { fly: 0 });
  dancer(show, 'Ada', crossing(0));
  check('flown-out drop: no warning', scanClothCrossings(show).length === 0);
}

// 9. A screen is a drop with the screen flag, and is reported as a screen.
{
  const show = mk();
  drop(show, { fly: 1, screen: true, name: 'Projection screen' });
  dancer(show, 'Ada', crossing(0));
  const hits = scanClothCrossings(show);
  check('hanging screen: crossing warns as a screen', hits.length === 1 && hits[0].kind === 'screen', JSON.stringify(hits.map((h) => h.kind)));
}

// 10. A drop narrower than the crossing point leaves that point clear.
{
  const show = mk();
  drop(show, { fly: 1, span: 2, x: 4 });
  dancer(show, 'Ada', crossing(0));
  check('narrow drop beside the path: no warning', scanClothCrossings(show).length === 0);
}

// 11. A screen placed upstage of where the dancers go needs no check: nobody crosses it.
{
  const show = mk();
  drop(show, { fly: 1, screen: true, y: 7.5 });
  dancer(show, 'Ada', crossing(0));
  check('screen upstage of the dancers: no crossing, no warning', scanClothCrossings(show).length === 0);
}

if (failures) {
  console.log(`${failures} failing`);
  process.exit(1);
}
console.log('all cloth crossing checks pass');
