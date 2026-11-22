{
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- hero: loop detects, LED goes green, arm lifts ---------- */
  const hero = $('.hero');
  if (reduce) hero.classList.add('done');
  else setTimeout(() => hero.classList.add('go'), 300);

  /* ---------- the trace ---------- */
  const svg = $('#trace');
  const ghost = $('#traceGhost');
  const live = $('#traceLive');
  const head = $('#traceHead');
  const scene = $('.scene');
  const cab = $('#cab');
  const nodes = $$('.node');
  let total = 0, samples = [], nodeY = [];

  const box = el => {
    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
  };

  // straight segments with 45 degree chamfers at every corner, like a PCB track
  const chamfer = (pts, r) => {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const l1 = Math.hypot(x1 - x0, y1 - y0) || 1, l2 = Math.hypot(x2 - x1, y2 - y1) || 1;
      const k = Math.min(r, l1 / 2, l2 / 2);
      d += ` L${x1 - (x1 - x0) / l1 * k} ${y1 - (y1 - y0) / l1 * k} L${x1 + (x2 - x1) / l2 * k} ${y1 + (y2 - y1) / l2 * k}`;
    }
    const last = pts[pts.length - 1];
    return d + ` L${last[0]} ${last[1]}`;
  };

  const build = () => {
    const W = document.documentElement.clientWidth;
    const H = document.documentElement.scrollHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.height = H + 'px';

    const c = box(cab), s = box(scene);
    const ns = nodes.map(n => { const b = box(n); return [b.x + b.w / 2, b.y + b.h / 2]; });
    const gx = ns[0][0];
    const sx = c.x + c.w * 0.3;
    const yOut = s.y + s.h + 22;

    const pts = [[sx, c.y + c.h - 4], [sx, yOut], [gx, yOut]];
    ns.forEach((p, i) => {
      if (i > 0) {
        // a small dog-leg between sections so it reads as a routed track
        const my = (ns[i - 1][1] + p[1]) / 2;
        pts.push([gx, my - 26], [gx + 16, my - 10], [gx + 16, my + 10], [gx, my + 26]);
      }
      pts.push(p);
    });

    const d = chamfer(pts, 14);
    ghost.setAttribute('d', d);
    live.setAttribute('d', d);
    total = live.getTotalLength();
    live.style.strokeDasharray = `${total} ${total}`;

    samples = [];
    for (let l = 0; l <= total; l += 6) samples.push([l, live.getPointAtLength(l).y]);
    samples.push([total, live.getPointAtLength(total).y]);
    nodeY = ns.map(p => p[1]);
    update();
  };

  // length along the track where it reaches a given page y
  const lengthAtY = y => {
    if (!samples.length || y <= samples[0][1]) return 0;
    let lo = 0, hi = samples.length - 1;
    if (y >= samples[hi][1]) return total;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid][1] < y) lo = mid; else hi = mid;
    }
    // walk forward through flat runs at the same height
    while (hi < samples.length - 1 && samples[hi + 1][1] <= y) hi++;
    return samples[hi][0];
  };

  let ticking = false;
  const update = () => {
    ticking = false;
    const read = scrollY + innerHeight * (reduce ? 10 : 0.66);
    const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    const len = atBottom ? total : lengthAtY(read);
    live.style.strokeDashoffset = total - len;
    if (len > 0 && len < total) {
      const p = live.getPointAtLength(len);
      head.setAttribute('cx', p.x); head.setAttribute('cy', p.y);
      head.style.opacity = 1;
    } else head.style.opacity = 0;
    nodes.forEach((n, i) => n.classList.toggle('lit', atBottom || read >= nodeY[i]));
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });

  let rb;
  const rebuild = () => { clearTimeout(rb); rb = setTimeout(build, 80); };
  new ResizeObserver(rebuild).observe(document.body);
  addEventListener('load', build);
  if (document.fonts) document.fonts.ready.then(build);
  build();

  /* ---------- nav highlight ---------- */
  const links = new Map($$('.nav nav a').map(a => [a.getAttribute('href').slice(1), a]));
  const navObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.remove('is-on'));
      const a = links.get(e.target.id) || (e.target.id === 'education' && links.get('experience'));
      if (a) a.classList.add('is-on');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  $$('main > section[id]').forEach(s => navObs.observe(s));

  /* ---------- skill modules light up ---------- */
  const mods = $$('.mod');
  const modObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.setProperty('--d', '0ms');
        setTimeout(() => e.target.classList.add('on'), reduce ? 0 : mods.indexOf(e.target) * 120);
        modObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  mods.forEach(m => modObs.observe(m));

  /* ---------- galleries and lightbox ---------- */
  const flat = /diagram|dashboard|log|ui|code|survey|labview|poster|synth|fsm|gauge|vhdl/;
  const fit = img => img.classList.toggle('contain', flat.test(img.getAttribute('src')));
  const lb = $('#lb'), lbImg = $('img', lb), lbCap = $('.lb__cap', lb);

  $$('.gallery').forEach(g => {
    const main = $('.gallery__main img', g);
    const thumbs = $$('.gallery__thumbs button', g);
    fit(main);
    thumbs.forEach(b => b.addEventListener('click', () => {
      const im = $('img', b);
      main.src = im.getAttribute('src');
      main.alt = im.alt;
      fit(main);
      thumbs.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }));
    $('.gallery__main', g).addEventListener('click', () => {
      lbImg.src = main.getAttribute('src');
      lbImg.alt = main.alt;
      lbCap.textContent = main.alt;
      if (lb.showModal) lb.showModal();
    });
  });
  $('.lb__close').addEventListener('click', () => lb.close());
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });

  $('#year').textContent = new Date().getFullYear();
}
