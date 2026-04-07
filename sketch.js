/*
  FIXED STORY SKETCH
  Scene 1 -> Scene 2 -> Scene 7

  Updates:
  - Scene 1 ambient stops as soon as transition starts
  - Scene 1 transition alarm is force-stopped exactly when Scene 2 transition begins
  - Scene 2 alarm fully stops when user turns it off
  - prevents double-alarm overlap between Scene 1 and Scene 2
*/

/* =========================================================
   SHARED CONSTANTS
========================================================= */

/*
  Audio file paths for Scene 1.
  These are used by MemoryAudioManager.
*/
const AUDIO_PATHS = {
  ambient: "sounds/scene1/background.mp3",
  sun: "",
  farm: "",
  kids: "",
  transitionAlarm: "sounds/scene1/digitalalarm_long.mp3"
};

/*
  Audio file paths for Scene 2.
  Scene 2 reuses the same alarm file but has its own interaction sounds.
*/
const SCENE2_AUDIO_PATHS = {
  alarm: "sounds/scene1/digitalalarm_long.mp3",
  ambient: "",
  water: "sounds/scene2/tap.mp3",
  toaster: "sounds/scene2/toaster.mp3",
  drawer: "sounds/scene2/keys.mp3",
  door: "sounds/scene2/door.mp3"
};

/*
  Small global cooldown so the user cannot spam-click nodes too quickly.
*/
const NODE_COOLDOWN_MS = 700;

/*
  Global bridge flag between Scene 1 and Scene 2.

  Scene 1 sets this to true exactly when the transition finishes.
  Scene 2 reads it and starts its alarm.
*/
let scene2AlarmShouldPlay = false;
let scene3ScrollLocked = false;

const SCENE_LOCK_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
  "Spacebar"
];

function setScene3ScrollLock(locked) {
  scene3ScrollLocked = locked;
  const appEl = document.getElementById("app");
  if (appEl) appEl.style.overflowY = locked ? "hidden" : "auto";
}

window.addEventListener("wheel", function (event) {
  if (!scene3ScrollLocked) return;
  event.preventDefault();
}, { passive: false });

window.addEventListener("touchmove", function (event) {
  if (!scene3ScrollLocked) return;
  event.preventDefault();
}, { passive: false });

window.addEventListener("keydown", function (event) {
  if (!scene3ScrollLocked) return;
  if (!SCENE_LOCK_KEYS.includes(event.key)) return;
  event.preventDefault();
});

/* =========================================================
   SHARED HELPERS
========================================================= */

/*
  Draws a vertical 3-color gradient line by line.
  Used for different scene backgrounds.
*/
function drawVerticalGradient(p, topCol, midCol, bottomCol, split = 0.58) {
  for (let y = 0; y < p.height; y += 2) {
    let c;
    if (y < p.height * split) {
      const amt = p.map(y, 0, p.height * split, 0, 1);
      c = p.lerpColor(topCol, midCol, amt);
    } else {
      const amt = p.map(y, p.height * split, p.height, 0, 1);
      c = p.lerpColor(midCol, bottomCol, amt);
    }
    p.stroke(c);
    p.line(0, y, p.width, y);
  }
  p.noStroke();
}

/*
  Draws a soft glow using several transparent ellipses.
  Reused for nodes, sun glow, alarm glow, door glow, etc.
*/
function drawSoftGlow(p, x, y, size, col, layers = 4) {
  const a = p.alpha(col);
  for (let i = layers; i >= 1; i--) {
    const localA = a * (i / (layers * 3));
    p.fill(p.red(col), p.green(col), p.blue(col), localA);
    p.ellipse(x, y, size * (1 + i * 0.55), size * (1 + i * 0.55));
  }
}

/*
  Draws one mountain / hill band using noise.
*/
function drawMountainBand(p, cfg) {
  const { t, baseY, amplitude, detail, speed, seedOffset, fillColor } = cfg;

  p.noStroke();
  p.fill(fillColor);
  p.beginShape();
  p.vertex(-20, p.height);

  for (let x = -20; x <= p.width + 20; x += 20) {
    const n = p.map(p.noise(seedOffset + x * detail, t * speed), 0, 1, -1, 1);
    const y = baseY + n * amplitude;
    p.curveVertex(x, y);
  }

  p.vertex(p.width + 20, p.height);
  p.endShape(p.CLOSE);
}

/*
  Draws the warm background sky for landscape scenes.
*/
function drawLandscapeSky(p, t, warmth = 0.4) {
  const topBase = p.color(214, 227, 232);
  const midBase = p.color(236, 226, 201);
  const bottomBase = p.color(165, 186, 145);

  const topWarm = p.lerpColor(topBase, p.color(255, 218, 172), warmth);
  const midWarm = p.lerpColor(midBase, p.color(255, 214, 160), warmth * 0.9);
  const bottomWarm = p.lerpColor(bottomBase, p.color(185, 184, 132), warmth * 0.35);

  drawVerticalGradient(p, topWarm, midWarm, bottomWarm);

  drawSoftGlow(
    p,
    p.width * 0.22 + p.sin(t * 0.00018) * 14,
    p.height * 0.24,
    p.width * 0.22,
    p.color(255, 240, 214, 16)
  );
  drawSoftGlow(
    p,
    p.width * 0.70 + p.cos(t * 0.00014) * 12,
    p.height * 0.38,
    p.width * 0.18,
    p.color(255, 236, 214, 12)
  );

  p.fill(255, 245, 225, 10);
  p.rect(0, p.height * 0.43, p.width, p.height * 0.18);

  p.fill(255, 214, 158, 16 + 26 * warmth);
  p.rect(0, 0, p.width, p.height * 0.65);
}

/*
  Draws three soft mountain layers for the landscape.
*/
function drawLandscapeMountains(p, t, warmth = 0.4) {
  drawMountainBand(p, {
    t,
    baseY: p.height * 0.43,
    amplitude: 45,
    detail: 0.008,
    speed: 0.00016,
    seedOffset: 0,
    fillColor: p.color(167, 184, 168, 82)
  });

  drawMountainBand(p, {
    t,
    baseY: p.height * 0.50,
    amplitude: 58,
    detail: 0.010,
    speed: 0.00018,
    seedOffset: 300,
    fillColor: p.color(142, 160, 136, 96)
  });

  drawMountainBand(p, {
    t,
    baseY: p.height * 0.58,
    amplitude: 48,
    detail: 0.012,
    speed: 0.00020,
    seedOffset: 640,
    fillColor: p.color(120, 140, 112, 108)
  });

  p.fill(255, 230, 180, 10 + 24 * warmth);
  p.rect(0, p.height * 0.58, p.width, p.height * 0.07);
}

/*
  Draws the meadow / ground layers.
*/
function drawLandscapeMeadow(p, warmth = 0.4) {
  p.fill(156, 176, 128, 44);
  p.rect(0, p.height * 0.64, p.width, p.height * 0.36);

  p.fill(161, 171, 123, 34);
  p.rect(0, p.height * 0.73, p.width, p.height * 0.27);

  p.fill(255, 222, 170, 8 + 14 * warmth);
  p.rect(0, p.height * 0.60, p.width, p.height * 0.22);
}

/*
  Returns true if the given scene section is currently visible in the viewport.
  This prevents clicks in off-screen scenes from doing anything.
*/
function isSceneVisible(sceneEl) {
  if (!sceneEl) return false;
  const r = sceneEl.getBoundingClientRect();
  return r.top < window.innerHeight && r.bottom > 0;
}

/*
  Returns true if the cursor is inside a p5 canvas.
*/
function insideCanvas(p) {
  return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
}

/* =========================================================
   SHARED SIMPLE VISUAL SYSTEMS
========================================================= */

/*
  A small floating particle for background atmosphere.
*/
class SimpleParticle {
  constructor(p, yMin, yMax, sizeMin = 3, sizeMax = 10) {
    this.p = p;
    this.baseX = p.random(p.width);
    this.baseY = p.random(yMin, yMax);
    this.size = p.random(sizeMin, sizeMax);
    this.phase = p.random(p.TWO_PI);
    this.speed = p.random(0.00002, 0.00005);
    this.tint = p.random([
      p.color(252, 244, 218),
      p.color(244, 227, 176),
      p.color(205, 218, 183),
      p.color(255, 222, 200)
    ]);
  }

  display(t, alphaScale = 1) {
    const p = this.p;
    const x = this.baseX + p.sin(t * this.speed + this.phase) * 5;
    const y = this.baseY + p.cos(t * this.speed * 0.75 + this.phase) * 3.5;

    p.noStroke();
    p.fill(p.red(this.tint), p.green(this.tint), p.blue(this.tint), 18 * alphaScale);
    p.ellipse(x, y, this.size, this.size);
  }
}

/*
  A lightweight grass blade used in warm scenes.
*/
class SimpleGrassBlade {
  constructor(p, index, total) {
    this.p = p;
    this.x = (index / Math.max(1, total - 1)) * p.width + p.random(-5, 5);
    this.baseY = p.random(p.height * 0.74, p.height * 0.99);
    this.h = p.random(24, 64);
    this.w = p.random(1, 2);
    this.phase = p.random(p.TWO_PI);
    this.tint = p.random([
      p.color(111, 132, 88),
      p.color(97, 121, 76),
      p.color(125, 147, 96)
    ]);
  }

  display(t, warmth = 0, swayBoost = 1) {
    const p = this.p;
    const sway = p.sin(t * 0.001 + this.phase) * 5 * swayBoost;
    const c = p.lerpColor(this.tint, p.color(235, 214, 152), warmth * 0.25);

    p.stroke(p.red(c), p.green(c), p.blue(c), 145);
    p.strokeWeight(this.w);
    p.line(this.x, this.baseY, this.x + sway, this.baseY - this.h);
    p.noStroke();
  }
}
/*
  Shared interactive node class.

  Used for both Scene 1 and Scene 2.
  It handles:
  - position based on normalized coordinates
  - hover detection
  - hover label rendering
  - click hit detection
*/
class SimpleNode {
  constructor(p, id, meta, shape = "circle") {
    this.p = p;
    this.id = id;
    this.label = meta.label;
    this.nx = meta.nx;
    this.ny = meta.ny;
    this.baseColor = p.color(meta.color[0], meta.color[1], meta.color[2]);
    this.shape = shape;
    this.x = 0;
    this.y = 0;
    this.hoverAmt = 0;
    this.phase = p.random(p.TWO_PI);
  }

  /*
    Updates actual x/y based on canvas size and checks hover state.

    'enabled' is important:
    when enabled is false, the node will not respond visually as hoverable.
    This is one way scene interactions are blocked.
  */
  update(state, enabled) {
    const p = this.p;
    this.x = p.width * this.nx;
    this.y = p.height * this.ny;

    const d = p.dist(p.mouseX, p.mouseY, this.x, this.y);
    const target = enabled && d < 34 ? 1 : 0;
    this.hoverAmt = p.lerp(this.hoverAmt, target, 0.2);

    if (this.hoverAmt > 0.35) {
      state.hoverNodeId = this.id;
    }
  }

  /*
    Draws the node and its hover label.
  */
  display(activeFade = 0) {
    const p = this.p;
    const pulse = 1 + 0.05 * p.sin(p.millis() * 0.004 + this.phase);
    const size = 18 * pulse * p.lerp(1, 1.18, this.hoverAmt);

    drawSoftGlow(
      p,
      this.x,
      this.y,
      size * 1.8,
      p.color(
        p.red(this.baseColor),
        p.green(this.baseColor),
        p.blue(this.baseColor),
        36 + 26 * this.hoverAmt + 30 * activeFade
      ),
      3
    );

    p.noStroke();
    p.fill(p.red(this.baseColor), p.green(this.baseColor), p.blue(this.baseColor), 190 + 40 * this.hoverAmt);

    if (this.shape === "square") {
      p.rect(this.x - size * 0.45, this.y - size * 0.45, size * 0.9, size * 0.9, 3);
    } else {
      p.ellipse(this.x, this.y, size, size);
    }

    if (this.hoverAmt > 0.08) {
      p.textSize(13);
      p.textAlign(p.CENTER, p.CENTER);

      const labelW = p.textWidth(this.label) + 22;
      const labelH = 28;
      const labelY = this.y - size * 1.8;

      p.fill(18, 20, 18, 150 * this.hoverAmt);
      p.rect(this.x - labelW / 2, labelY - labelH / 2, labelW, labelH, 999);

      p.fill(255, 244, 230, 230 * this.hoverAmt);
      p.text(this.label, this.x, labelY + 1);
    }
  }

  /*
    Returns true if mouse is close enough to count as a click on the node.
  */
  hit(mouseX, mouseY) {
    return this.p.dist(mouseX, mouseY, this.x, this.y) < 34;
  }
}

/* =========================================================
   SHARED AUDIO HELPERS
========================================================= */

/*
  Reusable audio wrapper.

  Important methods:
  - setTarget() for fade-based audio control
  - playOnce() for one-shot sounds
  - immediateStop() for hard stop
  - reset() for complete reset
*/
class AudioChannel {
  constructor(src, loop = true, maxVolume = 0.5) {
    this.src = src;
    this.loop = loop;
    this.maxVolume = maxVolume;
    this.target = 0;
    this.audio = null;

    if (src && src.trim() !== "") {
      this.audio = new Audio(src);
      this.audio.loop = loop;
      this.audio.volume = 0;
      this.audio.preload = "auto";
      this.audio.playsInline = true;
      this.audio.crossOrigin = "anonymous";
    }
  }

  /*
    Prepares the audio so later playback is smoother.
  */
  arm() {
    if (!this.audio) return;
    this.audio.play().then(() => {
      this.audio.pause();
      this.audio.currentTime = 0;
    }).catch(() => {});
  }

  /*
    Sets the desired volume target.
    update() will smoothly interpolate actual volume toward it.
  */
  setTarget(v) {
    this.target = Math.max(0, Math.min(this.maxVolume, v));
  }

  /*
    Immediately restarts the clip from the beginning and plays it once.
  */
  playOnce() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.loop = false;
    this.audio.volume = this.maxVolume;
    this.audio.play().catch(() => {});
  }

  /*
    Hard stop.
    This is used in transition handoffs where overlap must be prevented.
  */
  immediateStop() {
    if (!this.audio) return;
    this.target = 0;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.volume = 0;
    this.audio.loop = this.loop;
  }

  /*
    Runs every frame to move audio toward its target volume.
  */
  update(p) {
    if (!this.audio) return;

    if (this.target > 0.002 && this.audio.paused) {
      this.audio.loop = this.loop;
      this.audio.play().catch(() => {});
    }

    this.audio.volume = p.lerp(this.audio.volume, this.target, 0.08);

    if (!this.audio.paused && this.audio.volume < 0.001 && this.target < 0.001) {
      this.audio.volume = 0;
    }
  }

  /*
    Full reset to initial silent state.
  */
  reset() {
    if (!this.audio) return;
    this.target = 0;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.volume = 0;
    this.audio.loop = this.loop;
  }
}

/*
  Detached one-shot helper.

  This is important for Scene 2 toaster and drawer:
  the sound must play in full and not get cut off by any fade logic.
*/
class DetachedAudioChannel {
  constructor(src, maxVolume = 0.5) {
    this.src = src;
    this.maxVolume = maxVolume;
    this.seedAudio = null;

    if (src && src.trim() !== "") {
      this.seedAudio = new Audio(src);
      this.seedAudio.preload = "auto";
      this.seedAudio.playsInline = true;
      this.seedAudio.crossOrigin = "anonymous";
      this.seedAudio.volume = maxVolume;
    }
  }

  arm() {
    if (!this.seedAudio) return;

    this.seedAudio.load();

    this.seedAudio.play().then(() => {
      this.seedAudio.pause();
      this.seedAudio.currentTime = 0;
    }).catch(() => {});
  }

  playDetachedOnce() {
    if (!this.seedAudio) return;

    const clone = this.seedAudio.cloneNode(true);
    clone.volume = this.maxVolume;
    clone.currentTime = 0;
    clone.play().catch((err) => {
      console.warn("Detached audio failed:", this.src, err);
    });
  }

  reset() {}
}

/* =========================================================
   SCENE 1 — DREAM / CHILDHOOD MEMORY
========================================================= */

/*
  The order of Scene 1 nodes.
  The special "transition" node is the one that starts the switch to Scene 2.
*/
const MEMORY_ORDER = ["sun", "farm", "kids", "transition"];

/*
  Metadata for Scene 1 nodes:
  - label shown on hover
  - normalized coordinates (nx, ny)
  - color
*/
const MEMORY_META = {
  sun: { label: "Sun", nx: 0.76, ny: 0.22, color: [255, 218, 150] },
  farm: { label: "Farm", nx: 0.22, ny: 0.72, color: [213, 198, 137] },
  kids: { label: "Kids", nx: 0.68, ny: 0.66, color: [255, 226, 176] },
  transition: { label: "???", nx: 0.16, ny: 0.18, color: [210, 214, 220] }
};

let containerEl;
let scene1El;
let scene2El;
let overlayEl;
let startBtnEl;
let hintEl;
let thoughtEls = {};

let nodes = [];
let particles = [];
let grassBlades = [];
let farmShapes = [];
let kidTrails = [];

let audioManager;

/*
  Main state object for Scene 1.

  The transition sub-object is the key part for scene switching.
*/
let appState = {
  started: false,
  hoverNodeId: null,
  cooldownUntil: 0,
  clicked: {
    sun: false,
    farm: false,
    kids: false,
    transition: false
  },
  fades: {
    sun: 0,
    farm: 0,
    kids: 0,
    transition: 0
  },
  targets: {
    sun: 0,
    farm: 0,
    kids: 0,
    transition: 0
  },
    transition: {
    active: false,
    startTime: 0,
    flashAlpha: 0,
    autoScrolled: false,
    scene2Triggered: false
  }
};

/*
  Standard p5 setup for Scene 1.
*/
function setup() {
  scene1El = document.getElementById("scene-1");
  scene2El = document.getElementById("scene-2");
  containerEl = document.getElementById("p5-container");
  overlayEl = document.getElementById("scene-1-overlay");
  startBtnEl = document.getElementById("start-btn");
  hintEl = document.getElementById("scene-1-hint");

  thoughtEls = {
    sun: document.getElementById("scene-1-thought-sun"),
    farm: document.getElementById("scene-1-thought-farm"),
    kids: document.getElementById("scene-1-thought-kids")
  };

  const canvas = createCanvas(containerEl.offsetWidth, containerEl.offsetHeight);
  canvas.parent("p5-container");

  pixelDensity(1);
  noStroke();

  initScene1World();
  audioManager = new MemoryAudioManager(AUDIO_PATHS);

  if (startBtnEl) {
    startBtnEl.addEventListener("click", startScene1);
  }
}

/*
  Main draw loop for Scene 1.
  This updates transition logic, audio, and all visuals every frame.
*/
function draw() {
  const t = millis();

  updateScene1Fades();
  updateTransitionState();
  audioManager.update(appState.started, appState.fades, appState.transition);

  drawLandscapeSky(this, t, 0.35 + appState.fades.sun * 0.35);
  drawLandscapeMountains(this, t, 0.35 + appState.fades.sun * 0.35);
  drawScene1Sun(t);
  drawScene1Particles(t);
  drawLandscapeMeadow(this, 0.35 + appState.fades.sun * 0.25);
  drawScene1Grass(t);
  drawScene1Farm(t);
  drawScene1Kids(t);
  drawScene1TransitionAlarm(t);
  drawScene1Nodes();
  drawScene1Flash();

  updateScene1Cursor();
}

/*
  Builds all Scene 1 visual systems:
  - nodes
  - particles
  - grass
  - farm shapes
  - kid trails
*/
function initScene1World() {
  nodes = [];
  particles = [];
  grassBlades = [];
  farmShapes = [];
  kidTrails = [];

  for (const key of MEMORY_ORDER) {
    const shape = key === "transition" ? "square" : "circle";
    nodes.push(new SimpleNode(this, key, MEMORY_META[key], shape));
  }

  for (let i = 0; i < 45; i++) {
    particles.push(new SimpleParticle(this, height * 0.18, height * 0.88, 3, 9));
  }

  const bladeCount = Math.max(60, Math.floor(width / 18));
  for (let i = 0; i < bladeCount; i++) {
    grassBlades.push(new SimpleGrassBlade(this, i, bladeCount));
  }

  for (let i = 0; i < 12; i++) {
    farmShapes.push({
      x: random(width * 0.18, width * 0.52),
      y: random(height * 0.72, height * 0.83),
      w: random(16, 30),
      h: random(10, 18),
      phase: random(TWO_PI)
    });
  }

  for (let i = 0; i < 5; i++) {
    kidTrails.push({
      bandY: random(height * 0.76, height * 0.88),
      phase: random(TWO_PI),
      speed: random(0.00002, 0.00005),
      color: random([
        color(120, 205, 120),
        color(120, 175, 255),
        color(255, 155, 205),
        color(255, 225, 120)
      ])
    });
  }

  syncScene1Thoughts();
}

/*
  Sun visualization, shown after the Sun memory is activated.
*/
function drawScene1Sun(t) {
  const fade = appState.fades.sun;
  if (fade < 0.01) return;

  const x = width * MEMORY_META.sun.nx;
  const y = height * MEMORY_META.sun.ny;

  drawSoftGlow(this, x, y, width * 0.07, color(255, 220, 155, 50 * fade));
  drawSoftGlow(this, x, y, width * 0.11, color(255, 206, 140, 26 * fade));

  push();
  translate(x, y);
  stroke(255, 223, 168, 18 * fade);
  strokeWeight(1.2);

  for (let i = 0; i < 12; i++) {
    const a = (TWO_PI / 12) * i;
    line(cos(a) * 18, sin(a) * 18, cos(a) * 34, sin(a) * 34);
  }

  noStroke();
  pop();
}

/*
  Draws floating particles in Scene 1.
*/
function drawScene1Particles(t) {
  const alphaScale = 0.7 + appState.fades.sun * 0.6 + appState.fades.kids * 0.3;
  for (const particle of particles) {
    particle.display(t, alphaScale);
  }
}

/*
  Draws grass in Scene 1.
*/
function drawScene1Grass(t) {
  const warmth = appState.fades.sun;
  const sway = 1 + appState.fades.farm * 0.4 + appState.fades.kids * 0.2;
  for (const blade of grassBlades) {
    blade.display(t, warmth, sway);
  }
}

/*
  Farm visualization.
*/
function drawScene1Farm(t) {
  const fade = appState.fades.farm;
  if (fade < 0.01) return;

  fill(166, 143, 92, 16 * fade);
  rect(0, height * 0.70, width, height * 0.30);

  noStroke();
  for (const f of farmShapes) {
    const x = f.x + sin(t * 0.00045 + f.phase) * 3 * fade;
    const y = f.y + cos(t * 0.00055 + f.phase) * 1.2 * fade;

    fill(246, 242, 236, 185 * fade);
    rect(x - f.w / 2, y - f.h / 2, f.w, f.h, 3);

    fill(40, 36, 32, 170 * fade);
    ellipse(x - f.w * 0.18, y - f.h * 0.05, f.w * 0.22, f.h * 0.34);
    ellipse(x + f.w * 0.12, y + f.h * 0.10, f.w * 0.18, f.h * 0.28);

    if (f.w > 20) {
      ellipse(x + f.w * 0.02, y - f.h * 0.18, f.w * 0.14, f.h * 0.22);
    }
  }
}

/*
  Kids visualization.
*/
function drawScene1Kids(t) {
  const fade = appState.fades.kids;
  if (fade < 0.01) return;

  for (const k of kidTrails) {
    const q = t * k.speed + k.phase;
    const x = ((q * width * 0.65) % (width + 80)) - 40;
    const y = constrain(
      k.bandY + sin(q * 5.5) * 5,
      height * 0.74,
      height * 0.90
    );

    noStroke();
    fill(red(k.color), green(k.color), blue(k.color), 96 * fade);
    ellipse(x, y, 12, 12);

    fill(red(k.color), green(k.color), blue(k.color), 40 * fade);
    ellipse(x - 8, y + 2, 7, 7);
  }
}

/*
  Draws the moving digital alarm during Scene 1 transition.

  This is the visual part of the scene switch animation.
*/
function drawScene1TransitionAlarm(t) {
  if (!appState.transition.active) return;

  const elapsed = millis() - appState.transition.startTime;
  const progress = constrain(elapsed / 5000, 0, 1);

  const cx = width * 0.22;
  const cy = height * 0.20;
  const shake = map(progress, 0, 1, 1, 6);

  const vx = sin(t * 0.05) * shake;
  const vy = cos(t * 0.045) * shake * 0.35;

  push();
  translate(cx + vx, cy + vy);
  rectMode(CENTER);

  fill(130, 136, 144, 220);
  rect(0, 0, 82, 52, 8);

  fill(166, 172, 180, 170);
  rect(0, -6, 62, 10, 4);

  fill(105, 110, 118, 225);
  rect(-18, -32, 14, 10, 4);
  rect(18, -32, 14, 10, 4);

  stroke(230, 236, 244, 140);
  strokeWeight(2);
  line(-12, 8, -12, 18);
  line(12, 8, 12, 18);

  noStroke();
  fill(220, 228, 236, 210);
  ellipse(0, 0, 12, 12);
  pop();

  noFill();
  stroke(225, 230, 238, 24 + progress * 30);
  strokeWeight(1.5);
  ellipse(cx, cy, 120 + progress * 120, 80 + progress * 80);
  noStroke();
}
/*
  Updates hover states and draws Scene 1 nodes.

  Important:
  Once the transition begins, the transition node is hidden,
  and all nodes are updated with interactions disabled.
*/
function drawScene1Nodes() {
  appState.hoverNodeId = null;

  for (const node of nodes) {
    if (node.id === "transition" && appState.transition.active) continue;
    node.update(appState, appState.started && !appState.transition.active);
  }

  for (const node of nodes) {
    if (node.id === "transition" && appState.transition.active) continue;
    node.display(appState.fades[node.id]);
  }
}

/*
  Draws the white flash at the end of the Scene 1 transition.
*/
function drawScene1Flash() {
  if (appState.transition.flashAlpha <= 0.5) return;
  fill(255, 255, 255, appState.transition.flashAlpha);
  rect(0, 0, width, height);
}

/*
  Starts Scene 1 from the intro overlay.
*/
function startScene1() {
  if (appState.started) return;
  appState.started = true;

  if (overlayEl) overlayEl.classList.add("hidden");
  if (hintEl) hintEl.classList.remove("hidden");

  audioManager.enable();
}

/*
  Resets Scene 1 back to its initial state.
  Used when restarting the whole story.
*/
function resetScene1() {
  appState.started = false;
  appState.hoverNodeId = null;
  appState.cooldownUntil = 0;

  for (const key of MEMORY_ORDER) {
    appState.clicked[key] = false;
    appState.fades[key] = 0;
    appState.targets[key] = 0;
  }

  appState.transition.active = false;
  appState.transition.startTime = 0;
  appState.transition.flashAlpha = 0;
  appState.transition.autoScrolled = false;
  appState.transition.scene2Triggered = false;
  scene2AlarmShouldPlay = false;
  setScene3ScrollLock(false);

  syncScene1Thoughts();

  if (overlayEl) overlayEl.classList.remove("hidden");
  if (hintEl) hintEl.classList.add("hidden");

  if (audioManager) audioManager.reset();

  const appEl = document.getElementById("app");
  if (appEl) appEl.style.overflowY = "hidden";
}

window.resetScene1Story = resetScene1;

/*
  Synchronizes the HTML thought bubbles with which memories were clicked.
*/
function syncScene1Thoughts() {
  for (const key of ["sun", "farm", "kids"]) {
    const el = thoughtEls[key];
    if (!el) continue;
    el.classList.toggle("active", !!appState.clicked[key]);
  }
}

/*
  Activates a Scene 1 memory node.

  For the special "transition" node:
  - starts the Scene 1 -> Scene 2 transition
*/
function activateScene1Memory(memoryId) {
  if (!appState.started) return;
  if (millis() < appState.cooldownUntil) return;
  if (appState.clicked[memoryId]) return;
  if (appState.transition.active) return;

  appState.cooldownUntil = millis() + NODE_COOLDOWN_MS;
  appState.clicked[memoryId] = true;
  appState.targets[memoryId] = 1;

  if (memoryId === "transition") {
    appState.transition.active = true;
    appState.transition.startTime = millis();
    appState.transition.flashAlpha = 0;
    appState.transition.autoScrolled = false;
    appState.transition.scene2Triggered = false;
    scene2AlarmShouldPlay = false;
    audioManager.startTransitionAlarm();
    return;
  }

  const thoughtEl = thoughtEls[memoryId];
  if (thoughtEl) thoughtEl.classList.add("active");
}

/*
  Smoothly moves visual fade values toward their targets.
*/
function updateScene1Fades() {
  for (const key of MEMORY_ORDER) {
    appState.fades[key] = lerp(appState.fades[key], appState.targets[key], 0.06);
  }
}

/*
  Controls the full Scene 1 -> Scene 2 transition animation and handoff.
*/
function updateTransitionState() {
  if (!appState.transition.active) {
    appState.transition.flashAlpha = lerp(appState.transition.flashAlpha, 0, 0.2);
    return;
  }

  const elapsed = millis() - appState.transition.startTime;
  const progress = constrain(elapsed / 10000, 0, 1);

  if (progress < 0.82) {
    appState.transition.flashAlpha = lerp(appState.transition.flashAlpha, 0, 0.15);
  } else {
    appState.transition.flashAlpha = max(appState.transition.flashAlpha, map(progress, 0.82, 1, 0, 255));
  }

  /*
    This block executes only once.
    It hands control from Scene 1 to Scene 2.
  */
  if (elapsed >= 5000 && !appState.transition.scene2Triggered) {
    appState.transition.scene2Triggered = true;

    if (audioManager) {
      audioManager.stopForScene2();
    }

    scene2AlarmShouldPlay = true;
  }

  /*
    This block also executes only once.
    It unlocks scroll and moves the user to Scene 2.
  */
  if (elapsed >= 5000 && !appState.transition.autoScrolled) {
    appState.transition.autoScrolled = true;
    appState.transition.flashAlpha = 255;

    const appEl = document.getElementById("app");
    if (appEl) appEl.style.overflowY = "auto";

    if (scene2El) {
      scene2El.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

/*
  Updates mouse cursor in Scene 1.
*/
function updateScene1Cursor() {
  if (!appState.started) {
    cursor(ARROW);
    return;
  }

  if (appState.hoverNodeId && millis() >= appState.cooldownUntil && !appState.transition.active) {
    cursor(HAND);
  } else {
    cursor(ARROW);
  }
}

/*
  Main click handler for Scene 1.
*/
function mousePressed() {
  if (!insideCanvas(this) || !isSceneVisible(scene1El)) return false;

  if (!appState.started) {
    startScene1();
    return false;
  }

  if (millis() < appState.cooldownUntil) return false;
  if (appState.transition.active) return false;

  for (const node of nodes) {
    if (node.id === "transition" && appState.transition.active) continue;
    if (node.hit(mouseX, mouseY)) {
      activateScene1Memory(node.id);
      return false;
    }
  }

  return false;
}

/*
  Rebuilds Scene 1 layout on window resize.
*/
function windowResized() {
  if (!containerEl) return;
  resizeCanvas(containerEl.offsetWidth, containerEl.offsetHeight);
  initScene1World();
}

/*
  Scene 1 audio manager.
*/
class MemoryAudioManager {
  constructor(paths) {
    this.enabled = false;
    this.channels = {
      ambient: new AudioChannel(paths.ambient, true, 0.28),
      sun: new AudioChannel(paths.sun, true, 0.48),
      farm: new AudioChannel(paths.farm, true, 0.46),
      kids: new AudioChannel(paths.kids, true, 0.44),
      transitionAlarm: new AudioChannel(paths.transitionAlarm, true, 0.9)
    };
  }

  /*
    Enables and arms all Scene 1 audio channels.
  */
  enable() {
    if (this.enabled) return;
    this.enabled = true;
    for (const key in this.channels) this.channels[key].arm();
  }

  /*
    Starts the Scene 1 transition alarm cleanly.
    immediateStop() is called first to avoid duplicate overlap.
  */
  startTransitionAlarm() {
    this.channels.transitionAlarm.immediateStop();
    this.channels.transitionAlarm.setTarget(0.02);
  }
    /*
    Hard-stops all Scene 1 sounds when entering Scene 2.

    This is the key anti-overlap audio function.
    It ensures the Scene 1 alarm does not keep playing under Scene 2.
  */
  stopForScene2() {
    this.channels.ambient.immediateStop();
    this.channels.sun.immediateStop();
    this.channels.farm.immediateStop();
    this.channels.kids.immediateStop();
    this.channels.transitionAlarm.immediateStop();
  }

  /*
    Per-frame audio update logic for Scene 1.
  */
  update(started, fades, transitionState) {
    if (!this.enabled || !started) return;

    this.channels.ambient.setTarget(transitionState.active ? 0 : 0.22);
    this.channels.sun.setTarget(transitionState.active ? 0 : 0.42 * fades.sun);
    this.channels.farm.setTarget(transitionState.active ? 0 : 0.38 * fades.farm);
    this.channels.kids.setTarget(transitionState.active ? 0 : 0.36 * fades.kids);

    if (transitionState.active && !transitionState.scene2Triggered) {
      const progress = constrain((millis() - transitionState.startTime) / 10000, 0, 1);
      this.channels.transitionAlarm.setTarget(0.10 + progress * 0.78);
    } else {
      this.channels.transitionAlarm.setTarget(0);
    }

    const lerpHelper = { lerp };

    for (const key in this.channels) {
      this.channels[key].update(lerpHelper);
    }
  }

  /*
    Resets all channels.
  */
  reset() {
    for (const key in this.channels) this.channels[key].reset();
  }
}

/* =========================================================
   SCENE 2 — WAKE UP
========================================================= */

new p5(function (p) {
  /*
    Interactive node order for Scene 2.
  */
  const MEMORY_ORDER_2 = ["water", "toaster", "drawer"];

  /*
    Node metadata for Scene 2.
  */
  const MEMORY_META_2 = {
    water: { label: "Tap Water", nx: 0.26, ny: 0.38, color: [184, 214, 240] },
    toaster: { label: "Toaster", nx: 0.68, ny: 0.36, color: [228, 216, 188] },
    drawer: { label: "Drawer", nx: 0.50, ny: 0.72, color: [186, 198, 214] }
  };

  let sceneEl2;
  let containerEl2;
  let hintEl2;
  let thoughtEls2 = {};

  let nodes2 = [];
  let audioManager2;

  /*
    Main Scene 2 state.
  */
  let state2 = {
    started: true,
    alarmActive: false,
    alarmStopped: false,
    hoverAlarm: false,
    hoverNodeId: null,
    cooldownUntil: 0,
    doorVisible: false,
    doorHovered: false,
    doorClicked: false,
    doorTransitioning: false,
    doorClickedAt: 0,
    clicked: {
      water: false,
      toaster: false,
      drawer: false
    },
    fades: {
      water: 0,
      toaster: 0,
      drawer: 0
    },
    targets: {
      water: 0,
      toaster: 0,
      drawer: 0
    },
    triggerTimes: {
      water: -9999,
      toaster: -9999,
      drawer: -9999
    }
  };

  /*
    Scene 2 setup.
  */
  p.setup = function () {
    sceneEl2 = document.getElementById("scene-2");
    containerEl2 = document.getElementById("scene-2-container");
    hintEl2 = document.getElementById("scene-2-hint");

    thoughtEls2 = {
      water: document.getElementById("scene-2-thought-water"),
      toaster: document.getElementById("scene-2-thought-toaster"),
      drawer: document.getElementById("scene-2-thought-drawer")
    };

    const canvas = p.createCanvas(containerEl2.offsetWidth, containerEl2.offsetHeight);
    canvas.parent("scene-2-container");

    p.pixelDensity(1);
    p.noStroke();

    initScene2();
    audioManager2 = new Scene2AudioManager(SCENE2_AUDIO_PATHS);
    audioManager2.enable();
  };

  /*
    Main draw loop for Scene 2.
  */
  p.draw = function () {
    const t = p.millis();

    if (scene2AlarmShouldPlay && !state2.alarmStopped) {
      state2.alarmActive = true;
    }

    updateScene2Fades();
    updateDoorState2();
    audioManager2.update(state2.started, state2.alarmActive, state2.alarmStopped, state2.fades);

    drawBackground2();
    drawRoom2();

    if (state2.alarmActive && !state2.alarmStopped) {
      drawAlarm2(t);
      state2.hoverNodeId = null;
    } else {
      drawWater2(t);
      drawToaster2();
      drawDrawer2();
      drawNodes2();
      drawDoor2();
    }

    updateCursor2();
  };

  /*
    Builds Scene 2 nodes.
  */
  function initScene2() {
    nodes2 = [];
    for (const key of MEMORY_ORDER_2) {
      nodes2.push(new SimpleNode(p, key, MEMORY_META_2[key], "square"));
    }
    syncScene2Thoughts();
  }

  /*
    Draws cold scene background.
  */
  function drawBackground2() {
    drawVerticalGradient(
      p,
      p.color(20, 28, 38),
      p.color(13, 19, 28),
      p.color(8, 11, 16),
      0.55
    );

    const totalFade = state2.fades.water + state2.fades.toaster + state2.fades.drawer;
    p.fill(220, 235, 255, 8 * totalFade);
    p.rect(0, 0, p.width, p.height);
  }

  /*
    Draws static room blocks / geometry.
  */
  function drawRoom2() {
    p.fill(92, 108, 124, 95);
    p.rect(p.width * 0.10, p.height * 0.18, p.width * 0.22, p.height * 0.34);

    p.fill(86, 94, 104, 110);
    p.rect(p.width * 0.58, p.height * 0.22, p.width * 0.18, p.height * 0.14, 4);

    p.fill(74, 82, 94, 100);
    p.rect(p.width * 0.36, p.height * 0.58, p.width * 0.28, p.height * 0.18);
  }

  /*
    Draws the clickable center alarm for Scene 2.
  */
  function drawAlarm2(t) {
    if (state2.alarmStopped) return;

    const cx = p.width * 0.5;
    const cy = p.height * 0.5;
    state2.hoverAlarm = p.dist(p.mouseX, p.mouseY, cx, cy) < 68;
        const vx = p.sin(t * 0.05) * 4;
    const vy = p.cos(t * 0.045) * 1.6;

    p.push();
    p.translate(cx + vx, cy + vy);
    p.rectMode(p.CENTER);

    drawSoftGlow(p, 0, 0, 80, p.color(230, 238, 248, 28), 3);

    p.fill(130, 136, 144, 230);
    p.rect(0, 0, 114, 72, 10);

    p.fill(166, 172, 180, 170);
    p.rect(0, -8, 86, 12, 4);

    p.fill(105, 110, 118, 225);
    p.rect(-24, -42, 18, 14, 4);
    p.rect(24, -42, 18, 14, 4);

    p.stroke(236, 242, 248, 150);
    p.strokeWeight(2.2);
    p.line(-14, 12, -14, 24);
    p.line(14, 12, 14, 24);

    p.noStroke();
    p.fill(228, 234, 240, 225);
    p.ellipse(0, 0, 16, 16);
    p.pop();

    if (state2.hoverAlarm) {
      p.textSize(14);
      p.textAlign(p.CENTER, p.CENTER);

      const label = "Turn off the alarm";
      const w = p.textWidth(label) + 28;
      const h = 34;
      const y = cy - 90;

      p.fill(14, 17, 22, 180);
      p.rect(cx - w / 2, y - h / 2, w, h, 999);

      p.fill(245, 248, 255, 235);
      p.text(label, cx, y + 1);
    }
  }

  /*
    Stops Scene 2 alarm.
  */
  function stopAlarm2() {
    if (!state2.alarmActive || state2.alarmStopped) return;

    state2.alarmStopped = true;
    state2.alarmActive = false;
    scene2AlarmShouldPlay = false;

    if (hintEl2) hintEl2.classList.remove("hidden");
    audioManager2.stopAlarm();

    const appEl = document.getElementById("app");
    if (appEl) appEl.style.overflowY = "hidden";
  }

  /*
    Water animation.
    This one fades away after 5 seconds.
  */
  function drawWater2(t) {
    const fade = state2.fades.water;
    if (fade < 0.01) return;

    const elapsed = p.millis() - state2.triggerTimes.water;
    if (elapsed > 5000) return;

    const x = p.width * 0.20;
    const y = p.height * 0.25;
    const streamW = 14 + p.sin(t * 0.03) * 2;

    p.noStroke();
    p.fill(188, 220, 245, 34 * fade);

    for (let i = 0; i < 6; i++) {
      const yy = y + i * 40 + (t * 0.18 + i * 16) % 24;
      p.rect(x, yy, streamW, 24, 3);
    }

    p.fill(220, 238, 255, 26 * fade);
    p.rect(p.width * 0.08, p.height * 0.60, p.width * 0.16, 10, 3);
  }

  /*
    Toaster animation.
    Plays once when activated.
  */
  function drawToaster2() {
    const fade = state2.fades.toaster;
    if (fade < 0.01) return;

    const baseX = p.width * 0.67;
    const baseY = p.height * 0.24;
    const elapsed = p.millis() - state2.triggerTimes.toaster;
    const progress = p.constrain(elapsed / 1600, 0, 1);

    let popOffset = 0;
    if (progress < 0.55) {
      popOffset = p.map(progress, 0, 0.55, 0, 18);
    } else {
      popOffset = p.map(progress, 0.55, 1, 18, 8);
    }

    p.fill(86, 94, 104, 170 * fade);
    p.rect(baseX - 28, baseY, 72, 36, 4);

    p.fill(210, 190, 152, 180 * fade);
    p.rect(baseX - 8, baseY - popOffset, 16, 26, 2);
    p.rect(baseX + 14, baseY - popOffset + 2, 16, 24, 2);
  }

  /*
    Drawer animation.
    Opens once when activated.
  */
  function drawDrawer2() {
    const fade = state2.fades.drawer;
    if (fade < 0.01) return;

    const baseX = p.width * 0.38;
    const baseY = p.height * 0.60;
    const elapsed = p.millis() - state2.triggerTimes.drawer;
    const progress = p.constrain(elapsed / 1400, 0, 1);
    const openAmt = p.lerp(0, 42, progress);

    p.fill(146, 158, 176, 90 * fade);
    p.rect(baseX, baseY, p.width * 0.24, p.height * 0.12);

    p.fill(200, 210, 224, 120 * fade);
    p.rect(baseX + openAmt, baseY + 18, p.width * 0.18, p.height * 0.06);

    p.fill(230, 235, 240, 150 * fade);
    p.rect(baseX + openAmt + 24, baseY + 34, 38, 6, 3);
  }

  /*
    Updates and draws Scene 2 nodes.

    Key rule:
    nodes are only interactive after the alarm has been stopped.
  */
  function drawNodes2() {
    state2.hoverNodeId = null;

    for (const node of nodes2) {
      node.update(state2, state2.started && state2.alarmStopped);
    }

    for (const node of nodes2) {
      node.display(state2.fades[node.id]);
    }
  }

  /*
    Activates a Scene 2 interaction.
  */
  function activateMemory2(memoryId) {
    if (!state2.started || !state2.alarmStopped) return;
    if (p.millis() < state2.cooldownUntil) return;
    if (state2.clicked[memoryId]) return;

    state2.cooldownUntil = p.millis() + NODE_COOLDOWN_MS;
    state2.clicked[memoryId] = true;
    state2.targets[memoryId] = 1;
    state2.triggerTimes[memoryId] = p.millis();

    const thoughtEl = thoughtEls2[memoryId];
    if (thoughtEl) thoughtEl.classList.add("active");

    audioManager2.setActive(memoryId);
  }

  /*
    Updates Scene 2 fade values.
    Water target resets back to 0 after 5 seconds.
  */
  function updateScene2Fades() {
    if (state2.clicked.water) {
      const elapsed = p.millis() - state2.triggerTimes.water;
      if (elapsed >= 5000) state2.targets.water = 0;
    }

    for (const key of MEMORY_ORDER_2) {
      state2.fades[key] = p.lerp(state2.fades[key], state2.targets[key], 0.08);
    }
  }

  /*
    Door becomes visible only after all three Scene 2 interactions are done.
  */
  function updateDoorState2() {
    state2.doorVisible = state2.clicked.water && state2.clicked.toaster && state2.clicked.drawer;
    if (state2.doorVisible && hintEl2) hintEl2.classList.add("hidden");
  }

  /*
    Draws the door that transitions to Scene 3.
  */
  function drawDoor2() {
    if (!state2.doorVisible) return;

    const x = p.width * 0.82;
    const y = p.height * 0.56;
    const w = p.width * 0.10;
    const h = p.height * 0.24;
        state2.doorHovered =
      p.mouseX >= x && p.mouseX <= x + w &&
      p.mouseY >= y && p.mouseY <= y + h &&
      !state2.doorTransitioning;

    drawSoftGlow(
      p,
      x + w / 2,
      y + h / 2,
      70,
      p.color(210, 220, 235, state2.doorHovered ? 28 : 14),
      3
    );

    p.fill(78, 88, 100, state2.doorClicked ? 170 : 220);
    p.rect(x, y, w, h, 4);

    p.fill(98, 110, 124, state2.doorClicked ? 150 : 190);
    p.rect(x + 6, y + 6, w - 12, h - 12, 3);

    p.fill(188, 198, 212, 210);
    p.ellipse(x + w * 0.74, y + h * 0.54, 7, 7);

    if (state2.doorHovered) {
      p.textSize(13);
      p.textAlign(p.CENTER, p.CENTER);
      const label = "Door";
      const labelW = p.textWidth(label) + 24;
      const labelH = 30;
      const labelX = x + w / 2;
      const labelY = y - 24;

      p.fill(14, 17, 22, 170);
      p.rect(labelX - labelW / 2, labelY - labelH / 2, labelW, labelH, 999);

      p.fill(245, 248, 255, 235);
      p.text(label, labelX, labelY + 1);
    }
  }

  /*
    Triggers Scene 2 -> Scene 3 door transition.
  */
  function triggerDoorTransition2() {
    if (!state2.doorVisible || state2.doorTransitioning) return;

    state2.doorClicked = true;
    state2.doorTransitioning = true;
    state2.doorClickedAt = p.millis();

    audioManager2.playDoor();

    if (window.resetScene3Intro) window.resetScene3Intro();

    const appEl = document.getElementById("app");
    if (appEl) appEl.style.overflowY = "auto";

    const nextScene = document.getElementById("scene-3");
    if (nextScene) {
      setTimeout(() => {
        nextScene.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    }
  }

  /*
    Syncs Scene 2 HTML thought bubbles with clicked state.
  */
  function syncScene2Thoughts() {
    for (const key of MEMORY_ORDER_2) {
      const el = thoughtEls2[key];
      if (!el) continue;
      el.classList.toggle("active", !!state2.clicked[key]);
    }
  }

  /*
    Cursor update for Scene 2.
  */
  function updateCursor2() {
    if (state2.alarmActive && !state2.alarmStopped) {
      p.cursor(state2.hoverAlarm ? p.HAND : p.ARROW);
      return;
    }

    if ((state2.hoverNodeId && p.millis() >= state2.cooldownUntil) || state2.doorHovered) {
      p.cursor(p.HAND);
    } else {
      p.cursor(p.ARROW);
    }
  }

  /*
    Full reset for Scene 2.
  */
  function resetScene2() {
    state2.started = true;
    state2.alarmActive = false;
    state2.alarmStopped = false;
    state2.hoverAlarm = false;
    state2.hoverNodeId = null;
    state2.cooldownUntil = 0;
    state2.doorVisible = false;
    state2.doorHovered = false;
    state2.doorClicked = false;
    state2.doorTransitioning = false;
    state2.doorClickedAt = 0;

    for (const key of MEMORY_ORDER_2) {
      state2.clicked[key] = false;
      state2.fades[key] = 0;
      state2.targets[key] = 0;
      state2.triggerTimes[key] = -9999;
    }

    scene2AlarmShouldPlay = false;

    syncScene2Thoughts();

    if (hintEl2) hintEl2.classList.add("hidden");

    if (audioManager2) {
      audioManager2.reset();
      audioManager2.enable();
    }

    const appEl = document.getElementById("app");
    if (appEl) appEl.style.overflowY = "hidden";
  }

  window.resetScene2Story = resetScene2;

  /*
    Main click handler for Scene 2.
  */
  p.mousePressed = function () {
    if (!insideCanvas(p) || !isSceneVisible(sceneEl2)) return false;

    if (state2.alarmActive && !state2.alarmStopped) {
      const cx = p.width * 0.5;
      const cy = p.height * 0.5;
      if (p.dist(p.mouseX, p.mouseY, cx, cy) < 72) {
        stopAlarm2();
      }
      return false;
    }

    if (state2.doorVisible && !state2.doorTransitioning) {
      const x = p.width * 0.82;
      const y = p.height * 0.56;
      const w = p.width * 0.10;
      const h = p.height * 0.24;

      const overDoor =
        p.mouseX >= x && p.mouseX <= x + w &&
        p.mouseY >= y && p.mouseY <= y + h;

      if (overDoor) {
        triggerDoorTransition2();
        return false;
      }
    }

    if (p.millis() < state2.cooldownUntil) return false;

    for (const node of nodes2) {
      if (node.hit(p.mouseX, p.mouseY)) {
        activateMemory2(node.id);
        return false;
      }
    }

    return false;
  };

  /*
    Resize handler for Scene 2.
  */
  p.windowResized = function () {
    if (!containerEl2) return;
    p.resizeCanvas(containerEl2.offsetWidth, containerEl2.offsetHeight);
    initScene2();
  };

  /*
    Scene 2 audio manager.

    Handles:
    - alarm loop
    - ambient
    - water
    - toaster one-shot
    - drawer one-shot
    - door one-shot
  */
  class Scene2AudioManager {
  constructor(paths) {
    this.enabled = false;
    this.channels = {
      alarm: new AudioChannel(paths.alarm, true, 0.85),
      ambient: new AudioChannel(paths.ambient, true, 0.16),
      water: new AudioChannel(paths.water, true, 0.5),
      toaster: new DetachedAudioChannel(paths.toaster, 0.8),
      drawer: new DetachedAudioChannel(paths.drawer, 0.8),
      door: new DetachedAudioChannel(paths.door, 0.7)
    };
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    for (const key in this.channels) this.channels[key].arm();
  }

  stopAlarm() {
    this.channels.alarm.immediateStop();
  }

  playDoor() {
    this.channels.door.playDetachedOnce();
  }

  setActive(memoryId) {
    if (memoryId === "toaster") {
      this.channels.toaster.playDetachedOnce();
    }
    if (memoryId === "drawer") {
      this.channels.drawer.playDetachedOnce();
    }
  }

  update(started, alarmActive, alarmStopped, fades) {
    if (!this.enabled || !started) return;

    this.channels.alarm.setTarget(alarmActive && !alarmStopped ? 0.72 : 0);
    this.channels.ambient.setTarget(alarmStopped ? 0.12 : 0);
    this.channels.water.setTarget(alarmStopped ? 0.42 * fades.water : 0);

    this.channels.alarm.update(p);
    this.channels.ambient.update(p);
    this.channels.water.update(p);
  }

  reset() {
    for (const key in this.channels) {
      if (this.channels[key].reset) this.channels[key].reset();
    }
    this.enabled = false;
  }
}
}, "scene-2-container");

/* =========================================================
   SCENE 3 — COMMUTE AND DISSOCIATION
========================================================= */

new p5(function (p) {
  let sceneEl3;
  let containerEl3;
  let thoughtEl3;
  let enterOfficeBtnEl3;

  let carX = [];
  let carY = [];
  let carWidth = [];
  let carHeight = [];
  let carSpeed = [];
  let allCarColors = ["#5E607E", "#828DA9", "#2F4B7C", "#714FA5", "#A0A4B8", "#465A80"];
  let oneCarColor = [];

  let slowsDown = false;
  let speedMultiplier = 1;
  let pulse = 0;
  let noteShown = false;
  let officeButtonShown = false;
  let heartLocked = false;
  let slowedAt = 0;

  let trafficLoud = new AudioChannel("sounds/scene3/traffic.mp3", true, 0.8);
  let heartQuiet = new AudioChannel("sounds/scene3/muffledHeartbeat.mp3", true, 0.5);
  let heartLoud = new AudioChannel("sounds/scene3/heartbeat.mp3", true, 0.9);
  let trafficQuiet = new AudioChannel("sounds/scene3/muffledTraffic.mp3", true, 0.4);

  p.setup = function() {
    sceneEl3 = document.getElementById("scene-3");
    containerEl3 = document.getElementById("scene-3-container");
    thoughtEl3 = document.getElementById("scene-3-thought");
    enterOfficeBtnEl3 = document.getElementById("scene-3-enter-office-btn");

    const canvas = p.createCanvas(containerEl3.offsetWidth, containerEl3.offsetHeight);
    canvas.parent("scene-3-container");

    trafficLoud.arm();
    heartQuiet.arm();
    heartLoud.arm();
    trafficQuiet.arm();

    trafficLoud.setTarget(0);
    heartQuiet.setTarget(0);
    trafficQuiet.setTarget(0);
    heartLoud.setTarget(0);

    for (let i = 0; i < 50; i++) {
      carX[i] = p.random(p.width);
      carY[i] = p.random(p.height);
      carWidth[i] = p.random(300, 500);
      carHeight[i] = p.random(4, 12);
      carSpeed[i] = p.random(2, 8);
      oneCarColor[i] = p.random(allCarColors);
    }

    if (enterOfficeBtnEl3) {
      enterOfficeBtnEl3.addEventListener("click", goToScene4);
    }

    resetScene3();
  };

  p.draw = function() {
    p.background("#242A3A");

    trafficLoud.update(p);
    heartQuiet.update(p);
    heartLoud.update(p);
    trafficQuiet.update(p);

    const position = sceneEl3.getBoundingClientRect();
    const isCentered = (position.top < window.innerHeight / 2 && position.bottom > window.innerHeight / 2);

    if (isCentered) {
      if (!slowsDown) {
        trafficLoud.setTarget(0.8);
        heartQuiet.setTarget(0.5);
        trafficQuiet.setTarget(0);
        heartLoud.setTarget(0);
      } else {
        trafficLoud.setTarget(0);
        heartQuiet.setTarget(0);
        trafficQuiet.setTarget(0.4);
        heartLoud.setTarget(0.9);
      }
    } else {
      trafficLoud.setTarget(0);
      heartQuiet.setTarget(0);
      trafficQuiet.setTarget(0);
      heartLoud.setTarget(0);
    }

    speedMultiplier = slowsDown ? 0.1 : 1.0;

    displayCars();
    displayHeart();

    if (slowsDown && !officeButtonShown) {
      const elapsed = p.millis() - slowedAt;
      if (!noteShown) {
        noteShown = true;
        if (thoughtEl3) thoughtEl3.classList.add("active");
      }

      if (elapsed >= 5000) {
        officeButtonShown = true;
        if (enterOfficeBtnEl3) enterOfficeBtnEl3.classList.remove("hidden");
      }
    }
  };

  function displayCars() {
    p.noStroke();
    for (let i = 0; i < 50; i++) {
      p.fill(oneCarColor[i]);
      p.rect(carX[i], carY[i], carWidth[i], carHeight[i], 10);
      carX[i] = carX[i] + (carSpeed[i] * speedMultiplier);

      if (carX[i] > p.width) {
        carX[i] = -carWidth[i];
        carY[i] = p.random(p.height);
      }
    }
  }

  function displayHeart() {
    p.push();
    let pulseSpeed;

    if (slowsDown === true) {
      pulseSpeed = 0.12;
      p.fill("#FF516E");
      p.drawingContext.shadowColor = "#FF516E";
    } else {
      pulseSpeed = 0.04;
      p.fill("#FF8A9E");
      p.drawingContext.shadowColor = "#FF8A9E";
    }

    p.drawingContext.shadowBlur = 25;
    pulse = p.sin(p.frameCount * pulseSpeed) * 15;
    p.ellipse(p.width / 2, p.height / 3, 100 + pulse);
    p.pop();
  }

  function resetScene3() {
    slowsDown = false;
    speedMultiplier = 1;
    pulse = 0;
    noteShown = false;
    officeButtonShown = false;
    heartLocked = false;
    slowedAt = 0;

    if (thoughtEl3) thoughtEl3.classList.remove("active");
    if (enterOfficeBtnEl3) enterOfficeBtnEl3.classList.add("hidden");

    trafficLoud.setTarget(0);
    heartQuiet.setTarget(0);
    trafficQuiet.setTarget(0);
    heartLoud.setTarget(0);
    setScene3ScrollLock(true);
  }

  window.resetScene3Intro = resetScene3;

  function goToScene4() {
    setScene3ScrollLock(false);
    const scene4 = document.getElementById("scene-4");
    if (scene4) {
      scene4.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  p.mousePressed = function() {
    if (!insideCanvas(p) || !isSceneVisible(sceneEl3)) return false;
    if (heartLocked) return false;

    const d = p.dist(p.mouseX, p.mouseY, p.width / 2, p.height / 3);
    if (d > 70) return false;

    slowsDown = true;
    heartLocked = true;
    slowedAt = p.millis();

    trafficLoud.setTarget(0);
    heartQuiet.setTarget(0);
    trafficQuiet.setTarget(0.4);
    heartLoud.setTarget(0.9);

    if (thoughtEl3) thoughtEl3.classList.add("active");
    setScene3ScrollLock(true);

    return false;
  };

  p.windowResized = function() {
    if (!containerEl3) return;
    p.resizeCanvas(containerEl3.offsetWidth, containerEl3.offsetHeight);
  };
}, "scene-3-container");

/* =========================================================
   SCENE 7 — COMING BACK HOME
========================================================= */

new p5(function (p) {
  let sceneEl7;
  let containerEl7;
  let restartBtn7;
  let textEls7 = {};

  let particles7 = [];
  let grass7 = [];

  /*
    Scene 7 state:
    used mainly for timed text appearance.
  */
  let state7 = {
    startedAt: 0,
    textShown: [false, false, false]
  };

  /*
    Scene 7 setup.
  */
  p.setup = function () {
    sceneEl7 = document.getElementById("scene-7");
    containerEl7 = document.getElementById("scene-7-container");
    restartBtn7 = document.getElementById("scene-7-restart-btn");

    textEls7 = {
      one: document.getElementById("scene-7-text-1"),
      two: document.getElementById("scene-7-text-2"),
      three: document.getElementById("scene-7-text-3")
    };

    const canvas = p.createCanvas(containerEl7.offsetWidth, containerEl7.offsetHeight);
    canvas.parent("scene-7-container");

    p.pixelDensity(1);
    p.noStroke();

    initScene7();
    resetScene7();

    if (restartBtn7) {
      restartBtn7.addEventListener("click", restartStoryJourney);
    }
  };

  /*
    Main draw loop for Scene 7.
  */
  p.draw = function () {
    const t = p.millis();
    const elapsed = t - state7.startedAt;
    const sunProgress = p.constrain(elapsed / 10000, 0, 1);

    updateScene7Texts(elapsed);

    drawLandscapeSky(p, t, 0.28 + sunProgress * 0.55);
    drawLandscapeMountains(p, t, 0.28 + sunProgress * 0.55);
    drawScene7Sun(t, sunProgress);

    for (const particle of particles7) {
      particle.display(t, 0.7 + sunProgress * 0.7);
    }

    drawLandscapeMeadow(p, 0.25 + sunProgress * 0.3);

    for (const blade of grass7) {
      blade.display(t, sunProgress, 1.1);
    }

    drawSoftGlow(
      p,
      p.width * 0.18,
      p.height * 0.93,
      p.width * 0.11,
      p.color(255, 248, 240, 10 + 14 * sunProgress),
      3
    );
    drawSoftGlow(
      p,
      p.width * 0.78,
      p.height * 0.91,
      p.width * 0.10,
      p.color(255, 246, 236, 10),
      3
    );
  };

  /*
    Builds Scene 7 visuals.
  */
  function initScene7() {
    particles7 = [];
    grass7 = [];

    for (let i = 0; i < 45; i++) {
      particles7.push(new SimpleParticle(p, p.height * 0.18, p.height * 0.88, 3, 9));
    }

    const bladeCount = Math.max(60, Math.floor(p.width / 18));
    for (let i = 0; i < bladeCount; i++) {
      grass7.push(new SimpleGrassBlade(p, i, bladeCount));
    }
  }

  /*
    Draws the warm sun in Scene 7.
  */
  function drawScene7Sun(t, sunProgress) {
    const x = p.width * 0.76;
    const y = p.height * 0.18;

    drawSoftGlow(
      p,
      x,
      y,
      p.width * (0.07 + sunProgress * 0.03),
      p.color(255, 220, 155, 50 + 45 * sunProgress),
      4
    );
    drawSoftGlow(
      p,
      x,
      y,
      p.width * (0.11 + sunProgress * 0.04),
      p.color(255, 206, 140, 24 + 28 * sunProgress),
      3
    );

    p.push();
    p.translate(x, y);
    p.stroke(255, 223, 168, 16 + 30 * sunProgress);
    p.strokeWeight(1.2);

    for (let i = 0; i < 12; i++) {
      const a = (p.TWO_PI / 12) * i;
      p.line(
        p.cos(a) * 18,
        p.sin(a) * 18,
        p.cos(a) * (30 + 8 * sunProgress),
        p.sin(a) * (30 + 8 * sunProgress)
      );
    }

    p.pop();
  }

  /*
    Resets Scene 7 intro text timing.
  */
  function resetScene7() {
    state7.startedAt = p.millis();
    state7.textShown = [false, false, false];

    for (const key in textEls7) {
      if (textEls7[key]) textEls7[key].classList.remove("active");
    }
  }

  window.resetScene7Intro = resetScene7;

  /*
    Shows Scene 7 text blocks over time.
  */
  function updateScene7Texts(elapsed) {
    if (elapsed >= 3000 && !state7.textShown[0]) {
      state7.textShown[0] = true;
      if (textEls7.one) textEls7.one.classList.add("active");
    }

    if (elapsed >= 6000 && !state7.textShown[1]) {
      state7.textShown[1] = true;
      if (textEls7.two) textEls7.two.classList.add("active");
    }

    if (elapsed >= 9000 && !state7.textShown[2]) {
      state7.textShown[2] = true;
      if (textEls7.three) textEls7.three.classList.add("active");
    }
  }

  /*
    Restarts the entire story journey:
    - Scene 1 reset
    - Scene 2 reset
    - Scene 3 reset
    - Scene 7 reset
    - scroll back to top / Scene 1
  */
  function restartStoryJourney() {
    const appEl = document.getElementById("app");
    const scene1 = document.getElementById("scene-1");

    if (window.resetScene1Story) window.resetScene1Story();
    if (window.resetScene2Story) window.resetScene2Story();
    if (window.resetScene3Intro) window.resetScene3Intro();
    if (window.resetScene7Intro) window.resetScene7Intro();

    if (appEl) {
      appEl.style.overflowY = "hidden";
      appEl.scrollTo({ top: 0, behavior: "smooth" });
    } else if (scene1) {
      scene1.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /*
    Resize handler for Scene 7.
  */
  p.windowResized = function () {
    if (!containerEl7) return;
    p.resizeCanvas(containerEl7.offsetWidth, containerEl7.offsetHeight);
    initScene7();
    resetScene7();
  };
}, "scene-7-container");