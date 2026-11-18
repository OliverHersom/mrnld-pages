(function () {
  'use strict';

  function initHoverIndex(container) {
    // --- 1. Selectors ---
    const items = Array.from(container.querySelectorAll('[data-anm-hi-item]'));
    const list = container.querySelector('[data-anm-hi-list]');
    const card = container.querySelector('[data-anm-hi-card]');
    const frame = container.querySelector('[data-anm-hi-frame]');

    if (items.length < 2 || !list) return null;

    // --- 2. Config ---
    const range = Math.min(6, Math.max(1.2, parseFloat(container.dataset.anmRange || '2')));
    const dim = Math.min(40, Math.max(0, parseFloat(container.dataset.anmDim || '14'))) / 100;
    const follow = Math.min(20, Math.max(3, parseFloat(container.dataset.anmFollow || '9')));

    // --- 3. Constants ---
    // Brightness falls off with distance from the lens on this curve, so the rows next to it stay readable.
    const CURVE = 1.6;
    // How much bigger the name under the lens gets (0.15 = 15%).
    const GROW = 0.15;
    const WIPE = 0.7;
    const SETTLE = 0.001;
    const DESKTOP_QUERY = '(min-width: 768px)';
    const RESIZE_DEBOUNCE = 150;

    // --- 4. State ---
    const count = items.length;
    const state = { f: Math.floor((count - 1) / 2), target: Math.floor((count - 1) / 2) };
    let active = -1;
    let centers = [];
    let imgs = [];
    let wipes = [];
    let layer = 1;
    let demoTl = null;
    let lastTime = 0;
    let dirty = true;
    let reduced = false;
    let resizeTimer = null;

    // --- 5. Helpers ---
    function measure() {
      const box = container.getBoundingClientRect();
      centers = items.map((el) => {
        const r = el.getBoundingClientRect();
        return r.top - box.top + r.height / 2;
      });
      // The card sits bottom right with its bottom edge on the list's last row.
      if (!card) return;
      if (window.matchMedia(DESKTOP_QUERY).matches) {
        card.style.top = (list.getBoundingClientRect().bottom - box.top - card.offsetHeight).toFixed(1) + 'px';
      } else {
        card.style.removeProperty('top');
      }
    }

    // The pointer's height maps onto the list as a continuous row number, so the lens glides between rows.
    function rowAt(y) {
      if (y <= centers[0]) return 0;
      for (let i = 1; i < count; i++) {
        if (y <= centers[i]) return i - 1 + (y - centers[i - 1]) / (centers[i] - centers[i - 1]);
      }
      return count - 1;
    }

    // --- 6. Animation routines ---
    function buildImages() {
      imgs = items.map((item, i) => {
        const img = document.createElement('img');
        img.className = 'hi_img';
        img.src = item.getAttribute('data-image') || '';
        img.alt = '';
        img.decoding = 'async';
        img.style.setProperty('--hi-clip-top', i === Math.round(state.f) ? '0%' : '100%');
        frame.appendChild(img);
        return img;
      });
      wipes = imgs.map(() => null);
    }

    // The new photo comes in from the side the lens is moving toward and lands over the last one.
    function showImage(i, dir) {
      const img = imgs[i];
      if (!img) return;
      if (wipes[i]) wipes[i].kill();
      img.style.zIndex = String(++layer);
      const fromTop = dir > 0 ? '100%' : '0%';
      const fromBottom = dir > 0 ? '0%' : '100%';
      wipes[i] = gsap.fromTo(img,
        { '--hi-clip-top': fromTop, '--hi-clip-bottom': fromBottom },
        { '--hi-clip-top': '0%', '--hi-clip-bottom': '0%', duration: reduced ? 0 : WIPE, ease: 'annnimate' });
    }

    function setActive(i) {
      if (i === active) return;
      const dir = active < 0 ? 1 : Math.sign(i - active);
      active = i;
      showImage(i, dir);
    }

    function paint() {
      items.forEach((el, i) => {
        const near = Math.max(0, 1 - Math.abs(i - state.f) / range);
        const glow = Math.pow(near, CURVE);
        el.style.opacity = (dim + (1 - dim) * glow).toFixed(3);
        el.style.transform = 'scale(' + (1 + GROW * glow).toFixed(4) + ')';
      });
      setActive(Math.round(state.f));
    }

    function tick() {
      const now = gsap.ticker.time;
      const dt = Math.max(1 / 240, now - lastTime);
      lastTime = now;
      const before = state.f;
      state.f = reduced ? state.target : state.f + (state.target - state.f) * (1 - Math.exp(-dt * follow));
      if (Math.abs(state.target - state.f) < SETTLE) state.f = state.target;
      if (state.f === before && !dirty) return;
      dirty = false;
      paint();
    }

    // Pre-built and paused (Timeline inspector contract): the lens runs down the list and back.
    function buildDemo() {
      const start = state.target;
      demoTl = gsap.timeline({ paused: true });
      demoTl
        .to(state, { target: Math.min(count - 1, start + 3), duration: 1.2, ease: 'annnimateInOut', data: { label: 'Lens moves down the list' } }, 0.01)
        .to(state, { target: start, duration: 1.2, ease: 'annnimateInOut', data: { label: 'Lens moves back up' } }, '+=0.4');
    }

    function demo() {
      if (demoTl && demoTl.isActive()) return null;
      demoTl.restart(true, false);
      return demoTl;
    }

    // --- 7. Event listeners ---
    function handlePointerMove(e) {
      if (e.pointerType === 'touch') return;
      if (demoTl) demoTl.pause();
      state.target = rowAt(e.clientY - container.getBoundingClientRect().top);
    }

    function handlePointerDown(e) {
      const i = items.indexOf(e.target.closest('[data-anm-hi-item]'));
      if (i > -1) state.target = i;
    }

    function handleFocusIn(e) {
      const i = items.indexOf(e.target);
      if (i > -1) state.target = i;
    }

    function handleKey(e) {
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowDown' && i < count - 1) { e.preventDefault(); items[i + 1].focus(); }
      else if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); items[i - 1].focus(); }
    }

    function handleResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        measure();
        dirty = true;
      }, RESIZE_DEBOUNCE);
    }

    function handleVisibility() {
      if (document.hidden) gsap.globalTimeline.pause();
      else gsap.globalTimeline.resume();
    }

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerdown', handlePointerDown);
    list.addEventListener('focusin', handleFocusIn);
    list.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    // --- 8. Initial DOM state ---
    if (frame) buildImages();
    measure();
    active = Math.round(state.f);
    paint();
    buildDemo();
    lastTime = gsap.ticker.time;
    gsap.ticker.add(tick);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); dirty = true; });

    // --- 9. Reduced motion ---
    const mm = gsap.matchMedia();
    mm.add({ motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
      reduced = !!ctx.conditions.reduce;
      dirty = true;
    });

    // --- 10. Public API ---
    function refresh() {
      measure();
      dirty = true;
    }

    function kill() {
      gsap.ticker.remove(tick);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerdown', handlePointerDown);
      list.removeEventListener('focusin', handleFocusIn);
      list.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(resizeTimer);
      mm.revert();
      if (demoTl) demoTl.kill();
      wipes.forEach((tw) => { if (tw) tw.kill(); });
      imgs.forEach((img) => img.remove());
      items.forEach((el) => { el.style.removeProperty('opacity'); el.style.removeProperty('transform'); });
      if (card) card.style.removeProperty('top');
    }

    return { refresh, kill, demo };
  }

  function waitForGSAP(cb, attempts) {
    attempts = attempts || 0;
    if (typeof gsap !== 'undefined' && typeof CustomEase !== 'undefined') { cb(); return; }
    if (attempts < 100) setTimeout(() => waitForGSAP(cb, attempts + 1), 50);
    else console.error('[Annnimate] gsap/CustomEase failed to load');
  }

  waitForGSAP(() => {
    gsap.registerPlugin(CustomEase);
    CustomEase.create('annnimate', 'M0,0 C0.3,0.9 0.1,1 1,1');
    CustomEase.create('annnimateInOut', 'M0,0 C0.7,0 0.16,1 1,1');

    const instances = [];
    document.querySelectorAll('[data-anm-hover-index]').forEach((el) => {
      const api = initHoverIndex(el);
      if (api) instances.push(api);
    });
    window.Anm = window.Anm || {};
    window.Anm.HoverIndex = {
      refresh: () => instances.forEach((i) => i.refresh()),
      kill: () => instances.forEach((i) => i.kill()),
      demo: () => (instances[0] ? instances[0].demo() : null),
    };
  });

})();
