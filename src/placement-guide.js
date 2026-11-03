// Draft planning bands only. These are not ballet-safety certification, enforcement,
// or solver-reach estimates; review the reference values before treating them as guidance.
const REFERENCE_HEIGHT_METRES = 1.7;
const REFERENCE_DURATION_MS = 1500;

// Metres per reference step at 1.7m dancer height and 1.5s duration.
export const DRAFT_TRAVEL_RANGES = Object.freeze({
  walk: Object.freeze({ comfortableMin: 0.25, comfortableMax: 1.2, stretchMax: 1.8, label: 'Walk' }),
  chasse: Object.freeze({ comfortableMin: 0.35, comfortableMax: 1.4, stretchMax: 1.9, label: 'Chassé' }),
  glissade: Object.freeze({ comfortableMin: 0.2, comfortableMax: 0.8, stretchMax: 1.2, label: 'Glissade' }),
  'pas-de-bourree': Object.freeze({ comfortableMin: 0.1, comfortableMax: 0.7, stretchMax: 1, label: 'Pas de bourrée' }),
  pirouette: Object.freeze({ comfortableMin: 0, comfortableMax: 0.12, stretchMax: 0.25, label: 'Pirouette (in place)' }),
  releve: Object.freeze({ comfortableMin: 0, comfortableMax: 0.12, stretchMax: 0.25, label: 'Relevé (in place)' }),
});

/**
 * Return a draft station-distance guide in metres, or null for an unsupported step.
 * Travel bands scale linearly with height and with duration up to the reference duration;
 * in-place turn/rise bands scale with height only and never grow with extra time.
 */
export function placementRange({ step = 'walk', pose = 'none', height = REFERENCE_HEIGHT_METRES, durationMs = REFERENCE_DURATION_MS } = {}) {
  const supportedSteps = ['walk', 'chasse', 'glissade', 'pas-de-bourree', 'pirouette'];
  if (!supportedSteps.includes(step)) return null;
  const isInPlace = step === 'pirouette' || pose === 'pirouette' || pose === 'releve';
  const source = isInPlace ? DRAFT_TRAVEL_RANGES[pose === 'releve' ? 'releve' : 'pirouette'] : DRAFT_TRAVEL_RANGES[step];
  const durationScale = isInPlace
    ? 1
    : Math.min(validPositive(durationMs, REFERENCE_DURATION_MS) / REFERENCE_DURATION_MS, 1);
  return scaleRange(source, height, durationScale);
}

function validPositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function scaleRange(range, height, durationScale) {
  const factor = (validPositive(height, REFERENCE_HEIGHT_METRES) / REFERENCE_HEIGHT_METRES) * durationScale;
  return {
    comfortableMin: range.comfortableMin * factor,
    comfortableMax: range.comfortableMax * factor,
    stretchMax: range.stretchMax * factor,
    label: range.label,
    draft: true,
  };
}
