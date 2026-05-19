// ============= 动态彩色光点背景 =============
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });

  const COUNT = 50;
  const PALETTE = [
    '#FF6B6B','#FF8E72','#FFA94D','#FFD43B','#C0EB75',
    '#69DB7C','#38D9A9','#63E6BE','#20C997','#66D9E8',
    '#4DABF7','#748FFC','#9775FA','#DA77F2','#F783AC',
    '#F06595','#E64980','#CC5DE8','#845EF7','#5C7CFA',
    '#339AF0','#22B8CF','#15AABF','#0CA678','#40C057',
    '#82C91E','#94D82D','#FCC419','#F59F00','#FD7E14',
    '#FF6B6B','#F06595','#E599F7','#B197FC','#91A7FF',
    '#74C0FC','#66D9E8','#63E6BE','#FFD8A8','#FFC078',
    '#FFA8A8','#FFD43B','#A9E34B','#69DB7C','#38D9A9',
    '#748FFC','#DA77F2','#F783AC','#FF922B','#FF8787'
  ];

  // 浅蓝底色 (从 CSS 变量读取，支持暗色模式)
  function getBgColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#eef4fb';
  }

  let W, H;
  function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
  resize(); addEventListener('resize', resize);

  const pts = [];
  for (let i = 0; i < COUNT; i++) {
    pts.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: 22 + Math.random() * 50,          // 半径 22~72px（缩小）  
      cr: 0,                                // 当前半径（从0开始渐变）
      c: PALETTE[i],
      ph: Math.random() * Math.PI * 2,      // 呼吸相位
      pd: 3500 + Math.random() * 6500,      // 呼吸周期
      aHi: 0.65 + Math.random() * 0.30,     // 最大不透明度 (提高到95%)
      aLo: 0.12 + Math.random() * 0.12,    // 最小不透明度 (提高到12-24%)
      ca: 0,                                 // 当前不透明度
      pulse: 0,                              // 波纹脉冲
      rippleR: 100 + Math.random() * 160,    // 波纹影响半径
      decay: 0.965 + Math.random() * 0.02,   // 脉冲衰减（慢很多: ~97%/帧）
      pulseMax: 0.30 + Math.random() * 0.25, // 最大脉冲强度（提高）
    });
  }

  let mx = -9999, my = -9999, tmx = -9999, tmy = -9999;
  let pmx = -9999, pmy = -9999;
  addEventListener('mousemove', e => { tmx = e.clientX; tmy = e.clientY; });
  addEventListener('mouseleave', () => { tmx = tmy = -9999; });

  let lt = performance.now();

  function loop(now) {
    const dt = Math.min(now - lt, 50); lt = now;
    mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06;
    const spd = Math.hypot(mx - pmx, my - pmy); pmx = mx; pmy = my;

    // 先画底色（跟随系统日/夜模式）
    ctx.fillStyle = getBgColor();
    ctx.fillRect(0, 0, W, H);

    for (const p of pts) {
      // 呼吸透明度
      const t = (now % p.pd) / p.pd;
      const ta = p.aLo + ((Math.sin(t * Math.PI * 2 + p.ph) + 1) / 2) * (p.aHi - p.aLo);

      // 漂移
      p.x += p.vx * (dt / 16); p.y += p.vy * (dt / 16);
      if (p.x < -p.r) p.x = W + p.r;
      if (p.x > W + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = H + p.r;
      if (p.y > H + p.r) p.y = -p.r;

      // 水波纹：鼠标移动时给附近粒子脉冲，再次划过可叠加
      if (mx > -5000 && spd > 0.3) {
        const dist = Math.hypot(p.x - mx, p.y - my);
        if (dist < p.rippleR) {
          const nd = dist / p.rippleR;
          const ripple = (1 - nd) * Math.sin(nd * Math.PI * 3) * Math.min(spd * 0.55, 1);
          if (ripple > 0.003) p.pulse = Math.min(p.pulse + ripple * 1.3, p.pulseMax);
        }
      }
      // 慢衰减
      p.pulse *= p.decay;
      if (p.pulse < 0.0005) p.pulse = 0;

      // 半径：基础 + 脉冲膨胀
      const tr = p.r * (1 + p.pulse);
      p.cr += (tr - p.cr) * 0.15;             // 更慢的收缩过渡

      // 不透明度平滑
      p.ca += (ta - p.ca) * 0.05;
      const alpha = Math.min(p.ca * (1 + p.pulse * 0.5), 0.9);

      // 绘制
      const rad = p.cr || p.r;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      g.addColorStop(0, p.c);
      g.addColorStop(0.35, p.c);
      g.addColorStop(1, 'transparent');

      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

// ============= 手动主题切换（含 localStorage 持久化） =============
(function () {
  const toggle = document.getElementById('themeToggle');
  const root = document.documentElement;
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  const STORAGE_KEY = 'latexSnipper-theme';

  function loadTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      root.setAttribute('data-theme', saved);
    } else {
      root.removeAttribute('data-theme'); // 无保存时跟随系统
    }
  }

  function isDark() {
    const attr = root.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return darkMQ.matches; // 无属性时跟随系统
  }

  function saveTheme() {
    const attr = root.getAttribute('data-theme');
    if (attr === 'dark') {
      localStorage.setItem(STORAGE_KEY, 'dark');
    } else if (attr === 'light') {
      localStorage.setItem(STORAGE_KEY, 'light');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  loadTheme();

  if (toggle) {
    function updateIcon() {
      toggle.textContent = isDark() ? '☀️' : '🌙';
    }
    updateIcon();
    darkMQ.addEventListener('change', () => {
      loadTheme(); // 系统切换时重载（若用户未手动设置，则 data-theme 为空，isDark 跟随系统）
      updateIcon();
    });

    toggle.addEventListener('click', () => {
      if (isDark()) {
        root.setAttribute('data-theme', 'light');
      } else {
        root.setAttribute('data-theme', 'dark');
      }
      saveTheme();
      updateIcon();
    });
  }
})();

// ============= 回到顶部按钮 =============
(function () {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  let fadeTimer = null;
  const FADE_DELAY = 4000; // 闲置 4 秒后半透明

  function toggle() {
    if (window.scrollY > 400) {
      btn.classList.add('visible');
      startFadeTimer();
    } else {
      btn.classList.remove('visible');
      btn.classList.remove('faded');
      clearFadeTimer();
    }
  }

  function startFadeTimer() {
    clearFadeTimer();
    fadeTimer = setTimeout(() => { btn.classList.add('faded'); }, FADE_DELAY);
  }

  function clearFadeTimer() {
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
  }

  window.addEventListener('scroll', toggle, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  btn.addEventListener('mouseenter', () => {
    btn.classList.remove('faded');
    clearFadeTimer();
  });
  btn.addEventListener('mouseleave', () => {
    startFadeTimer();
  });
  toggle();
})();

// ============= Hero 渐变滚动：句中 → 左上 (连续过渡) =============
(function () {
  const hero = document.querySelector('.hero-section');
  const content = document.querySelector('.hero-content');
  const title = document.querySelector('.hero-title');
  const subtitle = document.querySelector('.hero-sub');
  const ctas = document.querySelector('.hero-ctas');
  const header = document.querySelector('.hero-header');
  if (!hero || !content) return;

  // 缓存的动态值
  let heroH = 0, headerH = 56, maxScroll = 300;
  function recalc() {
    heroH = hero.getBoundingClientRect().height;
    headerH = header ? header.getBoundingClientRect().height : 56;
    maxScroll = Math.max(300, heroH * 0.82); // 更大的滚动范围，过渡更缓慢
  }
  recalc();
  window.addEventListener('resize', recalc);

  // 缓动插值函数
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  let rafId = null;
  function update() {
    rafId = null;
    const sy = window.scrollY;
    const p = clamp(sy / maxScroll, 0, 1); // 0=居中, 1=左上

    // ease-out: 用更平缓的曲线，整体过渡更柔和
    const ep = 1 - Math.pow(1 - p, 2.5); 

    // 竖直偏移: 从视口中心 → header下方
    const startY = (heroH - content.offsetHeight) / 2; // 居中时的顶部偏移
    const endY = headerH + 16; // 左上目标: header下方16px
    const ty = lerp(startY, endY, ep) - startY;

    // 标题字号: 2.1rem → 1.4rem
    const titleSize = lerp(2.1, 1.4, ep);
    // 副标题字号: 1.05rem → 0.9rem
    const subSize = lerp(1.05, 0.9, ep);
    // CTA按钮透明度: 1 → 0.5 (滚动时渐隐)
    const ctaOpacity = lerp(1, 0.3, ep);

    // 应用样式 (textAlign/alignItems 用原始 p，在滚动中段自然翻转)
    content.style.transform = `translateY(${ty.toFixed(1)}px)`;
    content.style.textAlign = p > 0.6 ? 'left' : 'center';
    content.style.alignItems = p > 0.6 ? 'flex-start' : 'center';
    title.style.fontSize = titleSize.toFixed(2) + 'rem';
    if (subtitle) {
      subtitle.style.fontSize = subSize.toFixed(2) + 'rem';
      subtitle.style.marginBottom = lerp(1, 0.4, ep).toFixed(2) + 'rem';
    }
    if (ctas) {
      ctas.style.opacity = ctaOpacity.toFixed(2);
      ctas.style.transform = `scale(${ctaOpacity.toFixed(2)})`;
    }
  }

  function onScroll() {
    if (!rafId) rafId = requestAnimationFrame(update);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  update(); // 初始状态
})();

// ============= 原有交互脚本 =============
// 简单前端交互脚本：平滑滚动、打字效果、scroll reveal
document.addEventListener('DOMContentLoaded', function () {
  // 平滑滚动（为内链链接）
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // 简单打字效果
  const typedEl = document.getElementById('typed');
  const words = ['快速插入', '实时预览', '智能识别'];
  if (typedEl) {
    let i = 0, j = 0, forward = true;
    function tick() {
      const w = words[i];
      typedEl.textContent = w.slice(0, j);
      if (forward) {
        if (j < w.length) j++; else { forward = false; setTimeout(tick, 900); return }
      } else {
        if (j > 0) j--; else { forward = true; i = (i + 1) % words.length }
      }
      setTimeout(tick, forward ? 80 : 40);
    }
    tick();
  }

  // scroll reveal
  const reveals = document.querySelectorAll('.card, .section-title, .hero-content');
  const onScroll = () => {
    const top = window.innerHeight;
    reveals.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < top - 60) el.classList.add('visible');
    });
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
});
