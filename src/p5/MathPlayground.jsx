import { useEffect, useRef, useState, memo } from "react";

/*
 * MathPlayground — interactive mathematical generative art (Canvas 2D, no lib).
 *
 * A selectable set of live math visualizations drawn on a plain HTML5 canvas:
 *   - Fourier  : a chain of rotating vectors (epicycles) tracing a curve
 *   - Lissajous: x = sin(3t), y = sin(4t)
 *   - Field    : a pseudo-noise vector flow field
 *   - Rose     : r = cos(kθ)
 *
 * React owns the UI (mode buttons + aria); the canvas is a visual enhancement,
 * never content. Theme-aware, reduced-motion → static frame, off-screen / tab
 * hidden → paused.
 */

const MODES = [
  { id: "fourier", label: "Fourier" },
  { id: "knot", label: "Knot" },
  { id: "spirograph", label: "Spirograph" },
  { id: "butterfly", label: "Butterfly" },
  { id: "sierpinski", label: "Sierpinski" },
  { id: "surface", label: "3D Surface" },
  { id: "julia", label: "Julia" },
  { id: "cloud", label: "Probability Cloud" },
];

const isDark = () => {
  const a = document.documentElement.getAttribute("data-theme");
  if (a === "dark" || a === "light") return a === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

function MathPlayground() {
  const hostRef = useRef(null);
  const [mode, setMode] = useState("fourier");
  const modeRef = useRef("fourier");
  modeRef.current = mode;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement("canvas");
    canvas.className = "playground-p5";
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let cancelled = false;
    let ro = null;
    let io = null;
    let running = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const state = { w: 0, h: 0, t: 0, trace: [] };
    const mouse = { x: -1, y: -1 };

    const size = () => {
      const cw = host.clientWidth || Math.floor(host.getBoundingClientRect().width) || 320;
      const ch = host.clientHeight || Math.floor(host.getBoundingClientRect().height) || 420;
      state.w = Math.max(2, cw);
      state.h = Math.max(2, ch);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = state.w * dpr;
      canvas.height = state.h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    const color = () =>
      isDark()
        ? { l: "rgba(128,172,255,", g: "rgba(150,194,255," }
        : { l: "rgba(32,88,216,", g: "rgba(84,150,255," };

    const onPointer = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onVis = () => {
      if (reducedMotion) return;
      document.hidden ? stop() : start();
    };
    const onVisible = (entries) => {
      if (reducedMotion) return;
      entries[0].isIntersecting ? start() : stop();
    };

    function start() {
      if (cancelled || running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function draw() {
      const { w, h } = state;
      if (w < 4 || h < 4) return;
      ctx.clearRect(0, 0, w, h);
      // A soft designed backdrop so the panel reads as intentional, not blank.
      const bg = ctx.createRadialGradient(
        w * 0.5, h * 0.5, 10,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.62,
      );
      const c = color();
      bg.addColorStop(0, c.l + "0.08)");
      bg.addColorStop(1, c.l + "0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowBlur = 14;
      ctx.shadowColor = c.l + "0.4)";
      switch (modeRef.current) {
        case "knot":
          drawKnot(ctx, state, c, w, h);
          break;
        case "spirograph":
          drawSpirograph(ctx, state, c, w, h);
          break;
        case "butterfly":
          drawButterfly(ctx, state, c, w, h);
          break;
        case "sierpinski":
          drawSierpinski(ctx, state, c, w, h);
          break;
        case "surface":
          drawSurface(ctx, state, c, w, h);
          break;
        case "julia":
          drawJulia(ctx, state, c, w, h);
          break;
        case "cloud":
          drawCloud(ctx, state, c, w, h);
          break;
        default:
          drawFourier(ctx, state, c, w, h);
      }
      ctx.restore();
    }

    function loop() {
      if (cancelled) return;
      state.t += 0.016;
      draw();
      raf = requestAnimationFrame(loop);
    }

    if (reducedMotion) {
      draw();
    } else {
      start();
    }
    ro = new ResizeObserver(() => {
      size();
      if (reducedMotion) draw();
    });
    ro.observe(host);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    io = new IntersectionObserver(onVisible, { threshold: 0.05 });
    io.observe(host);

    return () => {
      cancelled = true;
      stop();
      ro?.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <section className="section-space playground-section" aria-labelledby="playground-title">
      <div className="ls-container">
        <header className="section-heading reveal">
          <span className="scene-index">EXPLORE · MATHEMATICAL PLAYGROUND</span>
          <h2 id="playground-title">用数学，玩数学。</h2>
          <p>一组在浏览器里实时生成的数学可视化。选中一个，看它在你的屏幕上被绘制出来。</p>
        </header>
        <div className="playground-stage reveal">
          <div className="playground-toolbar" role="group" aria-label="选择数学可视化">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={mode === m.id ? "is-active" : ""}
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div
            ref={hostRef}
            className="playground-canvas"
            aria-label="交互式数学可视化"
          />
        </div>
      </div>
    </section>
  );
}

function drawFourier(ctx, state, c, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const base = Math.min(w, h) * 0.18;
  let x = cx;
  let y = cy;
  const N = 24;
  ctx.lineWidth = 1;
  for (let k = 0; k < N; k++) {
    const ang = state.t * (k + 1) * 2.2;
    const r = base / (k + 1);
    const nx = x + Math.cos(ang) * r;
    const ny = y + Math.sin(ang) * r;
    ctx.strokeStyle = c.l + "0.5)";
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    x = nx;
    y = ny;
  }
  state.trace.push({ x, y });
  if (state.trace.length > 160) state.trace.shift();
  ctx.strokeStyle = c.l + "0.95)";
  ctx.beginPath();
  for (let i = 0; i < state.trace.length; i++) {
    const p = state.trace[i];
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.fillStyle = c.l + "1)";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function grad(ctx, h1, h2, w, h) {
  const dark = isDark();
  const s = dark ? 70 : 76;
  const l1 = dark ? 62 : 42;
  const l2 = dark ? 74 : 58;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${h1} ${s}% ${l1}%)`);
  g.addColorStop(1, `hsl(${h2} ${s}% ${l2}%)`);
  return g;
}

function drawSpirograph(ctx, state, c, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const S = Math.min(w, h) * 0.32;
  const R = 0.9;
  const r = 0.32;
  const d = 0.5;
  const tEnd = Math.min(40, state.t) * Math.PI * 2;
  ctx.strokeStyle = grad(ctx, 190, 262, w, h);
  ctx.beginPath();
  for (let i = 0; i <= 1800; i++) {
    const t = (i / 1800) * tEnd;
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    const px = cx + x * S;
    const py = cy + y * S;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawKnot(ctx, state, c, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const S = Math.min(w, h) * 0.28;
  const rot = state.t * 0.6;
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = grad(ctx, 252, 330, w, h);
  ctx.beginPath();
  for (let i = 0; i <= 420; i++) {
    const t = (i / 420) * Math.PI * 2;
    let x = Math.sin(t) + 2 * Math.sin(2 * t);
    let y = Math.cos(t) - 2 * Math.cos(2 * t);
    let z = -Math.sin(3 * t);
    const cA = Math.cos(rot);
    const sA = Math.sin(rot);
    const x1 = x * cA - z * sA;
    const z1 = x * sA + z * cA;
    const cB = Math.cos(rot * 0.8);
    const sB = Math.sin(rot * 0.8);
    const y2 = y * cB - z1 * sB;
    const px = cx + x1 * S;
    const py = cy + y2 * S;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawButterfly(ctx, state, c, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const S = Math.min(w, h) * 0.32;
  // Draw the full iconic butterfly once (t ∈ [0, 12π]) and stop; no retrace.
  const tEnd = Math.min(12 * Math.PI, state.t * 4);
  ctx.strokeStyle = grad(ctx, 16, 330, w, h);
  ctx.beginPath();
  for (let i = 0; i <= 1200; i++) {
    const t = (i / 1200) * tEnd;
    const r =
      Math.exp(Math.sin(t)) -
      2 * Math.cos(4 * t) -
      Math.pow(Math.sin((2 * t - Math.PI) / 24), 5);
    const x = r * Math.sin(t);
    const y = -r * Math.cos(t);
    const px = cx + x * S;
    const py = cy + y * S;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawSierpinski(ctx, state, c, w, h) {
  const v = [
    [w * 0.5, h * 0.1],
    [w * 0.14, h * 0.88],
    [w * 0.86, h * 0.88],
  ];
  if (!state.chaos) {
    state.chaos = {
      x: (v[0][0] + v[1][0] + v[2][0]) / 3,
      y: (v[0][1] + v[1][1] + v[2][1]) / 3,
      pts: [],
    };
  }
  const ch = state.chaos;
  for (let i = 0; i < 60; i++) {
    const n = Math.floor(Math.random() * 3);
    ch.x = (ch.x + v[n][0]) / 2;
    ch.y = (ch.y + v[n][1]) / 2;
    ch.pts.push([ch.x, ch.y]);
  }
  if (ch.pts.length > 5000) ch.pts.splice(0, ch.pts.length - 5000);
  ctx.lineWidth = 1;
  const g = grad(ctx, 22, 42, w, h);
  ctx.strokeStyle = g;
  ctx.beginPath();
  ctx.moveTo(v[0][0], v[0][1]);
  ctx.lineTo(v[1][0], v[1][1]);
  ctx.lineTo(v[2][0], v[2][1]);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = g;
  for (const p of ch.pts) ctx.fillRect(p[0], p[1], 1.4, 1.4);
}

// A rotating 3D parametric "wave surface" rendered as a drifting point cloud.
function drawSurface(ctx, state, c, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const S = Math.min(w, h) * 0.33;
  const rot = state.t * 0.5;
  const g = grad(ctx, 200, 290, w, h);
  ctx.fillStyle = g;
  const uMax = Math.min(1.2, state.t * 0.04);
  for (let u = 0; u < uMax; u += 0.06) {
    for (let v = 0; v < uMax; v += 0.06) {
      const x = u * 2 - 1;
      const y = v * 2 - 1;
      const zz = Math.sin(x * Math.PI) * Math.cos(y * Math.PI) * 0.3;
      const cA = Math.cos(rot);
      const sA = Math.sin(rot);
      const x1 = x * cA - zz * sA;
      const z1 = x * sA + zz * cA;
      const cB = Math.cos(rot * 0.7);
      const sB = Math.sin(rot * 0.7);
      const y1 = y * cB - z1 * sB;
      ctx.fillRect(cx + x1 * S, cy + y1 * S, 1.8, 1.8);
    }
  }
}

// Julia set, rendered at a reduced resolution then scaled (cheap enough to
// animate: the constant c drifts so the fractal morphs over time).
function drawJulia(ctx, state, c, w, h) {
  const off = document.createElement("canvas");
  // Higher resolution (2x on typical sizes) keeps it crisp; cap iterations for
  // frame rate.
  const n = w * h > 300000 ? 2 : 3;
  const rw = Math.ceil(w / n);
  const rh = Math.ceil(h / n);
  off.width = rw;
  off.height = rh;
  const octx = off.getContext("2d");
  const img = octx.createImageData(rw, rh);
  const data = img.data;
  const cxa = rw / 2;
  const cya = rh / 2;
  const S = Math.min(rw, rh) * 0.55;
  const t = state.t;
  const ca = -0.7 + 0.03 * Math.sin(t * 0.2);
  const cb = 0.27 + 0.03 * Math.cos(t * 0.26);
  let idx = 0;
  const maxIter = 26;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      let zx = (x - cxa) / S;
      let zy = (y - cya) / S;
      let i = 0;
      while (i < maxIter && zx * zx + zy * zy < 4) {
        const nx = zx * zx - zy * zy + ca;
        zy = 2 * zx * zy + cb;
        zx = nx;
        i++;
      }
      let r, g, b;
      if (i >= maxIter) {
        r = 5;
        g = 9;
        b = 18;
      } else {
        const m = i / maxIter;
        r = Math.floor(40 + m * 150);
        g = Math.floor(80 + m * 40);
        b = Math.floor(180 + m * 70);
      }
      data[idx++] = r;
      data[idx++] = g;
      data[idx++] = b;
      data[idx++] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, w, h);
}

// A drifting Gaussian "probability cloud" of accumulating points.
function drawCloud(ctx, state, c, w, h) {
  if (!state.parts) state.parts = [];
  const cx = w * 0.5;
  const cy = h * 0.5;
  const S = Math.min(w, h) * 0.32;
  const g = grad(ctx, 150, 262, w, h);
  ctx.fillStyle = g;
  for (let i = 0; i < 40; i++) {
    const cxc = (Math.random() - 0.5) * 0.4;
    const cyc = (Math.random() - 0.5) * 0.4;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(-2 * Math.log(1 - Math.random() + 1e-6)) * 0.32;
    state.parts.push([cx + (cxc + Math.cos(a) * r) * S, cy + (cyc + Math.sin(a) * r) * S]);
  }
  if (state.parts.length > 4000) state.parts.splice(0, state.parts.length - 4000);
  for (const p of state.parts) ctx.fillRect(p[0], p[1], 1.4, 1.4);
}

export default memo(MathPlayground);
