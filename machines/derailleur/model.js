// A Shimano 11-speed road rear derailleur on an 11-28 cassette with a 50-tooth chainring, in millimetres. No three.js.
//
// Sourced: 2.7 mm of cable per shift (Shimano 11-speed road STI), a 1.4 actuation ratio, a 1/2" (12.7 mm) chain.
// Hand check: 2.7 x 1.4 = 3.78 mm, the 11-speed cog pitch; 10 shifts move the guide pulley 37.8 mm.
// A sprocket's pitch radius is 12.7 / (2 sin(pi / N)): 22.54 mm for 11 teeth, 56.72 mm for 28, 101.2 mm for 50.
// Derived: the chain is sized big ring + big cog + 2 links, rounded to an even count; the cage angle in every gear is
// solved so that the chain's path (4 tangents, 4 arcs) is exactly that long.
// Approximate (no source to hand): the frame (410 mm chainstay, 70 mm BB drop, 43.5 mm chainline), the derailleur's
// link length, cage length and the slant of its travel, and the pulley-to-cog gap at the two end cogs.

export const DR = {
  cogs: [11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 28],
  ring: 50,
  pitch: 12.7,
  pull: 2.7,
  ratio: 1.4,
  cogPitch: 3.78,
  cog0X: 56, // smallest cog's lateral position from the hub centre
  ringX: 43.5, // chainline
  ringC: [410, -70], // chainring centre (forward, up) from the rear axle
  pulleyT: 11,
  cageL: 55, // upper to lower pulley centres
  gap: 6, // pulley tips to cog tips at the two end cogs
  slant: 20, // the guide pulley sits this far behind straight below the axle
  linkL: 50, // parallelogram link length
  wheelCirc: 2105, // 700 x 25c
  wheelIn: 26.3,
};
export const sprocketR = (n) => DR.pitch / (2 * Math.sin(Math.PI / n));
DR.Rp = sprocketR(DR.pulleyT);
DR.Rr = sprocketR(DR.ring);
DR.cogR = DR.cogs.map(sprocketR);
DR.cogX = DR.cogs.map((_, k) => DR.cog0X - k * DR.cogPitch);
DR.maxPull = (DR.cogs.length - 1) * DR.pull;

// ------------------------------------------------------------ 3D helpers (x lateral, y up, f forward)
const v = (x, y, f) => ({x, y, f});
const add = (a, b, k = 1) => v(a.x + b.x * k, a.y + b.y * k, a.f + b.f * k);
const len = (a) => Math.hypot(a.x, a.y, a.f);
const norm = (a) => {
  const l = len(a);
  return v(a.x / l, a.y / l, a.f / l);
};

// ------------------------------------------------------------ the parallelogram: the guide pulley rides an arc
const radial = [-Math.sin((DR.slant * Math.PI) / 180), -Math.cos((DR.slant * Math.PI) / 180)]; // (f, y) away from the axle
const gAt = (k) => {
  const d = DR.cogR[k] + DR.gap + DR.Rp;
  return v(DR.cogX[k], radial[1] * d, radial[0] * d);
};
const G0 = gAt(0);
const G1 = gAt(DR.cogs.length - 1);
const chord = add(G1, G0, -1);
const dHat = norm(chord);
// the arc's centre sits behind, above and outboard of the chord (the B-knuckle hangs outside the cassette)
const e0 = v(0.55, 0.25, -0.8);
const ed = e0.x * dHat.x + e0.y * dHat.y + e0.f * dHat.f;
const E_HAT = norm(v(e0.x - ed * dHat.x, e0.y - ed * dHat.y, e0.f - ed * dHat.f));
const half = len(chord) / 2;
const hC = Math.sqrt(DR.linkL ** 2 - half ** 2);
export const ARC = {centre: add(add(G0, chord, 0.5), E_HAT, hC), d: dHat, e: E_HAT, beta0: Math.asin(half / DR.linkL)};
/** guide pulley centre at link angle beta (radians, 0 = mid-travel) */
export const guideAt = (beta) => add(add(ARC.centre, ARC.e, -DR.linkL * Math.cos(beta)), ARC.d, DR.linkL * Math.sin(beta));
/** the link angle that puts the guide pulley at lateral position x (the arc is monotonic in x) */
export function betaForX(x) {
  let lo = -ARC.beta0 - 0.3;
  let hi = ARC.beta0 + 0.3;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    // x falls as beta grows (the chord runs from the outboard small cog to the inboard big cog)
    if (guideAt(m).x > x) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
/** cable pull (mm) to the derailleur: Shimano's ratio keeps the travel linear in pull */
export function derailleurAt(pull) {
  const x = DR.cog0X - DR.ratio * pull;
  const beta = betaForX(x);
  return {pull, x, beta, G: guideAt(beta), travel: DR.ratio * pull};
}

// ------------------------------------------------------------ the chain path: tangents and arcs in the side plane
// circles in (f, y) with a winding s: +1 the chain goes round anticlockwise (seen from the drive side, front right)
function tangent(c1, r1, s1, c2, r2, s2) {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const L = Math.hypot(dx, dy);
  const th = Math.atan2(dy, dx);
  const phi = th + Math.acos(Math.max(-1, Math.min(1, (s2 * r2 - s1 * r1) / L)));
  const n = [Math.cos(phi), Math.sin(phi)];
  return [
    [c1[0] - s1 * r1 * n[0], c1[1] - s1 * r1 * n[1]],
    [c2[0] - s2 * r2 * n[0], c2[1] - s2 * r2 * n[1]],
  ];
}
const TAU = Math.PI * 2;
const mod = (a, m) => ((a % m) + m) % m;
// a chain wraps a sprocket as a polygon of 12.7 mm chords, one roller per tooth: along an arc the rollers advance one
// tooth angle (2 pi / N) per pitch, so arc lengths use the radius pitch * N / (2 pi), a hair under the pitch radius
const rollRadius = (c) => (c.n ? (DR.pitch * c.n) / TAU : c.r);
/**
 * The loop in order of chain travel: chainring -> lower pulley -> upper pulley -> cog. Each circle: {c: [f, y], r, s, x, n}.
 * Returns segments with lengths; the total is the chain length that path needs.
 */
export function chainPath(circles) {
  const n = circles.length;
  const tans = circles.map((a, i) => {
    const b = circles[(i + 1) % n];
    return tangent(a.c, a.r, a.s, b.c, b.r, b.s);
  });
  const segs = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const c = circles[i];
    const arrive = tans[(i - 1 + n) % n][1];
    const leave = tans[i][0];
    const a0 = Math.atan2(arrive[1] - c.c[1], arrive[0] - c.c[0]);
    const a1 = Math.atan2(leave[1] - c.c[1], leave[0] - c.c[0]);
    const sweep = c.s > 0 ? mod(a1 - a0, TAU) : mod(a0 - a1, TAU);
    const re = rollRadius(c);
    segs.push({type: 'arc', c: c.c, r: c.r, re, s: c.s, a0, sweep, x: c.x, len: re * sweep, name: c.name});
    total += re * sweep;
    const [p, q] = tans[i];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    segs.push({type: 'line', p, q, x0: c.x, x1: circles[(i + 1) % n].x, len: L});
    total += L;
  }
  return {segs, total};
}
/** a point on the path at arc length s: [x, y, f] and the unit tangent */
export function pathPoint(path, s) {
  let u = mod(s, path.total);
  for (const g of path.segs) {
    if (u <= g.len) {
      if (g.type === 'line') {
        const k = u / g.len;
        const t = [(g.q[0] - g.p[0]) / g.len, (g.q[1] - g.p[1]) / g.len];
        return {x: g.x0 + (g.x1 - g.x0) * k, f: g.p[0] + (g.q[0] - g.p[0]) * k, y: g.p[1] + (g.q[1] - g.p[1]) * k, tf: t[0], ty: t[1], seg: g};
      }
      const a = g.a0 + (g.s * u) / g.re;
      return {x: g.x, f: g.c[0] + g.r * Math.cos(a), y: g.c[1] + g.r * Math.sin(a), tf: -g.s * Math.sin(a), ty: g.s * Math.cos(a), seg: g, a};
    }
    u -= g.len;
  }
  return pathPoint(path, 0);
}

const ringCircle = {c: DR.ringC, r: DR.Rr, s: -1, x: DR.ringX, n: DR.ring, name: 'ring'};
/** the loop for a guide pulley at G, the cage at angle alpha (forward of straight down), the chain on cog radius R at x */
export function loopFor(G, alpha, R, x, n) {
  const L = [G.f + DR.cageL * Math.sin(alpha), G.y - DR.cageL * Math.cos(alpha)];
  return [
    ringCircle,
    {c: L, r: DR.Rp, s: -1, x: G.x, n: DR.pulleyT, name: 'lower'},
    {c: [G.f, G.y], r: DR.Rp, s: 1, x: G.x, n: DR.pulleyT, name: 'upper'},
    {c: [0, 0], r: R, s: -1, x, n, name: 'cog'},
  ];
}
// chain length: big ring round the biggest cog with no derailleur, plus 2 links, rounded up to an even link count
{
  const direct = chainPath([ringCircle, {c: [0, 0], r: DR.cogR[DR.cogs.length - 1], s: -1, x: 0, n: DR.cogs[DR.cogs.length - 1]}]).total;
  DR.links = Math.ceil((direct + 2 * DR.pitch) / (2 * DR.pitch)) * 2;
  DR.chainL = DR.links * DR.pitch;
}
/** the cage angle that makes the loop exactly the chain's length (a longer loop as the cage swings back) */
export function solveCage(G, R, x, n) {
  let lo = -1.2;
  let hi = 1.5;
  for (let i = 0; i < 44; i++) {
    const m = (lo + hi) / 2;
    if (chainPath(loopFor(G, m, R, x, n)).total > DR.chainL) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
/** the drivetrain for cable pull and the chain's (possibly fractional) cog */
export function drivetrainAt(pull, e) {
  const der = derailleurAt(pull);
  const k0 = Math.floor(Math.min(e, DR.cogs.length - 1.0001));
  const fr = e - k0;
  const R = DR.cogR[k0] + (DR.cogR[k0 + 1] - DR.cogR[k0]) * fr;
  const x = DR.cogX[k0] + (DR.cogX[k0 + 1] - DR.cogX[k0]) * fr;
  const n = DR.cogs[k0] + (DR.cogs[k0 + 1] - DR.cogs[k0]) * fr;
  const alpha = solveCage(der.G, R, x, n);
  const path = chainPath(loopFor(der.G, alpha, R, x, n));
  const cogSeg = path.segs.find((g) => g.name === 'cog');
  const N = DR.cogs[Math.round(e)];
  const ratio = DR.ring / N;
  return {
    ...der,
    e,
    R,
    cogX: x,
    alpha,
    path,
    N,
    ratio,
    gearIn: ratio * DR.wheelIn,
    devel: (ratio * DR.wheelCirc) / 1000,
    bGap: Math.hypot(der.G.f, der.G.y) - R - DR.Rp,
    wrapTeeth: (cogSeg.sweep / TAU) * (DR.cogs[k0] + (DR.cogs[k0 + 1] - DR.cogs[k0]) * fr),
    chainline: (Math.atan2(DR.ringX - x, DR.ringC[0]) * 180) / Math.PI,
    lower: loopFor(der.G, alpha, R, x, n)[1].c,
  };
}
/** the cog under the guide pulley for a lateral position */
export const cogUnder = (x) => Math.max(0, Math.min(DR.cogs.length - 1, (DR.cog0X - x) / DR.cogPitch));
