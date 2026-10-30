// The page shell both machines share: a pale studio with soft shadows, a 1600 x 900 console scaled to the window,
// panels, buttons, sliders, charts, callouts with leader lines, an orbit you drag, quality tiers, and an auto tour
// whose cursor walks to each control and presses it. Any real click, drag, wheel or key hands control to the visitor;
// 25 s of quiet hands it back. Once the visitor has control the camera only moves when they move it.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

export const W = 1600;
export const H = 900;
export const IDLE = 25;
export const D2R = Math.PI / 180;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

const CSS = ({bg, ink, mute, line, panel, accent}) => `
html,body{margin:0;height:100%;background:${bg};overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;color:${ink};font-family:Inter,system-ui,sans-serif}
#gl{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.ui{position:absolute;inset:0;pointer-events:none}
.ui.hide .pn,.ui.hide .co,.ui.hide .hd{display:none}
.hd{position:absolute;left:28px;top:22px}
.hd .t{font:700 30px Inter,sans-serif;letter-spacing:-.4px}
.hd .t b{color:${accent};font-weight:700}
.hd .s{font:600 10px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:${mute};margin-top:6px;text-transform:uppercase}
.hd .big{font:700 54px 'JetBrains Mono',monospace;letter-spacing:-2px;margin-top:14px;line-height:1}
.hd .big small{font:600 11px 'JetBrains Mono',monospace;letter-spacing:1.4px;color:${mute};margin-left:8px}
.hd .sub2{font:600 11px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${ink};margin-top:6px;text-transform:uppercase}
.pn{position:absolute;background:${panel};border:1px solid ${line};border-radius:6px;padding:10px 12px;pointer-events:auto;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.pn h4{margin:0 0 8px;font:700 9.5px 'JetBrains Mono',monospace;letter-spacing:1.5px;color:${ink};text-transform:uppercase;display:flex;gap:8px}
.pn h4 i{font-style:normal;color:${accent}}
.pn h4 span{margin-left:auto;color:${mute};font-weight:600}
.rows{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;font:600 10px 'JetBrains Mono',monospace;letter-spacing:.6px}
.rows .k{color:${mute};text-transform:uppercase}
.rows .v{text-align:right;white-space:nowrap}
.rows .v.on{color:${accent}}
.bg{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;align-items:center}
.bg .lab{font:600 8.5px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:${mute};width:100%;margin:2px 0 1px;text-transform:uppercase}
.b{font:700 9px 'JetBrains Mono',monospace;letter-spacing:1px;padding:5px 8px;border:1px solid ${line};background:#fff;color:${ink};border-radius:3px;cursor:pointer;text-transform:uppercase;user-select:none;white-space:nowrap}
.b:hover{border-color:${mute}}
.b.on{background:${ink};border-color:${ink};color:#fff}
.b.acc.on{background:${accent};border-color:${accent}}
.sl{margin:8px 0 4px;font:600 9px 'JetBrains Mono',monospace;letter-spacing:1px;text-transform:uppercase}
.sl .top{display:flex;color:${mute}}.sl .top b{margin-left:auto;color:${ink}}
.sl .tr{position:relative;height:18px;margin-top:4px;cursor:ew-resize;touch-action:none}
.sl .tr:before{content:'';position:absolute;left:0;right:0;top:8px;height:2px;background:${line}}
.sl .fill{position:absolute;left:0;top:8px;height:2px;background:${accent}}
.sl .kn{position:absolute;top:3px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#fff;border:2px solid ${accent}}
.phase{display:flex;gap:3px;margin-top:2px}
.phase div{flex:1;text-align:center;font:700 8px 'JetBrains Mono',monospace;letter-spacing:.8px;padding:5px 0;border-radius:2px;background:rgba(0,0,0,.04);color:${mute}}
.phase div.on{background:${accent};color:#fff}
.co{position:absolute;inset:0;overflow:visible}
.co svg{position:absolute;inset:0;overflow:visible}
.co .lb{position:absolute;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${ink};background:rgba(255,255,255,.92);border:1px solid ${line};padding:3px 6px;border-radius:2px;white-space:nowrap;text-transform:uppercase;transform:translate(-50%,-50%)}
.co .lb small{display:block;font-weight:600;color:${mute};letter-spacing:.6px;margin-top:1px}
.chip{position:absolute;left:800px;top:16px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 11px;border:1px solid ${line};border-radius:4px;background:rgba(255,255,255,.95);font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto;color:${ink}}
.chip i{display:block;width:6px;height:6px;border-radius:50%;background:${accent}}
.chip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.cur{position:absolute;left:0;top:0;width:22px;height:22px;pointer-events:none;z-index:9;transition:none}
.ring{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border:2px solid ${accent};border-radius:50%;pointer-events:none;opacity:0}
.warn{position:absolute;left:800px;top:48px;transform:translateX(-50%);font:700 10px 'JetBrains Mono',monospace;letter-spacing:1.4px;color:#fff;background:${accent};padding:5px 10px;border-radius:3px;display:none}
`;

export function createShell(opt) {
  const theme = {bg: '#f3f1ec', ink: '#1b1d20', mute: '#8a8d93', line: '#e0ddd6', panel: 'rgba(255,255,255,.88)', accent: '#e0482b', ...opt.theme};
  const style = document.createElement('style');
  style.textContent = CSS(theme);
  document.head.appendChild(style);
  document.title = opt.title;
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const root = document.createElement('div');
  root.className = 'ui';
  app.appendChild(root);

  // ------------------------------------------------------------ the studio
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.bg);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pm.dispose();
  const camera = new THREE.PerspectiveCamera(opt.fov ?? 30, W / H, opt.near ?? 0.1, opt.far ?? 2000);
  const sun = new THREE.DirectionalLight('#fffaf2', 2.2);
  sun.castShadow = true;
  const ext = opt.shadowExtent ?? 100;
  Object.assign(sun.shadow.camera, {left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: ext * 8});
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 6;
  sun.position.set(...(opt.sun ?? [-0.4, 1, 0.5]).map((v) => v * ext * 3));
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#d8d2c6', 0.7));
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ext * 12, ext * 12),
    new THREE.ShadowMaterial({color: '#4a4136', opacity: 0.18, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4}),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = opt.floorY ?? 0;
  floor.receiveShadow = true;
  scene.add(floor);

  // ------------------------------------------------------------ fit and quality tiers
  const TIERS = [{pr: 2, shadow: 2048}, {pr: 1.5, shadow: 1024}, {pr: 1, shadow: 512}];
  let tier = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700 ? 2 : 0;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    renderer.setPixelRatio(clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
    renderer.setSize(W, H, false);
  };
  const applyTier = () => {
    sun.shadow.mapSize.set(TIERS[tier].shadow, TIERS[tier].shadow);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };

  // ------------------------------------------------------------ console builders
  const el = (tag, cls, parent, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    (parent ?? root).appendChild(e);
    return e;
  };
  const btn = {};
  const actions = {};
  const ui = {
    root,
    btn,
    el,
    header(title, sub) {
      const h = el('div', 'hd');
      h.innerHTML = `<div class="t">${title}</div><div class="s">${sub}</div><div class="big"></div><div class="sub2"></div>`;
      return {big: h.querySelector('.big'), sub: h.querySelector('.sub2')};
    },
    panel(x, y, w, h, title, right = '') {
      const p = el('div', 'pn');
      Object.assign(p.style, {left: `${x}px`, top: `${y}px`, width: `${w}px`, ...(h ? {height: `${h}px`} : {})});
      el('h4', '', p, `<i>›››</i>${title}<span>${right}</span>`);
      return p;
    },
    rows(parent, list) {
      const g = el('div', 'rows', parent);
      const v = {};
      for (const [k, label] of list) {
        el('div', 'k', g, label);
        v[k] = el('div', 'v', g, '–');
      }
      return (k, text, on = false) => {
        if (v[k].textContent !== text) v[k].textContent = text;
        v[k].classList.toggle('on', on);
      };
    },
    group(parent, label) {
      const g = el('div', 'bg', parent);
      if (label) el('div', 'lab', g, label);
      return g;
    },
    // a button: `fn` runs on a visitor's click and on the tour's
    button(parent, id, label, fn, cls = '') {
      const b = el('div', 'b ' + cls, parent, label);
      btn[id] = b;
      actions[id] = fn;
      b.addEventListener('click', (e) => {
        if (e.isTrusted) fn();
      });
      return b;
    },
    slider(parent, id, {label, min, max, value, fmt, set}) {
      const s = el('div', 'sl', parent);
      s.innerHTML = `<div class="top">${label}<b></b></div><div class="tr"><div class="fill"></div><div class="kn"></div></div>`;
      const tr = s.querySelector('.tr');
      const out = s.querySelector('b');
      const api = {
        value,
        tr,
        set(v, call = true) {
          api.value = clamp(v, min, max);
          const k = (api.value - min) / (max - min);
          s.querySelector('.fill').style.width = `${k * 100}%`;
          s.querySelector('.kn').style.left = `${k * 100}%`;
          out.textContent = fmt(api.value);
          if (call) set(api.value);
        },
        // where the knob sits for value v, in stage pixels (the tour's cursor drags it there)
        at(v) {
          const r = tr.getBoundingClientRect();
          const [x0, y] = toStage(r.left, r.top + r.height / 2);
          const [x1] = toStage(r.right, r.top);
          return [x0 + ((clamp(v, min, max) - min) / (max - min)) * (x1 - x0), y];
        },
      };
      const move = (e) => {
        const r = tr.getBoundingClientRect();
        api.set(min + clamp((e.clientX - r.left) / r.width, 0, 1) * (max - min));
      };
      tr.addEventListener('pointerdown', (e) => {
        tr.setPointerCapture(e.pointerId);
        move(e);
        const up = () => {
          tr.removeEventListener('pointermove', move);
          tr.removeEventListener('pointerup', up);
        };
        tr.addEventListener('pointermove', move);
        tr.addEventListener('pointerup', up);
      });
      api.set(value, false);
      sliders[id] = api;
      return api;
    },
    canvas(parent, w, h) {
      const c = el('canvas', '', parent);
      c.width = w * 2;
      c.height = h * 2;
      Object.assign(c.style, {width: `${w}px`, height: `${h}px`, display: 'block'});
      const ctx = c.getContext('2d');
      ctx.scale(2, 2);
      return {ctx, w, h};
    },
    phases(parent, names) {
      const g = el('div', 'phase', parent);
      const d = names.map((n) => el('div', '', g, n));
      return (i) => d.forEach((x, j) => x.classList.toggle('on', i === j));
    },
    setOn(ids, onId) {
      for (const id of ids) btn[id]?.classList.toggle('on', id === onId);
    },
    theme,
  };
  const sliders = {};

  // ------------------------------------------------------------ callouts: a label with a thin leader into the part
  const co = el('div', 'co');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  co.appendChild(svg);
  const callouts = [];
  const callout = (text, small, anchor, dx, dy, on = () => true) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('stroke', theme.ink);
    line.setAttribute('stroke-width', '0.8');
    line.setAttribute('fill', 'none');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '2.2');
    dot.setAttribute('fill', theme.accent);
    svg.append(line, dot);
    const lb = el('div', 'lb', co, `${text}${small ? `<small>${small}</small>` : ''}`);
    callouts.push({anchor, dx, dy, on, line, dot, lb, a: 0});
  };
  const pv = new THREE.Vector3();
  const project = (p) => {
    pv.set(p[0], p[1], p[2]).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * W, (-pv.y * 0.5 + 0.5) * H];
  };
  const drawCallouts = (dt, show) => {
    for (const c of callouts) {
      c.a = clamp(c.a + (show && c.on() ? dt : -dt) * 3, 0, 1);
      const p = c.a > 0 ? project(c.anchor()) : null;
      const vis = !!p && c.a > 0;
      for (const n of [c.line, c.dot]) n.style.display = vis ? '' : 'none';
      c.lb.style.display = vis ? '' : 'none';
      if (!vis) continue;
      const [x, y] = p;
      const lx = x + c.dx;
      const ly = y + c.dy;
      c.line.setAttribute('d', `M${x},${y} L${lx},${ly}`);
      c.line.style.opacity = c.a;
      c.dot.setAttribute('cx', x);
      c.dot.setAttribute('cy', y);
      c.dot.style.opacity = c.a;
      c.lb.style.left = `${lx}px`;
      c.lb.style.top = `${ly}px`;
      c.lb.style.opacity = c.a;
    }
  };

  // ------------------------------------------------------------ camera: named views, the visitor's orbit on top
  const VIEWS = opt.views;
  const cam = {...VIEWS[opt.view0](0)};
  const off = {az: 0, el: 0, k: 1};
  const camState = {view: opt.view0, at: 0};
  const setView = (v) => {
    camState.view = v;
    camState.at = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -60, 60);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.5);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ the tour
  const chip = el('div', 'chip');
  const cursor = el('div', 'cur', root, `<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 14 L10.5 20.5 L13 19.3 L10.2 13 L16 13 Z" fill="#fff" stroke="${theme.ink}" stroke-width="1.4" stroke-linejoin="round"/></svg>`);
  const ring = el('div', 'ring', root);
  const warn = el('div', 'warn');
  const AP = {on: true, t0: 0, i: 0};
  let lastInput = 0;
  let T = 0;
  let cur = [W * 0.55, H * 0.55];
  let ringT = -9;
  const pulseAt = (x, y) => {
    ringT = T;
    Object.assign(ring.style, {left: `${x}px`, top: `${y}px`});
  };
  const centerOf = (b) => {
    const r = b.getBoundingClientRect();
    return toStage(r.left + r.width / 2, r.top + r.height / 2);
  };
  // steps: {t, id} presses a button; {t, slider, to} drags a slider; the cursor travels for 0.9 s before each
  const tour = opt.tour;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.i = 0;
    AP.from = cur;
    AP.fromT = T;
    opt.reset?.();
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    cursor.style.display = 'none';
  };
  chip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.isTrusted && e.target !== chip) takeOver();
  });
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    takeOver();
    if (e.key.toLowerCase() === 'h') root.classList.toggle('hide');
    opt.onKey?.(e);
  });
  const targetOf = (s) => (s.id ? centerOf(btn[s.id]) : sliders[s.slider].at(s.to));
  const runTour = () => {
    const c = T - AP.t0;
    const s = tour.steps[AP.i];
    if (!s) {
      if (c > tour.duration) startTour();
      return;
    }
    const go = s.t - 0.9;
    const tgt = targetOf(s);
    if (c < go) {
      AP.from = cur;
      AP.fromT = T;
    } else if (s.slider) {
      // walk to the knob's current value, then drag it to the new one
      const sl = sliders[s.slider];
      if (s.v0 === undefined) s.v0 = sl.value;
      const start = sl.at(s.v0);
      const k = smoother((c - go) / 0.9);
      cur = [lerp(AP.from[0], start[0], k), lerp(AP.from[1], start[1], k)];
      if (c >= s.t) {
        const kd = smoother((c - s.t) / 0.9);
        sl.set(lerp(s.v0, s.to, kd));
        cur = sl.at(sl.value);
        if (kd >= 1) {
          s.v0 = undefined;
          AP.i++;
          AP.from = cur;
        }
      }
    } else {
      const k = smoother((c - go) / 0.9);
      cur = [lerp(AP.from[0], tgt[0], k), lerp(AP.from[1], tgt[1], k)];
      if (c >= s.t) {
        actions[s.id]();
        pulseAt(...tgt);
        AP.i++;
        AP.from = cur;
      }
    }
  };

  // ------------------------------------------------------------ the frame
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  let last = performance.now();
  let started = false;
  const run = (update) => {
    const frame = (now) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      T += dt;
      if (tier < TIERS.length - 1) {
        perf.age += dt;
        if (perf.age > 1) {
          perf.sum += dt;
          perf.n++;
          if (perf.sum >= 0.5) {
            perf.slow = perf.sum / perf.n > 0.024 ? perf.slow + 1 : 0;
            Object.assign(perf, {sum: 0, n: 0});
            if (perf.slow >= 2) {
              tier++;
              applyTier();
              Object.assign(perf, {age: 0, slow: 0});
            }
          }
        }
      }
      if (!started) {
        started = true;
        startTour();
      }
      if (AP.on) runTour();
      else if (T - lastInput > IDLE) startTour();
      update(dt, T);

      // the camera: the view's own slow move only while the tour runs, the visitor's orbit and zoom on top
      const u = AP.on ? T - camState.at : 0;
      const tgt = VIEWS[camState.view](u);
      tgt.az += off.az;
      tgt.el = clamp(tgt.el + off.el, -85, 85);
      tgt.d *= off.k;
      const k = 1 - Math.exp(-dt / 0.4);
      cam.az += wrap(tgt.az - cam.az) * k;
      for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += ((tgt[key] ?? 0) - (cam[key] ?? 0)) * k;
      const az = cam.az * D2R;
      const elv = cam.el * D2R;
      camera.position.set(cam.tx + cam.d * Math.cos(elv) * Math.sin(az), cam.ty + cam.d * Math.sin(elv), cam.tz + cam.d * Math.cos(elv) * Math.cos(az));
      camera.lookAt(cam.tx, cam.ty, cam.tz);
      camera.setViewOffset(W, H, -(cam.sx ?? 0), -(cam.sy ?? 0), W, H);
      camera.updateMatrixWorld();
      renderer.render(scene, camera);
      drawCallouts(dt, true);

      cursor.style.display = AP.on ? '' : 'none';
      cursor.style.transform = `translate(${cur[0] - 3}px, ${cur[1] - 2}px)`;
      const rk = clamp(1 - (T - ringT) / 0.5, 0, 1);
      ring.style.opacity = rk;
      ring.style.transform = `scale(${1.6 - rk * 0.6})`;
      if (chip.classList.contains('on') !== AP.on || !chip.firstChild) {
        chip.classList.toggle('on', AP.on);
        chip.innerHTML = AP.on ? '<i></i>AUTO TOUR · CLICK TO TAKE OVER' : '▶ RESUME TOUR';
      }
      requestAnimationFrame(frame);
    };
    renderer.compile(scene, camera);
    requestAnimationFrame(frame);
    window.LIVE = {cam, camera, scene, takeOver, startTour, setView, get T() {
      return T;
    }, get tour() {
      return AP.on;
    }};
  };
  const showWarn = (text) => {
    warn.style.display = text ? 'block' : 'none';
    if (text && warn.textContent !== text) warn.textContent = text;
  };

  return {renderer, scene, camera, sun, floor, ui, callout, setView, camState, run, project, showWarn, takeOver, get T() {
    return T;
  }};
}

// ghosting and exploding a subsystem: every mesh keeps its own material so a group can fade and slide on its own
export function makeGroups(names) {
  const g = {};
  for (const n of names) g[n] = {root: new THREE.Group(), mats: [], ghost: 0, ghostT: 0, ex: new THREE.Vector3()};
  const add = (name, mesh) => {
    const grp = g[name];
    mesh.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.userData.base = {opacity: o.material.opacity, transparent: o.material.transparent};
      o.castShadow = true;
      o.receiveShadow = true;
      grp.mats.push(o.material);
    });
    grp.root.add(mesh);
    return mesh;
  };
  // ease every group's ghost amount toward its target and apply it
  const update = (dt) => {
    const k = 1 - Math.exp(-dt / 0.18);
    for (const n of names) {
      const grp = g[n];
      grp.ghost += (grp.ghostT - grp.ghost) * k;
      const a = 1 - grp.ghost * 0.9;
      for (const m of grp.mats) {
        const ghosted = grp.ghost > 0.01;
        const tr = ghosted || m.userData.base.transparent;
        if (m.transparent !== tr) m.needsUpdate = true; // the program changes with transparency
        m.transparent = tr;
        m.opacity = m.userData.base.opacity * a;
        m.depthWrite = !ghosted;
      }
      grp.root.traverse((o) => {
        if (o.isMesh) o.castShadow = grp.ghost < 0.5;
      });
    }
  };
  return {g, add, update};
}
