// The Swiss lever escapement of an ETA 2824-class movement, in millimetres and degrees. One input, time, plus the
// balance amplitude; every pose and every readout is a pure function of the two.
//
// Sourced: 4 Hz (28,800 vph), a 15-tooth club-tooth escape wheel, a 52° lift angle, 270-310° amplitude at full wind.
// Derived (hand check): 4 Hz = 8 beats/s. The wheel advances half a tooth per beat: 24° / 2 = 12°. 4 teeth/s on a
// 15-tooth wheel = 16 rpm, so a seconds wheel at 1 rpm needs a 16:1 drive (112 teeth onto a 7-leaf pinion).
// The pallets span 2.5 teeth (60°), so when one pallet locks a tooth the other sits mid-gap: the beats alternate.
// The impulse pin only meets the fork within ±26° (half the lift); rebanking starts above 360 - 26 = 334°.
// Approximate (no source to hand): the 10° lever swing between bankings, the 1.5° lock, the split of the 12° into
// 10.5° impulse and 1.5° drop, and the part sizes. The wheel's motion inside a beat is a phase model (unlock, impulse,
// drop, draw), not a contact solve.

export const E = {
  f: 4,
  vph: 28800,
  Z: 15,
  pitch: 24,
  beat: 12,
  lift: 52,
  lever: 10, // banking to banking
  lock: 1.5, // lever degrees of lock
  impulse: 10.5, // escape wheel degrees of impulse per beat
  drop: 1.5,
  R: 1.6, // escape wheel tooth tip radius
  span: 30, // each pallet's tangent point sits 30° off the line of centres (2.5 pitches between them)
  stoneW: 0.2, // pallet stone thickness, tangential
  fork: 3.9, // pallet arbor to the fork notch
  pin: 0.75, // impulse pin radius on the roller (fork / pin = 52 / 10 = 5.2)
  balanceR: 4.9,
  train: [112, 7], // fourth wheel teeth, escape pinion leaves: 16:1
  ampDefault: 290,
};
const D2R = Math.PI / 180;
E.D = E.R / Math.cos(E.span * D2R); // pallet arbor from the escape wheel centre
E.PT = E.R * Math.tan(E.span * D2R); // pallet arbor to each tangent point
E.B = E.D + E.fork + E.pin; // balance staff on the line of centres
E.halfLift = E.lift / 2;
E.rebank = 360 - E.halfLift;
// the radial depth a stone tip moves per lever degree, and the depth at full lock
E.depthPerDeg = E.PT * D2R;
E.lockDepth = E.lock * E.depthPerDeg;
// a tooth tip locked on the entry stone's upstream face (the wheel turns clockwise, so upstream is the larger angle)
E.toothLock = E.span + (E.stoneW / 2 / E.R) / D2R;

export const PHASES = ['UNLOCK', 'IMPULSE', 'DROP', 'DRAW', 'FREE SWING'];
const U_LOCK = E.lock / E.lever;
const U_DROP = 1 - 1.4 / E.lever; // the tooth leaves the stone with the lever 1.4° short of banking
const U_LAND = U_DROP + 0.01; // and drops onto the other pallet's lock

/** the escape wheel's progress through one beat (0..1 of 12°) for lever travel u (0..1) */
function wheelOf(u) {
  const recoil = -0.03;
  if (u < U_LOCK) return (recoil * u) / U_LOCK;
  const imp = E.impulse / E.beat;
  if (u < U_DROP) return recoil + (imp - recoil) * ((u - U_LOCK) / (U_DROP - U_LOCK));
  if (u < U_LAND) return imp + (1 - imp) * ((u - U_DROP) / (U_LAND - U_DROP));
  return 1;
}

/** the whole escapement at time t (s) and amplitude A (degrees) */
export function stateAt(t, A = E.ampDefault) {
  const w = 2 * Math.PI * E.f;
  const theta = A * Math.sin(w * t); // balance angle
  const omega = A * w * Math.cos(w * t); // deg/s
  const phi = -(E.lever / 2) * Math.max(-1, Math.min(1, theta / E.halfLift)); // lever angle
  // beats happen at the balance's zero crossings; the fork is engaged within ±half-lift of each
  const win = Math.asin(Math.min(1, E.halfLift / A)) / w;
  const j = Math.round(2 * E.f * t);
  const tj = j / (2 * E.f);
  const dir = j % 2 === 0 ? 1 : -1;
  let done;
  let phase = 4;
  let u = 0;
  if (t < tj - win) done = j;
  else if (t > tj + win) done = j + 1;
  else {
    u = ((E.lever / 2) * dir - phi) / (E.lever * dir);
    const g = wheelOf(u);
    done = j + g;
    phase = u < U_LOCK ? 0 : u < U_DROP ? 1 : u < U_LAND ? 2 : 3;
  }
  // which pallet is doing the work: even beats unlock and impulse on the entry pallet, odd on the exit
  const entryWorks = (phase < 4 ? j : Math.floor(done)) % 2 === 0;
  const psi = -E.beat * done; // escape wheel angle, clockwise
  const fourth = -psi / (E.train[0] / E.train[1]); // meshing gears turn opposite ways
  return {
    t,
    A,
    theta,
    omega,
    phi,
    psi,
    fourth,
    beats: Math.floor(done),
    phase,
    u,
    entryWorks,
    engaged: Math.abs(theta) < E.halfLift,
    rebank: A > E.rebank,
    seconds: (Math.floor(done) / (2 * E.f)) % 60,
  };
}

// plane geometry (top view, x along the line of centres from the escape wheel to the balance)
export const toothAngles = (psi) => Array.from({length: E.Z}, (_, k) => E.toothLock + E.pitch * k + psi);
/** a pallet stone's tip radius from the escape wheel centre for lever angle phi; +1 entry, -1 exit */
export const stoneTip = (phi, side) => E.R - E.lockDepth - side * (phi - (side * E.lever) / 2) * E.depthPerDeg;
