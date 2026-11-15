// Returns an error message for an unsuitable photo, or "" when the file is fine.
export function checkImage(file) {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return "Choose a PNG, JPG or WebP image.";
  if (file.size > 10 * 1024 * 1024) return "The photo is larger than 10 MB.";
  return "";
}

// Removes the light background that touches the edges of the image so the logo
// sits on whatever colour is behind it. Only the outer region is cleared, so
// white details inside the emblem (books, lettering, petals) stay intact.
function cutBackground(data, w, h) {
  const at = (x, y) => (y * w + x) * 4;
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const ref = corners.reduce((acc, i) => [acc[0] + data[i], acc[1] + data[i + 1], acc[2] + data[i + 2]], [0, 0, 0]).map((v) => v / 4);
  const bright = (ref[0] + ref[1] + ref[2]) / 3;
  const spread = Math.max(...ref) - Math.min(...ref);
  if (bright < 205 || spread > 60) return; // not a plain light background
  const close = (i) => data[i + 3] > 8 && Math.abs(data[i] - ref[0]) < 52 && Math.abs(data[i + 1] - ref[1]) < 52 && Math.abs(data[i + 2] - ref[2]) < 52;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const visit = (x, y) => {
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    const i = p * 4;
    if (!close(i)) return;
    data[i + 3] = 0;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { visit(x, 0); visit(x, h - 1); }
  for (let y = 0; y < h; y++) { visit(0, y); visit(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p - x) / w;
    if (x > 0) visit(x - 1, y);
    if (x < w - 1) visit(x + 1, y);
    if (y > 0) visit(x, y - 1);
    if (y < h - 1) visit(x, y + 1);
  }
}

// Crops transparent / white margins around a logo and returns a square PNG data URL.
export function trimLogo(src, max = 480, out = 400) {
  return new Promise((resolve) => {
    if (/^data:image\/svg/.test(src)) return resolve(src);
    const img = new Image();
    img.onerror = () => resolve(src);
    img.onload = () => {
      try {
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * r), h = Math.round(img.height * r);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const frame = ctx.getImageData(0, 0, w, h);
        const { data } = frame;
        cutBackground(data, w, h);
        ctx.putImageData(frame, 0, 0);
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 16) {
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
        if (x1 < 0) return resolve(src);
        const side = Math.max(x1 - x0 + 1, y1 - y0 + 1);
        const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
        const size = Math.min(out, side);
        const o = document.createElement("canvas");
        o.width = o.height = size;
        o.getContext("2d").drawImage(c, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
        resolve(o.toDataURL("image/png"));
      } catch { resolve(src); }
    };
    img.src = src;
  });
}
