// Diagnostic report, not a certification of correct ballet or a placement constraint.
import assert from 'node:assert/strict';
import { createShow, overheadPoseAtLocal } from './src/model.js';
const show = createShow();
function scan(dancer) {
  let maximum = 0, warnings = 0;
  for (let t = 0; t <= dancer.keys.at(-1).t; t += 20) {
    const evaluated = overheadPoseAtLocal(show, dancer, t);
    for (const foot of Object.values(evaluated.feet)) {
      assert(Number.isFinite(foot.shortfall));
      maximum = Math.max(maximum, foot.shortfall);
      if (foot.target && foot.shortfall > 0.005) warnings++;
    }
  }
  return { maxGapMm: Math.round(maximum * 1000), warningSamples: warnings };
}
const stationary = {};
for (const pose of ['first', 'second', 'third', 'fourth', 'fifth', 'tendu', 'plie', 'releve', 'arabesque', 'attitude', 'pirouette']) {
  stationary[pose] = scan({ keys: [{ t: 0, x: 0, y: 3, pose }] });
}
const transitions = [];
for (const [start, finish] of [['first', 'second'], ['none', 'none'], ['tendu', 'tendu']]) {
  for (const distance of [0, 0.1, 0.3, 0.9, 1, 4]) {
    transitions.push({ start, finish, distance, ...scan({ keys: [
      { t: 0, x: 0, y: 3, pose: start },
      { t: 2000, x: distance, y: 3, pose: finish },
    ] }) });
  }
}
console.log(JSON.stringify({ dancerHeight: show.stage.dancerH, sampleIntervalMs: 20,
  transitionDurationMs: 2000, warningThresholdMm: 5, stationary, transitions }, null, 2));
