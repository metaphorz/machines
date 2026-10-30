// The derailleur's geometry, built from code in millimetres. three.js axes: x lateral (outboard +), y up, z rearward
// (forward is -z, so seen from the drive side the bike faces right). update(state) poses everything from the model.
import * as THREE from 'three';
import {makeGroups} from '../common/shell.js';
import {ARC, DR, pathPoint, sprocketR} from './model.js';

const V3 = THREE.Vector3;
const W3 = (p) => new V3(p.x, p.y, -p.f); // model point -> world
const mat = (color, rough = 0.45, metal = 0.8, extra = {}) =>
  new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal, envMapIntensity: 0.6, ...extra});
const M = {
  cog: () => mat('#b9bdc4', 0.4),
  cogDark: () => mat('#7d828a', 0.45),
  ring: () => mat('#2a2d31', 0.45, 0.6),
  body: () => mat('#3a3d42', 0.5, 0.55),
  link: () => mat('#c9ccd1', 0.38),
  cage: () => mat('#2f3236', 0.45, 0.6),
  pulley: () => mat('#1d1f22', 0.6, 0.1),
  chainOuter: () => mat('#a9adb3', 0.42),
  chainInner: () => mat('#cfd2d6', 0.42),
  roller: () => mat('#8c9097', 0.45),
  frame: () => mat('#e8e4dc', 0.5, 0.15),
  cable: () => mat('#2a2c30', 0.6, 0.1),
  steel: () => mat('#b8bcc3', 0.4),
};

/**
 * A sprocket lying in the side plane: n teeth, a roller seat centred on the pitch circle at shape angle 0 (and every
 * 360/n after), a bore, optional spider windows. Shape (a, b) maps to world (forward, up); thickness runs laterally.
 */
function sprocketGeo(n, thick, bore, windows = 0) {
  const R = sprocketR(n);
  const seat = 3.95; // seats for 7.75 mm rollers
  const tip = R + 3.6;
  const s = new THREE.Shape();
  const da = (Math.PI * 2) / n;
  let first = true;
  for (let i = 0; i < n; i++) {
    const a = i * da;
    const r = [Math.cos(a), Math.sin(a)];
    const t = [-Math.sin(a), Math.cos(a)];
    // the seat: a half circle cut inward from the pitch circle
    for (let j = 0; j <= 10; j++) {
      const u = (Math.PI * j) / 10;
      const x = R * r[0] + seat * (-Math.cos(u) * t[0] - Math.sin(u) * r[0]);
      const y = R * r[1] + seat * (-Math.cos(u) * t[1] - Math.sin(u) * r[1]);
      if (first) s.moveTo(x, y);
      else s.lineTo(x, y);
      first = false;
    }
    // the tooth between this seat and the next
    const am = a + da / 2;
    const hw = Math.min(da * 0.16, 1.6 / tip);
    s.lineTo(tip * Math.cos(am - hw), tip * Math.sin(am - hw));
    s.lineTo(tip * Math.cos(am + hw), tip * Math.sin(am + hw));
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, bore, 0, Math.PI * 2, true);
  s.holes.push(hole);
  if (windows) {
    const r0 = bore + 5;
    const r1 = R - 9;
    for (let i = 0; i < windows; i++) {
      const a0 = (i / windows) * Math.PI * 2 + 0.22;
      const a1 = ((i + 1) / windows) * Math.PI * 2 - 0.22;
      const p = new THREE.Path();
      p.absarc(0, 0, r1, a0, a1, false);
      p.absarc(0, 0, r0, a1 - 0.08, a0 + 0.08, true);
      p.closePath();
      s.holes.push(p);
    }
  }
  const g = new THREE.ExtrudeGeometry(s, {depth: thick, bevelEnabled: false, curveSegments: 6});
  g.translate(0, 0, -thick / 2);
  g.rotateY(Math.PI / 2); // shape x -> -z (forward), shape y -> y, thickness -> x
  return g;
}
/** a stadium plate in its own x-y plane, L between end centres, end radius r, an optional waist */
function stadium(L, r, thick, waist = 1) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  if (waist < 1) s.quadraticCurveTo(L / 2, -r * waist, L, -r);
  else s.lineTo(L, -r);
  s.absarc(L, 0, r, -Math.PI / 2, Math.PI / 2, false);
  if (waist < 1) s.quadraticCurveTo(L / 2, r * waist, 0, r);
  else s.lineTo(0, r);
  const g = new THREE.ExtrudeGeometry(s, {depth: thick, bevelEnabled: false, curveSegments: 10});
  g.translate(0, 0, -thick / 2);
  return g;
}
// a unit-length box or rod stretched between two points (its length runs along local z)
const span = (mesh, a, b) => {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.lookAt(b);
  mesh.scale.z = Math.max(1e-3, a.distanceTo(b));
  return mesh;
};
const rod = (r, m) => {
  const g = new THREE.CylinderGeometry(r, r, 1, 18);
  g.rotateX(Math.PI / 2);
  return new THREE.Mesh(g, m);
};
const box = (w, h, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), m);

export function buildDerailleur() {
  const {g, add, update: updateGroups} = makeGroups(['frame', 'cassette', 'crank', 'chain', 'parallelogram', 'cage']);
  const root = new THREE.Group();
  for (const k in g) root.add(g[k].root);
  const BB = new V3(DR.ringX, DR.ringC[1], -DR.ringC[0]);

  // ------------------------------------------------------------ frame: stays, dropout, hanger, axle, hub
  const HANGER_BOLT = new V3(72, -30, 10);
  {
    const fm = M.frame();
    add('frame', span(rod(9, fm), new V3(66, 0, 0), new V3(30, BB.y, BB.z + 40)));
    add('frame', span(rod(7, fm), new V3(66, 0, 0), new V3(28, 440, -320)));
    add('frame', span(rod(15, fm), new V3(64, 0, 0), new V3(71, 0, 0)));
    add('frame', span(rod(7, M.steel()), new V3(72, 0, 0), HANGER_BOLT));
    add('frame', span(rod(7.5, M.steel()), new V3(-70, 0, 0), new V3(78, 0, 0)));
    add('frame', span(rod(19, M.cogDark()), new V3(-30, 0, 0), new V3(14, 0, 0)));
    add('frame', span(rod(16.5, M.cogDark()), new V3(14, 0, 0), new V3(60, 0, 0)));
  }

  // ------------------------------------------------------------ cassette
  const cassette = new THREE.Group();
  add('cassette', cassette);
  const cogMats = DR.cogs.map((_, k) => (k % 2 ? M.cog() : M.cogDark()));
  DR.cogs.forEach((n, k) => {
    const m = new THREE.Mesh(sprocketGeo(n, 1.6, 17, n >= 17 ? 5 : 0), cogMats[k]);
    m.position.x = DR.cogX[k];
    cassette.add(m);
  });

  // ------------------------------------------------------------ chainring and crank
  const crank = new THREE.Group();
  crank.position.copy(BB);
  add('crank', crank);
  const ringMesh = new THREE.Mesh(sprocketGeo(DR.ring, 4, 62, 4), M.ring());
  crank.add(ringMesh);
  const armPivot = new THREE.Group();
  crank.add(armPivot);
  const arm = new THREE.Mesh(stadium(172.5, 13, 12, 0.7), M.ring());
  arm.rotation.y = Math.PI / 2; // shape x -> forward, thickness -> lateral
  arm.position.x = 12;
  armPivot.add(arm);
  const pedal = rod(6, M.steel());
  pedal.position.set(172.5, 0, 26);
  pedal.scale.z = 40;
  arm.add(pedal);

  // ------------------------------------------------------------ the parallelogram: B-knuckle, two links, P-knuckle
  const dir = (p) => new V3(p.x, p.y, -p.f);
  const aD = dir(ARC.d);
  const aE = dir(ARC.e);
  const axis = new V3().crossVectors(aD, aE).normalize(); // the links' pivot axis, normal to the plane of travel
  const Q = new V3(0, 1, 0).addScaledVector(axis, -axis.y).normalize().multiplyScalar(15); // the second link, above
  const KOFF = new V3(4, 10, 8); // the P-knuckle's lower pivot relative to the guide pulley centre
  const C1 = W3(ARC.centre).add(KOFF);
  const C2 = C1.clone().add(Q);
  const Cmid = C1.clone().lerp(C2, 0.5);
  const bodyM = M.body();
  add('parallelogram', span(box(16, 20, bodyM), HANGER_BOLT, Cmid));
  add('parallelogram', span(rod(8, bodyM), HANGER_BOLT.clone().add(new V3(-5, 0, 0)), HANGER_BOLT.clone().add(new V3(9, 0, 0))));
  add('parallelogram', span(box(14, 22, bodyM), Cmid.clone().addScaledVector(axis, -7), Cmid.clone().addScaledVector(axis, 7)));
  for (const c of [C1, C2]) add('parallelogram', span(rod(3.5, M.steel()), c.clone().addScaledVector(axis, -10), c.clone().addScaledVector(axis, 10)));
  const linkM = M.link();
  const links = [0, 1].map(() => add('parallelogram', box(13, 3.5, linkM)));
  const pBody = add('parallelogram', box(12, 20, bodyM));
  const pPins = [0, 1].map(() => add('parallelogram', rod(3.2, M.steel())));
  const post = add('parallelogram', rod(5, bodyM));
  // cable: housing from the chainstay stop to the barrel adjuster on the body, the inner wire to the outer link
  const BARREL = Cmid.clone().add(new V3(12, 16, 10));
  {
    const curve = new THREE.CatmullRomCurve3([new V3(68, 24, -150), new V3(84, 30, -70), new V3(94, 22, 0), BARREL.clone().add(new V3(2, 4, -14)), BARREL]);
    add('parallelogram', new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 2.5, 10), M.cable()));
    add('parallelogram', span(rod(4.5, M.steel()), BARREL.clone().add(new V3(0, 1, -6)), BARREL.clone().add(new V3(0, -1, 6))));
  }
  const wire = add('parallelogram', rod(0.7, M.steel()));

  // ------------------------------------------------------------ cage and pulleys
  const cage = new THREE.Group();
  add('cage', cage);
  const cageM = M.cage();
  for (const [r, x, t, w] of [[12.5, 7.5, 2, 0.72], [10.5, -7.5, 1.6, 0.6]]) {
    const plate = new THREE.Mesh(stadium(DR.cageL, r, t, w), cageM);
    plate.rotation.set(0, Math.PI / 2, -Math.PI / 2, 'YXZ'); // length points straight down, thickness laterally
    plate.position.x = x;
    cage.add(plate);
  }
  const pulleyM = M.pulley();
  const upper = new THREE.Mesh(sprocketGeo(DR.pulleyT, 3, 2.5), pulleyM);
  const lower = new THREE.Mesh(sprocketGeo(DR.pulleyT, 3, 2.5), pulleyM);
  add('cage', upper);
  add('cage', lower);
  const bolts = [0, 1].map(() => add('cage', rod(3, M.steel())));

  // ------------------------------------------------------------ the chain: instanced plates, rollers, pins
  const NL = DR.links;
  const plateG = stadium(DR.pitch, 4.6, 0.8, 0.72);
  const inner = new THREE.InstancedMesh(plateG, M.chainInner(), NL);
  const outer = new THREE.InstancedMesh(plateG, M.chainOuter(), NL);
  const rollerG = new THREE.CylinderGeometry(3.875, 3.875, 2.2, 14);
  rollerG.rotateZ(Math.PI / 2);
  const rollers = new THREE.InstancedMesh(rollerG, M.roller(), NL);
  const pinG = new THREE.CylinderGeometry(1.8, 1.8, 5.6, 10);
  pinG.rotateZ(Math.PI / 2);
  const pins = new THREE.InstancedMesh(pinG, M.steel(), NL);
  for (const im of [inner, outer, rollers, pins]) {
    im.frustumCulled = false;
    add('chain', im);
  }
  const tmpM = new THREE.Matrix4();
  const bx = new V3();
  const by = new V3();
  const bz = new V3();
  const off = new V3();
  const X = new V3(1, 0, 0);
  const pts = Array.from({length: NL + 1}, () => new V3());
  const placeChain = (path, s0) => {
    for (let i = 0; i <= NL; i++) {
      const p = pathPoint(path, s0 + i * DR.pitch);
      pts[i].set(p.x, p.y, -p.f);
    }
    let ni = 0;
    let no = 0;
    for (let i = 0; i < NL; i++) {
      bx.subVectors(pts[i + 1], pts[i]).normalize();
      bz.copy(X).addScaledVector(bx, -X.dot(bx)).normalize();
      by.crossVectors(bz, bx);
      // inner plates on even pitches, outer plates (wider apart, over them) on odd
      const isOuter = i % 2 === 1;
      const w = isOuter ? 2.4 : 1.5;
      for (const sgn of [1, -1]) {
        off.copy(pts[i]).addScaledVector(bz, sgn * w);
        tmpM.makeBasis(bx, by, bz).setPosition(off);
        if (isOuter) outer.setMatrixAt(no++, tmpM);
        else inner.setMatrixAt(ni++, tmpM);
      }
      tmpM.makeBasis(bz, bx, by).setPosition(pts[i]);
      rollers.setMatrixAt(i, tmpM);
      pins.setMatrixAt(i, tmpM);
    }
    inner.count = ni;
    outer.count = no;
    for (const im of [inner, outer, rollers, pins]) im.instanceMatrix.needsUpdate = true;
  };
  // a sprocket's rotation that seats the roller nearest the middle of its wrap in a tooth gap
  const seatAngle = (centre, R, mid) => {
    let best = null;
    let bd = Infinity;
    for (const p of pts) {
      const f = -p.z - centre[0];
      const y = p.y - centre[1];
      if (Math.abs(Math.hypot(f, y) - R) > 3) continue;
      const a = Math.atan2(y, f);
      const d = Math.abs(Math.atan2(Math.sin(a - mid), Math.cos(a - mid)));
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  };
  const midOf = (seg) => seg.a0 + (seg.s * seg.sweep) / 2;
  // a sprocket turns one tooth per link of chain travel; the seat only trims it within a tooth, so the spider never
  // snaps back when the roller nearest mid-wrap changes
  const turn = (seg, n, s0, seat) => {
    const step = (Math.PI * 2) / n;
    const cont = (seg.s * s0 * step) / DR.pitch;
    return seat === null ? cont : seat + step * Math.round((cont - seat) / step);
  };

  const accent = new THREE.Color('#e0482b');
  const black = new THREE.Color('#000');
  const glow = (m, k) => {
    m.emissive.copy(k > 0 ? accent : black);
    m.emissiveIntensity = k * 0.55;
  };
  const exX = {frame: 0, cassette: -60, crank: 0, chain: 0, parallelogram: 130, cage: 65};
  let topRun = {x: 0, y: 0, z: 0};

  const update = (st, dt, explode) => {
    for (const k in exX) g[k].root.position.x = exX[k] * explode;
    placeChain(st.path, st.s);
    const seg = (name) => st.path.segs.find((s) => s.name === name);
    const cogSeg = seg('cog');
    cassette.rotation.x = turn(cogSeg, DR.cogs[Math.round(st.e)], st.s, seatAngle([0, 0], cogSeg.r, midOf(cogSeg)));
    const ringSeg = seg('ring');
    ringMesh.rotation.x = turn(ringSeg, DR.ring, st.s, seatAngle(DR.ringC, DR.Rr, midOf(ringSeg)));
    armPivot.rotation.x = ringMesh.rotation.x; // the arm is bolted to the ring

    // the derailleur from the guide pulley's position
    const G = W3(st.G);
    const P1 = G.clone().add(KOFF);
    const P2 = P1.clone().add(Q);
    span(links[0], C1, P1);
    span(links[1], C2, P2);
    const Pmid = P1.clone().lerp(P2, 0.5);
    span(pBody, Pmid.clone().addScaledVector(axis, -6), Pmid.clone().addScaledVector(axis, 6));
    pPins.forEach((p, i) => {
      const c = i ? P2 : P1;
      span(p, c.clone().addScaledVector(axis, -9), c.clone().addScaledVector(axis, 9));
    });
    span(post, P1, G.clone().add(new V3(10, 0, 0)));
    span(wire, BARREL, C1.clone().lerp(P1, 0.6).add(new V3(7, 2, 0)));

    cage.position.copy(G);
    cage.rotation.x = st.alpha;
    upper.position.copy(G);
    const L = new V3(st.G.x, st.lower[1], -st.lower[0]);
    lower.position.copy(L);
    span(bolts[0], G.clone().add(new V3(-9, 0, 0)), G.clone().add(new V3(10, 0, 0)));
    span(bolts[1], L.clone().add(new V3(-9, 0, 0)), L.clone().add(new V3(10, 0, 0)));
    const upSeg = seg('upper');
    const loSeg = seg('lower');
    upper.rotation.x = turn(upSeg, DR.pulleyT, st.s, seatAngle([st.G.f, st.G.y], DR.Rp, midOf(upSeg)));
    lower.rotation.x = turn(loSeg, DR.pulleyT, st.s, seatAngle(st.lower, DR.Rp, midOf(loSeg)));

    // the accent: the cog the chain is climbing to, the parallelogram and guide pulley while they move
    cogMats.forEach((m, k) => glow(m, st.shifting && k === st.target ? 1 : 0));
    glow(pulleyM, st.moving ? 1 : 0);
    glow(linkM, st.moving ? 0.6 : 0);
    updateGroups(dt);
    // a point on the top run, 120 mm forward of the cassette
    let sEnd = 0;
    for (const sg of st.path.segs) {
      sEnd += sg.len;
      if (sg.name === 'cog') break;
    }
    const p = pathPoint(st.path, sEnd + 120);
    topRun = {x: p.x, y: p.y, z: -p.f};
  };

  const at = (fn, grp) => () => {
    const v = fn();
    v.x += g[grp].root.position.x;
    return v.toArray();
  };
  const anchors = {
    cassette: at(() => new V3(DR.cogX[10] - 1, sprocketR(28) + 3, 4), 'cassette'),
    guide: at(() => upper.position.clone().add(new V3(9, DR.Rp * 0.3, 0)), 'cage'),
    lower: at(() => lower.position.clone().add(new V3(9, -DR.Rp * 0.5, 0)), 'cage'),
    link: at(() => links[0].position.clone().add(new V3(4, 0, 0)), 'parallelogram'),
    body: at(() => HANGER_BOLT.clone().add(new V3(9, 0, 0)), 'parallelogram'),
    cable: at(() => BARREL.clone(), 'parallelogram'),
    chain: at(() => new V3(topRun.x + 3, topRun.y + 4, topRun.z), 'chain'),
    ring: at(() => new V3(DR.ringX + 3, DR.ringC[1] + DR.Rr, -DR.ringC[0]), 'crank'),
  };
  return {root, g, update, anchors};
}
