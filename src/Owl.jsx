import { useEffect, useMemo, useRef, useState } from "react";

const graphemes = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)].map((x) => x.segment) : Array.from(s));
const reduced = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const COLORS = ["#2f6fe0", "#3fd0ba", "#f0a02c", "#ff7a90", "#8497ff"];

const SHORTCUTS = [
  { en: "Add marks", ta: "மதிப்பெண் சேர்", to: ["builder", "modules"] },
  { en: "Import workbook", ta: "பணிப்புத்தகம் இறக்கு", to: ["builder", "sheet"] },
  { en: "Print report", ta: "அறிக்கை அச்சிடு", to: ["builder", "records"] },
  { en: "Term dates", ta: "தவணை தேதிகள்", to: ["calendar"] },
];

export default function Owl({ page, tips, enabled, setEnabled, lang, setLang, go, shortcuts = SHORTCUTS, floating = false, compact = false }) {
  const [bubble, setBubble] = useState(null);
  const [mood, setMood] = useState("idle");
  const [menu, setMenu] = useState(false);
  const [jump, setJump] = useState(false);
  const [idx, setIdx] = useState(0);
  const [n, setN] = useState(0);
  const [burst, setBurst] = useState(0);
  const root = useRef(), btn = useRef(), eyes = useRef([]);
  const hideT = useRef(), moodT = useRef(), lastAct = useRef(Date.now());
  const live = useRef({});
  live.current = { enabled, lang, compact, mood };

  const textOf = (i) => (tips.length ? tips[i % tips.length][lang] || tips[i % tips.length].en : "");
  const show = (text, ms = 8000) => {
    if (!text) return;
    setBubble({ text });
    clearTimeout(hideT.current);
    hideT.current = setTimeout(() => setBubble(null), ms);
  };
  const moodFor = (m, ms) => { setMood(m); clearTimeout(moodT.current); moodT.current = setTimeout(() => setMood("idle"), ms); };
  const wake = () => { lastAct.current = Date.now(); if (live.current.mood === "sleep") setMood("idle"); };

  // a tip appears whenever the page changes
  useEffect(() => {
    setIdx(0);
    if (enabled && !compact) show(tips.length ? (tips[0][lang] || tips[0].en) : "");
    return () => clearTimeout(hideT.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // typewriter
  const chars = useMemo(() => graphemes(bubble?.text || ""), [bubble?.text]);
  useEffect(() => {
    if (!bubble) return;
    if (reduced()) { setN(chars.length); return; }
    setN(0);
    const t = setInterval(() => setN((v) => { if (v >= chars.length) { clearInterval(t); return v; } return v + 1; }), 24);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubble?.text]);

  // reactions from the rest of the app
  useEffect(() => {
    const on = (e) => {
      const { type, en, ta } = e.detail || {};
      wake();
      if (type === "confetti") setBurst((b) => b + 1);
      moodFor(type === "celebrate" || type === "confetti" ? "celebrate" : type === "wave" ? "wave" : "think", 3200);
      const { enabled: on_, lang: l, compact: c } = live.current;
      if (on_ && !c && (en || ta)) show(l === "ta" ? ta || en : en || ta, 6000);
    };
    window.addEventListener("srb-owl", on);
    return () => window.removeEventListener("srb-owl", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eyes follow the pointer, owl falls asleep when idle
  useEffect(() => {
    let raf = 0;
    const move = (e) => {
      wake();
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = btn.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy) || 1, k = Math.min(1, dist / 200) * 2.2;
        eyes.current.forEach((el) => { if (el) el.style.transform = `translate(${(dx / dist) * k}px, ${(dy / dist) * k}px)`; });
      });
    };
    const act = () => wake();
    window.addEventListener("pointermove", move);
    window.addEventListener("keydown", act);
    window.addEventListener("pointerdown", act);
    const sleepT = setInterval(() => { if (Date.now() - lastAct.current > 60000 && live.current.mood === "idle") setMood("sleep"); }, 5000);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", move); window.removeEventListener("keydown", act); window.removeEventListener("pointerdown", act); clearInterval(sleepT); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // close the menu on outside click / Escape
  useEffect(() => {
    if (!menu) return;
    const down = (e) => { if (!root.current?.contains(e.target)) setMenu(false); };
    const key = (e) => { if (e.key === "Escape") { setMenu(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    root.current?.querySelector('[role^="menuitem"]')?.focus();
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [menu]);

  const onOwl = () => {
    wake();
    setJump(true); setTimeout(() => setJump(false), 600);
    if (compact) return;
    setBubble(null);
    setMenu((m) => !m);
  };
  const nextTip = () => { if (!tips.length) return; const i = (idx + 1) % tips.length; setIdx(i); show(textOf(i)); };
  const menuKey = (e) => {
    const items = [...root.current.querySelectorAll('[role^="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  };
  const t = (o) => (lang === "ta" ? o.ta : o.en);
  const pieces = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ x: Math.round((Math.random() - 0.5) * 220), y: Math.round(-130 + Math.random() * 190), r: Math.round(Math.random() * 540 - 270), d: (i % 6) * 0.05, c: COLORS[i % COLORS.length] })), [burst]);
  const full = bubble?.text || "";

  return (
    <div ref={root} className={"owl no-print" + (floating ? " floating" : "") + (compact ? " compact" : "")}>
      {bubble && !menu && !compact && (
        <div className="bubble" role="status">
          <span className="sr">{full}</span>
          <span className="btext" aria-hidden="true" lang={lang === "ta" ? "ta" : undefined}>{chars.slice(0, n).join("")}</span>
          <div className="bact">{tips.length > 1 ? <button className="linkbtn" onClick={nextTip}>{lang === "ta" ? "அடுத்த குறிப்பு" : "Next tip"}</button> : <span />}</div>
          <button className="bclose" aria-label="Hide tip" onClick={() => setBubble(null)}>×</button>
        </div>
      )}
      {menu && (
        <div className="omenu" role="menu" onKeyDown={menuKey}>
          {shortcuts.map((s) => <button key={s.en} role="menuitem" className="mi" onClick={() => { setMenu(false); go(...s.to); }}>{t(s)}</button>)}
          <div className="msep" />
          <button role="menuitem" className="mi" onClick={() => { setMenu(false); setEnabled(true); nextTip(); }}>{lang === "ta" ? "அடுத்த குறிப்பு" : "Next tip"}</button>
          <button role="menuitemcheckbox" aria-checked={enabled} className="mi" onClick={() => setEnabled(!enabled)}>{lang === "ta" ? `குறிப்புகள்: ${enabled ? "இயக்கம்" : "நிறுத்தம்"}` : `Tips: ${enabled ? "On" : "Off"}`}</button>
          <button role="menuitem" className="mi" onClick={() => setLang(lang === "ta" ? "en" : "ta")}>{lang === "ta" ? "Switch to English" : "தமிழில் பார்க்க"}</button>
        </div>
      )}
      <button ref={btn} className={"owlbtn mood-" + mood + (jump ? " jump" : "")} aria-haspopup={compact ? undefined : "menu"} aria-expanded={compact ? undefined : menu} aria-label="Owl helper" onClick={onOwl}>
        {mood === "sleep" && <span className="zzz" aria-hidden="true">Zzz</span>}
        {mood === "think" && <span className="qmark" aria-hidden="true">?</span>}
        {mood === "celebrate" && <span className="spark" aria-hidden="true">✦</span>}
        <svg viewBox="0 0 64 64" width="52" height="52" aria-hidden="true">
          <g className="owl-bob">
            <ellipse cx="25" cy="60" rx="5" ry="2.2" fill="#f0a02c" />
            <ellipse cx="39" cy="60" rx="5" ry="2.2" fill="#f0a02c" />
            <path d="M15 24 L13 11 L25 18z" fill="#1f4fb5" />
            <path d="M49 24 L51 11 L39 18z" fill="#1f4fb5" />
            <ellipse cx="32" cy="38" rx="19" ry="21" fill="#2f6fe0" />
            <ellipse className="wing-l" cx="12.5" cy="40" rx="6" ry="12" fill="#1f4fb5" />
            <ellipse className="wing-r" cx="51.5" cy="40" rx="6" ry="12" fill="#1f4fb5" />
            <ellipse cx="32" cy="46" rx="11" ry="12.5" fill="#d6e6ff" />
            <path d="M26 44 q2 2 4 0 M34 44 q2 2 4 0 M29 50 q3 2.5 6 0" fill="none" stroke="#8fb4f0" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="24" cy="31" r="8" fill="#fff" />
            <circle cx="40" cy="31" r="8" fill="#fff" />
            <g className="pupil" ref={(el) => (eyes.current[0] = el)}><circle cx="24" cy="31.5" r="3.6" fill="#16233a" /><circle cx="25.2" cy="30.2" r="1.1" fill="#fff" /></g>
            <g className="pupil" ref={(el) => (eyes.current[1] = el)}><circle cx="40" cy="31.5" r="3.6" fill="#16233a" /><circle cx="41.2" cy="30.2" r="1.1" fill="#fff" /></g>
            <ellipse className="lid" cx="24" cy="31" rx="8.2" ry="8.2" fill="#2f6fe0" />
            <ellipse className="lid" cx="40" cy="31" rx="8.2" ry="8.2" fill="#2f6fe0" />
            <path d="M32 34 l-3.6 5.6 h7.2z" fill="#f0a02c" />
            <circle cx="17.5" cy="37" r="2" fill="#ff9db0" opacity=".6" />
            <circle cx="46.5" cy="37" r="2" fill="#ff9db0" opacity=".6" />
            <path d="M8 20 L32 9 L56 20 L32 29z" fill="#233a73" />
            <rect x="24" y="25" width="16" height="6" rx="2" fill="#233a73" />
            <g className="tassel"><path d="M55 20 v10" stroke="#f0a02c" strokeWidth="1.8" strokeLinecap="round" /><circle cx="55" cy="32" r="2.2" fill="#f0a02c" /></g>
          </g>
        </svg>
      </button>
      {burst > 0 && (
        <div className="confetti" key={burst} aria-hidden="true">
          {pieces.map((p, i) => <i key={i} style={{ "--x": p.x + "px", "--y": p.y + "px", "--r": p.r + "deg", "--d": p.d + "s", "--c": p.c }} />)}
        </div>
      )}
    </div>
  );
}
