// The lever escapement as a page you drive. Time runs through the model at the playback speed; the 3D movement, the
// panels, the timing diagram and the schematic all read the same stateAt(t, amplitude).
import {clamp, createShell} from '../common/shell.js';
import {E, PHASES, stateAt, stoneTip, toothAngles} from './model.js';
import {buildEscapement} from './parts.js';

const PLAYS = [1 / 64, 1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1];
const playText = (p) => (p >= 1 ? 'REAL TIME' : `1 / ${Math.round(1 / p)}`);
const EXPLAIN = [
  'The impulse pin swings the fork. The pallet slides off the tip of the tooth it was holding; the wheel recoils a hair.',
  'The freed tooth pushes across the pallet’s slanted face. The lever passes that push to the balance through the pin.',
  'The tooth leaves the stone. The wheel turns free for 1.5° until a tooth lands on the other pallet.',
  'The slant of the locking face pulls the lever onto its banking pin. The wheel is locked again.',
  'The balance swings free of the lever for most of its arc. Only the hairspring acts on it, and brings it back.',
];
const V = {
  hero: (u) => ({tx: 2.6, ty: 1.0, tz: 0.6, az: -28 + 1.2 * u, el: 40, d: 40, sx: 0, sy: 10}),
  top: (u) => ({tx: 2.8, ty: 0.5, tz: 0, az: 0 + 0.5 * u, el: 86, d: 38, sx: 0, sy: 0}),
  // from the escape wheel's side, under the balance rim's overhang
  pallets: (u) => ({tx: 1.25, ty: 0.7, tz: 0, az: -90 + 1.5 * u, el: 64, d: 11, sx: 0, sy: 0}),
  balance: (u) => ({tx: 6.5, ty: 1.6, tz: 0, az: 25 + 1.5 * u, el: 34, d: 22, sx: 0, sy: 0}),
  side: (u) => ({tx: 3, ty: 3.0, tz: 0, az: -20 + 0.6 * u, el: 14, d: 52, sx: 0, sy: 0}),
};
const VIEWS = ['hero', 'top', 'pallets', 'balance', 'side'];
const ISO = {i_all: null, i_wheel: 'wheel', i_lever: 'lever', i_balance: 'balance', i_spring: 'spring', i_train: 'train'};
const DISP = ['d_solid', 'd_xray', 'd_explode'];

export function runEscapement() {
  let amp = E.ampDefault;
  let playI = 2;
  let paused = false;
  let ts = 0.03;
  let iso = 'i_all';
  let disp = 'd_xray';
  let explode = 0;

  const sh = createShell({
    title: 'Lever Escapement',
    views: V,
    view0: 'hero',
    fov: 30,
    near: 0.5,
    far: 400,
    shadowExtent: 16,
    floorY: -0.61,
    sun: [-0.35, 1, 0.45],
    tour: {
      duration: 52,
      steps: [
        {t: 3, id: 'v_pallets'},
        {t: 7.5, id: 'i_lever'},
        {t: 11.5, id: 'i_wheel'},
        {t: 15, id: 'i_all'},
        {t: 17, id: 'v_top'},
        {t: 21, slider: 'amp', to: 340},
        {t: 27, slider: 'amp', to: 290},
        {t: 30, id: 'v_balance'},
        {t: 32, id: 'i_spring'},
        {t: 36, id: 'i_all'},
        {t: 37.5, id: 'v_side'},
        {t: 39, id: 'd_explode'},
        {t: 43, id: 'v_hero'},
        {t: 44, id: 'd_solid'},
        {t: 47, id: 'd_xray'},
      ],
    },
    reset: () => {
      sliders.amp?.set(E.ampDefault);
      sliders.play?.set(2);
      paused = false;
      setIso('i_all');
      setDisp('d_xray');
      sh?.setView('hero');
      ui?.setOn(VIEWS.map((v) => 'v_' + v), 'v_hero');
    },
    onKey: (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ') {
        togglePause();
        e.preventDefault();
      } else if (k === 'arrowright') stepBeat(1);
      else if (k === 'arrowleft') stepBeat(-1);
      const v = {1: 'hero', 2: 'top', 3: 'pallets', 4: 'balance', 5: 'side'}[k];
      if (v) pickView(v);
    },
  });
  const {ui} = sh;
  const sliders = {};
  const esc = buildEscapement();
  sh.scene.add(esc.root);

  // ------------------------------------------------------------ console
  const hd = ui.header('Lever Escapement <b>ETA 2824</b>', 'Swiss lever · 4 Hz · 28,800 vph · 15-tooth club wheel');
  const pA = ui.panel(28, 196, 272, 0, 'The numbers', 'live');
  const row = ui.rows(pA, [
    ['f', 'Frequency'],
    ['vph', 'Beats / hour'],
    ['beats', 'Beats counted'],
    ['amp', 'Amplitude'],
    ['lift', 'Lift angle'],
    ['lever', 'Lever angle'],
    ['wheel', 'Escape wheel'],
    ['rpm', 'Wheel speed'],
    ['sec', 'Seconds hand'],
    ['work', 'Working pallet'],
  ]);
  const pS = ui.panel(28, 484, 272, 0, 'Schematic', 'top view · same model');
  const sch = ui.canvas(pS, 248, 196);
  const pT = ui.panel(322, 742, 956, 0, 'Timing', 'last 2 swings · 0.5 s of watch time');
  const tim = ui.canvas(pT, 932, 108);

  const pC = ui.panel(1300, 22, 272, 0, 'Controls');
  const gv = ui.group(pC, 'View');
  const pickView = (v) => {
    sh.setView(v);
    ui.setOn(VIEWS.map((x) => 'v_' + x), 'v_' + v);
  };
  for (const v of VIEWS) ui.button(gv, 'v_' + v, v, () => pickView(v));
  ui.setOn(VIEWS.map((x) => 'v_' + x), 'v_hero');
  const gd = ui.group(pC, 'Display');
  const setDisp = (d) => {
    disp = d;
    ui.setOn(DISP, d);
    applyGhost();
  };
  ui.button(gd, 'd_solid', 'Solid', () => setDisp('d_solid'));
  ui.button(gd, 'd_xray', 'X-ray bridges', () => setDisp('d_xray'));
  ui.button(gd, 'd_explode', 'Exploded', () => setDisp('d_explode'));
  const gi = ui.group(pC, 'Isolate a subsystem');
  const setIso = (k) => {
    iso = k;
    ui.setOn(Object.keys(ISO), k);
    applyGhost();
  };
  for (const [k, label] of [['i_all', 'All'], ['i_wheel', 'Escape wheel'], ['i_lever', 'Pallet lever'], ['i_balance', 'Balance'], ['i_spring', 'Hairspring'], ['i_train', 'Train']])
    ui.button(gi, k, label, () => setIso(k), 'acc');
  const gp = ui.group(pC, 'Time');
  const togglePause = () => {
    paused = !paused;
    ui.btn.pause.textContent = paused ? '▶ Run' : '❚❚ Pause';
  };
  ui.button(gp, 'pause', '❚❚ Pause', togglePause);
  // step to the end of the next (or previous) beat and hold there
  const stepBeat = (d) => {
    const w = (2 * Math.PI * E.f);
    const win = Math.asin(Math.min(1, E.halfLift / amp)) / w;
    let j = Math.round(2 * E.f * ts) + (d > 0 ? 0 : -1);
    let t = j / (2 * E.f) + win + 0.0015;
    if (d > 0 && t <= ts + 1e-4) t = (j + 1) / (2 * E.f) + win + 0.0015;
    if (d < 0 && t >= ts - 1e-4) t = (j - 1) / (2 * E.f) + win + 0.0015;
    ts = Math.max(0.0015, t);
    paused = true;
    ui.btn.pause.textContent = '▶ Run';
  };
  ui.button(gp, 'back', '◀ Beat', () => stepBeat(-1));
  ui.button(gp, 'fwd', 'Beat ▶', () => stepBeat(1));
  sliders.amp = ui.slider(pC, 'amp', {label: 'Balance amplitude', min: 150, max: 345, value: amp, fmt: (v) => `${Math.round(v)}°`, set: (v) => (amp = v)});
  sliders.play = ui.slider(pC, 'play', {label: 'Playback speed', min: 0, max: PLAYS.length - 1, value: playI, fmt: (v) => playText(PLAYS[Math.round(v)]), set: (v) => (playI = Math.round(v))});

  const pP = ui.panel(1300, 548, 272, 0, 'Phase of the beat');
  const setPhase = ui.phases(pP, ['UNLOCK', 'IMPULSE', 'DROP', 'DRAW', 'FREE']);
  const expl = ui.el('div', '', pP);
  Object.assign(expl.style, {font: "500 11.5px/1.45 Inter,sans-serif", marginTop: '9px', minHeight: '68px'});
  const note = ui.el('div', '', pP, 'Sourced: 4 Hz, 15 teeth, 52° lift, 270–310° amplitude. Approximate: the 10° lever swing, 1.5° lock, 10.5° impulse / 1.5° drop, part sizes.');
  Object.assign(note.style, {font: "500 9.5px/1.45 Inter,sans-serif", color: ui.theme.mute, marginTop: '8px'});

  sh.callout('Escape wheel', '15 club teeth · 16 rpm', esc.anchors.wheel, -150, -40, () => iso === 'i_all' || iso === 'i_wheel');
  sh.callout('Entry pallet', 'ruby', esc.anchors.entry, -110, -70, () => iso === 'i_all' || iso === 'i_lever');
  sh.callout('Exit pallet', 'ruby', esc.anchors.exit, -90, 80, () => iso === 'i_all' || iso === 'i_lever');
  sh.callout('Impulse pin', 'meets the fork within ±26°', esc.anchors.pin, 60, 110, () => iso === 'i_all' || iso === 'i_balance');
  sh.callout('Balance', 'Glucydur · 4 Hz', esc.anchors.rim, 90, 60, () => iso === 'i_all' || iso === 'i_balance');
  sh.callout('Hairspring', 'inner end turns, stud holds', esc.anchors.spring, 40, -120, () => iso === 'i_spring' || iso === 'i_all');
  sh.callout('Fourth wheel', '112 T · 1 rpm · seconds', esc.anchors.fourth, -60, 90, () => iso === 'i_all' || iso === 'i_train');

  function applyGhost() {
    const focus = ISO[iso];
    for (const k in esc.g) {
      let gh = 0;
      if (focus && k !== focus) gh = k === 'plate' ? 0.6 : 1;
      if (k === 'bridges') gh = focus || disp === 'd_xray' ? 1 : disp === 'd_explode' ? 0.5 : 0;
      esc.g[k].ghostT = gh;
    }
  }
  setIso('i_all');
  setDisp('d_xray');

  // ------------------------------------------------------------ drawing the 2D panels from the same model
  const ink = ui.theme.ink;
  const acc = ui.theme.accent;
  const mute = ui.theme.mute;
  const drawSchematic = (s) => {
    const {ctx, w, h} = sch;
    ctx.clearRect(0, 0, w, h);
    const k = 24; // px per mm
    const ox = 50;
    const oy = h / 2;
    const X = (x) => ox + x * k;
    const Y = (y) => oy - y * k;
    ctx.lineWidth = 1;
    // escape wheel teeth
    ctx.strokeStyle = s.phase === 1 ? acc : ink;
    ctx.beginPath();
    for (const a of toothAngles(s.psi)) {
      const r = (d, aa) => [X(d * Math.cos(aa * Math.PI / 180)), Y(d * Math.sin(aa * Math.PI / 180))];
      const pts = [r(E.R - 0.42, a - 3), r(E.R, a), r(E.R - 0.1, a + 7), r(E.R - 0.2, a + 9), r(E.R - 0.42, a + 12)];
      ctx.moveTo(...pts[0]);
      for (const p of pts.slice(1)) ctx.lineTo(...p);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(X(0), Y(0), (E.R - 0.42) * k, 0, Math.PI * 2);
    ctx.stroke();
    // the lever: a line to each stone, the fork along the line of centres
    const P = [E.D, 0];
    const rot = (x, y) => {
      const c = Math.cos(s.phi * Math.PI / 180);
      const sn = Math.sin(s.phi * Math.PI / 180);
      return [P[0] + x * c - y * sn, P[1] + x * sn + y * c];
    };
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const fk = rot(E.fork, 0);
    ctx.moveTo(X(P[0]), Y(P[1]));
    ctx.lineTo(X(fk[0]), Y(fk[1]));
    ctx.stroke();
    // stones on their radial lines
    [1, -1].forEach((side) => {
      const a = (side * E.span * Math.PI) / 180;
      const r0 = stoneTip(s.phi, side);
      const working = (s.phase <= 1) && (side === 1) === s.entryWorks;
      ctx.strokeStyle = working ? acc : '#b3122b';
      ctx.lineWidth = E.stoneW * k;
      ctx.beginPath();
      ctx.moveTo(X(r0 * Math.cos(a)), Y(r0 * Math.sin(a)));
      ctx.lineTo(X((r0 + 0.75) * Math.cos(a)), Y((r0 + 0.75) * Math.sin(a)));
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(X(P[0]), Y(P[1]));
      ctx.lineTo(X((r0 + 0.6) * Math.cos(a)), Y((r0 + 0.6) * Math.sin(a)));
      ctx.stroke();
    });
    // roller and impulse pin
    ctx.strokeStyle = mute;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(X(E.B), Y(0), E.pin * k, 0, Math.PI * 2);
    ctx.stroke();
    const pa = ((180 + s.theta) * Math.PI) / 180;
    ctx.fillStyle = s.engaged ? acc : '#b3122b';
    ctx.beginPath();
    ctx.arc(X(E.B + E.pin * Math.cos(pa)), Y(E.pin * Math.sin(pa)), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mute;
    ctx.font = "600 8px 'JetBrains Mono'";
    ctx.fillText('ESCAPE WHEEL', 4, h - 8);
    ctx.fillText('BALANCE', X(E.B) - 18, h - 8);
    ctx.fillText(`LEVER ${s.phi >= 0 ? '+' : ''}${s.phi.toFixed(1)}°`, X(E.D) + 10, 14);
  };
  const drawTiming = (s) => {
    const {ctx, w, h} = tim;
    ctx.clearRect(0, 0, w, h);
    const span = 0.5;
    const t0 = s.t - span;
    const lanes = [
      {name: 'BALANCE', lo: -345, hi: 345, f: (q) => q.theta, band: E.halfLift},
      {name: 'LEVER', lo: -6, hi: 6, f: (q) => q.phi},
      {name: 'ESCAPE WHEEL', lo: -60, hi: 0, f: (q, q0) => q.psi - q0.psi},
    ];
    const q0 = stateAt(t0, amp);
    const lh = h / 3;
    const xL = 92;
    const N = 260;
    const qs = [];
    for (let i = 0; i <= N; i++) qs.push(stateAt(t0 + (span * i) / N, amp));
    lanes.forEach((L, li) => {
      const y0 = li * lh;
      const Y = (v) => y0 + lh - 4 - ((v - L.lo) / (L.hi - L.lo)) * (lh - 8);
      if (L.band) {
        ctx.fillStyle = 'rgba(224,72,43,.12)';
        ctx.fillRect(xL, Y(L.band), w - xL, Y(-L.band) - Y(L.band));
      }
      ctx.fillStyle = mute;
      ctx.font = "700 8.5px 'JetBrains Mono'";
      ctx.fillText(L.name, 0, y0 + lh / 2 + 3);
      ctx.strokeStyle = 'rgba(0,0,0,.08)';
      ctx.beginPath();
      ctx.moveTo(xL, y0 + lh - 0.5);
      ctx.lineTo(w, y0 + lh - 0.5);
      ctx.stroke();
      ctx.strokeStyle = li === 0 ? ink : li === 1 ? acc : ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      qs.forEach((q, i) => {
        const x = xL + ((w - xL) * i) / N;
        const v = L.f(q, q0);
        if (i) ctx.lineTo(x, Y(v));
        else ctx.moveTo(x, Y(v));
      });
      ctx.stroke();
    });
    ctx.fillStyle = mute;
    ctx.font = "600 8px 'JetBrains Mono'";
    ctx.fillText('SHADED: FORK ENGAGED (±26°)', w - 170, 10);
  };

  // ------------------------------------------------------------ the frame
  let last = null;
  let schT = 0;
  // a handle for checking frames: set the watch's time and hold it
  window.ESC = {set: (t) => ((ts = t), (paused = true)), stateAt: (t) => stateAt(t, amp)};
  sh.run((dt) => {
    if (!paused) ts += dt * PLAYS[playI];
    const s = stateAt(ts, amp);
    explode += ((disp === 'd_explode' ? 1 : 0) - explode) * (1 - Math.exp(-dt / 0.35));
    esc.update(s, dt, explode);
    hd.big.innerHTML = `${s.theta >= 0 ? '+' : '−'}${Math.abs(s.theta).toFixed(0)}°<small>BALANCE</small>`;
    hd.sub.textContent = PHASES[s.phase] + (s.engaged ? ' · FORK ENGAGED' : '');
    row('f', `${E.f} Hz`);
    row('vph', E.vph.toLocaleString('en-US'));
    row('beats', String(s.beats));
    row('amp', `${Math.round(amp)}°`, amp > E.rebank);
    row('lift', `${E.lift}° (±${E.halfLift}°)`);
    row('lever', `${s.phi >= 0 ? '+' : ''}${s.phi.toFixed(2)}°`, s.engaged);
    row('wheel', `${(-s.psi % 360).toFixed(1)}°`, s.phase === 1);
    row('rpm', `${(E.f * 2 * E.beat * 60 / 360).toFixed(0)} rpm × ${playText(PLAYS[playI]).toLowerCase()}`);
    row('sec', `${s.seconds.toFixed(3)} s`);
    row('work', s.phase < 4 ? (s.entryWorks ? 'ENTRY' : 'EXIT') : '—', s.phase < 2);
    setPhase(s.phase === 4 ? 4 : s.phase);
    if (last !== s.phase) {
      expl.textContent = EXPLAIN[s.phase];
      last = s.phase;
    }
    sh.showWarn(amp > E.rebank ? `REBANKING ABOVE ${E.rebank}°: THE PIN SWINGS ROUND AND HITS THE BACK OF THE FORK` : '');
    schT += dt;
    if (schT > 1 / 30) {
      schT = 0;
      drawSchematic(s);
      drawTiming(s);
    }
  });
}
