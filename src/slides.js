import { storeAudio, readAudio } from './audiostore.js';

const PREFIX = 'image-';
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

function makeKey() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function imageBlob(bytes, type = '') {
  if (typeof Blob === 'undefined') return null;
  if (bytes instanceof Blob) return bytes;
  if (bytes instanceof ArrayBuffer || ArrayBuffer.isView(bytes)) {
    return new Blob([bytes], { type });
  }
  return null;
}

export class SlideEngine {
  constructor() {
    this.status = new Map();
    this.images = new Map();
    this.objectUrls = new Map();
    this.loading = new Map();
    this.canvas = null;
  }

  makeObjectUrl(blob) {
    try {
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
      return URL.createObjectURL(blob);
    } catch (error) {
      return null;
    }
  }

  revokeObjectUrl(url) {
    if (!url) return;
    try {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
    } catch (error) {
      // Cleanup should not interrupt image loading.
    }
  }

  decode(url) {
    return new Promise((resolve, reject) => {
      if (typeof Image === 'undefined') {
        reject(new Error('This browser cannot load images'));
        return;
      }
      let image;
      try {
        image = new Image();
      } catch (error) {
        reject(new Error('This browser cannot load images'));
        return;
      }
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        image.onload = null;
        image.onerror = null;
        if (error) reject(error);
        else if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image);
        else reject(new Error('The file is not a usable image'));
      };
      image.onload = () => finish(null);
      image.onerror = () => finish(new Error('The browser cannot decode this image'));
      image.src = url;
      if (typeof image.decode === 'function') {
        image.decode().then(() => finish(null), () => {
          // Some browsers reject decode() even though the load event succeeds.
        });
      }
    });
  }

  async attachFile(file) {
    if (!file || typeof file.arrayBuffer !== 'function') throw new Error('An image file is required');
    const type = String(file.type || '').toLowerCase().split(';')[0].trim();
    if (!MIME_TYPES.has(type)) throw new Error('Choose a PNG, JPEG, WebP, GIF, or AVIF image');
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_FILE_BYTES) {
      throw new Error('Image files must be smaller than 30 MB');
    }
    const blob = imageBlob(file, type);
    if (!blob) throw new Error('This browser cannot read image files');
    const url = this.makeObjectUrl(blob);
    if (!url) throw new Error('This browser cannot load image files');
    let image;
    try {
      image = await this.decode(url);
      const key = makeKey();
      const name = file.name || 'Image';
      await storeAudio(PREFIX + key, { name, bytes: blob });
      this.images.set(key, image);
      this.objectUrls.set(key, url);
      this.status.set(key, true);
      return { key, name, width: image.naturalWidth, height: image.naturalHeight };
    } catch (error) {
      this.revokeObjectUrl(url);
      throw new Error(error && error.message ? error.message : 'Could not store or read the image file');
    }
  }

  async ensureImage(key) {
    if (typeof key !== 'string' || !key) return null;
    if (this.status.get(key) === false) return null;
    if (this.images.has(key)) return this.images.get(key);
    if (this.loading.has(key)) return this.loading.get(key);
    const promise = (async () => {
      let record = null;
      try {
        record = await readAudio(PREFIX + key);
      } catch (error) {
        this.status.set(key, false);
        return null;
      }
      const blob = record && imageBlob(record.bytes);
      const type = blob && String(blob.type || '').toLowerCase().split(';')[0].trim();
      if (!blob || !MIME_TYPES.has(type) || blob.size <= 0 || blob.size > MAX_FILE_BYTES) {
        this.status.set(key, false);
        return null;
      }
      const url = this.makeObjectUrl(blob);
      if (!url) {
        this.status.set(key, false);
        return null;
      }
      try {
        const image = await this.decode(url);
        this.images.set(key, image);
        this.objectUrls.set(key, url);
        this.status.set(key, true);
        return image;
      } catch (error) {
        this.revokeObjectUrl(url);
        this.status.set(key, false);
        return null;
      }
    })();
    this.loading.set(key, promise);
    try {
      return await promise;
    } finally {
      if (this.loading.get(key) === promise) this.loading.delete(key);
    }
  }

  async probe(images) {
    await Promise.all((Array.isArray(images) ? images : []).map((item) =>
      item && item.key ? this.ensureImage(item.key) : Promise.resolve(null)
    ));
  }

  async thumbnail(key) {
    await this.ensureImage(key);
    return this.status.get(key) === true ? (this.objectUrls.get(key) || null) : null;
  }

  sync(images, layers) {
    const byId = new Map((Array.isArray(images) ? images : [])
      .filter((image) => image && typeof image.id === 'string')
      .map((image) => [image.id, image]));
    for (const layer of Array.isArray(layers) ? layers : []) {
      if (!layer || !Number.isFinite(Number(layer.alpha)) || Number(layer.alpha) <= 0) continue;
      const image = byId.get(layer.imageId);
      if (image && image.key) this.ensureImage(image.key);
    }
  }

  frame(images, layers) {
    const items = Array.isArray(images) ? images : [];
    const byId = new Map(items.filter((image) => image && typeof image.id === 'string')
      .map((image) => [image.id, image]));
    const visible = (Array.isArray(layers) ? layers : []).map((layer) => {
      if (!layer || !Number.isFinite(Number(layer.alpha))) return null;
      const alpha = Math.max(0, Math.min(1, Number(layer.alpha)));
      const image = byId.get(layer.imageId);
      const source = image && image.key ? this.images.get(image.key) : null;
      return alpha > 0 && source ? { source, alpha } : null;
    }).filter(Boolean);
    if (!visible.length || typeof document === 'undefined' || typeof document.createElement !== 'function') return null;

    let canvas;
    let ctx;
    try {
      canvas = this.canvas || (this.canvas = document.createElement('canvas'));
      if (canvas.width !== DEFAULT_WIDTH) canvas.width = DEFAULT_WIDTH;
      if (canvas.height !== DEFAULT_HEIGHT) canvas.height = DEFAULT_HEIGHT;
      ctx = canvas.getContext('2d');
    } catch (error) {
      return null;
    }
    if (!ctx) return null;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    for (const { source, alpha } of visible) {
      const sw = source.naturalWidth;
      const sh = source.naturalHeight;
      if (!sw || !sh) continue;
      const scale = Math.min(canvas.width / sw, canvas.height / sh);
      const width = sw * scale;
      const height = sh * scale;
      ctx.globalAlpha = alpha;
      ctx.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return canvas;
  }

  dispose() {
    for (const url of this.objectUrls.values()) this.revokeObjectUrl(url);
    this.objectUrls.clear();
    this.images.clear();
  }
}
