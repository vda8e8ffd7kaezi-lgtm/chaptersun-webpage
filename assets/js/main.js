document.addEventListener('DOMContentLoaded', () => {
  // initial load flags for CSS transitions
  document.body.classList.add('is-loaded');
  const preloader = document.getElementById('preloader');
  const hasPreloader = !!preloader;
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash || '';
  const forcePreloader = params.has('preloader') || /preloader/i.test(hash);
  const PRELOADER_VERSION = '2025-09-09-1';
  let visited = (function() {
    try {
      const v = localStorage.getItem('preloaderVersion');
      if (v) return v === PRELOADER_VERSION; // version-aware gating
      // fallback to old flag; if present but no version, treat as not visited to show once after update
      const legacy = localStorage.getItem('siteVisited');
      return false; // force one-time replay after deploy to restore effect
    } catch (_) { return false; }
  })();
  // Optional reset: add ?resetPreloader or #resetPreloader to URL to clear the flag
  const resetPreloader = params.has('resetPreloader') || /resetPreloader/i.test(hash);
  if (resetPreloader) {
    try { localStorage.removeItem('siteVisited'); localStorage.removeItem('preloaderVersion'); } catch (_) {}
    visited = false;
  }

  // (Chatbot is embedded only on index.html)
  // If there is no preloader (non-top pages), reveal immediately
  if (!hasPreloader) {
    // ensure content shows without preloader transition
    setTimeout(() => document.body.classList.add('is-loadedFirst'), 50);
  }

  // Preloader with 0-100% progress (always on top page)
  if (preloader) {
    const inner = preloader.querySelector('.preloader-inner') || preloader;
    const ring = inner.querySelector('.preloader-ring');
    const percentEl = document.createElement('div');
    percentEl.className = 'preloader-percent';
    percentEl.textContent = '0%';
    const brandEl = inner.querySelector('.preloader-brand');
    if (brandEl) inner.insertBefore(percentEl, brandEl); else inner.appendChild(percentEl);

    let p = 0; // progress
    let loaded = document.readyState === 'complete';
    const start = performance.now();
    const minShow = 1200; // ms minimum display time

    const tick = () => {
      const now = performance.now();
      const elapsed = now - start;
      const target = loaded ? 100 : 95;
      const accel = loaded ? 0.12 : 0.06;
      p += (target - p) * accel + (loaded ? 0.4 : 0.2);
      if (p > target) p = target;
      const pct = Math.round(p);
      percentEl.textContent = `${pct}%`;
      if (ring) ring.style.setProperty('--p', String(Math.max(0, Math.min(1, p / 100))));

      if (loaded && p >= 100 && elapsed >= minShow) {
        // trigger content reveal and door opening
        document.body.classList.add('is-loadedFirst');
        preloader.classList.add('hide');
        try {
          localStorage.setItem('siteVisited', '1');
          localStorage.setItem('preloaderVersion', PRELOADER_VERSION);
        } catch (_) {}
        // wait for doors to finish (1.2s) then remove
        setTimeout(() => preloader && preloader.remove(), 1400);
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
    window.addEventListener('load', () => { loaded = true; });
    // Safety: force finish after 5s even if load event never fires
    setTimeout(() => { loaded = true; }, 5000);

    // Hard failsafe: if for any reason we didn't finish, force close preloader
    setTimeout(() => {
      if (!document.body.classList.contains('is-loadedFirst')) {
        document.body.classList.add('is-loadedFirst');
        preloader.classList.add('hide');
        setTimeout(() => preloader && preloader.remove(), 1000);
      }
    }, 8000);
  }

  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // --- Hero underline width = first line of lead ---
  (function matchHeroUnderlineToLead() {
    const hero = document.querySelector('.hero-niplanning .hero-copy');
    const lead = hero && hero.querySelector('.lead');
    if (!hero || !lead) return;

    const update = () => {
      // Measure the width of the first visual line in the lead paragraph
      let w = 0;
      const rects = lead.getClientRects();
      if (rects && rects.length) w = rects[0].width; else w = lead.getBoundingClientRect().width;
      const maxW = hero.getBoundingClientRect().width - 20; // small padding
      w = Math.max(60, Math.min(Math.round(w), Math.round(maxW)));
      hero.style.setProperty('--hero-underline', `${w}px`);
    };

    const debounced = (() => {
      let t; return () => { clearTimeout(t); t = setTimeout(update, 50); };
    })();

    // Run on ready, after fonts, and on resize
    window.addEventListener('load', update);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(update).catch(() => {});
    }
    update();
    window.addEventListener('resize', debounced);
    window.addEventListener('orientationchange', debounced);
  })();

  // --- Page Transitions (slide animation) ---
  (function initPageTransitions() {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'page-fade';
    document.body.appendChild(overlay);

    // Entry: slide overlay out to reveal page
    if (sessionStorage.getItem('pageTransition') === '1') {
      overlay.classList.add('cover'); // Start covered
      requestAnimationFrame(() => {
        overlay.classList.add('leave'); // Trigger slide-out animation
      });
      sessionStorage.removeItem('pageTransition');
    }

    const DURATION = 600; // ms (must match CSS transition duration)
    const transitionAndGo = (href) => {
      overlay.classList.add('cover'); // Trigger slide-in
      setTimeout(() => { window.location.href = href; }, DURATION);
    };

    // Intercept internal link clicks
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      if (a.hasAttribute('download')) return;
      if (a.getAttribute('target') && a.getAttribute('target') !== '_self') return;
      const href = a.getAttribute('href');
      if (!href) return;
      if (href.startsWith('#')) return;
      let url;
      try { url = new URL(href, window.location.href); } catch (_) { return; }
      if (!/^https?:$/.test(url.protocol)) return;
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;

      e.preventDefault();
      try { sessionStorage.setItem('pageTransition', '1'); } catch (_) {}
      transitionAndGo(url.href);
    });
  })();
  
  

  // 既存のフォームイベントリスナーを置き換え
  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      // 既存のメッセージを削除
      const existingMsg = form.querySelector('.form-message');
      if (existingMsg) existingMsg.remove();

      // 同意チェック（未同意なら送信を止める）
      const agree = form.querySelector('#agree');
      if (agree && !agree.checked) {
        e.preventDefault();
        const msg = document.createElement('p');
        msg.className = 'form-message form-error';
        msg.textContent = '送信前にプライバシーポリシーに同意してください。';
        const checkboxWrap = agree.closest('.checkbox');
        if (checkboxWrap) checkboxWrap.after(msg); else form.appendChild(msg);
        agree.focus();
        return;
      }

      // 同意済みの場合はデフォルト送信（FormsubmitにPOST）を許可
      // ここでは preventDefault しない
    });
  }

  // Header shadow on scroll
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    if (!header) return;
    if (window.scrollY > 0) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // --- 3D Perspective Rotation on Scroll (Repeatable) ---
  const perspectiveWrappers = document.querySelectorAll('.perspective-wrapper');
  if (perspectiveWrappers.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        // isIntersectingプロパティで画面内に入ったか（true）、出たか（false）を判定
        if (entry.isIntersecting) {
          // 画面に入ったら in-view クラスを追加してアニメーションを再生
          entry.target.classList.add('in-view');
        } else {
          // 画面から出たら in-view クラスを削除してアニメーションをリセット
          entry.target.classList.remove('in-view');
        }
      });
    }, {
      threshold: 0.2, // セクションが20%見えたら判定
      rootMargin: "0px 0px -50px 0px"
    });

    perspectiveWrappers.forEach(wrapper => {
      io.observe(wrapper);
    });
  }

  // Steps-immersive: horizontal list item reveal on scroll (inside its own scroller)
  document.querySelectorAll('.steps-immersive').forEach((list) => {
    const items = Array.from(list.querySelectorAll(':scope > li'));
    if (!items.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, {
      root: list,
      threshold: 0.6
    });
    items.forEach((it) => io.observe(it));
  });

  // Global scroll FX for titles, cards and testimonials
  (function initGlobalScrollFx() {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = Array.from(document.querySelectorAll('.section-title, .card.link, .testimonial, .reveal-rise'));
    if (!targets.length) return;
    if (reduce) {
      targets.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    targets.forEach((el) => io.observe(el));
  })();

  // --- Aurora color shift by visible section (CSS vars) ---
  (function initAuroraColorShift() {
    const sections = Array.from(document.querySelectorAll('main > section'));
    if (!sections.length) return;

    const hexToRgba = (hex, a) => {
      if (!hex) return null;
      const m = hex.trim().match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
      if (!m) return null;
      const r = parseInt(m[1],16), g = parseInt(m[2],16), b = parseInt(m[3],16);
      return `rgba(${r},${g},${b},${a})`;
    };

    let currentId = null;
    const applyColors = (el) => {
      const c1 = el.getAttribute('data-aurora-color1');
      const c2 = el.getAttribute('data-aurora-color2');
      // brighten global aurora glows (slightly higher alpha)
      const v1 = hexToRgba(c1, 0.24);
      const v2 = hexToRgba(c2, 0.18);
      const root = document.documentElement;
      if (v1) root.style.setProperty('--aurora-color-1', v1);
      if (v2) root.style.setProperty('--aurora-color-2', v2);
    };

    const io = new IntersectionObserver((entries) => {
      let best = null;
      entries.forEach((e) => {
        if (e.isIntersecting) {
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
      });
      if (best) {
        const id = best.target.id || best.target.className || best.target.tagName;
        if (id !== currentId) {
          currentId = id;
          applyColors(best.target);
        }
      }
    }, { threshold: [0.25, 0.5, 0.75], rootMargin: '0px 0px -20% 0px' });

    sections.forEach(s => io.observe(s));

    // Initial application based on viewport center
    const pickInitial = () => {
      const midY = window.innerHeight / 2;
      let candidate = null, dist = Infinity;
      sections.forEach((s) => {
        const r = s.getBoundingClientRect();
        const center = r.top + r.height / 2;
        const d = Math.abs(center - midY);
        if (r.bottom > 0 && r.top < window.innerHeight && d < dist) { candidate = s; dist = d; }
      });
      if (candidate) applyColors(candidate);
    };
    pickInitial();
    window.addEventListener('load', pickInitial);
  })();

  // (reverted) 3D reveal uses transition via .in class only

  // --- Global Parallax Glows (lightweight, GPU-friendly) ---
  (function initParallaxGlows() {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const l1 = document.createElement('div');
    const l2 = document.createElement('div');
    l1.className = 'aurora-layer aurora-layer-1';
    l2.className = 'aurora-layer aurora-layer-2';
    Object.assign(l1.style, {
      position: 'fixed', inset: '-20vmax', zIndex: -2, pointerEvents: 'none',
      background: 'radial-gradient(42vmax 30vmax at 22% 18%, color-mix(in srgb, var(--aurora-color-1, rgba(120,160,255,0.7)) 70%, white 30%), transparent 72%)',
      transform: 'translate3d(0,0,0)', willChange: 'transform'
    });
    Object.assign(l2.style, {
      position: 'fixed', inset: '-20vmax', zIndex: -2, pointerEvents: 'none',
      background: 'radial-gradient(40vmax 28vmax at 78% 26%, color-mix(in srgb, var(--aurora-color-2, rgba(140,210,200,0.65)) 70%, white 30%), transparent 72%)',
      transform: 'translate3d(0,0,0)', willChange: 'transform'
    });
    document.body.appendChild(l1);
    document.body.appendChild(l2);

    if (reduce) return; // no motion

    let mx = 0, my = 0;
    const apply = () => {
      const amp = (window.innerWidth <= 720) ? 6 : 12; // smaller shift on mobile
      const ax = (mx * amp).toFixed(2) + 'px';
      const ay = (my * amp).toFixed(2) + 'px';
      l1.style.transform = `translate3d(${ax}, ${ay}, 0)`;
      l2.style.transform = `translate3d(${(-mx * amp).toFixed(2)}px, ${(-my * amp).toFixed(2)}px, 0)`;
    };
    window.addEventListener('mousemove', (e) => {
      const w = window.innerWidth, h = window.innerHeight;
      mx = (e.clientX / w) - 0.5;
      my = (e.clientY / h) - 0.5;
      apply();
    }, { passive: true });
    window.addEventListener('scroll', apply, { passive: true });
    apply();
  })();

  // --- Hero Headline Typewriter ---
  (function initHeroTypewriter() {
    const h1 = document.querySelector('.hero-niplanning .hero-copy h1');
    if (!h1) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (h1.dataset.typewriterInit === '1') return;

    const full = (h1.textContent || '').trim();
    if (!full) return;
    h1.dataset.typewriterInit = '1';

    // Preserve layout height to avoid jump during typing
    const preRect = h1.getBoundingClientRect();
    if (preRect && preRect.height) h1.style.minHeight = Math.ceil(preRect.height) + 'px';

    // Build typewriter structure
    const textSpan = document.createElement('span');
    textSpan.className = 'typewriter-text';
    const caret = document.createElement('span');
    caret.className = 'typewriter-caret';
    h1.setAttribute('aria-label', full);
    h1.textContent = '';
    h1.appendChild(textSpan);
    h1.appendChild(caret);

    const startTyping = () => {
      // Start shortly after rise-in finishes
      const START_DELAY = 500; // ms
      setTimeout(() => {
        let i = 0;
        const step = () => {
          if (i <= full.length) {
            textSpan.textContent = full.slice(0, i);
            i++;
            // Variable pacing for punctuation
            const prev = full.charAt(i - 1);
            let spd = 55;
            if (/[,、，.。!！?？]/.test(prev)) spd += 180;
            if (/\s/.test(prev)) spd = 30;
            setTimeout(step, spd);
          } else {
            caret.classList.add('done');
            setTimeout(() => { try { caret.remove(); } catch (_) {} }, 800);
            // Release min-height after finish
            setTimeout(() => { h1.style.minHeight = ''; }, 300);
          }
        };
        step();
      }, START_DELAY);
    };

    if (document.body.classList.contains('is-loadedFirst')) startTyping();
    else {
      const mo = new MutationObserver(() => {
        if (document.body.classList.contains('is-loadedFirst')) {
          mo.disconnect();
          startTyping();
        }
      });
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  })();


  // --- 3D Particle Stream ---
  (function initParticleStream() {
    const section = document.querySelector('.hero-niplanning');
    const canvas = section && section.querySelector('.hero-particles');
    if (!section || !canvas || typeof THREE === 'undefined' || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      if (canvas) canvas.style.display = 'none';
      return;
    }

    let w = section.offsetWidth;
    let h = section.offsetHeight;
    const mouse = new THREE.Vector2(0, 0);

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 2000);
    camera.position.z = 1000;
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Particles
    const particleCount = 8000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color('#3b82f6'); // blue-500
    const color2 = new THREE.Color('#06b6d4'); // cyan-500

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 2000; // x
      positions[i3 + 1] = (Math.random() - 0.5) * 2000; // y
      positions[i3 + 2] = (Math.random() - 0.5) * 2000; // z (奥行き)

      const mixedColor = color1.clone().lerp(color2, Math.random());
      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.5,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.9,
      depthWrite: false, // 重なり順をあまり考慮せず、光が綺麗に混ざるように
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // 3. Animate
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // 粒子をZ軸方向に流す
      geometry.attributes.position.array.forEach((val, i) => {
        if (i % 3 === 2) { // Z座標のみを更新
          geometry.attributes.position.array[i] += 4.0; // 流れる速度
          
          // 粒子がカメラを通り過ぎたら、奥に再配置する
          if (geometry.attributes.position.array[i] > 1000) {
            geometry.attributes.position.array[i] = -1000;
          }
        }
      });
      geometry.attributes.position.needsUpdate = true;
      
      // マウスの位置に応じてカメラを滑らかに動かす
      camera.position.x += (mouse.x * 200 - camera.position.x) * 0.05;
      camera.position.y += (-mouse.y * 200 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // 4. Interaction & Resize
    const onMouseMove = (event) => {
      mouse.x = event.clientX / w - 0.5;
      mouse.y = event.clientY / h - 0.5;
    };
    section.addEventListener('mousemove', onMouseMove, { passive: true });

    const onResize = () => {
      w = section.offsetWidth;
      h = section.offsetHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener('resize', onResize);
  })();

  // --- Hero Canvas Noise (lightweight blobs) ---
  (function initHeroCanvasNoise() {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const section = document.querySelector('.hero-niplanning');
    const canvas = section && section.querySelector('.hero-noise');
    if (!section || !canvas) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      w = section.clientWidth; h = section.clientHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Colors from CSS vars if present
    const root = getComputedStyle(document.documentElement);
    const c1 = root.getPropertyValue('--aurora-color-1') || 'rgba(120,160,255,0.18)';
    const c2 = root.getPropertyValue('--aurora-color-2') || 'rgba(140,210,200,0.14)';

    const blobs = Array.from({ length: 5 }).map((_, i) => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() * 0.22 + 0.06) * (Math.random() < 0.5 ? -1 : 1),
      vy: (Math.random() * 0.22 + 0.06) * (Math.random() < 0.5 ? -1 : 1),
      r: 0.26 + Math.random() * 0.20,
      color: i % 2 ? c1.trim() : c2.trim()
    }));

    let running = false;
    function draw(ts) {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      blobs.forEach(b => {
        b.x += b.vx * 0.0022; b.y += b.vy * 0.0022;
        if (b.x < 0 || b.x > 1) b.vx *= -1;
        if (b.y < 0 || b.y > 1) b.vy *= -1;
        const cx = b.x * w, cy = b.y * h;
        const rad = Math.min(w, h) * b.r;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, b.color.replace(/\)$/, ',0.34)'));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(draw);
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && !reduce) {
          if (!running) { running = true; requestAnimationFrame(draw); }
        } else {
          running = false;
        }
      });
    }, { threshold: 0.1 });
    io.observe(section);
  })();


  /* Removed legacy hero animation (initTextParticles) start
    let w = section.offsetWidth;
    let h = section.offsetHeight;
    const mouse = new THREE.Vector2(-9999, -9999);
    const targetMouse = new THREE.Vector2(0, 0);

    // 1. Renderer, Scene, Camera
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.z = 80;

    // 2. Get Text Pixel Coordinates
    let particlePositions = [];
    const getTextCoordinates = () => {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = w;
      tempCanvas.height = h;

      const lines = textEl.innerHTML.replace(/<br>/g, '\n').split('\n');
      const style = window.getComputedStyle(textEl);
      tempCtx.fillStyle = 'white';
      tempCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      tempCtx.textAlign = 'center';
      tempCtx.textBaseline = 'middle';
      
      lines.forEach((line, i) => {
        tempCtx.fillText(line, w / 2, h / 2 + (i - (lines.length -1) / 2) * 60);
      });

      const imageData = tempCtx.getImageData(0, 0, w, h).data;
      const positions = [];
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          if (imageData[(x + y * w) * 4 + 3] > 128) {
            positions.push({
              x: (x - w / 2),
              y: -(y - h / 2)
            });
          }
        }
      }
      return positions;
    };
    particlePositions = getTextCoordinates();

    // 3. Create Particles
    const geometry = new THREE.BufferGeometry();
    const particleCount = particlePositions.length;
    const posArray = new Float32Array(particleCount * 3);
    const targetArray = new Float32Array(particleCount * 3);
    const randomArray = new Float32Array(particleCount * 3);
    const colorArray = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color('#3b82f6');
    const color2 = new THREE.Color('#06b6d4');

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Target position (text)
      targetArray[i3] = particlePositions[i].x;
      targetArray[i3 + 1] = particlePositions[i].y;
      targetArray[i3 + 2] = 0;
      
      // Random position (sphere)
      const phi = Math.acos(-1 + (2 * i) / particleCount);
      const theta = Math.sqrt(particleCount * Math.PI) * phi;
      randomArray[i3] = 150 * Math.cos(theta) * Math.sin(phi);
      randomArray[i3 + 1] = 150 * Math.sin(theta) * Math.sin(phi);
      randomArray[i3 + 2] = 150 * Math.cos(phi);

      // Initial position is random
      posArray[i3] = randomArray[i3];
      posArray[i3 + 1] = randomArray[i3 + 1];
      posArray[i3 + 2] = randomArray[i3 + 2];
      
      // Color
      const gradient = (particlePositions[i].y + h/4) / (h/2);
      const mixedColor = color1.clone().lerp(color2, Math.max(0, Math.min(1, gradient)));
      colorArray[i3] = mixedColor.r;
      colorArray[i3 + 1] = mixedColor.g;
      colorArray[i3 + 2] = mixedColor.b;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.setAttribute('aTarget', new THREE.BufferAttribute(targetArray, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randomArray, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colorArray, 3));

    const material = new THREE.PointsMaterial({
      size: 0.7,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.9,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // 4. Animate
    let mouseForce = 0;
    const animate = () => {
      mouse.x += (targetMouse.x - mouse.x) * 0.05;
      mouse.y += (targetMouse.y - mouse.y) * 0.05;
      
      const explosionFactor = 1.0 - Math.sqrt(mouse.x * mouse.x + mouse.y * mouse.y) * 1.5;
      mouseForce = THREE.MathUtils.lerp(mouseForce, explosionFactor, 0.08);

      const positions = geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        // Interpolate between random and target positions based on mouseForce
        positions[i3] = THREE.MathUtils.lerp(randomArray[i3], targetArray[i3], mouseForce);
        positions[i3+1] = THREE.MathUtils.lerp(randomArray[i3+1], targetArray[i3+1], mouseForce);
        positions[i3+2] = THREE.MathUtils.lerp(randomArray[i3+2], targetArray[i3+2], mouseForce);
      }
      geometry.attributes.position.needsUpdate = true;
      
      points.rotation.y = mouse.x * 0.2;
      points.rotation.x = -mouse.y * 0.2;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // 5. Interaction & Resize
    section.addEventListener('mousemove', (e) => {
      targetMouse.x = (e.clientX / w - 0.5) * 2;
      targetMouse.y = (e.clientY / h - 0.5) * 2;
    });
    section.addEventListener('mouseleave', () => {
      targetMouse.x = 0;
      targetMouse.y = 0;
    });

    const onResize = () => {
      w = section.offsetWidth;
      h = section.offsetHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      // Recalculate text positions on resize
      particlePositions = getTextCoordinates();
      // NOTE: For simplicity we skip dynamic resizing of particle buffers here
    };
    window.addEventListener('resize', onResize);
  })();
  */

  // Proximity lift for glass cards (move up slightly when cursor is near)
  (function initProximityLift() {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    // Scope to: ホームの「サービス」, 「導入の流れ」, 「お客様の声」, 「選ばれる理由」, 事業についてページのカード
    const cards = Array.from(document.querySelectorAll('.services .card.link, .process-immersive .steps-immersive li, .testimonials .card.testimonial, .features .card.feature, #services-overview .card'));
    if (!cards.length) return;

    let mx = -9999, my = -9999, ticking = false;
    const MAX_DIST = 140; // px radius around element
    const MAX_LIFT = -6;  // px translateY at closest

    const distToRect = (x, y, r) => {
      const dx = (x < r.left) ? r.left - x : (x > r.right ? x - r.right : 0);
      const dy = (y < r.top) ? r.top - y : (y > r.bottom ? y - r.bottom : 0);
      return Math.hypot(dx, dy);
    };

    const apply = () => {
      cards.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const d = distToRect(mx, my, rect);
        let lift = 0;
        if (d < MAX_DIST) {
          const t = 1 - (d / MAX_DIST); // 0..1
          lift = MAX_LIFT * (0.3 + 0.7 * t); // start gentle, stronger when closer
        }
        el.style.setProperty('--lift', lift.toFixed(2) + 'px');
      });
    };

    const onMove = (e) => {
      mx = e.clientX; my = e.clientY;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => { apply(); ticking = false; });
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', () => {
      mx = my = -9999; apply();
    }, { passive: true });
    const rafApply = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => { apply(); ticking = false; });
      }
    };
    window.addEventListener('scroll', rafApply, { passive: true });
    window.addEventListener('resize', rafApply);
    document.querySelectorAll('.steps-immersive').forEach((s) => s.addEventListener('scroll', rafApply, { passive: true }));
  })();
});

// Card hover glow effect (services, features, testimonials, process steps, services page cards)
const glowCards = document.querySelectorAll('.card.link, .card.feature, .card.testimonial, .process-immersive .steps-immersive li, #services-overview .card');
glowCards.forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--x', `${x}px`);
    card.style.setProperty('--y', `${y}px`);
  });
});

// --- Cursor Aura (Double Ring + Interactive States) ---
const cursorAura = document.querySelector('.cursor-aura');
if (cursorAura) {
  let mouseX = 0, mouseY = 0; // current pointer
  let auraX = 0, auraY = 0;   // eased follower

  // Track pointer position
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  // Smooth follow
  const animateAura = () => {
    auraX += (mouseX - auraX) * 0.12;
    auraY += (mouseY - auraY) * 0.12;
    // Use left/top so CSS transform can center via translate(-50%, -50%)
    cursorAura.style.left = `${auraX}px`;
    cursorAura.style.top = `${auraY}px`;
    requestAnimationFrame(animateAura);
  };
  animateAura();

  // Body state: link-hover
  const hoverTargets = document.querySelectorAll('a, button, [role="button"], .card.link');
  hoverTargets.forEach((el) => {
    el.addEventListener('mouseenter', () => document.body.classList.add('link-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('link-hover'));
    el.addEventListener('focusin',   () => document.body.classList.add('link-hover'));
    el.addEventListener('focusout',  () => document.body.classList.remove('link-hover'));
  });

  // Body state: dragging (mousedown / drag)
  const setDragging = (on) => {
    document.body.classList.toggle('dragging', !!on);
  };
  window.addEventListener('mousedown', () => setDragging(true));
  window.addEventListener('mouseup', () => setDragging(false));
  window.addEventListener('mouseleave', () => setDragging(false));
  window.addEventListener('dragstart', () => setDragging(true));
  window.addEventListener('dragend', () => setDragging(false));

  // Hide custom cursor on inputs / textareas / contenteditable
  const textTargets = document.querySelectorAll('input, textarea, select, [contenteditable="true"]');
  const hideCursor = () => cursorAura.classList.add('text');
  const showCursor = () => cursorAura.classList.remove('text');
  textTargets.forEach((el) => {
    el.addEventListener('mouseenter', hideCursor);
    el.addEventListener('mouseleave', showCursor);
    el.addEventListener('focusin', hideCursor);
    el.addEventListener('blur', showCursor);
  });
}

// (magnetic effect removed by request)

/* Crossfade page transition was removed per request */

// (removed)
