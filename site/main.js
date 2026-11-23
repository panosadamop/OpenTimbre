// OpenTimbre landing page interactions. No dependencies.
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ------------------------------------------------------------------
   * Animated layered waveform (hero + CTA banner)
   * ------------------------------------------------------------------ */
  function waveCanvas(canvas, { layers = 5, amp = 0.32, speed = 1, follow = false } = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, t = 0, mx = 0.5, my = 0.5, visible = true, raf = 0;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const colors = ['#5ef0c8', '#46d8b3', '#7ee0ff', '#8fa2ff', '#41d6b1', '#b3c0ff'];
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let l = 0; l < layers; l++) {
        const k = l / layers;
        ctx.beginPath();
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, colors[l % colors.length]);
        grad.addColorStop(1, 'transparent');
        ctx.strokeStyle = grad;
        ctx.globalAlpha = 0.18 + 0.5 * (1 - k);
        ctx.lineWidth = 1.2 + (1 - k) * 1.4;
        const freq = 1.6 + l * 0.55;
        const a = h * amp * (0.35 + 0.65 * (1 - k)) * (follow ? 0.6 + my * 0.8 : 1);
        for (let x = 0; x <= w; x += 4) {
          const p = x / w;
          const env = Math.sin(Math.PI * p) ** 1.5;                 // fade at the edges
          const bend = follow ? Math.exp(-((p - mx) ** 2) * 18) * 0.6 : 0; // swell near the cursor
          const y = h / 2 + env * a * (1 + bend) *
            (Math.sin(p * freq * 6.283 + t * (0.9 + k) + l) * 0.7 + Math.sin(p * freq * 13 - t * 1.3 + l * 2) * 0.3);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      t += 0.012 * speed;
      if (visible && !reduced) raf = requestAnimationFrame(draw);
    };
    resize(); draw();
    addEventListener('resize', resize, { passive: true });
    if (follow) addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth; my = 1 - e.clientY / innerHeight; }, { passive: true });
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !reduced) raf = requestAnimationFrame(draw);
    }).observe(canvas);
  }
  waveCanvas($('#wave'), { layers: 6, amp: 0.34, follow: true });
  waveCanvas($('#ctaWave'), { layers: 4, amp: 0.28, speed: 0.7 });

  /* ------------------------------------------------------------------
   * Reveal on scroll + animated counters
   * ------------------------------------------------------------------ */
  const countUp = (el) => {
    const target = +el.dataset.count, prefix = el.dataset.prefix || '';
    if (reduced || target === 0) { el.textContent = prefix + target; return; }
    const start = performance.now(), dur = 1400;
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur), eased = 1 - (1 - p) ** 4;
      el.textContent = prefix + Math.round(target * eased).toLocaleString('en');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      $$('[data-count]', e.target).forEach(countUp);
      io.unobserve(e.target);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach((el) => io.observe(el));

  /* ------------------------------------------------------------------
   * Nav: hide on scroll down, scroll-spy, mobile menu
   * ------------------------------------------------------------------ */
  const nav = $('.nav');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    nav.classList.toggle('hide', y > lastY && y > 400 && !nav.classList.contains('open'));
    lastY = y;
  }, { passive: true });
  const toggle = $('.nav-toggle');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  $$('.nav-links a').forEach((a) => a.addEventListener('click', () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }));
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting)
      $$('.nav-links a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((s) => spy.observe(s));

  /* ------------------------------------------------------------------
   * Pointer effects: cursor glow, 3D tilt + glare, magnetic buttons, spotlights
   * ------------------------------------------------------------------ */
  if (!reduced && matchMedia('(pointer: fine)').matches) {
    const glow = $('.cursor-glow');
    addEventListener('pointermove', (e) => { glow.style.transform = `translate(${e.clientX - 260}px, ${e.clientY - 260}px)`; }, { passive: true });

    const tilt = $('#tilt'), frame = tilt?.querySelector('.frame');
    if (tilt) {
      const hero = $('.hero');
      hero.addEventListener('pointermove', (e) => {
        const r = tilt.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.transform = `rotateY(${-8 + x * 14}deg) rotateX(${4 - y * 10}deg)`;
        frame.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
        frame.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
      });
      hero.addEventListener('pointerleave', () => { tilt.style.transform = ''; });
    }

    $$('.magnetic').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });

    $$('.feature').forEach((f) => f.addEventListener('pointermove', (e) => {
      const r = f.getBoundingClientRect();
      f.style.setProperty('--mx', `${e.clientX - r.left}px`);
      f.style.setProperty('--my', `${e.clientY - r.top}px`);
    }));
  }

  /* ------------------------------------------------------------------
   * Scroll-driven product tour
   * ------------------------------------------------------------------ */
  const steps = $$('.step'), shots = $$('.shot'), label = $('#tourLabel'), bar = $('.progress span');
  const show = (i) => {
    steps.forEach((s, j) => s.classList.toggle('active', j === i));
    shots.forEach((s, j) => s.classList.toggle('active', j === i));
    label.textContent = shots[i].dataset.label;
    bar.style.width = `${((i + 1) / shots.length) * 100}%`;
  };
  const tourIO = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) show(+e.target.dataset.shot);
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach((s) => {
    tourIO.observe(s);
    s.addEventListener('click', () => show(+s.dataset.shot));
  });

  /* ------------------------------------------------------------------
   * Typing terminal
   * ------------------------------------------------------------------ */
  const commands = [
    ['c', '# clone & install'],
    ['p', 'git clone https://github.com/panosadamop/OpenTimbre.git'],
    ['p', 'cd OpenTimbre && npm install'],
    ['c', '# generate the procedural demo instruments'],
    ['p', 'npm run fixtures'],
    ['p', 'npm run dev'],
    ['ok', '  ➜  Local:   http://localhost:5173/'],
  ];
  const term = $('#term code');
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const lineHTML = (kind, text) => kind === 'p' ? `<span class="p">$</span> ${esc(text)}` : `<span class="${kind}">${esc(text)}</span>`;
  const renderAll = () => { term.innerHTML = commands.map(([k, t]) => lineHTML(k, t)).join('\n'); };
  let typed = false;
  const typeOut = async () => {
    if (typed) return; typed = true;
    if (reduced) return renderAll();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const done = [];
    for (const [kind, text] of commands) {
      if (kind === 'p') {
        for (let i = 1; i <= text.length; i++) {
          term.innerHTML = [...done, `<span class="p">$</span> ${esc(text.slice(0, i))}<span class="caret"></span>`].join('\n');
          await sleep(18 + Math.random() * 30);
        }
        await sleep(260);
      } else { await sleep(kind === 'ok' ? 600 : 120); }
      done.push(lineHTML(kind, text));
      term.innerHTML = done.join('\n') + '\n<span class="caret"></span>';
    }
  };
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { typeOut(); o.disconnect(); } }, { threshold: 0.4 }).observe($('#term'));
  $('#copyCmds').addEventListener('click', async (e) => {
    const text = commands.filter(([k]) => k === 'p').map(([, t]) => t).join('\n');
    try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied ✓'; } catch { e.target.textContent = 'Select & copy'; }
    setTimeout(() => (e.target.textContent = 'Copy'), 1600);
  });

  /* ------------------------------------------------------------------
   * Playable microtonal mini-synth (Web Audio) + oscilloscope
   * ------------------------------------------------------------------ */
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const KEYMAP = 'awsedftgyhujk'; // C4..C5
  const keysEl = $('#keys'), centsEl = $('#cents'), centsOut = $('#centsOut'), freqEl = $('#freq');
  const first = 60, count = 13;
  const whites = [];
  for (let m = first; m < first + count; m++) {
    const black = NOTES[m % 12].includes('#');
    const b = document.createElement('button');
    b.className = 'key ' + (black ? 'black' : 'white');
    b.dataset.midi = m;
    b.setAttribute('aria-label', `Play ${NOTES[m % 12]}${Math.floor(m / 12) - 1}`);
    b.innerHTML = `<small>${black ? '' : NOTES[m % 12] + (Math.floor(m / 12) - 1)}</small>`;
    keysEl.append(b);
    if (!black) whites.push(b);
  }
  // Position black keys between their white neighbours.
  const placeBlacks = () => {
    const wW = 100 / whites.length;
    let wi = 0;
    $$('.key', keysEl).forEach((k) => {
      if (k.classList.contains('white')) { wi++; return; }
      k.style.left = `calc(${wi * wW}% - ${(wW * 0.62) / 2}%)`;
      k.style.width = `${wW * 0.62}%`;
    });
  };
  placeBlacks();

  let ac = null, analyser = null, master = null;
  const audio = () => {
    if (ac) return ac;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.5;
    const comp = ac.createDynamicsCompressor();
    analyser = ac.createAnalyser(); analyser.fftSize = 2048;
    master.connect(comp).connect(analyser).connect(ac.destination);
    drawScope();
    return ac;
  };
  const cents = () => +centsEl.value;
  const hz = (m) => 440 * 2 ** ((m - 69 + cents() / 100) / 12);
  // A plucked-string flavour: two detuned partial stacks through a closing low-pass filter.
  const pluck = (m) => {
    const ctx = audio(); const now = ctx.currentTime; const f = hz(m);
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(0.9, now + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(Math.min(12000, f * 14), now);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), now + 1.2);
    for (const [type, mult, det, g] of [['sawtooth', 1, -4, 0.35], ['triangle', 1, 5, 0.5], ['sine', 2, 0, 0.18]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mult; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og).connect(lp); o.start(now); o.stop(now + 2.5);
    }
    lp.connect(out).connect(master);
    freqEl.textContent = `${NOTES[m % 12]}${Math.floor(m / 12) - 1} ${cents() >= 0 ? '+' : ''}${cents()}¢ → ${f.toFixed(2)} Hz`;
  };
  const press = (k) => { if (!k) return; k.classList.add('down'); pluck(+k.dataset.midi); setTimeout(() => k.classList.remove('down'), 180); };
  keysEl.addEventListener('pointerdown', (e) => { const k = e.target.closest('.key'); if (k) { e.preventDefault(); press(k); } });
  addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || /input|textarea/i.test(document.activeElement?.tagName || '') && document.activeElement !== centsEl) return;
    const i = KEYMAP.indexOf(e.key.toLowerCase());
    if (i < 0) return;
    const r = keysEl.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return; // only when the demo is on screen
    press($(`.key[data-midi="${first + i}"]`, keysEl));
  });
  const setCents = (v) => {
    centsEl.value = v;
    centsOut.textContent = `${v >= 0 ? '+' : ''}${v}¢`;
    $$('.presets button').forEach((b) => b.classList.toggle('on', +b.dataset.c === +v));
  };
  centsEl.addEventListener('input', () => setCents(+centsEl.value));
  $$('.presets button').forEach((b) => b.addEventListener('click', () => setCents(+b.dataset.c)));

  const scope = $('#scope'), sctx = scope.getContext('2d');
  function drawScope() {
    const data = new Uint8Array(analyser.fftSize);
    const loop = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2), w = scope.clientWidth, h = scope.clientHeight;
      if (scope.width !== w * dpr) { scope.width = w * dpr; scope.height = h * dpr; sctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
      analyser.getByteTimeDomainData(data);
      sctx.clearRect(0, 0, w, h);
      const g = sctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#5ef0c8'); g.addColorStop(1, '#8fa2ff');
      sctx.strokeStyle = g; sctx.lineWidth = 2; sctx.beginPath();
      for (let i = 0; i < data.length; i += 2) {
        const x = (i / data.length) * w, y = (data[i] / 255) * h;
        i ? sctx.lineTo(x, y) : sctx.moveTo(x, y);
      }
      sctx.stroke();
      requestAnimationFrame(loop);
    };
    loop();
  }
})();
