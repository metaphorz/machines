// The rear derailleur as a page you drive. The shifter sets the cable pull; the pull sets the parallelogram; the chain
// climbs to the cog under the guide pulley only while the cassette turns. Everything on screen reads drivetrainAt().
import {clamp, createShell} from '../common/shell.js';
import {cogUnder, DR, drivetrainAt} from './model.js';
import {buildDerailleur} from './parts.js';

const PLAYS = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1];
const playText = (p) => (p >= 1 ? 'REAL TIME' : `1 / ${Math.round(1 / p)}`);
const EXPLAIN = {
  cable: 'Each click pulls (or releases) 2.7 mm of cable. At Shimano’s 1.4 ratio the parallelogram swings the guide pulley 3.78 mm: exactly one cog.',
  up: 'The guide pulley leans the chain toward the bigger cog. Its ramps catch a link and the chain climbs as the teeth come round.',
  down: 'The guide pulley pushes the chain outboard. It drops onto the smaller cog as the teeth come round.',
  gear: 'Chain, cog and guide pulley line up. The cage spring takes up the slack: the cage settles wherever the loop is exactly 108 links.',
  stall: 'No pedalling. The derailleur has moved, but the chain cannot change cogs until the cassette turns.',
};
const V = {
  hero: (u) => ({tx: 40, ty: -40, tz: 10, az: 138 + 1.2 * u, el: 8, d: 600, sx: 0, sy: 0}),
  side: (u) => ({tx: 30, ty: -35, tz: -20, az: 90 + 0.4 * u, el: 2, d: 640, sx: 0, sy: 0}),
  rear: (u) => ({tx: 36, ty: -35, tz: 0, az: 0 + 0.6 * u, el: 6, d: 520, sx: 0, sy: 0}),
  cage: (u) => ({tx: 42, ty: -80, tz: 15, az: 116 + 1.2 * u, el: 6, d: 360, sx: 0, sy: 0}),
  drive: (u) => ({tx: 40, ty: -40, tz: -200, az: 90 + 0.3 * u, el: 10, d: 1300, sx: 0, sy: 0}),
};
const VIEWS = ['hero', 'side', 'rear', 'cage', 'drive'];
const ISO = {i_all: null, i_cassette: 'cassette', i_para: 'parallelogram', i_cage: 'cage', i_chain: 'chain'};
const DISP = ['d_solid', 'd_xray', 'd_explode'];
const NC = DR.cogs.length;

export function runDerailleur() {
  let gear = 5;
  let pull = gear * DR.pull;
  let e = gear;
  let s = 0;
  let crankA = 0;
  let cadence = 80;
  let playI = 2;
  let paused = false;
  let iso = 'i_all';
  let disp = 'd_solid';
  let explode = 0;
  const hist = [];

  const sh = createShell({
    title: 'Rear Derailleur',
    views: V,
    view0: 'hero',
    fov: 30,
    near: 2,
    far: 6000,
    shadowExtent: 260,
    floorY: -150,
    sun: [0.45, 1, -0.25],
    tour: {
      duration: 54,
      steps: [
        {t: 3, id: 'sh_harder'},
        {t: 5, id: 'sh_harder'},
        {t: 8, id: 'v_rear'},
        {t: 10.5, id: 'cog_10'},
        {t: 15, id: 'v_cage'},
        {t: 17.5, id: 'i_cage'},
        {t: 20.5, id: 'i_all'},
        {t: 23, slider: 'cad', to: 0},
        {t: 26, id: 'cog_0'},
        {t: 30, slider: 'cad', to: 80},
        {t: 34, id: 'v_side'},
        {t: 37, id: 'd_explode'},
        {t: 41, id: 'd_xray'},
        {t: 42.5, id: 'v_drive'},
        {t: 46, id: 'cog_5'},
        {t: 49.5, id: 'd_solid'},
        {t: 51, id: 'v_hero'},
      ],
    },
    reset: () => {
      setGear(5);
      pull = 5 * DR.pull;
      e = 5;
      sliders.cad?.set(80);
      sliders.play?.set(2);
      paused = false;
      setIso('i_all');
      setDisp('d_solid');
      pickView('hero');
    },
    onKey: (ev) => {
      const k = ev.key.toLowerCase();
      if (k === ' ') {
        togglePause();
        ev.preventDefault();
      } else if (k === 'arrowup' || k === 'arrowright') setGear(gear - 1);
      else if (k === 'arrowdown' || k === 'arrowleft') setGear(gear + 1);
      const v = {1: 'hero', 2: 'side', 3: 'rear', 4: 'cage', 5: 'drive'}[k];
      if (v) pickView(v);
    },
  });
  const {ui} = sh;
  const sliders = {};
  const der = buildDerailleur();
  sh.scene.add(der.root);

  // ------------------------------------------------------------ console
  const hd = ui.header('Rear Derailleur <b>11-speed</b>', 'Shimano road · 11–28 cassette · 50 T ring · 2.7 mm × 1.4');
  const pA = ui.panel(28, 196, 272, 0, 'The numbers', 'live');
  const row = ui.rows(pA, [
    ['ratio', 'Gear ratio'],
    ['gi', 'Gear inches'],
    ['dev', 'Development'],
    ['spd', 'Speed'],
    ['pull', 'Cable pull'],
    ['travel', 'Pulley travel'],
    ['gap', 'Pulley to cog'],
    ['cage', 'Cage angle'],
    ['wrap', 'Teeth in wrap'],
    ['line', 'Chain angle'],
    ['chain', 'Chain'],
  ]);
  const pS = ui.panel(28, 512, 272, 0, 'Schematic', 'top view · lateral ×12');
  const sch = ui.canvas(pS, 248, 168);
  const pT = ui.panel(322, 742, 956, 0, 'Lateral position', 'last 6 s · guide pulley vs chain at the cassette');
  const tim = ui.canvas(pT, 932, 108);

  const pC = ui.panel(1300, 22, 272, 0, 'Controls');
  const gv = ui.group(pC, 'View');
  const pickView = (v) => {
    sh.setView(v);
    ui.setOn(VIEWS.map((x) => 'v_' + x), 'v_' + v);
  };
  for (const v of VIEWS) ui.button(gv, 'v_' + v, v, () => pickView(v));
  const gd = ui.group(pC, 'Display');
  const setDisp = (d) => {
    disp = d;
    ui.setOn(DISP, d);
    applyGhost();
  };
  ui.button(gd, 'd_solid', 'Solid', () => setDisp('d_solid'));
  ui.button(gd, 'd_xray', 'X-ray frame', () => setDisp('d_xray'));
  ui.button(gd, 'd_explode', 'Exploded', () => setDisp('d_explode'));
  const gi = ui.group(pC, 'Isolate a subsystem');
  const setIso = (k) => {
    iso = k;
    ui.setOn(Object.keys(ISO), k);
    applyGhost();
  };
  for (const [k, label] of [['i_all', 'All'], ['i_cassette', 'Cassette'], ['i_para', 'Parallelogram'], ['i_cage', 'Cage'], ['i_chain', 'Chain']]) ui.button(gi, k, label, () => setIso(k), 'acc');
  const gs = ui.group(pC, 'Shift');
  const setGear = (k) => {
    gear = clamp(k, 0, NC - 1);
    ui.setOn(DR.cogs.map((_, i) => 'cog_' + i), 'cog_' + gear);
  };
  ui.button(gs, 'sh_easier', '◀ Easier', () => setGear(gear + 1));
  ui.button(gs, 'sh_harder', 'Harder ▶', () => setGear(gear - 1));
  const gc = ui.group(pC, 'Pick a cog (teeth)');
  DR.cogs.forEach((n, i) => {
    const b = ui.button(gc, 'cog_' + i, String(n), () => setGear(i), 'acc');
    b.style.padding = '5px 4px';
    b.style.minWidth = '19px';
    b.style.textAlign = 'center';
  });
  const gp = ui.group(pC, 'Time');
  const togglePause = () => {
    paused = !paused;
    ui.btn.pause.textContent = paused ? '▶ Run' : '❚❚ Pause';
  };
  ui.button(gp, 'pause', '❚❚ Pause', togglePause);
  sliders.cad = ui.slider(pC, 'cad', {label: 'Cadence', min: 0, max: 120, value: cadence, fmt: (v) => `${Math.round(v)} rpm`, set: (v) => (cadence = v)});
  sliders.play = ui.slider(pC, 'play', {label: 'Playback speed', min: 0, max: PLAYS.length - 1, value: playI, fmt: (v) => playText(PLAYS[Math.round(v)]), set: (v) => (playI = Math.round(v))});
  setGear(gear);
  ui.setOn(VIEWS.map((x) => 'v_' + x), 'v_hero');

  const pP = ui.panel(1300, 612, 272, 0, 'What is happening');
  const setPhase = ui.phases(pP, ['CABLE', 'CHAIN', 'IN GEAR']);
  const expl = ui.el('div', '', pP);
  Object.assign(expl.style, {font: '500 11.5px/1.45 Inter,sans-serif', marginTop: '9px', minHeight: '66px'});
  const note = ui.el('div', '', pP, 'Sourced: 2.7 mm pull, 1.4 ratio, 1/2" chain. Approximate: frame, link and cage lengths, the slant of the travel.');
  Object.assign(note.style, {font: '500 9.5px/1.45 Inter,sans-serif', color: ui.theme.mute, marginTop: '8px'});

  const on = (...ks) => () => ks.includes(iso);
  sh.callout('Cassette', '11–28 · 3.78 mm pitch', der.anchors.cassette, -40, -70, on('i_all', 'i_cassette'));
  sh.callout('Guide pulley', '11 T', der.anchors.guide, 110, -30, on('i_all', 'i_cage'));
  sh.callout('Tension pulley', 'cage spring takes up slack', der.anchors.lower, 110, 40, on('i_all', 'i_cage'));
  sh.callout('Parallelogram', 'slant links', der.anchors.link, 90, -80, on('i_all', 'i_para'));
  sh.callout('Cable', '2.7 mm per click', der.anchors.cable, 70, -60, on('i_para'));
  sh.callout('Chain', `${DR.links} links`, der.anchors.chain, -30, -60, on('i_all', 'i_chain'));

  function applyGhost() {
    const focus = ISO[iso];
    for (const k in der.g) {
      let gh = focus && k !== focus ? 1 : 0;
      if (k === 'frame') gh = focus || disp !== 'd_solid' ? 1 : 0;
      if (k === 'crank' && focus) gh = 1;
      der.g[k].ghostT = gh;
    }
  }
  setIso('i_all');
  setDisp('d_solid');

  // ------------------------------------------------------------ 2D panels from the same state
  const ink = ui.theme.ink;
  const acc = ui.theme.accent;
  const mute = ui.theme.mute;
  const drawSchematic = (st) => {
    const {ctx, w, h} = sch;
    ctx.clearRect(0, 0, w, h);
    const kx = 4.2; // px per lateral mm (12x the forward scale)
    const kf = 0.35;
    const X = (x) => 20 + (64 - x) * kx; // outboard on the left, as seen from above facing forward... drawn as-is
    const Y = (f) => h - 22 - f * kf;
    // cogs: each a bar its diameter long
    DR.cogs.forEach((n, k) => {
      const R = DR.cogR[k];
      ctx.strokeStyle = k === Math.round(st.e) ? ink : 'rgba(0,0,0,.25)';
      ctx.lineWidth = k === Math.round(st.e) ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.moveTo(X(DR.cogX[k]), Y(-R));
      ctx.lineTo(X(DR.cogX[k]), Y(R));
      ctx.stroke();
    });
    // chainring
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(X(DR.ringX), Y(DR.ringC[0] - 60));
    ctx.lineTo(X(DR.ringX), Y(DR.ringC[0] - 20));
    ctx.stroke();
    // the top run, ring to cog
    ctx.strokeStyle = Math.abs(st.chainline) > 2.9 ? acc : mute;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(X(DR.ringX), Y(DR.ringC[0] - 40));
    ctx.lineTo(X(st.cogX), Y(0));
    ctx.stroke();
    // the guide pulley
    ctx.fillStyle = acc;
    ctx.fillRect(X(st.x) - 3, Y(st.G.f) - 8, 6, 16);
    ctx.fillStyle = mute;
    ctx.font = "600 8px 'JetBrains Mono'";
    ctx.fillText('CASSETTE', 4, h - 6);
    ctx.fillText('CHAINRING', X(DR.ringX) + 6, Y(DR.ringC[0] - 40) + 3);
    ctx.fillText('GUIDE PULLEY', X(st.x) + 7, Y(st.G.f) + 14);
    ctx.fillText('OUTBOARD ◀', 4, 10);
    ctx.fillText('▶ INBOARD', w - 54, 10);
  };
  const drawLateral = (st) => {
    const {ctx, w, h} = tim;
    ctx.clearRect(0, 0, w, h);
    const xL = 40;
    const xR = 610;
    const Y = (x) => 6 + ((DR.cogX[0] + 2 - x) / (DR.cogX[0] - DR.cogX[NC - 1] + 4)) * (h - 12);
    ctx.font = "600 7.5px 'JetBrains Mono'";
    DR.cogs.forEach((n, k) => {
      ctx.strokeStyle = 'rgba(0,0,0,.07)';
      ctx.beginPath();
      ctx.moveTo(xL, Y(DR.cogX[k]));
      ctx.lineTo(xR, Y(DR.cogX[k]));
      ctx.stroke();
      ctx.fillStyle = mute;
      ctx.fillText(`${n}T`, 8, Y(DR.cogX[k]) + 3);
    });
    const now = hist.length ? hist[hist.length - 1].t : 0;
    const X = (t) => xR - ((now - t) / 6) * (xR - xL);
    for (const [key, col, lw] of [['xc', ink, 2.2], ['xp', acc, 1.4]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      hist.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p[key])) : ctx.moveTo(X(p.t), Y(p[key]))));
      ctx.stroke();
    }
    ctx.fillStyle = acc;
    ctx.fillText('GUIDE PULLEY', xR - 120, 10);
    ctx.fillStyle = ink;
    ctx.fillText('CHAIN', xR - 50, 10);
    // gear inches for every cog, the current one marked
    const gx = 650;
    const gw = w - gx - 4;
    const bw = gw / NC;
    DR.cogs.forEach((n, k) => {
      const gi = (DR.ring / n) * DR.wheelIn;
      const bh = (gi / 125) * (h - 22);
      ctx.fillStyle = k === Math.round(st.e) ? acc : k === gear ? ink : 'rgba(0,0,0,.14)';
      ctx.fillRect(gx + k * bw + 2, h - 12 - bh, bw - 4, bh);
      ctx.fillStyle = mute;
      ctx.fillText(String(n), gx + k * bw + 3, h - 2);
    });
    ctx.fillStyle = mute;
    ctx.fillText('GEAR INCHES', gx, 10);
  };

  // ------------------------------------------------------------ the frame
  let lastKey = '';
  let pT2 = 0;
  let wall = 0;
  window.DER = {set: (k) => setGear(k), get: () => ({gear, e, pull})};
  sh.run((dt) => {
    wall += dt;
    const ds = paused ? 0 : dt * PLAYS[playI];
    // the shifter: the cable eases to its click in about 0.15 s
    const want = gear * DR.pull;
    pull += (want - pull) * (1 - Math.exp(-ds / 0.05));
    if (Math.abs(want - pull) < 0.005) pull = want;
    const moving = Math.abs(want - pull) > 0.02;
    // the chain: it migrates toward the cog under the guide pulley, one cog per third of a cassette turn
    const x = DR.cog0X - DR.ratio * pull;
    const under = Math.round(cogUnder(x));
    const omega = (cadence / 60) * Math.PI * 2;
    const v = omega * DR.Rr; // chain speed, mm/s
    const R0 = DR.cogR[Math.floor(Math.min(e, NC - 1.0001))];
    const dTheta = (v * ds) / R0;
    if (e !== under) {
      const step = dTheta / ((Math.PI * 2) / 3);
      e = e < under ? Math.min(under, e + step) : Math.max(under, e - step);
    }
    s += v * ds;
    crankA += omega * ds;
    const st = drivetrainAt(pull, e);
    const shifting = e !== under;
    Object.assign(st, {s, crank: crankA, target: under, shifting, moving});
    explode += ((disp === 'd_explode' ? 1 : 0) - explode) * (1 - Math.exp(-dt / 0.35));
    der.update(st, dt, explode);

    hist.push({t: wall, xp: st.x, xc: st.cogX});
    while (hist.length && hist[0].t < wall - 6.2) hist.shift();

    const N = DR.cogs[Math.round(e)];
    hd.big.innerHTML = `${DR.ring} × ${N}<small>RING × COG</small>`;
    const kmh = cadence * st.devel * 60 / 1000;
    hd.sub.textContent = `${st.gearIn.toFixed(1)} GEAR INCHES · ${kmh.toFixed(1)} KM/H AT ${Math.round(cadence)} RPM`;
    row('ratio', st.ratio.toFixed(2));
    row('gi', `${st.gearIn.toFixed(1)} in`);
    row('dev', `${st.devel.toFixed(2)} m / rev`);
    row('spd', `${kmh.toFixed(1)} km/h`);
    row('pull', `${pull.toFixed(2)} mm`, moving);
    row('travel', `${st.travel.toFixed(2)} mm`, moving);
    row('gap', `${st.bGap.toFixed(1)} mm`);
    row('cage', `${((st.alpha * 180) / Math.PI).toFixed(1)}° fwd`);
    row('wrap', st.wrapTeeth.toFixed(1));
    row('line', `${Math.abs(st.chainline).toFixed(2)}°`, Math.abs(st.chainline) > 2.9);
    row('chain', `${DR.links} links · ${DR.chainL.toFixed(1)} mm`);
    const stalled = shifting && cadence < 1;
    const ph = moving ? 0 : shifting ? 1 : 2;
    setPhase(ph);
    const key = moving ? 'cable' : stalled ? 'stall' : shifting ? (under > e ? 'up' : 'down') : 'gear';
    if (key !== lastKey) {
      expl.textContent = EXPLAIN[key];
      lastKey = key;
    }
    sh.showWarn(
      stalled
        ? 'NOT PEDALLING: THE DERAILLEUR MOVED, THE CHAIN CAN’T'
        : Math.abs(st.chainline) > 2.9
          ? `CROSS-CHAINED: BIG RING ON A BIG COG, CHAIN AT ${Math.abs(st.chainline).toFixed(1)}°`
          : '',
    );
    pT2 += dt;
    if (pT2 > 1 / 30) {
      pT2 = 0;
      drawSchematic(st);
      drawLateral(st);
    }
  });
}
