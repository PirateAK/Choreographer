// Body-local to stage transform used by the overhead contact solver and renderer.
// Local y is height and local z points towards the house; stage y points upstage.
export function contactFrame(origin, height, facing = 1, turn = 0) {
  const angle = (Number(turn) || 0) * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  const mirror = facing < 0 ? -1 : 1;
  return {
    toStage([x, y, z]) {
      return { x: origin.x + mirror * (x * c + z * s) * height,
        y: origin.y - (z * c - x * s) * height, h: y * height };
    },
    toLocal(point) {
      const across = (point.x - origin.x) / height / mirror;
      const house = (origin.y - point.y) / height;
      return [across * c - house * s, point.h / height, across * s + house * c];
    },
  };
}
