// Small canvas helpers shared by the stage and timeline views.

export function drawAvatar(ctx, shape, x, y, r, fill, color) {
  ctx.beginPath();
  switch (shape) {
    case 'square':
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    case 'triangle':
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.1, y + r * 0.85);
      ctx.lineTo(x - r * 1.1, y + r * 0.85);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(x, y - r * 1.25);
      ctx.lineTo(x + r * 1.15, y);
      ctx.lineTo(x, y + r * 1.25);
      ctx.lineTo(x - r * 1.15, y);
      ctx.closePath();
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    case 'star': {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 ? r * 0.48 : r * 1.15;
        const px = x + Math.cos(a) * rad;
        const py = y + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    default:
      ctx.arc(x, y, r, 0, Math.PI * 2);
  }

  if (fill === 'hollow') {
    ctx.lineWidth = Math.max(1.4, r * 0.34);
    ctx.strokeStyle = color;
    ctx.stroke();
  } else if (fill === 'half') {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x - r * 2, y, r * 4, r * 2);
    ctx.restore();
    ctx.lineWidth = Math.max(1.2, r * 0.24);
    ctx.strokeStyle = color;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.stroke();
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function fmtTime(ms) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const f = Math.floor(total % 1000);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(f).padStart(3, '0');
}
