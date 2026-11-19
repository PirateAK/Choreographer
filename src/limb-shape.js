/**
 * Build a closed polygon around a tapered, possibly bent limb centerline.
 * Points and radii use caller-defined units. Returns [[x, y], ...], with one
 * side in forward order and the other side in reverse order.
 */
export function limbContour(points, radii) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new TypeError('points must contain at least two 2D coordinates');
  }
  if (!Array.isArray(radii) || radii.length !== points.length) {
    throw new TypeError('radii must match the number of points');
  }

  const centers = points.map((point, i) => {
    if (!Array.isArray(point) || point.length < 2 ||
        !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      throw new TypeError(`points[${i}] must contain finite x and y coordinates`);
    }
    return [point[0], point[1]];
  });
  const widths = radii.map((radius, i) => {
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new RangeError(`radii[${i}] must be a positive finite number`);
    }
    return radius;
  });

  const EPSILON = 1e-12;
  const unit = (x, y) => {
    const length = Math.hypot(x, y);
    return length > EPSILON ? [x / length, y / length] : null;
  };

  // Find non-zero directions through each center. Skipping coincident samples
  // keeps foreshortened joints from producing NaNs or unstable local normals.
  let fallback = null;
  for (let i = 1; i < centers.length && !fallback; i++) {
    fallback = unit(
      centers[i][0] - centers[i - 1][0],
      centers[i][1] - centers[i - 1][1],
    );
  }
  fallback ||= [1, 0];

  const offsets = centers.map((center, i) => {
    let previous = -1;
    let next = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (Math.hypot(center[0] - centers[j][0], center[1] - centers[j][1]) > EPSILON) {
        previous = j;
        break;
      }
    }
    for (let j = i + 1; j < centers.length; j++) {
      if (Math.hypot(centers[j][0] - center[0], centers[j][1] - center[1]) > EPSILON) {
        next = j;
        break;
      }
    }

    const incoming = previous >= 0
      ? unit(center[0] - centers[previous][0], center[1] - centers[previous][1])
      : null;
    const outgoing = next >= 0
      ? unit(centers[next][0] - center[0], centers[next][1] - center[1])
      : null;
    let tangent;
    if (incoming && outgoing) {
      tangent = unit(incoming[0] + outgoing[0], incoming[1] + outgoing[1]);
      if (!tangent) tangent = outgoing;
    } else {
      tangent = incoming || outgoing || fallback;
    }

    let nx = -tangent[1];
    let ny = tangent[0];
    // Correct the averaged normal to preserve the requested radius at corners,
    // while bounding sharp-corner miters to avoid long spikes.
    let correction = 1;
    if (incoming && outgoing) {
      const dot = Math.abs(nx * -incoming[1] + ny * incoming[0]);
      if (dot > EPSILON) correction = Math.min(2.5, 1 / dot);
    }
    return [nx * widths[i] * correction, ny * widths[i] * correction];
  });

  const sideA = centers.map(([x, y], i) => [x + offsets[i][0], y + offsets[i][1]]);
  const sideB = centers.map(([x, y], i) => [x - offsets[i][0], y - offsets[i][1]]).reverse();
  return sideA.concat(sideB);
}
