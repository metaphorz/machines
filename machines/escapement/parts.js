// The escapement's geometry, built from code in millimetres. The movement lies flat: plane (X, Y) maps to three.js
// (X, height, -Y), the line of centres runs along +X from the escape wheel through the pallet arbor to the balance.
// update(state) poses every part from the model; nothing here keeps time.
import * as THREE from 'three';
import {makeGroups} from '../common/shell.js';
import {E, stoneTip} from './model.js';

const D2R = Math.PI / 180;
const V3 = THREE.Vector3;
export const P3 = (x, y, h = 0) => new V3(x, h, -y);

const mat = (color, rough = 0.42, metal = 0.85, extra = {}) =>
  new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal, envMapIntensity: 0.6, ...extra});
const M = {
  steel: () => mat('#b8bcc3', 0.38),
  dark: () => mat('#5d6168', 0.45),
  plate: () => mat('#cfd0d2', 0.6, 0.65),
  bridge: () => mat('#c3c6cb', 0.5, 0.7),
  gold: () => mat('#d9b46b', 0.4, 0.9),
  brass: () => mat('#cfa75a', 0.45, 0.85),
  ruby: () => mat('#b3122b', 0.18, 0.1, {emissive: '#3a0008', emissiveIntensity: 0.4}),
  spring: () => mat('#8f9aa6', 0.35, 0.9, {side: THREE.DoubleSide}),
  hand: () => mat('#1b1d20', 0.5, 0.3),
};

// shapes lie in plane coordinates; extrude rotates them flat with thickness going up from h
const slab = (shape, h, t) => {
  const g = new THREE.ExtrudeGeometry(shape, {depth: t, bevelEnabled: false, curveSegments: 24});
  g.rotateX(-Math.PI / 2);
  g.translate(0, h, 0);
  return g;
};
const circlePath = (r, cx = 0, cy = 0, Cls = THREE.Path) => {
  const p = new Cls();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
};
const cyl = (r, h0, h1, m, x = 0, y = 0, seg = 24) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h1 - h0, seg), m);
  mesh.position.copy(P3(x, y, (h0 + h1) / 2));
  return mesh;
};
const pol = (r, a) => [r * Math.cos(a * D2R), r * Math.sin(a * D2R)];

/** a spur gear: teeth trapezoids on a rim, a hole for the arbor, optional spokes */
function gearShape(teeth, r, depth, {hole = 0.1, spokes = 0, rimW = 0.3, hubR = 0.3} = {}) {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const k = i % 4;
    const a = ((Math.floor(i / 4) + [0, 0.18, 0.5, 0.68][k]) / teeth) * Math.PI * 2;
    const rr = k === 1 || k === 2 ? r : r - depth;
    const [x, y] = [rr * Math.cos(a), rr * Math.sin(a)];
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.holes.push(circlePath(hole));
  if (spokes) addWindows(s, spokes, hubR, r - depth - rimW);
  return s;
}
function addWindows(s, spokes, r0, r1) {
  const sw = 0.12 / r1; // spoke half-width in radians at the rim
  for (let i = 0; i < spokes; i++) {
    const a0 = (i / spokes) * Math.PI * 2 + sw + 0.12;
    const a1 = ((i + 1) / spokes) * Math.PI * 2 - sw - 0.12;
    const p = new THREE.Path();
    p.absarc(0, 0, r1, a0, a1, false);
    p.absarc(0, 0, r0, a1 + 0.1, a0 - 0.1, true);
    p.closePath();
    s.holes.push(p);
  }
}

/** the club-tooth escape wheel: each tooth's locking corner at angle a, its club trailing behind it */
function escapeShape() {
  const s = new THREE.Shape();
  const Rr = E.R - 0.42;
  const pts = [];
  for (let k = 0; k < E.Z; k++) {
    const a = E.toothLock + E.pitch * k;
    pts.push(pol(Rr, a - 3), pol(E.R, a), pol(E.R - 0.1, a + 7), pol(E.R - 0.2, a + 9), pol(Rr, a + 12));
  }
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  s.holes.push(circlePath(0.08));
  addWindows(s, 5, 0.32, Rr - 0.16);
  return s;
}

/** the pallet lever in its own frame: the arbor at the origin, the fork along +X */
function leverShape() {
  const pts = [
    [4.35, 0.32], [4.35, 0.12], [3.8, 0.12], [3.8, -0.12], [4.35, -0.12], [4.35, -0.32], [3.55, -0.2], [0.6, -0.16],
    [0.42, -0.85], [0.42, -1.32], [-0.08, -1.36], [-0.3, -0.62], [-0.38, 0], [-0.3, 0.62], [-0.08, 1.36], [0.42, 1.32],
    [0.42, 0.85], [0.6, 0.16], [3.55, 0.2],
  ];
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  s.holes.push(circlePath(0.07));
  return s;
}

/** a bridge outline: a hull round a few circles */
function bridgeShape(circles) {
  // sample each circle and take the convex hull
  const pts = [];
  for (const [x, y, r] of circles) for (let i = 0; i < 32; i++) pts.push([x + r * Math.cos((i / 32) * Math.PI * 2), y + r * Math.sin((i / 32) * Math.PI * 2)]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of pts.slice().reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  const s = new THREE.Shape();
  hull.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

// heights (mm above the plate)
export const HT = {wheel: 0.55, wheelT: 0.12, lever: 0.78, leverT: 0.1, roller: 0.92, rim: 1.7, spring: 2.3, cock: 2.9, bridge: 1.25};
const FOURTH = pol(4.48 + 0.28, 200); // fourth wheel pitch radius + escape pinion's

export function buildEscapement() {
  const {g, add, update: updateGroups} = makeGroups(['plate', 'train', 'wheel', 'lever', 'balance', 'spring', 'bridges']);
  const root = new THREE.Group();
  for (const k in g) root.add(g[k].root);

  // ------------------------------------------------------------ main plate, jewels, banking pins
  {
    const s = new THREE.Shape();
    s.absarc(1.5, -1.0, 12.8, 0, Math.PI * 2, false);
    const m = add('plate', new THREE.Mesh(slab(s, -0.6, 0.6), M.plate()));
    m.castShadow = false;
    for (const [x, y] of [[0, 0], [E.D, 0], [E.B, 0], FOURTH]) add('plate', cyl(0.28, 0, 0.06, M.ruby(), x, y));
    // banking pins either side of the fork
    for (const sgn of [1, -1]) {
      const [x, y] = pol(2.9, sgn * 10.6);
      add('plate', cyl(0.11, 0, HT.lever + 0.3, M.steel(), E.D + x, y));
    }
  }

  // ------------------------------------------------------------ fourth wheel with the seconds hand, escape wheel
  const fourth = new THREE.Group();
  fourth.position.copy(P3(...FOURTH));
  add('train', fourth);
  {
    const gs = gearShape(E.train[0], 4.48, 0.17, {spokes: 4, hubR: 0.6, rimW: 0.35});
    fourth.add(new THREE.Mesh(slab(gs, 0.22, 0.1), M.brass()));
    fourth.add(cyl(0.12, -0.1, 1.2, M.steel())); // the seconds hand rides this arbor on the dial side, below the plate
  }
  const wheel = new THREE.Group();
  add('wheel', wheel);
  const toothMat = M.steel();
  {
    const w = new THREE.Mesh(slab(escapeShape(), HT.wheel, HT.wheelT), toothMat);
    wheel.add(w);
    wheel.add(cyl(0.08, -0.05, 1.6, M.steel()));
    // the escape pinion, 7 leaves, meshing with the fourth wheel
    wheel.add(new THREE.Mesh(slab(gearShape(E.train[1], 0.28, 0.1, {hole: 0.05}), 0.12, 0.36), M.steel()));
  }

  // ------------------------------------------------------------ the pallet lever with its stones and guard pin
  const lever = new THREE.Group();
  lever.position.copy(P3(E.D, 0));
  add('lever', lever);
  const stoneMats = [M.ruby(), M.ruby()];
  {
    lever.add(new THREE.Mesh(slab(leverShape(), HT.lever, HT.leverT), M.steel()));
    lever.add(cyl(0.07, -0.05, 1.6, M.steel()));
    lever.add(cyl(0.035, HT.lever - 0.3, HT.lever, M.steel(), 3.75, 0, 12)); // guard pin, just behind the notch
    // stones: tip on the escape wheel's radial line at ±30°, posed for lever angle 0
    [1, -1].forEach((side, i) => {
      const a = side * E.span;
      const tip0 = stoneTip(0, side);
      const len = 0.75;
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.36, E.stoneW), stoneMats[i]);
      const [cx, cy] = pol(tip0 + len / 2, a);
      m.position.copy(P3(cx - E.D, cy, HT.wheel - 0.04 + 0.18));
      m.rotation.y = a * D2R;
      lever.add(m);
    });
  }

  // ------------------------------------------------------------ the balance: staff, rollers, impulse pin, wheel
  const balance = new THREE.Group();
  balance.position.copy(P3(E.B, 0));
  add('balance', balance);
  const rimMat = M.gold();
  const pinMat = M.ruby();
  {
    balance.add(cyl(0.11, -0.05, HT.cock + 0.4, M.steel()));
    balance.add(cyl(0.95, HT.roller, HT.roller + 0.1, M.steel(), 0, 0, 40)); // impulse roller
    balance.add(cyl(0.8, HT.lever - 0.28, HT.lever - 0.18, M.steel(), 0, 0, 40)); // safety roller, the guard pin rides past its edge
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.26, 16), pinMat);
    pin.position.copy(P3(-E.pin, 0, HT.roller - 0.1)); // reaches down into the fork's plane only
    balance.add(pin);
    const prof = [[4.35, 0], [4.9, 0], [4.9, 0.36], [4.35, 0.36]].map(([r, h]) => new THREE.Vector2(r, h));
    prof.push(prof[0].clone());
    const rim = new THREE.Mesh(new THREE.LatheGeometry(prof, 120), rimMat);
    rim.position.y = HT.rim;
    balance.add(rim);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 0.42), rimMat);
      const a = i * 120 * D2R;
      arm.position.copy(P3(2.25 * Math.cos(a), 2.25 * Math.sin(a), HT.rim + 0.1));
      arm.rotation.y = a;
      balance.add(arm);
    }
    balance.add(cyl(0.5, HT.rim, HT.rim + 0.25, rimMat, 0, 0, 32));
    // inertia blocks, so the swing reads at a glance
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.6), M.steel());
      const a = (45 + i * 90) * D2R;
      b.position.copy(P3(4.15 * Math.cos(a), 4.15 * Math.sin(a), HT.rim + 0.18));
      b.rotation.y = a;
      balance.add(b);
    }
  }

  // ------------------------------------------------------------ the hairspring: a ribbon rebuilt each frame
  const N = 13; // coils
  const SAMPLES = 900;
  const sr0 = 0.55;
  const sr1 = 2.9;
  const springGeo = new THREE.BufferGeometry();
  const springPos = new Float32Array(SAMPLES * 2 * 3);
  springGeo.setAttribute('position', new THREE.BufferAttribute(springPos, 3));
  const idx = [];
  for (let i = 0; i < SAMPLES - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  springGeo.setIndex(idx);
  const springMesh = new THREE.Mesh(springGeo, M.spring());
  springMesh.position.copy(P3(E.B, 0));
  add('spring', springMesh);
  springMesh.frustumCulled = false;
  const outerA = N * 360;
  const studAt = pol(sr1, outerA % 360);
  add('spring', cyl(0.16, HT.spring - 0.05, HT.cock, M.steel(), E.B + studAt[0], studAt[1]));
  add('spring', cyl(0.3, HT.spring - 0.02, HT.spring + 0.2, M.steel(), E.B, 0)); // collet
  const poseSpring = (theta) => {
    for (let i = 0; i < SAMPLES; i++) {
      const s = i / (SAMPLES - 1);
      // the inner end turns with the balance, the outer end is pinned at the stud; the coils share the wind
      const a = (outerA * s + theta * (1 - s)) * D2R;
      const r = sr0 + (sr1 - sr0) * s;
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      springPos.set([x, HT.spring, -y, x, HT.spring + 0.16, -y], i * 6);
    }
    springGeo.attributes.position.needsUpdate = true;
    springGeo.computeVertexNormals();
  };

  // ------------------------------------------------------------ bridges: escape and pallet bridge, balance cock
  {
    const b1 = bridgeShape([[0, 0, 0.9], [E.D, 0, 0.7], [-2.6, 2.2, 1.3]]);
    add('bridges', new THREE.Mesh(slab(b1, HT.bridge + 0.4, 0.35), M.bridge()));
    const b2 = bridgeShape([[E.B, 0, 1.2], [E.B + 6.2, 3.0, 1.8]]);
    add('bridges', new THREE.Mesh(slab(b2, HT.cock, 0.4), M.bridge()));
    for (const [x, y, h] of [[0, 0, HT.bridge + 0.75], [E.D, 0, HT.bridge + 0.75], [E.B, 0, HT.cock + 0.4]]) add('bridges', cyl(0.26, h, h + 0.04, M.ruby(), x, y));
    // pillars carrying them
    for (const [x, y, h] of [[-2.6, 2.2, HT.bridge + 0.4], [E.B + 6.2, 3.0, HT.cock]]) add('bridges', cyl(0.7, 0, h, M.bridge(), x, y));
  }

  const accent = new THREE.Color('#e0482b');
  const black = new THREE.Color('#000');
  const glow = (m, k) => {
    m.emissive.copy(k > 0 ? accent : black);
    m.emissiveIntensity = k * 0.7;
  };
  const ex = {plate: 0, train: 2.2, wheel: 3.6, lever: 5.2, balance: 7.2, spring: 9.4, bridges: 12.5};
  const update = (s, dt, explode) => {
    wheel.rotation.y = s.psi * D2R;
    fourth.rotation.y = s.fourth * D2R;
    lever.rotation.y = s.phi * D2R;
    balance.rotation.y = s.theta * D2R;
    poseSpring(s.theta);
    for (const k in ex) g[k].root.position.y = ex[k] * explode;
    // the accent marks the part doing the work right now
    const working = s.phase === 0 || s.phase === 1;
    glow(stoneMats[0], working && s.entryWorks ? 1 : 0);
    glow(stoneMats[1], working && !s.entryWorks ? 1 : 0);
    glow(pinMat, s.engaged ? 1 : 0);
    glow(rimMat, s.phase === 4 ? 0.25 : 0);
    updateGroups(dt);
  };
  // anchors for callouts, in world space
  const w = (x, y, h, grp) => () => {
    const v = P3(x, y, h);
    v.y += g[grp].root.position.y;
    return v.toArray();
  };
  const anchors = {
    wheel: () => {
      const v = P3(...pol(E.R - 0.2, 150 + 0), HT.wheel + 0.12);
      v.y += g.wheel.root.position.y;
      return v.toArray();
    },
    entry: w(...pol(E.R + 0.3, E.span), HT.lever, 'lever'),
    exit: w(...pol(E.R + 0.3, -E.span), HT.lever, 'lever'),
    fork: w(E.D + 3.0, 0, HT.lever + 0.1, 'lever'),
    pin: w(E.B - E.pin, 0, HT.roller, 'balance'),
    rim: w(E.B + 3.4, -3.4, HT.rim + 0.36, 'balance'),
    spring: w(E.B - 1.6, 1.6, HT.spring + 0.16, 'spring'),
    fourth: w(FOURTH[0] - 3.0, FOURTH[1] - 3.0, 0.32, 'train'),
  };
  return {root, g, update, anchors};
}
