import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { checkImage } from "./image.js";

const V = 280, OUT = 256;
const clamp = (v, m) => Math.max(-m, Math.min(m, v));

function CropDialog({ file, onCancel, onSave }) {
  const [url] = useState(() => URL.createObjectURL(file));
  const [dim, setDim] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [err, setErr] = useState("");
  const drag = useRef(null), imgRef = useRef(), viewRef = useRef();

  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") cancelRef.current(); };
    document.addEventListener("keydown", k);
    viewRef.current?.focus();
    return () => document.removeEventListener("keydown", k);
  }, []);

  const scale = dim ? (V / Math.min(dim.w, dim.h)) * zoom : 1;
  const maxX = dim ? Math.max(0, (dim.w * scale - V) / 2) : 0;
  const maxY = dim ? Math.max(0, (dim.h * scale - V) / 2) : 0;
  const px = clamp(pos.x, maxX), py = clamp(pos.y, maxY);

  const onLoad = (e) => {
    const w = e.target.naturalWidth, h = e.target.naturalHeight;
    setDim({ w, h });
    const s = V / Math.min(w, h);
    setPos({ x: 0, y: Math.max(0, (h * s - V) / 2) * 0.6 }); // start towards the top so faces are not cut
  };
  const down = (e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { sx: e.clientX, sy: e.clientY, x: px, y: py }; };
  const move = (e) => { const d = drag.current; if (d) setPos({ x: clamp(d.x + e.clientX - d.sx, maxX), y: clamp(d.y + e.clientY - d.sy, maxY) }); };
  const up = () => { drag.current = null; };
  const key = (e) => {
    const step = 12, m = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (m) { e.preventDefault(); setPos({ x: clamp(px + m[0], maxX), y: clamp(py + m[1], maxY) }); }
    if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z + 0.1));
    if (e.key === "-") setZoom((z) => Math.max(1, z - 0.1));
  };
  const save = () => {
    const c = document.createElement("canvas");
    c.width = c.height = OUT;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(imgRef.current, dim.w / 2 - (V / 2 + px) / scale, dim.h / 2 - (V / 2 + py) / scale, V / scale, V / scale, 0, 0, OUT, OUT);
    onSave(c.toDataURL("image/jpeg", 0.88));
  };

  return createPortal(
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="cropt">
        <h3 id="cropt">Crop photo</h3>
        <p className="muted">Drag the photo to move it and use the slider to zoom. Keep the face inside the circle.</p>
        <div ref={viewRef} className="cropview" style={{ width: V, height: V }} tabIndex={0}
          aria-label="Photo position. Arrow keys move the photo, plus and minus zoom."
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
          <img ref={imgRef} src={url} alt="" draggable={false} onLoad={onLoad} onError={() => setErr("Could not read this image.")}
            style={dim ? { width: dim.w * scale, height: dim.h * scale, left: V / 2 + px - (dim.w * scale) / 2, top: V / 2 + py - (dim.h * scale) / 2 } : { visibility: "hidden" }} />
          <div className="cropring" aria-hidden="true" />
        </div>
        <label className="zoom"><span>Zoom</span><input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => setZoom(+e.target.value)} /></label>
        {err && <p className="alert bad" role="alert">{err}</p>}
        <div className="row crow">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn teal" disabled={!dim} onClick={save}>Save photo</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function usePhotoCrop(onSave) {
  const ref = useRef();
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  const pick = (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    const bad = checkImage(f);
    if (bad) return setErr(bad);
    setErr(""); setFile(f);
  };
  return {
    open: () => ref.current.click(),
    err,
    input: <input ref={ref} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={pick} />,
    dialog: file ? <CropDialog file={file} onCancel={() => setFile(null)} onSave={(d) => { setFile(null); onSave(d); }} /> : null,
  };
}
