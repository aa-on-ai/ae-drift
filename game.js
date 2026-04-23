const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const boostFillEl = document.querySelector("#boost-fill");
const hullEl = document.querySelector("#hull");
const toastEl = document.querySelector("#toast");
const panelEl = document.querySelector("#panel");
const panelCopyEl = document.querySelector("#panel-copy");
const startButton = document.querySelector("#start");
const muteButton = document.querySelector("#mute");
const upgradeEl = document.querySelector("#upgrade");
const upgradeOptionsEl = document.querySelector("#upgrade-options");
const audioPanelEl = document.querySelector("#audio-panel");
const volumeSliderEl = document.querySelector("#volume");
const volumeValueEl = document.querySelector("#volume-value");
const restartButton = document.querySelector("#restart");

const logo = new Image();
logo.src = "assets/logo-ae.svg";

const keys = new Set();
const touch = new Set();
const typed = [];
const konami = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
];
const konamiBuffer = [];
const eggTotal = 12;
const twoPi = Math.PI * 2;
const logoTilt = 0;

let width = 0;
let height = 0;
let dpr = 1;
let last = performance.now();
let toastTimer = 0;
let audio;
let masterGain;
let musicGain;
let sfxGain;
let muted = false;
let disco = false;
let slowMo = 0;
let shakeFrames = 0;
let shakePower = 0;
let musicNextTime = 0;
let musicStep = 0;
let engineNextTime = 0;
let volume = readVolume();

const songs = [
  {
    name: "launch",
    bpm: 144,
    roots: [110, 110, 130.81, 98],
    arp: [0, 7, 12, 15, 12, 7, 0, 10],
    bass: [0, 0, 7, 0, 10, 0, 7, 0],
  },
  {
    name: "orbit",
    bpm: 156,
    roots: [98, 123.47, 146.83, 123.47],
    arp: [0, 3, 7, 12, 15, 12, 7, 3],
    bass: [0, 0, 12, 0, 7, 0, 10, 0],
  },
  {
    name: "spark",
    bpm: 132,
    roots: [130.81, 146.83, 110, 164.81],
    arp: [12, 7, 4, 7, 14, 11, 7, 4],
    bass: [0, 0, -12, 0, 7, 0, -5, 0],
  },
  {
    name: "danger",
    bpm: 168,
    roots: [82.41, 98, 92.5, 110],
    arp: [0, 12, 7, 15, 10, 7, 3, 10],
    bass: [0, 0, 0, 7, 0, 10, 0, 7],
  },
];

const baseStats = {
  thrust: 430,
  turn: 5.1,
  maxCharge: 100,
  regen: 14,
  magnet: 0,
  dashCost: 22,
  dashPower: 650,
  dashCooldown: 0.55,
  comboHold: 2.2,
  comboGain: 0.16,
  maxHull: 3,
  maxSpeed: 620,
  shieldGrace: 1.1,
};

const state = {
  phase: "menu",
  score: 0,
  best: readBest(),
  charge: 100,
  wave: 1,
  hull: 3,
  combo: 1,
  comboTimer: 0,
  event: null,
  eggs: new Set(),
  upgrades: [],
  stats: { ...baseStats },
};

const ship = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  angle: -Math.PI / 2,
  radius: 24,
  heat: 0,
  invulnerable: 0,
  dash: 0,
  dashCooldown: 0,
};

const pointerAim = {
  active: false,
  x: 0,
  y: 0,
};

let stars = [];
let dust = [];
let shards = [];
let asteroids = [];
let gems = [];
let particles = [];
let floaters = [];
let afterimages = [];
let portal = null;
let comet = null;

const upgradePool = [
  {
    id: "engine",
    title: "Hotter Engines",
    copy: "Thrust harder and build speed faster.",
    apply: () => {
      state.stats.thrust += 58;
      state.stats.regen += 2;
      state.stats.maxSpeed += 45;
    },
  },
  {
    id: "handling",
    title: "Vector Fins",
    copy: "Turn tighter and recover from wild drifts.",
    apply: () => {
      state.stats.turn += 0.62;
    },
  },
  {
    id: "capacitor",
    title: "Bigger Boost Cell",
    copy: "Increase max boost and refill the tank.",
    apply: () => {
      state.stats.maxCharge += 22;
      state.charge = state.stats.maxCharge;
    },
  },
  {
    id: "plating",
    title: "Wrapper Plating",
    copy: "Add one hull and a little extra crash grace.",
    apply: () => {
      state.stats.maxHull += 1;
      state.stats.shieldGrace += 0.12;
      state.hull = Math.min(state.stats.maxHull, state.hull + 1);
    },
  },
  {
    id: "magnet",
    title: "Spark Magnet",
    copy: "Pull nearby sparks into your flight path.",
    apply: () => {
      state.stats.magnet += 76;
    },
  },
  {
    id: "dash",
    title: "Dash Ram",
    copy: "Dash cheaper, dash sooner, smash cleaner.",
    apply: () => {
      state.stats.dashCost = Math.max(12, state.stats.dashCost - 5);
      state.stats.dashCooldown = Math.max(0.32, state.stats.dashCooldown - 0.09);
      state.stats.dashPower += 70;
    },
  },
  {
    id: "combo",
    title: "Combo Memory",
    copy: "Keep multipliers longer and score bigger.",
    apply: () => {
      state.stats.comboHold += 0.55;
      state.stats.comboGain += 0.04;
    },
  },
];

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.floor(window.innerWidth);
  height = Math.floor(window.innerHeight);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  stars = makeStars(Math.round((width * height) / 5200));
  dust = makeStars(Math.round((width * height) / 16500), true);
  if (state.phase === "menu") resetShip();
}

function makeStars(count, soft = false) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: soft ? Math.random() * 1.9 + 0.4 : Math.random() * 1.3 + 0.25,
    a: soft ? Math.random() * 0.18 + 0.06 : Math.random() * 0.62 + 0.18,
    drift: Math.random() * 0.28 + 0.04,
  }));
}

function startGame() {
  ensureAudio();
  startMusic();
  panelEl.classList.add("is-hidden");
  upgradeEl.classList.add("is-hidden");
  audioPanelEl.classList.add("is-hidden");
  resetWorld();
  state.phase = "playing";
  showToast("Launch window open");
}

function resetWorld() {
  resetShip();
  state.score = 0;
  state.charge = baseStats.maxCharge;
  state.wave = 1;
  state.hull = baseStats.maxHull;
  state.combo = 1;
  state.comboTimer = 0;
  state.event = null;
  state.eggs.clear();
  state.upgrades = [];
  state.stats = { ...baseStats };
  pointerAim.active = false;
  touch.clear();
  keys.clear();
  disco = false;
  slowMo = 0;
  asteroids = [];
  gems = [];
  particles = [];
  floaters = [];
  shards = [];
  afterimages = [];
  portal = null;
  comet = null;
  spawnWave();
  updateHud();
}

function resetShip() {
  ship.x = width / 2;
  ship.y = height / 2;
  ship.vx = 0;
  ship.vy = 0;
  ship.angle = -Math.PI / 2;
  ship.heat = 0;
  ship.invulnerable = 1.7;
  ship.dash = 0;
  ship.dashCooldown = 0;
}

function spawnWave() {
  const asteroidCount = Math.min(3 + Math.floor(state.wave * 1.22), 15);
  const gemCount = Math.min(7 + Math.floor(state.wave * 1.3), 21);
  asteroids = [];
  gems = [];
  for (let i = 0; i < asteroidCount; i += 1) asteroids.push(makeAsteroid());
  for (let i = 0; i < gemCount; i += 1) gems.push(makeGem());
  portal = state.wave >= 3 ? makePortal() : null;
  beginEvent();
}

function beginEvent() {
  state.event = null;
  if (state.wave < 4) return;
  if (state.wave % 6 === 0) {
    state.event = {
      type: "wrapper",
      duration: 24,
      timer: 24,
      angle: 0,
      pulse: 0,
    };
    unlockEgg("wrapper", "The wrapper is hunting");
    showToast("Wrapper break: survive the frame");
  } else if (state.wave % 5 === 0) {
    const duration = stormDuration();
    state.event = {
      type: "storm",
      duration,
      timer: duration,
      pulse: 0,
      next: 1.6,
    };
    showToast("Meteor weather inbound");
  } else if (state.wave % 4 === 0) {
    state.event = {
      type: "gravity",
      duration: 22,
      timer: 22,
      x: width * (0.28 + Math.random() * 0.44),
      y: height * (0.28 + Math.random() * 0.44),
      pulse: 0,
    };
    showToast("Gravity well online");
  }
}

function makeAsteroid(parent) {
  const p = parent || farPoint(60);
  const speed = 0.32 + Math.random() * 0.68 + state.wave * 0.032;
  const sides = Math.floor(7 + Math.random() * 5);
  const angle = parent ? Math.random() * twoPi : Math.random() * twoPi;
  return {
    x: p.x,
    y: p.y,
    vx: Math.cos(angle) * speed + (parent?.vx || 0) * 0.25,
    vy: Math.sin(angle) * speed + (parent?.vy || 0) * 0.25,
    r: parent ? Math.max(13, p.r * (0.48 + Math.random() * 0.12)) : 18 + Math.random() * 34,
    spin: (Math.random() - 0.5) * 0.035,
    angle: Math.random() * twoPi,
    sides,
    near: false,
    dents: Array.from({ length: sides }, () => 0.72 + Math.random() * 0.42),
  };
}

function stormDuration() {
  return Math.min(19, 13 + Math.floor(state.wave / 5) * 2);
}

function stormInterval() {
  const pressure = Math.floor(state.wave / 5);
  const min = Math.max(0.82, 1.22 - pressure * 0.08);
  const max = Math.max(1.34, 2.05 - pressure * 0.1);
  return min + Math.random() * (max - min);
}

function activeMeteorCount() {
  return asteroids.filter((asteroid) => asteroid.meteor).length;
}

function makeGem() {
  const p = farPoint(54);
  return {
    ...p,
    r: 9 + Math.random() * 5,
    pulse: Math.random() * twoPi,
    rare: Math.random() < 0.1,
  };
}

function makePortal() {
  let p = farPoint(180);
  let attempts = 0;
  while (attempts < 60 && asteroids.some((asteroid) => distance(p.x, p.y, asteroid.x, asteroid.y) < asteroid.r + 145)) {
    attempts += 1;
    p = farPoint(180);
  }
  return {
    ...p,
    r: 42,
    pulse: 0,
    assistCooldown: 0,
    orbitCharge: 0,
    lastAngle: null,
  };
}

function farPoint(margin = 120) {
  let point;
  do {
    point = {
      x: margin + Math.random() * Math.max(1, width - margin * 2),
      y: margin + Math.random() * Math.max(1, height - margin * 2),
    };
  } while (distance(point.x, point.y, ship.x, ship.y) < Math.min(width, height) * 0.28);
  return point;
}

function update(dt) {
  const gameDt = slowMo > 0 ? dt * 0.44 : dt;
  slowMo = Math.max(0, slowMo - dt);
  updateFloaters(dt);

  if (state.phase !== "playing") return;

  const left = keys.has("ArrowLeft") || keys.has("KeyA") || touch.has("left");
  const right = keys.has("ArrowRight") || keys.has("KeyD") || touch.has("right");
  const thrust = keys.has("ArrowUp") || keys.has("KeyW") || touch.has("thrust");
  const brake = keys.has("ArrowDown") || keys.has("KeyS");
  const dash = keys.has("Space");

  if (pointerAim.active) applyTetherPhysics(gameDt);
  if (left) ship.angle -= state.stats.turn * gameDt;
  if (right) ship.angle += state.stats.turn * gameDt;
  if (thrust && state.charge > 0) {
    const power = state.eggs.has("studio") ? state.stats.thrust + 130 : state.stats.thrust;
    ship.vx += Math.cos(ship.angle) * power * gameDt;
    ship.vy += Math.sin(ship.angle) * power * gameDt;
    ship.heat = 1;
    state.charge = Math.max(0, state.charge - 11 * gameDt);
    emitFlame();
    thrustSound();
  }
  if (thrust) applySteeringAssist(gameDt);
  if (brake) {
    ship.vx *= 1 - 2.35 * gameDt;
    ship.vy *= 1 - 2.35 * gameDt;
  }
  if (dash) tryDash();

  ship.vx *= 1 - 0.44 * gameDt;
  ship.vy *= 1 - 0.44 * gameDt;
  if (pointerAim.active && Math.hypot(ship.vx, ship.vy) > 42) {
    ship.angle = Math.atan2(ship.vy, ship.vx);
  }
  limitSpeed();
  ship.x += ship.vx * gameDt;
  ship.y += ship.vy * gameDt;
  ship.heat = Math.max(0, ship.heat - 3.2 * gameDt);
  ship.invulnerable = Math.max(0, ship.invulnerable - gameDt);
  ship.dash = Math.max(0, ship.dash - gameDt);
  ship.dashCooldown = Math.max(0, ship.dashCooldown - gameDt);
  state.comboTimer = Math.max(0, state.comboTimer - gameDt);
  if (state.comboTimer === 0) state.combo = Math.max(1, state.combo - 1.8 * gameDt);
  state.charge = Math.min(state.stats.maxCharge, state.charge + state.stats.regen * gameDt);

  if (ship.dash > 0) afterimages.push(makeAfterimage());
  if (afterimages.length > 20) afterimages.shift();

  wrap(ship);
  updateObjects(gameDt);
  updatePortalPhysics(gameDt);
  updateEvent(gameDt);
  checkCollisions();
  maybeComet(gameDt);

  if (gems.length === 0) completeWave();

  addScore(Math.max(0, Math.hypot(ship.vx, ship.vy)) * 0.014 * gameDt, false);
  updateHud();
}

function tryDash() {
  const minimumCharge = state.stats.dashCost * 0.55;
  if (ship.dashCooldown > 0 || state.charge < minimumCharge) return;
  const strength = Math.min(1, state.charge / state.stats.dashCost);
  state.charge = Math.max(0, state.charge - state.stats.dashCost);
  ship.dash = 0.18 + 0.08 * strength;
  ship.dashCooldown = state.stats.dashCooldown;
  ship.invulnerable = Math.max(ship.invulnerable, ship.dash);
  const power = state.stats.dashPower * (0.58 + strength * 0.42);
  ship.vx += Math.cos(ship.angle) * power;
  ship.vy += Math.sin(ship.angle) * power;
  burst(ship.x, ship.y, "#ff3c00", 22);
  shake(7);
  dashSound(strength);
  unlockEgg("dash", "Dash ram armed");
}

function applySteeringAssist(dt) {
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed < 70) return;
  const blend = Math.min(1, 1.15 * dt);
  const targetVx = Math.cos(ship.angle) * speed;
  const targetVy = Math.sin(ship.angle) * speed;
  ship.vx += (targetVx - ship.vx) * blend;
  ship.vy += (targetVy - ship.vy) * blend;
}

function applyTetherPhysics(dt) {
  const dx = pointerAim.x - ship.x;
  const dy = pointerAim.y - ship.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  const nx = dx / d;
  const ny = dy / d;
  const pull = Math.min(760, 220 + d * 2.2);
  const closeDamping = d < 64 ? 0.84 : 1;

  ship.vx += nx * pull * dt;
  ship.vy += ny * pull * dt;
  ship.vx *= 1 - (1 - closeDamping) * dt * 10;
  ship.vy *= 1 - (1 - closeDamping) * dt * 10;
  ship.heat = Math.max(ship.heat, 0.45);
  state.charge = Math.min(state.stats.maxCharge, state.charge + 3 * dt);
}

function limitSpeed() {
  const speed = Math.hypot(ship.vx, ship.vy);
  const cap = state.stats.maxSpeed + (ship.dash > 0 ? 360 : 0);
  if (speed <= cap) return;
  const scale = cap / speed;
  ship.vx *= scale;
  ship.vy *= scale;
}

function updateObjects(dt) {
  for (const layer of [stars, dust]) {
    for (const star of layer) {
      star.x -= ship.vx * star.drift * dt;
      star.y -= ship.vy * star.drift * dt;
      if (star.x < 0) star.x += width;
      if (star.x > width) star.x -= width;
      if (star.y < 0) star.y += height;
      if (star.y > height) star.y -= height;
    }
  }

  for (let i = asteroids.length - 1; i >= 0; i -= 1) {
    const asteroid = asteroids[i];
    asteroid.x += asteroid.vx * 60 * dt;
    asteroid.y += asteroid.vy * 60 * dt;
    asteroid.angle += asteroid.spin * 60 * dt;
    if (asteroid.meteor) {
      asteroid.life -= dt;
      const margin = 140;
      if (
        asteroid.life <= 0 ||
        asteroid.x < -margin ||
        asteroid.x > width + margin ||
        asteroid.y < -margin ||
        asteroid.y > height + margin
      ) {
        asteroids.splice(i, 1);
      }
    } else {
      wrap(asteroid, asteroid.r);
    }
  }

  for (const gem of gems) {
    gem.pulse += dt * 4;
    if (state.stats.magnet > 0 || state.eggs.has("clean")) {
      const pullRange = state.stats.magnet + (state.eggs.has("clean") ? 70 : 0);
      const d = distance(gem.x, gem.y, ship.x, ship.y);
      if (d < pullRange && d > 1) {
        const force = (1 - d / pullRange) * 260 * dt;
        gem.x += ((ship.x - gem.x) / d) * force;
        gem.y += ((ship.y - gem.y) / d) * force;
      }
    }
    keepGemPlayable(gem);
  }

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.spin += p.twist * dt;
  }
  particles = particles.filter((p) => p.life > 0);

  for (const shard of shards) {
    shard.x += shard.vx * dt;
    shard.y += shard.vy * dt;
    shard.life -= dt;
    shard.angle += shard.spin * dt;
  }
  shards = shards.filter((shard) => shard.life > 0);

  for (const ghost of afterimages) ghost.life -= dt;
  afterimages = afterimages.filter((ghost) => ghost.life > 0);

  if (portal) {
    portal.pulse += dt;
    portal.assistCooldown = Math.max(0, portal.assistCooldown - dt);
  }
  if (comet) {
    comet.x += comet.vx * 60 * dt;
    comet.y += comet.vy * 60 * dt;
    comet.life -= 0.09 * dt;
    if (comet.x < -160 || comet.x > width + 160 || comet.y < -160 || comet.y > height + 160) comet = null;
  }
}

function updateEvent(dt) {
  if (!state.event) return;
  const event = state.event;
  event.timer -= dt;
  event.pulse += dt;
  if (event.type === "gravity") {
    const d = Math.max(80, distance(event.x, event.y, ship.x, ship.y));
    const force = 38000 / (d * d);
    ship.vx += ((event.x - ship.x) / d) * force * 60 * dt;
    ship.vy += ((event.y - ship.y) / d) * force * 60 * dt;
  }
  if (event.type === "storm") {
    event.next -= dt;
    if (event.next <= 0) {
      event.next = stormInterval();
      if (activeMeteorCount() < 4) spawnMeteor();
    }
  }
  if (event.type === "wrapper") {
    event.angle += dt * 0.65;
    const cx = width / 2;
    const cy = height / 2;
    const gate = Math.abs(Math.sin(event.angle)) * Math.min(width, height) * 0.28 + 90;
    if (Math.abs(ship.x - cx) > width * 0.43 || Math.abs(ship.y - cy) > height * 0.43) damageShip(1, "Frame burn");
    if (distance(ship.x, ship.y, cx, cy) > gate + Math.min(width, height) * 0.18 && event.timer < event.duration - 1) {
      addScore(16 * dt, false);
    }
  }
  if (event.timer <= 0) state.event = null;
}

function updatePortalPhysics(dt) {
  if (!portal) return;
  const dx = ship.x - portal.x;
  const dy = ship.y - portal.y;
  const d = Math.hypot(dx, dy);
  const influence = 230;
  if (d <= portal.r * 0.75 || d > influence) {
    portal.lastAngle = null;
    portal.orbitCharge = Math.max(0, portal.orbitCharge - dt * 1.5);
    return;
  }

  const rx = dx / d;
  const ry = dy / d;
  const falloff = 1 - d / influence;
  const pull = falloff * 105;
  ship.vx -= rx * pull * dt;
  ship.vy -= ry * pull * dt;

  const cross = ship.vx * ry - ship.vy * rx;
  const spinDirection = cross >= 0 ? 1 : -1;
  const tx = -ry * spinDirection;
  const ty = rx * spinDirection;
  const swirl = falloff * 165;
  ship.vx += tx * swirl * dt;
  ship.vy += ty * swirl * dt;

  const angle = Math.atan2(dy, dx);
  if (portal.lastAngle !== null && d > 86 && d < 188 && Math.hypot(ship.vx, ship.vy) > 130) {
    let delta = angle - portal.lastAngle;
    if (delta > Math.PI) delta -= twoPi;
    if (delta < -Math.PI) delta += twoPi;
    portal.orbitCharge = Math.min(twoPi, portal.orbitCharge + Math.abs(delta) * 1.55);
    state.charge = Math.min(state.stats.maxCharge, state.charge + 5 * dt);
    addScore(28 * dt * (1 + portal.orbitCharge), false);
  } else {
    portal.orbitCharge = Math.max(0, portal.orbitCharge - dt * 1.2);
  }
  portal.lastAngle = angle;

  if (portal.assistCooldown === 0 && portal.orbitCharge > Math.PI * 1.15) {
    portal.assistCooldown = 1.35;
    portal.orbitCharge = 0;
    ship.vx += tx * 235;
    ship.vy += ty * 235;
    state.charge = Math.min(state.stats.maxCharge, state.charge + 18);
    addScore(420, true);
    addFloater(ship.x, ship.y - 28, "gravity kick", "#a78bfa");
    unlockEgg("orbit", "Gravity kick discovered");
    tone(330, 0.06, 0.04, "square");
    tone(660, 0.07, 0.03, "square", sfxGain, (audio?.currentTime || 0) + 0.045);
  }
}

function spawnMeteor() {
  const side = Math.floor(Math.random() * 4);
  const speed = 2.85 + state.wave * 0.09;
  const drift = 1.25;
  const edge = [
    { x: -80, y: Math.random() * height, vx: speed, vy: Math.random() * drift - drift / 2 },
    { x: width + 80, y: Math.random() * height, vx: -speed, vy: Math.random() * drift - drift / 2 },
    { x: Math.random() * width, y: -80, vx: Math.random() * drift - drift / 2, vy: speed },
    { x: Math.random() * width, y: height + 80, vx: Math.random() * drift - drift / 2, vy: -speed },
  ][side];
  edge.r = 22;
  asteroids.push({
    ...makeAsteroid(edge),
    x: edge.x,
    y: edge.y,
    vx: edge.vx,
    vy: edge.vy,
    r: 12 + Math.random() * 11,
    meteor: true,
    life: 10,
  });
}

function maybeComet(dt) {
  if (comet || Math.random() > 0.06 * dt) return;
  const side = Math.floor(Math.random() * 4);
  const edge = [
    { x: -80, y: Math.random() * height, vx: 5.8, vy: Math.random() * 1.4 - 0.7 },
    { x: width + 80, y: Math.random() * height, vx: -5.8, vy: Math.random() * 1.4 - 0.7 },
    { x: Math.random() * width, y: -80, vx: Math.random() * 1.4 - 0.7, vy: 5.8 },
    { x: Math.random() * width, y: height + 80, vx: Math.random() * 1.4 - 0.7, vy: -5.8 },
  ][side];
  comet = { ...edge, r: 16, life: 1 };
}

function checkCollisions() {
  for (let i = gems.length - 1; i >= 0; i -= 1) {
    const gem = gems[i];
    if (distance(gem.x, gem.y, ship.x, ship.y) < ship.radius + gem.r + 4) {
      gems.splice(i, 1);
      const value = gem.rare ? 520 : 140;
      addScore(value, true);
      state.charge = Math.min(state.stats.maxCharge, state.charge + (gem.rare ? 30 : 14));
      burst(gem.x, gem.y, gem.rare ? "#ffd166" : "#24d5c7", gem.rare ? 30 : 15);
      addFloater(gem.x, gem.y, `+${Math.round(value * state.combo)}`, gem.rare ? "#ffd166" : "#24d5c7");
      pickupSound(gem.rare);
      if (gem.rare) {
        slowMo = 0.22;
        unlockEgg("gold", "Gold channel found");
      }
    }
  }

  for (let i = asteroids.length - 1; i >= 0; i -= 1) {
    const asteroid = asteroids[i];
    const d = distance(asteroid.x, asteroid.y, ship.x, ship.y);
    const hitRange = asteroid.r + ship.radius * 0.72;
    const nearRange = asteroid.r + ship.radius + 34;

    if (!asteroid.near && d < nearRange && d > hitRange && Math.hypot(ship.vx, ship.vy) > 190) {
      asteroid.near = true;
      state.combo = Math.min(8, state.combo + state.stats.comboGain * 1.3);
      state.comboTimer = state.stats.comboHold;
      addScore(95, true);
      addFloater(ship.x, ship.y - 28, "near miss", "#ffd166");
      shake(3);
      tone(720, 0.04, 0.028, "square");
      unlockEgg("skim", "Skim bonus found");
    }

    if (d < hitRange) {
      if (ship.dash > 0) {
        smashAsteroid(i, asteroid);
        continue;
      }
      if (ship.invulnerable > 0 || state.eggs.has("ghost")) continue;
      ship.vx += (ship.x - asteroid.x) * 2.4;
      ship.vy += (ship.y - asteroid.y) * 2.4;
      damageShip(1, "Hull hit");
      burst(ship.x, ship.y, "#ff3c00", 30);
      shake(13);
      crashSound();
    }
  }

  if (comet && distance(comet.x, comet.y, ship.x, ship.y) < comet.r + ship.radius) {
    unlockEgg("comet", "You caught the fast one");
    addScore(1500, true);
    state.charge = state.stats.maxCharge;
    burst(comet.x, comet.y, "#ffffff", 48);
    levelSound();
    slowMo = 0.32;
    comet = null;
  }
}

function smashAsteroid(index, asteroid) {
  asteroids.splice(index, 1);
  addScore(260 + asteroid.r * 4, true);
  state.combo = Math.min(9.9, state.combo + state.stats.comboGain * 1.8);
  state.comboTimer = state.stats.comboHold;
  burst(asteroid.x, asteroid.y, "#ff3c00", 28);
  addFloater(asteroid.x, asteroid.y, "SMASH", "#ff3c00");
  shake(8);
  smashSound();
  if (asteroid.r > 24) {
    asteroids.push(makeAsteroid(asteroid), makeAsteroid(asteroid));
  }
}

function damageShip(amount, label) {
  if (ship.invulnerable > 0) return;
  state.hull -= amount;
  ship.invulnerable = state.stats.shieldGrace;
  state.combo = 1;
  state.comboTimer = 0;
  addFloater(ship.x, ship.y - 34, label, "#ff3c00");
  if (state.hull <= 0) gameOver();
}

function completeWave() {
  addScore(850 + state.wave * 130, true);
  unlockEgg("wave", "Deep cut unlocked");
  state.phase = "upgrade";
  state.comboTimer = 0;
  state.combo = Math.max(1, state.combo);
  showToast(`Wave ${state.wave} clear`);
  levelSound();
  renderUpgradeOptions();
}

function renderUpgradeOptions() {
  upgradeOptionsEl.innerHTML = "";
  const options = sampleUpgrades();
  for (const option of options) {
    const button = document.createElement("button");
    button.className = "upgrade-card";
    button.type = "button";
    button.dataset.upgrade = option.id;
    button.innerHTML = `<strong>${option.title}</strong><span>${option.copy}</span>`;
    upgradeOptionsEl.append(button);
  }
  upgradeEl.classList.remove("is-hidden");
}

function sampleUpgrades() {
  const weighted = upgradePool
    .map((upgrade) => ({ upgrade, sort: Math.random() + state.upgrades.filter((id) => id === upgrade.id).length * 0.22 }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 3)
    .map((entry) => entry.upgrade);
  return weighted;
}

function chooseUpgrade(id) {
  const upgrade = upgradePool.find((item) => item.id === id);
  if (!upgrade || state.phase !== "upgrade") return;
  upgrade.apply();
  state.upgrades.push(id);
  state.wave += 1;
  state.phase = "playing";
  upgradeEl.classList.add("is-hidden");
  showToast(`${upgrade.title} installed`);
  levelSound();
  spawnWave();
  updateHud();
}

function gameOver() {
  state.phase = "gameover";
  state.best = Math.max(state.best, Math.floor(state.score));
  writeBest(state.best);
  panelEl.classList.remove("is-hidden");
  panelEl.querySelector("h1").textContent = "Drift Complete";
  panelCopyEl.textContent = `Score ${Math.floor(state.score).toLocaleString()} · Best ${state.best.toLocaleString()} · Wave ${state.wave}`;
  startButton.textContent = "Restart";
  burst(ship.x, ship.y, "#ff3c00", 60);
  gameOverSound();
  makeLogoShards();
  updateHud();
}

function addScore(amount, useCombo) {
  const score = useCombo ? amount * state.combo : amount;
  state.score += score;
  if (useCombo) {
    state.combo = Math.min(9.9, state.combo + state.stats.comboGain);
    state.comboTimer = state.stats.comboHold;
  }
  if (state.score > state.best) {
    state.best = Math.floor(state.score);
    writeBest(state.best);
  }
}

function draw(now) {
  ctx.save();
  if (shakeFrames > 0) {
    shakeFrames -= 1;
    ctx.translate((Math.random() - 0.5) * shakePower, (Math.random() - 0.5) * shakePower);
  }

  const hue = disco ? (now / 38) % 360 : 12;
  ctx.fillStyle = `hsl(${hue} 34% 4%)`;
  ctx.fillRect(-30, -30, width + 60, height + 60);
  drawSpace(now);
  drawEvent(now);
  if (portal) drawPortal(portal, now);
  if (pointerAim.active) drawTether();
  for (const gem of gems) {
    if (gems.length <= 2) drawGemLocator(gem, now);
    drawGem(gem);
  }
  for (const asteroid of asteroids) drawAsteroid(asteroid);
  if (comet) drawComet(comet);
  for (const ghost of afterimages) drawAfterimage(ghost);
  for (const shard of shards) drawShard(shard);
  for (const p of particles) drawParticle(p);
  drawShip();
  drawReticle();
  for (const floater of floaters) drawFloater(floater);
  if (state.phase === "menu") drawAttract(now);
  if (state.phase === "paused") drawPauseOverlay();
  ctx.restore();
}

function drawPauseOverlay() {
  ctx.save();
  ctx.fillStyle = "rgba(7, 8, 11, 0.54)";
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f7f4ed";
  ctx.font = "900 54px Inter, system-ui, sans-serif";
  ctx.fillText("PAUSED", width / 2, height / 2 - 78);
  ctx.fillStyle = "rgba(247, 244, 237, 0.68)";
  ctx.font = "700 16px Inter, system-ui, sans-serif";
  ctx.fillText("Esc resumes · restart and volume below", width / 2, height / 2 - 34);
  ctx.textAlign = "left";
  ctx.font = "800 15px Inter, system-ui, sans-serif";
  const controls = [
    ["Pull", "hold mouse / touch"],
    ["Thrust", "W / Arrow Up"],
    ["Turn", "A / D or Arrow Left / Right"],
    ["Brake", "S / Arrow Down"],
    ["Boost", "Space"],
  ];
  const rowHeight = 28;
  const blockWidth = Math.min(420, width - 48);
  const left = width / 2 - blockWidth / 2;
  const top = height / 2 + 6;
  for (let i = 0; i < controls.length; i += 1) {
    const y = top + i * rowHeight;
    ctx.fillStyle = "#ff3c00";
    ctx.fillText(controls[i][0], left, y);
    ctx.fillStyle = "rgba(247, 244, 237, 0.74)";
    ctx.fillText(controls[i][1], left + 92, y);
  }
  ctx.restore();
}

function drawSpace(now) {
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.78);
  gradient.addColorStop(0, disco ? "rgba(64, 45, 80, 0.5)" : "rgba(32, 17, 14, 0.46)");
  gradient.addColorStop(0.55, "rgba(7, 8, 11, 0.08)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (const layer of [dust, stars]) {
    for (const star of layer) {
      const twinkle = Math.sin(now * 0.0015 + star.x) * 0.16;
      ctx.globalAlpha = Math.max(0, star.a + twinkle);
      ctx.fillStyle = layer === dust ? "#24d5c7" : "#f7f4ed";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, twoPi);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawEvent(now) {
  if (!state.event) return;
  const event = state.event;
  if (event.type === "gravity") {
    const r = 76 + Math.sin(event.pulse * 4) * 12;
    const grad = ctx.createRadialGradient(event.x, event.y, 0, event.x, event.y, r * 2.2);
    grad.addColorStop(0, "rgba(167,139,250,0.38)");
    grad.addColorStop(1, "rgba(167,139,250,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(event.x, event.y, r * 2.2, 0, twoPi);
    ctx.fill();
    ctx.strokeStyle = "rgba(167,139,250,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(event.x, event.y, r, 0, twoPi);
    ctx.stroke();
  }
  if (event.type === "storm") {
    ctx.fillStyle = `rgba(255, 209, 102, ${0.05 + Math.sin(now / 120) * 0.025})`;
    ctx.fillRect(0, 0, width, height);
  }
  if (event.type === "wrapper") {
    const marginX = width * 0.07;
    const marginY = height * 0.07;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(Math.sin(event.angle) * 0.035);
    ctx.strokeStyle = "rgba(255, 60, 0, 0.56)";
    ctx.lineWidth = 5;
    ctx.shadowBlur = 26;
    ctx.shadowColor = "#ff3c00";
    ctx.strokeRect(-width / 2 + marginX, -height / 2 + marginY, width - marginX * 2, height - marginY * 2);
    ctx.restore();
  }
}

function drawShip() {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  const size = state.eggs.has("tiny") ? 34 : 54;
  if (ship.heat > 0.02 || ship.dash > 0) {
    const flame = 20 + Math.max(ship.heat, ship.dash * 4) * 32 + Math.random() * 12;
    ctx.save();
    ctx.rotate(ship.angle + Math.PI / 2);
    ctx.fillStyle = disco ? `hsl(${Math.random() * 360} 100% 60%)` : ship.dash > 0 ? "#24d5c7" : "#ffd166";
    ctx.beginPath();
    ctx.moveTo(-size * 0.22, size * 0.35);
    ctx.lineTo(0, size * 0.35 + flame);
    ctx.lineTo(size * 0.22, size * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.rotate(logoTilt);
  drawDiamondAura(size);
  ctx.shadowBlur = ship.invulnerable > 0 || ship.dash > 0 ? 34 : 22;
  ctx.shadowColor = disco ? `hsl(${performance.now() / 9 % 360} 100% 55%)` : ship.dash > 0 ? "#24d5c7" : "rgba(255, 60, 0, 0.76)";
  drawLogo(size, 1);
  ctx.shadowBlur = 0;

  if (ship.invulnerable > 0) {
    ctx.strokeStyle = `rgba(36, 213, 199, ${0.36 + Math.sin(performance.now() / 80) * 0.18})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.62, 0, twoPi);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDiamondAura(size) {
  ctx.strokeStyle = ship.dash > 0 ? "rgba(36, 213, 199, 0.74)" : "rgba(255, 60, 0, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.72);
  ctx.lineTo(size * 0.72, 0);
  ctx.lineTo(0, size * 0.72);
  ctx.lineTo(-size * 0.72, 0);
  ctx.closePath();
  ctx.stroke();
}

function drawLogo(size, alpha) {
  ctx.globalAlpha *= alpha;
  if (logo.complete && logo.naturalWidth > 0) {
    ctx.drawImage(logo, -size / 2, -size / 2, size, size);
  } else {
    drawLogoFallback(size);
  }
  ctx.globalAlpha /= alpha;
}

function drawLogoFallback(size) {
  ctx.fillStyle = "#ff3c00";
  ctx.beginPath();
  ctx.moveTo(-size * 0.4, -size * 0.45);
  ctx.lineTo(size * 0.45, size * 0.4);
  ctx.lineTo(size * 0.18, size * 0.48);
  ctx.lineTo(-size * 0.48, -size * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-size * 0.48, -size * 0.36, size * 0.18, size * 0.8);
}

function drawAfterimage(ghost) {
  ctx.save();
  ctx.translate(ghost.x, ghost.y);
  ctx.rotate(logoTilt);
  ctx.globalAlpha = Math.max(0, ghost.life / ghost.maxLife) * 0.34;
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#24d5c7";
  drawDiamondAura(ghost.size);
  drawLogo(ghost.size, 1);
  ctx.restore();
}

function drawAsteroid(asteroid) {
  ctx.save();
  ctx.translate(asteroid.x, asteroid.y);
  ctx.rotate(asteroid.angle);
  ctx.beginPath();
  for (let i = 0; i < asteroid.sides; i += 1) {
    const a = (i / asteroid.sides) * twoPi;
    const r = asteroid.r * asteroid.dents[i];
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = state.event?.type === "storm" ? "#51483f" : "#3f434a";
  ctx.strokeStyle = asteroid.near ? "rgba(255, 209, 102, 0.56)" : "rgba(247, 244, 237, 0.22)";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawGem(gem) {
  ctx.save();
  ctx.translate(gem.x, gem.y);
  ctx.rotate(gem.pulse);
  const pulse = Math.sin(gem.pulse) * 2;
  const r = gem.r + pulse;
  ctx.shadowBlur = 18;
  ctx.shadowColor = gem.rare ? "#ffd166" : "#24d5c7";
  ctx.fillStyle = gem.rare ? "#ffd166" : "#24d5c7";
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.82, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.82, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGemLocator(gem, now) {
  const pulse = 0.5 + Math.sin(now * 0.006 + gem.pulse) * 0.5;
  const distanceToShip = distance(gem.x, gem.y, ship.x, ship.y);
  const glow = Math.max(0.18, Math.min(0.46, distanceToShip / Math.max(width, height)));
  ctx.save();
  ctx.translate(gem.x, gem.y);
  ctx.strokeStyle = `rgba(36, 213, 199, ${glow})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 10]);
  ctx.lineDashOffset = -now * 0.02;
  ctx.beginPath();
  ctx.arc(0, 0, 27 + pulse * 8, 0, twoPi);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = `rgba(255, 209, 102, ${0.16 + pulse * 0.16})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 43 + pulse * 5, 0, twoPi);
  ctx.stroke();
  ctx.restore();
}

function keepGemPlayable(gem) {
  const margin = 26;
  if (!Number.isFinite(gem.x) || !Number.isFinite(gem.y)) {
    const point = farPoint(72);
    gem.x = point.x;
    gem.y = point.y;
    return;
  }
  gem.x = Math.max(margin, Math.min(width - margin, gem.x));
  gem.y = Math.max(margin, Math.min(height - margin, gem.y));
}

function drawPortal(p, now) {
  ctx.save();
  ctx.translate(p.x, p.y);
  const charge = p.orbitCharge / twoPi;
  const ring = p.r + 34;
  ctx.strokeStyle = "rgba(167, 139, 250, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 230, 0, twoPi);
  ctx.stroke();

  for (let i = 0; i < 3; i += 1) {
    ctx.rotate(p.pulse * (0.35 + i * 0.12));
    ctx.strokeStyle = `hsla(${258 + i * 20 + now / 110} 88% 68% / ${0.22 - i * 0.045})`;
    ctx.lineWidth = i === 0 ? 2 : 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, ring + i * 8, ring * 0.42 + i * 3, 0, 0, twoPi);
    ctx.stroke();
  }
  if (charge > 0.02) {
    ctx.rotate(-p.pulse * 0.6);
    ctx.strokeStyle = `rgba(255, 209, 102, ${0.16 + charge * 0.5})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, ring + 18, -Math.PI / 2, -Math.PI / 2 + charge * twoPi);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(167, 139, 250, 0.08)";
  ctx.beginPath();
  ctx.arc(0, 0, p.r * 0.62, 0, twoPi);
  ctx.fill();
  ctx.restore();
}

function drawComet(c) {
  const tail = 90;
  const angle = Math.atan2(c.vy, c.vx);
  const grad = ctx.createLinearGradient(c.x, c.y, c.x - Math.cos(angle) * tail, c.y - Math.sin(angle) * tail);
  grad.addColorStop(0, "rgba(255,255,255,0.92)");
  grad.addColorStop(1, "rgba(255,60,0,0)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(c.x - Math.cos(angle) * tail, c.y - Math.sin(angle) * tail);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, twoPi);
  ctx.fill();
}

function drawParticle(p) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, twoPi);
  ctx.fill();
  ctx.restore();
}

function drawShard(shard) {
  ctx.save();
  ctx.translate(shard.x, shard.y);
  ctx.rotate(shard.angle);
  ctx.globalAlpha = Math.max(0, shard.life / shard.maxLife);
  ctx.fillStyle = shard.color;
  ctx.fillRect(-shard.w / 2, -shard.h / 2, shard.w, shard.h);
  ctx.restore();
}

function drawFloater(floater) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
  ctx.fillStyle = floater.color;
  ctx.font = "800 15px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(floater.text, floater.x, floater.y);
  ctx.restore();
}

function drawReticle() {
  if (!state.eggs.has("clean") && state.stats.magnet <= 0) return;
  ctx.strokeStyle = "rgba(255, 209, 102, 0.34)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, 92 + state.stats.magnet * 0.35 + Math.sin(performance.now() / 180) * 8, 0, twoPi);
  ctx.stroke();
}

function drawAttract(now) {
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = "#ff3c00";
  ctx.lineWidth = 1;
  const r = 86 + Math.sin(now / 420) * 8;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, r, 0, twoPi);
  ctx.stroke();
  ctx.restore();
}

function drawTether() {
  ctx.save();
  const d = distance(ship.x, ship.y, pointerAim.x, pointerAim.y);
  const alpha = Math.min(0.58, 0.2 + d / 520);
  ctx.strokeStyle = `rgba(255, 209, 102, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ship.x, ship.y);
  ctx.lineTo(pointerAim.x, pointerAim.y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 209, 102, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pointerAim.x, pointerAim.y, 18, 0, twoPi);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 209, 102, 0.18)";
  ctx.beginPath();
  ctx.arc(pointerAim.x, pointerAim.y, 5, 0, twoPi);
  ctx.fill();
  ctx.restore();
}

function emitFlame() {
  const back = ship.angle + Math.PI;
  particles.push({
    x: ship.x + Math.cos(back) * 22,
    y: ship.y + Math.sin(back) * 22,
    vx: Math.cos(back + (Math.random() - 0.5) * 0.8) * (80 + Math.random() * 110),
    vy: Math.sin(back + (Math.random() - 0.5) * 0.8) * (80 + Math.random() * 110),
    r: 2 + Math.random() * 4,
    life: 0.28 + Math.random() * 0.24,
    maxLife: 0.52,
    color: disco ? `hsl(${Math.random() * 360} 100% 64%)` : Math.random() > 0.45 ? "#ff3c00" : "#ffd166",
    spin: 0,
    twist: 0,
  });
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * twoPi;
    const speed = 60 + Math.random() * 260;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: 1.5 + Math.random() * 4,
      life: 0.45 + Math.random() * 0.55,
      maxLife: 1,
      color,
      spin: 0,
      twist: 0,
    });
  }
}

function makeLogoShards() {
  for (let i = 0; i < 18; i += 1) {
    const a = Math.random() * twoPi;
    shards.push({
      x: ship.x,
      y: ship.y,
      vx: Math.cos(a) * (60 + Math.random() * 200),
      vy: Math.sin(a) * (60 + Math.random() * 200),
      w: 8 + Math.random() * 24,
      h: 3 + Math.random() * 12,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 12,
      life: 0.9 + Math.random() * 0.8,
      maxLife: 1.7,
      color: disco ? `hsl(${Math.random() * 360} 100% 62%)` : "#ff3c00",
    });
  }
}

function makeAfterimage() {
  return {
    x: ship.x,
    y: ship.y,
    angle: ship.angle,
    size: state.eggs.has("tiny") ? 34 : 54,
    life: 0.22,
    maxLife: 0.22,
  };
}

function addFloater(x, y, text, color) {
  floaters.push({
    x,
    y,
    text,
    color,
    vy: -36,
    life: 0.9,
    maxLife: 0.9,
  });
}

function updateFloaters(dt) {
  for (const floater of floaters) {
    floater.y += floater.vy * dt;
    floater.life -= dt;
  }
  floaters = floaters.filter((floater) => floater.life > 0);
}

function unlockEgg(id, message) {
  if (state.eggs.has(id)) return;
  state.eggs.add(id);
  showToast(message);
  updateHud();
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 1900);
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score).toLocaleString();
  const boost = Math.max(0, Math.min(1, state.charge / state.stats.maxCharge));
  boostFillEl.style.transform = `scaleX(${boost})`;
  boostFillEl.parentElement.parentElement.classList.toggle("is-ready", ship.dashCooldown <= 0 && state.charge >= state.stats.dashCost);
  hullEl.innerHTML = "";
  hullEl.setAttribute("aria-label", `Hull ${Math.max(0, state.hull)} of ${state.stats.maxHull}`);
  for (let i = 0; i < state.stats.maxHull; i += 1) {
    const pip = document.createElement("span");
    if (i >= state.hull) pip.className = "is-empty";
    hullEl.append(pip);
  }
}

function togglePause() {
  if (state.phase === "playing") {
    state.phase = "paused";
    pointerAim.active = false;
    touch.clear();
    audioPanelEl.classList.remove("is-hidden");
    showToast("Paused");
  } else if (state.phase === "paused") {
    state.phase = "playing";
    audioPanelEl.classList.add("is-hidden");
    showToast("Go");
  }
}

function shake(power) {
  shakeFrames = 14;
  shakePower = power;
}

function wrap(obj, margin = 32) {
  if (obj.x < -margin) obj.x = width + margin;
  if (obj.x > width + margin) obj.x = -margin;
  if (obj.y < -margin) obj.y = height + margin;
  if (obj.y > height + margin) obj.y = -margin;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function aimShipAt(x, y) {
  pointerAim.x = x;
  pointerAim.y = y;
}

function ensureAudio() {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return;
  if (!audio) {
    audio = new AudioEngine();
    masterGain = audio.createGain();
    musicGain = audio.createGain();
    sfxGain = audio.createGain();
    masterGain.gain.value = muted ? 0 : volume;
    musicGain.gain.value = 0.28;
    sfxGain.gain.value = 0.82;
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(audio.destination);
  }
  if (audio.state === "suspended") audio.resume();
  syncMute();
}

function syncMute() {
  if (!audio || !masterGain) return;
  masterGain.gain.cancelScheduledValues(audio.currentTime);
  masterGain.gain.setTargetAtTime(muted ? 0 : volume, audio.currentTime, 0.025);
  if (!muted) startMusic();
}

function tone(freq, duration, gain = 0.04, type = "triangle", destination = sfxGain, start = audio?.currentTime || 0) {
  if (!audio || muted) return;
  const osc = audio.createOscillator();
  const vol = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  vol.gain.setValueAtTime(0.0001, start);
  vol.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.008);
  vol.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(vol).connect(destination || sfxGain || audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(duration, gain = 0.08, start = audio?.currentTime || 0) {
  if (!audio || muted || !sfxGain) return;
  const sampleCount = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
  }
  const source = audio.createBufferSource();
  const vol = audio.createGain();
  source.buffer = buffer;
  vol.gain.setValueAtTime(gain, start);
  vol.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(vol).connect(sfxGain);
  source.start(start);
}

function semitone(freq, steps) {
  return freq * 2 ** (steps / 12);
}

function startMusic() {
  if (!audio) return;
  if (musicNextTime < audio.currentTime) {
    musicNextTime = audio.currentTime + 0.04;
  }
}

function updateMusic() {
  if (!audio || muted || !musicGain) return;
  if (state.phase !== "playing" && state.phase !== "upgrade") return;
  if (musicNextTime < audio.currentTime - 0.05) startMusic();
  const song = currentSong();
  const stepDuration = 60 / song.bpm / 2;
  while (musicNextTime < audio.currentTime + 0.16) {
    scheduleMusicStep(musicNextTime, musicStep, song);
    musicNextTime += stepDuration;
    musicStep += 1;
  }
}

function currentSong() {
  return songs[Math.floor((state.wave - 1) / 2) % songs.length];
}

function scheduleMusicStep(time, step, song) {
  const root = song.roots[Math.floor(step / 8) % song.roots.length];
  const leadFreq = semitone(root * 2, song.arp[step % song.arp.length]);
  const bassFreq = semitone(root, song.bass[step % song.bass.length]);
  const accent = step % 8 === 0 ? 1.5 : 1;
  tone(leadFreq, 0.075, 0.038 * accent, "square", musicGain, time);
  if (step % 2 === 0) tone(bassFreq, 0.12, 0.074, "square", musicGain, time);
  if (step % 4 === 2) tone(root * 2, 0.045, 0.022, "triangle", musicGain, time + 0.03);
  if (song.name === "danger" && step % 4 === 0) noise(0.025, 0.018, time + 0.04);
}

function pickupSound(rare) {
  const now = audio?.currentTime || 0;
  if (rare) {
    tone(740, 0.055, 0.055, "square", sfxGain, now);
    tone(980, 0.07, 0.05, "square", sfxGain, now + 0.055);
    tone(1480, 0.09, 0.042, "square", sfxGain, now + 0.11);
  } else {
    const base = 520 + (state.combo % 3) * 90;
    tone(base, 0.045, 0.042, "square", sfxGain, now);
    tone(base * 1.5, 0.04, 0.026, "square", sfxGain, now + 0.035);
  }
}

function crashSound() {
  const now = audio?.currentTime || 0;
  noise(0.18, 0.13, now);
  tone(110, 0.16, 0.085, "sawtooth", sfxGain, now);
  tone(62, 0.28, 0.075, "square", sfxGain, now + 0.03);
}

function dashSound(strength = 1) {
  const now = audio?.currentTime || 0;
  tone(220 + strength * 80, 0.055, 0.055, "square", sfxGain, now);
  tone(440 + strength * 180, 0.08, 0.042, "square", sfxGain, now + 0.035);
  noise(0.055, 0.045, now);
}

function smashSound() {
  const now = audio?.currentTime || 0;
  noise(0.12, 0.08, now);
  tone(180, 0.05, 0.07, "square", sfxGain, now);
  tone(90, 0.11, 0.06, "square", sfxGain, now + 0.025);
}

function levelSound() {
  const now = audio?.currentTime || 0;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
    tone(freq, 0.11, 0.055, "square", sfxGain, now + index * 0.075);
  });
}

function gameOverSound() {
  const now = audio?.currentTime || 0;
  [220, 164.81, 130.81, 98].forEach((freq, index) => {
    tone(freq, 0.16, 0.06, "square", sfxGain, now + index * 0.11);
  });
  noise(0.24, 0.08, now + 0.12);
}

function thrustSound() {
  if (!audio || muted || audio.currentTime < engineNextTime) return;
  engineNextTime = audio.currentTime + 0.075;
  tone(92 + Math.random() * 18, 0.035, 0.018, "square");
}

function readBest() {
  try {
    return Number(localStorage.getItem("ae-drift-best") || 0);
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    localStorage.setItem("ae-drift-best", String(Math.floor(value)));
  } catch {
    // The score still works when storage is blocked.
  }
}

function readVolume() {
  try {
    const raw = localStorage.getItem("ae-drift-volume");
    if (raw === null || raw === "0") return 1;
    const stored = Number(raw);
    return Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : 1;
  } catch {
    return 1;
  }
}

function writeVolume(value) {
  try {
    localStorage.setItem("ae-drift-volume", String(value));
  } catch {
    // Volume still works for this session when storage is blocked.
  }
}

function setVolume(value) {
  volume = Math.max(0, Math.min(1, value));
  volumeSliderEl.value = Math.round(volume * 100);
  volumeValueEl.textContent = `${Math.round(volume * 100)}%`;
  writeVolume(volume);
  syncMute();
}

function handleSecret(code) {
  typed.push(code.toLowerCase());
  if (typed.length > 18) typed.shift();
  const word = typed.join("");
  if (word.endsWith("ae")) {
    unlockEgg("tiny", "Pocket logo mode");
    makeLogoShards();
  }
  if (word.endsWith("studio")) {
    unlockEgg("studio", "Studio thrusters online");
  }
  if (word.endsWith("clean")) {
    state.stats.magnet = Math.max(state.stats.magnet, 120);
    unlockEgg("clean", "Precision overlay live");
  }
  if (word.endsWith("ghost")) {
    unlockEgg("ghost", "Collision? never heard of it");
  }
}

function handleKonami(code) {
  konamiBuffer.push(code);
  if (konamiBuffer.length > konami.length) konamiBuffer.shift();
  if (konami.every((key, i) => konamiBuffer[i] === key)) {
    disco = !disco;
    unlockEgg("konami", "Neon flight deck");
    makeLogoShards();
  }
}

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  updateMusic();
  draw(now);
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Escape"].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === "Enter" && (state.phase === "menu" || state.phase === "gameover")) startGame();
  if (event.code === "Escape") togglePause();
  keys.add(event.code);
  handleKonami(event.code);
  if (!["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code) && event.key.length === 1 && /[a-z]/i.test(event.key)) handleSecret(event.key);
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
muteButton.addEventListener("click", () => {
  muted = !muted;
  ensureAudio();
  syncMute();
  muteButton.classList.toggle("is-muted", muted);
  muteButton.setAttribute("aria-label", muted ? "Unmute sound" : "Toggle sound");
});
volumeSliderEl.addEventListener("input", () => {
  muted = false;
  muteButton.classList.remove("is-muted");
  muteButton.setAttribute("aria-label", "Toggle sound");
  setVolume(Number(volumeSliderEl.value) / 100);
});
upgradeOptionsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-upgrade]");
  if (button) chooseUpgrade(button.dataset.upgrade);
});

for (const button of document.querySelectorAll("[data-touch]")) {
  const value = button.dataset.touch;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    touch.add(value);
    button.setPointerCapture(event.pointerId);
    if (state.phase === "menu" || state.phase === "gameover") startGame();
  });
  button.addEventListener("pointerup", () => touch.delete(value));
  button.addEventListener("pointercancel", () => touch.delete(value));
  button.addEventListener("pointerleave", () => touch.delete(value));
}

canvas.addEventListener("pointerdown", (event) => {
  if (state.phase === "menu" || state.phase === "gameover") startGame();
  if (state.phase !== "playing") return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  aimShipAt(x, y);
  pointerAim.active = true;
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointerAim.active || state.phase !== "playing") return;
  const rect = canvas.getBoundingClientRect();
  aimShipAt(event.clientX - rect.left, event.clientY - rect.top);
});
canvas.addEventListener("pointerup", () => {
  pointerAim.active = false;
  touch.delete("thrust");
});
canvas.addEventListener("pointercancel", () => {
  pointerAim.active = false;
  touch.delete("thrust");
});
resize();
setVolume(volume);
updateHud();
requestAnimationFrame(frame);
