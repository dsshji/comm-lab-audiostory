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

let carX = [];

let carY = [];

let carWidth = [];

let carHeight = [];

let carSpeed = [];

let allCarColors = ['#5E607E', '#828DA9', '#2F4B7C', '#714FA5', '#A0A4B8', '#465A80'];

let oneCarColor = []; //stores specifc car's color

let slowsDown = false;

let speedMultiplier = 1;

let pulse = 0;

let hasClickedS3 = false; //used to track when user interacts so another text box can appear



let trafficLoud = new AudioChannel('sounds/scene3/traffic.mp3', true, 0.8);

let heartQuiet = new AudioChannel('sounds/scene3/muffledHeartbeat.mp3', true, 0.5);

let heartLoud = new AudioChannel('sounds/scene3/heartbeat.mp3', true, 0.9);

let trafficQuiet = new AudioChannel('sounds/scene3/muffledTraffic.mp3', true, 0.4);



p.setup = function() {

let container = document.getElementById("scene-3-container");

p.createCanvas(container.offsetWidth, container.offsetHeight);



// "arm" them (loads the file into memory)

trafficLoud.arm();

heartQuiet.arm();

heartLoud.arm();

trafficQuiet.arm();



//stops the sounds from playing during scene 1 and 2!

trafficLoud.setTarget(0);

heartQuiet.setTarget(0);

trafficQuiet.setTarget(0);

heartLoud.setTarget(0);


for(let i=0; i < 50; i++){

carX[i] = p.random(p.width);

carY[i] = p.random(p.height);

carWidth[i] = p.random(300, 500);

carHeight[i] = p.random(4, 12);

carSpeed[i] = p.random(2, 8);

oneCarColor[i] = p.random(allCarColors);

}

};



p.draw = function() {

p.background('#242A3A');



trafficLoud.update(p);

heartQuiet.update(p);

heartLoud.update(p);

trafficQuiet.update(p);



let scene = document.getElementById("scene-3");

let position = scene.getBoundingClientRect();


//checks if the center of the viewport (windowHeight/2) is inside scene 3

let isCentered = (position.top < p.height / 2 && position.bottom > p.height / 2);



if (isCentered) {

if (!slowsDown) {

//normal state sounds

trafficLoud.setTarget(0.8);

heartQuiet.setTarget(0.5);

trafficQuiet.setTarget(0);

heartLoud.setTarget(0);

} else {

//dissociated state sounds (already handled in mousePressed,

trafficLoud.setTarget(0);

heartQuiet.setTarget(0);

trafficQuiet.setTarget(0.4);

heartLoud.setTarget(0.9);

}

} else {

//if we aren't centered on Scene 3, KILL ALL SOUNDS

trafficLoud.setTarget(0);

heartQuiet.setTarget(0);

trafficQuiet.setTarget(0);

heartLoud.setTarget(0);

}



if (slowsDown == true) {

speedMultiplier = 0.1;

} else {

speedMultiplier = 1.0;

}



displayCars();

displayHeart();


};



function displayCars(){

p.noStroke();

for (let i = 0; i < 50; i++) {

p.fill(oneCarColor[i]);

p.rect(carX[i], carY[i], carWidth[i], carHeight[i], 10);

carX[i] = carX[i] + (carSpeed[i] * speedMultiplier); //controls speed of cars



if (carX[i] > p.width) {

carX[i] = -carWidth[i];

carY[i] = p.random(p.height);

}

}

}



function displayHeart() {

p.push();

let pulseSpeed;



if (slowsDown == true) {

pulseSpeed = 0.12;

p.fill('#FF516E');

p.drawingContext.shadowColor = '#FF516E';

}

else {

pulseSpeed = 0.04;

p.fill('#FF8A9E');

p.drawingContext.shadowColor = '#FF8A9E';

}


p.drawingContext.shadowBlur = 25;

pulse = p.sin(p.frameCount * pulseSpeed) * 15;

p.ellipse(p.width/2, p.height/2, 100 + pulse);

p.pop();

}



p.mousePressed = function() {

// checks if the mouse is inside the scene 3 canvas

if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) {

return;

}



// toggle the slowdown state

if (slowsDown === true) {

slowsDown = false;

}

else {

slowsDown = true;

}


//if the world is slowing down, change sounds and swap text

if (slowsDown === true) {



// -- SOUND LOGIC --

trafficLoud.setTarget(0);

heartQuiet.setTarget(0);

trafficQuiet.setTarget(0.4);

heartLoud.setTarget(0.9);


// --TEXT SWAP LOGIC --

let t1 = document.getElementById("s3-text-1");

let t2 = document.getElementById("s3-text-2");



if (t1) {

t1.style.display = "none"; //hide the first box

}

if (t2) {

t2.style.display = "block"; //show the second box

}



// --- TIMER FOR BUTTON ---

setTimeout(function() {

let s3button = document.getElementById("s3-button");

if (s3button) {

s3button.style.display = "block"; //makes the button visible


s3button.onclick = function() {

unlockNextScene();

};

}

}, 4500); // 4.5 seconds delay



} else {

//clicking again "speeds" it back up

trafficLoud.setTarget(0.8);

heartQuiet.setTarget(0.5);

trafficQuiet.setTarget(0);

heartLoud.setTarget(0);

}

};



//unlocks the page and moves

function unlockNextScene() {

let appEl = document.getElementById("app");


if (appEl) {

appEl.style.overflowY = "auto"; //enable scrolling again

}



//find the next scene

let nextScene = document.getElementById("scene-4");


if (nextScene) {

// Wait a tiny bit so the click feels physical, then scroll

setTimeout(function() {

nextScene.scrollIntoView({

behavior: "smooth",

block: "start"

});

}, 500);

}

}



p.windowResized = function() {

let container = document.getElementById("scene-3-container");

if (container) {

p.resizeCanvas(container.offsetWidth, container.offsetHeight);

}

};

}, "scene-3-container");


class AudioOnce { //for audios that do not loop (used in scene 6)

constructor(src, volume = 0.8) {

this.src = src;

this.maxVolume = volume;

this.audio = new Audio(src);

this.audio.loop = false; // FORCE loop to false

this.audio.volume = 0;

this.audio.preload = "auto";

}



arm() {

this.audio.load();

}



update() {



}



play() {

this.audio.volume = this.maxVolume;

this.audio.currentTime = 0; //reset to start in case user clicks fast

this.audio.play().catch(e => console.log("Audio play blocked"));

}


setTarget(v) {

// mutes if the user scrolls away

this.audio.volume = v;

}

}


/* =========================================================
   SCENE 4 & 5
========================================================= */

// Global scroll lock for scenes 4 & 5
let scene45ScrollLocked = false;

function setScene45ScrollLock(locked) {
  scene45ScrollLocked = locked;
  const appEl = document.getElementById("app");
  if (appEl) appEl.style.overflowY = locked ? "hidden" : "auto";
}

window.addEventListener("wheel", function (event) {
  if (!scene45ScrollLocked) return;
  event.preventDefault();
}, { passive: false });

window.addEventListener("touchmove", function (event) {
  if (!scene45ScrollLocked) return;
  event.preventDefault();
}, { passive: false });

window.addEventListener("keydown", function (event) {
  if (!scene45ScrollLocked) return;
  if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) return;
  event.preventDefault();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Easing functions
// ═══════════════════════════════════════════════════════════════════════════════
function easeOut(x) { return 1 - Math.pow(1 - x, 2.8); }
function easeOut2(x) { return 1 - Math.pow(1 - x, 1.5); }
function smoothstep(e0, e1, x) {
  let t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// ═══════════════════════════════════════════════════════════════════════════════
// START p5 INSTANCE FOR SCENES 4 & 5
// ═══════════════════════════════════════════════════════════════════════════════

new p5(function (p) {
  // Scene timing constants
  const SCENE4_DURATION = 40;
  const SCENE5_DURATION = 40;
  
  // Scene 4: Office anxiety state
  let rects = [];
  let extraRects = [];
  let boxLines = [];
  let particles = [];
  let clickCount = 0;
  let mouseSpeed = 0;
  let lastMousePos = { x: 0, y: 0 };
  let anxiety = 1;
  let currentPhase = 'ORDER';
  let freezeFrames = 0;
  let countrysideMoment = false;
  let countrysideAlpha = 0;
  let whooshPlayed = false;
  let pauseStarted = false;

  const PHASES = {
    ORDER:      [0.00, 0.18],
    REPETITION: [0.18, 0.38],
    TREMBLING:  [0.38, 0.55],
    DENSITY:    [0.55, 0.72],
    GLITCH:     [0.72, 0.88],
    PAUSE:      [0.88, 1.00],
  };

  // Color palette
  const C = {
    bg:          [245, 244, 242],
    g1:          [210, 208, 205],
    g2:          [165, 162, 157],
    g3:          [112, 108, 104],
    g4:          [ 60,  57,  54],
    b1:          [185, 200, 212],
    b2:          [130, 152, 168],
    white:       [255, 255, 255],
    red:         [215,  45,  40],
    green:       [100, 185, 120],
    redDark:     [150,  22,  14],
    redLight:    [240,  90,  60],
    dark:        [ 20,  18,  16],
    charcoal:    [ 28,  25,  22],
    softYellow:  [255, 245, 170],
    honeyGlow:   [255, 220, 100],
    warmWhite:   [255, 252, 225],
  };

  // ─── AUDIO ──────────────────────────────────────────────────────────────────
  // Scene 4 looping bg — AudioChannel for lerp-based fade
  let bgScene4 = new AudioChannel('sounds/scene4/demoscene4.mp3', true, 0.55);

  // Scene 5 bg — plain Audio for simplicity (start/stop directly)
  let bgAudio5 = new Audio('sounds/scene5/background_bedroomambience.mp3');
  bgAudio5.loop = true;
  bgAudio5.volume = 0.5;
  bgAudio5.preload = 'auto';

  // One-shot click sounds (scene 4)
  let s4Clicks = [];
  let s4ClickPaths = [
    'sounds/scene4/clockticking.mp3',
    'sounds/scene4/mouseclicks.mp3',
    'sounds/scene4/paperruffle.mp3',
    'sounds/scene4/justtyping.mp3',
    'sounds/scene4/typingwithexhale.mp3',
    'sounds/scene4/officetelephone.mp3'
  ];
  for (let i = 0; i < s4ClickPaths.length; i++) {
    let a = new Audio(s4ClickPaths[i]);
    a.preload = 'auto';
    s4Clicks.push(a);
  }

  // One-shot pack sounds
  let s5Pack = [];
  let s5PackPaths = [
    'sounds/scene5/drawer_openclose.mp3',
    'sounds/scene5/pan_clothes.mp3',
    'sounds/scene5/safebeepopen.mp3',
    'sounds/scene5/pan_drawer_openclose.mp3'
  ];
  for (let i = 0; i < s5PackPaths.length; i++) {
    let a = new Audio(s5PackPaths[i]);
    a.preload = 'auto';
    s5Pack.push(a);
  }

  // Camera shutter whoosh at pause phase
  let s4Whoosh = new Audio('sounds/scene4/camerashutter.mp3');
  s4Whoosh.preload = 'auto';

  function playOneShot(audioEl, vol) {
    audioEl.volume = vol !== undefined ? vol : 0.6;
    audioEl.currentTime = 0;
    audioEl.play().catch(function() {});
  }

  // Scene 5: Packing state
  let scrollX = 0;
  let frameT = 0;
  const SCROLL_SPEED = 1.8;
  const SEGMENTS = 180;
  const LINE_COUNT = 55;

  let lines = [];
  let greenObjects = [];
  let badItems = [];
  let bursts = [];
  let packedCount = 0;
  const TOTAL_PACK = 4;
  let allLinesFinalGreenTriggered = false;
  let scene5Started = false;

  let badItemPopup = null;

  let sceneStartTime = null;
  let currentScene = 4;

  // ─── SCENE 4: BUILD GRID ──────────────────────────────────────────────────
  function buildGrid() {
    let result = [];
    let cols = 10, rows = 7;
    let cW = p.width / cols, cH = p.height / rows;
    
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        let col = p.random() < 0.6
          ? [C.g1, C.g2, C.g3][Math.floor(p.random(3))]
          : [C.b1, C.b2][Math.floor(p.random(2))];
        
        result.push({
          cx: c * cW + cW / 2,
          cy: r * cH + cH / 2,
          w: cW * 1.12,
          h: cH * 1.12,
          col: col,
          noiseX: p.random(1000),
          noiseY: p.random(1000),
          driftX: 0,
          driftY: 0,
          visible: true,
        });
      }
    }
    return result;
  }

  function spawnExtraBlock() {
    let col = p.random() < 0.65
      ? [C.g1, C.g2, C.g3][Math.floor(p.random(3))]
      : [C.b1, C.b2][Math.floor(p.random(2))];
    
    let cW = p.random(40, 140), cH = p.random(30, 100);
    extraRects.push({
      cx: p.random(p.width * 0.05, p.width * 0.95),
      cy: p.random(p.height * 0.05, p.height * 0.95),
      w: cW,
      h: cH,
      col: col,
      noiseX: p.random(1000),
      noiseY: p.random(1000),
      driftX: 0,
      driftY: 0,
    });
  }

  // ─── SCENE 4: PHASES ───────────────────────────────────────────────────────
  function getCurrentPhase(scenePct) {
    if (scenePct < 0.18) return 'ORDER';
    if (scenePct < 0.38) return 'REPETITION';
    if (scenePct < 0.55) return 'TREMBLING';
    if (scenePct < 0.72) return 'DENSITY';
    if (scenePct < 0.88) return 'GLITCH';
    return 'PAUSE';
  }

  function phaseProgress(scenePct, phaseName) {
    let s = PHASES[phaseName][0], e = PHASES[phaseName][1];
    return p.constrain((scenePct - s) / (e - s), 0, 1);
  }

  function triggerEnding() {
    freezeFrames = 45;
    setTimeout(function() {
      countrysideMoment = true;
    }, 800);
  }

  function drawCountrysideMoment() {
    if (!countrysideMoment) return;
    countrysideAlpha = Math.min(countrysideAlpha + 3, 180);
    p.background(255);
    p.noStroke();
    p.rectMode(p.CORNER);
    
    let progress = countrysideAlpha / 180;
    let barThickness = p.lerp(0, p.height * 0.7, progress);
    
    p.fill(C.green[0], C.green[1], C.green[2], p.lerp(0, 255, progress));
    p.rect(0, 0, p.width, barThickness);
    p.rect(0, p.height - barThickness, p.width, barThickness);
    p.rect(0, 0, barThickness, p.height);
    p.rect(p.width - barThickness, 0, barThickness, p.height);
    
    if (progress > 0.95) {
      p.fill(0, 0, 0, p.map(progress, 0.95, 1, 0, 255));
      p.rect(0, 0, p.width, p.height);
    }
    p.rectMode(p.CENTER);
  }

  // ─── SCENE 4: DRAW BLOCKS ──────────────────────────────────────────────────
  function drawBlock(block, dimFactor, driftAmount, jitterAmount, alphaBoost, useGhosts, noiseTime) {
    if (block.visible === false) return;

    let targetX = (p.noise(block.noiseX, noiseTime) - 0.5) * 2 * driftAmount;
    let targetY = (p.noise(block.noiseY, noiseTime + 100) - 0.5) * 2 * driftAmount;

    block.driftX = p.lerp(block.driftX || 0, targetX, 0.04);
    block.driftY = p.lerp(block.driftY || 0, targetY, 0.04);

    let jitterX = jitterAmount > 0 ? p.random(-jitterAmount, jitterAmount) * 0.55 : 0;
    let jitterY = jitterAmount > 0 ? p.random(-jitterAmount, jitterAmount) * 0.55 : 0;

    let x = block.cx + block.driftX + jitterX;
    let y = block.cy + block.driftY + jitterY;
    let alpha = dimFactor * alphaBoost;

    if (useGhosts) {
      let gx = block.cx + block.driftX * 2.1 + jitterX;
      let gy = block.cy + block.driftY * 2.1 + jitterY;
      p.fill(...block.col, 34 * alpha * 0.22);
      p.rect(gx, gy, block.w * 1.14, block.h * 1.14);
      p.fill(...block.col, 63 * alpha * 0.22);
      p.rect(gx, gy, block.w * 0.99, block.h * 0.99);
    }

    let padX = block.w * 0.10;
    let padY = block.h * 0.10;

    p.fill(...block.col, 34 * alpha);
    p.rect(x, y, block.w, block.h);
    p.fill(...block.col, 63 * alpha);
    p.rect(x, y, block.w - padX * 1.5, block.h - padY * 1.5);
    p.fill(...block.col, 100 * alpha);
    p.rect(x, y, block.w - padX * 3, block.h - padY * 3);
  }

  function drawBlocks(scenePct, phase, anxiety = 1) {
    let driftAmount = 0;
    let noiseSpeed = 0.001;
    let jitterAmount = 0;
    let alphaBoost = 1;
    let useGhosts = false;

    let spawnChance = 0;
    if (phase === 'REPETITION') spawnChance = 0.04;
    else if (phase === 'TREMBLING') spawnChance = 0.08;
    else if (phase === 'DENSITY') spawnChance = 0.14;
    else if (phase === 'GLITCH') spawnChance = 0.10;
    if (p.random() < spawnChance) spawnExtraBlock();

    if (phase === 'ORDER') {
      driftAmount = 3;
    } else if (phase === 'REPETITION') {
      let pr = phaseProgress(scenePct, 'REPETITION');
      driftAmount = p.lerp(3, 7, pr);
      alphaBoost = p.lerp(1, 1.10, pr);
    } else if (phase === 'TREMBLING') {
      let pr = phaseProgress(scenePct, 'TREMBLING');
      driftAmount = p.lerp(7, 16, pr);
      noiseSpeed = 0.0014;
      jitterAmount = p.lerp(0, 6, pr);
      alphaBoost = p.lerp(1.10, 1.28, pr);
    } else if (phase === 'DENSITY') {
      let pr = phaseProgress(scenePct, 'DENSITY');
      driftAmount = p.lerp(16, 30, pr);
      noiseSpeed = 0.0020;
      jitterAmount = p.lerp(6, 14, pr);
      alphaBoost = p.lerp(1.28, 1.60, pr);
      useGhosts = true;
    } else if (phase === 'GLITCH') {
      let pr = phaseProgress(scenePct, 'GLITCH');
      driftAmount = p.lerp(30, 46, pr);
      noiseSpeed = 0.0028;
      jitterAmount = p.lerp(14, 26, pr);
      alphaBoost = 1.85;
      useGhosts = true;
    }

    driftAmount *= anxiety;
    jitterAmount *= anxiety;
    alphaBoost *= (1 + (anxiety - 1) * 0.5);

    let noiseTime = p.frameCount * noiseSpeed;

    p.noStroke();
    p.rectMode(p.CENTER);

    for (let block of rects) {
      drawBlock(block, 1, driftAmount, jitterAmount, alphaBoost, useGhosts, noiseTime);
    }
    for (let block of extraRects) {
      drawBlock(block, 0.82, driftAmount, jitterAmount, alphaBoost, useGhosts, noiseTime);
    }
  }

  function manageBoxLines(phase) {
    let chance = 0;
    if (phase === 'REPETITION') chance = 0.022;
    else if (phase === 'TREMBLING') chance = 0.045;
    else if (phase === 'DENSITY') chance = 0.080;
    else if (phase === 'GLITCH') chance = 0.120;
    if (p.random() > chance) return;

    let cx = p.random(p.width * 0.1, p.width * 0.9);
    let cy = p.random(p.height * 0.1, p.height * 0.9);
    let bw = p.random(60, 240);
    let bh = p.random(40, 160);
    let colChoice = p.random();
    let col = colChoice < 0.65 ? C.white : colChoice < 0.88 ? C.red : C.green;
    let layers = phase === 'DENSITY' || phase === 'GLITCH' ? 3 : 2;
    let speed = phase === 'REPETITION' ? p.random(0.004, 0.007)
              : phase === 'TREMBLING' ? p.random(0.006, 0.010)
              : phase === 'DENSITY' ? p.random(0.008, 0.013)
              : p.random(0.010, 0.016);

    for (let k = 0; k < layers; k++) {
      let gap = k * p.random(8, 18);
      boxLines.push({
        cx, cy,
        w: bw + gap * 2,
        h: bh + gap * 2,
        col,
        alpha: p.random(100, 190) * (1 - k * 0.28),
        lineW: k === 0 ? p.random(1, 2) : 1,
        progress: 0,
        speed,
      });
    }
  }

  function drawBoxLines() {
    p.noFill();
    p.strokeJoin(p.MITER);
    p.strokeCap(p.SQUARE);

    for (let b of boxLines) {
      b.progress = Math.min(b.progress + b.speed, 1.12);
      if (b.progress <= 0) continue;
      p.stroke(b.col[0], b.col[1], b.col[2], b.alpha * (1 - Math.max(0, b.progress - 1) / 0.12));
      p.strokeWeight(b.lineW);

      let hw = b.w / 2, hh = b.h / 2;
      let perim = 2 * (b.w + b.h);
      let drawn = perim * p.constrain(b.progress, 0, 1);
      let corners = [
        { x: b.cx - hw, y: b.cy - hh },
        { x: b.cx + hw, y: b.cy - hh },
        { x: b.cx + hw, y: b.cy + hh },
        { x: b.cx - hw, y: b.cy + hh },
      ];
      let sideLens = [b.w, b.h, b.w, b.h];

      p.beginShape();
      p.vertex(corners[0].x, corners[0].y);
      let acc = 0;
      for (let i = 0; i < 4; i++) {
        let sLen = sideLens[i];
        let next = corners[(i + 1) % 4];
        if (acc + sLen <= drawn) {
          p.vertex(next.x, next.y);
          acc += sLen;
        } else {
          let frac = (drawn - acc) / sLen;
          p.vertex(
            p.lerp(corners[i].x, next.x, frac),
            p.lerp(corners[i].y, next.y, frac)
          );
          break;
        }
      }
      p.endShape();
    }
    boxLines = boxLines.filter(b => b.progress < 1.12);
  }

  function manageParticles(phase, anxiety = 1) {
    let rate = phase === 'GLITCH' ? 12 : 5;
    rate = Math.floor(rate * anxiety);
    
    for (let i = 0; i < rate; i++) {
      let col = p.random() < 0.68
        ? [C.g2, C.g3, C.g4][Math.floor(p.random(3))]
        : [C.b1, C.b2][Math.floor(p.random(2))];
      
      particles.push({
        x: p.random(p.width),
        y: p.random(p.height),
        vx: p.random(-1.2, 1.2),
        vy: p.random(-0.3, -2.0),
        size: p.random(1.2, 4.5),
        col: col,
        alpha: p.random(28, 95),
        life: 1,
      });
    }
    
    for (let p_particle of particles) {
      p_particle.x += p_particle.vx;
      p_particle.y += p_particle.vy;
      p_particle.life -= 0.010;
    }
    
    particles = particles.filter(p_particle => p_particle.life > 0);
  }

  function drawParticles() {
    p.noStroke();
    p.rectMode(p.CORNER);
    for (let p_particle of particles) {
      p.fill(...p_particle.col, p_particle.alpha * p_particle.life);
      p.rect(p_particle.x, p_particle.y, p_particle.size, p_particle.size);
    }
    p.rectMode(p.CENTER);
  }

  function drawGlitch(t) {
    let gP = phaseProgress(t, 'GLITCH');
    p.noStroke();
    p.rectMode(p.CORNER);
    
    for (let i = 0; i < Math.floor(p.lerp(1, 10, gP)); i++) {
      let y = p.random(p.height), h = p.random(1, 7), offset = p.random(-65, 65);
      p.fill(...[C.g1, C.g2, C.white][Math.floor(p.random(3))], p.random(20, 110) * gP);
      p.rect(0, y, p.width, h);
    }
    
    if (gP > 0.45 && p.random() < p.map(gP, 0.45, 1, 0, 0.12)) {
      p.stroke(...C.red, 38 * gP);
      p.strokeWeight(p.random(1, 2));
      let x = p.random(p.width);
      p.line(x, 0, x + p.random(-14, 14), p.height);
    }
    p.rectMode(p.CENTER);
  }

  function drawVignette(t, phase) {
    let strength;
    if (phase === 'ORDER' || phase === 'REPETITION') return;
    if (phase === 'TREMBLING') strength = p.lerp(0, 55, phaseProgress(t, 'TREMBLING'));
    if (phase === 'DENSITY')   strength = p.lerp(55, 130, phaseProgress(t, 'DENSITY'));
    if (phase === 'GLITCH')    strength = p.lerp(130, 175, phaseProgress(t, 'GLITCH'));
    if (!strength) return;

    p.noStroke();
    p.rectMode(p.CORNER);
    for (let i = 0; i < 8; i++) {
      let m = i * 16, a = p.map(i, 0, 7, strength, 0);
      p.fill(28, 26, 24, a);
      p.rect(0, 0, p.width, m);
      p.rect(0, p.height - m, p.width, m);
      p.rect(0, 0, m, p.height);
      p.rect(p.width - m, 0, m, p.height);
    }
    p.rectMode(p.CENTER);
  }

  /* function drawBreathingPressure(t, phase) {
    let pr = phase === 'DENSITY' ? phaseProgress(t, 'DENSITY') : 1;
    let breathSpeed = p.lerp(0.018, 0.045, pr);
    let breath = Math.sin(p.frameCount * breathSpeed) * 0.5 + 0.5;
    let baseR = p.lerp(p.width * 0.55, p.width * 0.75, pr);
    let r = baseR + breath * p.lerp(20, 60, pr);
    let a = p.lerp(8, 22, pr) * (0.6 + 0.4 * breath);

    p.noStroke();
    p.fill(28, 26, 24, a);
    p.ellipse(p.width / 2, p.height / 2, r * 2, r * 2);
  } */

  function drawPause(t) {
    let pr = phaseProgress(t, 'PAUSE');

    if (pr < 0.02 && !whooshPlayed) {
      whooshPlayed = true;
      playOneShot(s4Whoosh, 0.8);
    }

    if (pr < 0.18) {
      let fP = p.map(pr, 0.00, 0.18, 0, 1);
      let eased = fP < 0.5 ? 2 * fP * fP : 1 - Math.pow(-2 * fP + 2, 2) / 2;

      p.background(...C.bg);
      p.noStroke();
      let bloomR = p.lerp(0, p.width * 1.1, eased);
      p.fill(255, 255, 255, (1 - eased) * 140);
      p.ellipse(p.width / 2, p.height / 2, bloomR * 2.6);
      p.fill(255, 255, 255, eased * 255);
      p.ellipse(p.width / 2, p.height / 2, bloomR * 2);
      p.rectMode(p.CORNER);
      p.fill(255, 255, 255, Math.pow(eased, 1.6) * 245);
      p.rect(0, 0, p.width, p.height);
      p.rectMode(p.CENTER);
    }
  }

  // Draw contextual text label at the bottom of scene 4
  function drawScene4Text(phase) {
    let txt = '';
    if (phase === 'ORDER' || phase === 'REPETITION') {
      txt = "Back in office. Everything should be perfect.";
    } else if (phase === 'TREMBLING' || phase === 'DENSITY' || phase === 'GLITCH') {
      txt = "But it's so hard to keep it up...";
    }
    if (!txt) return;

    p.push();
    p.noStroke();
    p.rectMode(p.CENTER);
    p.textSize(13);
    p.textAlign(p.CENTER, p.CENTER);
    let boxW = p.textWidth(txt) + 28;
    p.fill(248, 246, 242, 170);
    p.rect(p.width / 2, p.height - 40, boxW, 28, 999);
    p.fill(30, 28, 24, 215);
    p.text(txt, p.width / 2, p.height - 39);
    p.pop();
  }

  function scene4_mousePressed() {
    clickCount++;
    for (let i = 0; i < p.random(3, 8); i++) spawnExtraBlock();
    // louder clicks during glitch phase
    let clickVol = currentPhase === 'GLITCH' ? 0.75 : 0.5;
    playOneShot(s4Clicks[Math.floor(p.random(s4Clicks.length))], clickVol);
  }

  function scene4_mouseDragged() {
    // drag only spawns extra blocks; particles removed for performance
  }

  // ─── SCENE 5 HELPERS ───────────────────────────────────────────────────────
  function range(a, b) {
    let r = [];
    for (let i = a; i <= b; i++) r.push(i);
    return r;
  }

  function lerpCol(a, b, t) {
    return [p.lerp(a[0], b[0], t), p.lerp(a[1], b[1], t), p.lerp(a[2], b[2], t)];
  }

  // ─── SCENE 5: BUILD LINES ──────────────────────────────────────────────────
  function buildLines() {
    lines = [];
    for (let i = 0; i < LINE_COUNT; i++) {
      lines.push({
        id: i,
        yBase: p.map(i, 0, LINE_COUNT - 1, p.height * 0.04, p.height * 0.96),
        nSeed: p.random(2000),
        wobble: p.random(16, 40),
        wobbleTarget: p.random(16, 40),
        weight: p.random(1.2, 3.4),
        weightTarget: p.random(1.2, 3.4),
        greenness: 0,
        greennessTarget: 0,
        alpha: p.random(160, 240),
      });
    }
  }

  function getBandY(lineIds) {
    let sum = 0;
    for (let i = 0; i < lineIds.length; i++) {
      let id = lineIds[i];
      sum += lines[id] ? lines[id].yBase : p.height / 2;
    }
    return sum / lineIds.length;
  }

  function scheduleGreenObjects() {
    greenObjects = [
      { shape: 'circle',  spawnTime: 3,  r: 30, linesOwned: range(0, 10),  packed: false, scale: 0, glowPhase: 0,                x: 0, y: 0, spawnScrollX: null },
      { shape: 'diamond', spawnTime: 12, r: 34, linesOwned: range(41, 54), packed: false, scale: 0, glowPhase: p.random(p.TWO_PI), x: 0, y: 0, spawnScrollX: null },
      { shape: 'square',  spawnTime: 21, r: 32, linesOwned: range(18, 32), packed: false, scale: 0, glowPhase: p.random(p.TWO_PI), x: 0, y: 0, spawnScrollX: null },
      { shape: 'circle',  spawnTime: 30, r: 28, linesOwned: range(11, 17), packed: false, scale: 0, glowPhase: p.random(p.TWO_PI), x: 0, y: 0, spawnScrollX: null },
    ];
    for (let i = 0; i < greenObjects.length; i++) {
      greenObjects[i].y = getBandY(greenObjects[i].linesOwned);
    }
  }

  function scheduleBadItems() {
    badItems = [
      { shape: 'square', spawnTime: 5,  y: p.height * 0.32, x: 0, alpha: 0, soundPlayed: false, popup: "I don't need this with me." },
      { shape: 'square', spawnTime: 15, y: p.height * 0.60, x: 0, alpha: 0, soundPlayed: false, popup: "I'll leave it behind." },
      { shape: 'square', spawnTime: 24, y: p.height * 0.45, x: 0, alpha: 0, soundPlayed: false, popup: "This stays here." },
      { shape: 'square', spawnTime: 34, y: p.height * 0.78, x: 0, alpha: 0, soundPlayed: false, popup: "I can let this go." },
    ];
  }

  function updateLines() {
    for (let i = 0; i < lines.length; i++) {
      lines[i].greenness = p.lerp(lines[i].greenness, lines[i].greennessTarget, 0.025);
      lines[i].wobble    = p.lerp(lines[i].wobble, lines[i].wobbleTarget, 0.018);
      lines[i].weight    = p.lerp(lines[i].weight, lines[i].weightTarget, 0.018);
    }
  }

  function drawLines() {
    let segW = (p.width + 240) / SEGMENTS;
    p.noFill();

    for (let i = 0; i < lines.length; i++) {
      let l = lines[i];
      let g = easeOut2(l.greenness);
      let col = lerpCol(C.red, C.green, g);

      if (g < 0.5) {
        p.stroke(C.redDark[0], C.redDark[1], C.redDark[2], l.alpha * 0.40 * (1 - g));
        p.strokeWeight(l.weight * 2.0);
        p.strokeCap(p.ROUND);
        drawOneLine(l, segW, 1.18, 0.0012);
        p.stroke(C.redLight[0], C.redLight[1], C.redLight[2], l.alpha * 0.70 * (1 - g));
        p.strokeWeight(l.weight * 0.7);
        drawOneLine(l, segW, 0.5, 0.0);
      }

      p.stroke(col[0], col[1], col[2], l.alpha);
      p.strokeWeight(p.lerp(l.weight, 0.7, g));
      drawOneLine(l, segW, 1.0, 0.0);
    }
    p.noStroke();
  }

  function drawOneLine(l, segW, wobbleScale, timeOffset) {
    let timeComponent = p.frameCount * 0.008 + timeOffset * p.frameCount;
    p.beginShape();
    for (let s = 0; s <= SEGMENTS; s++) {
      let x = -120 + s * segW;
      let nx = (x + scrollX) * 0.0035 + l.nSeed;
      let ny = timeComponent + l.nSeed * 0.3;
      let wobbleY = (p.noise(nx, ny) - 0.5) * 2 * l.wobble * wobbleScale;
      p.vertex(x, l.yBase + wobbleY);
    }
    p.endShape();
  }


  function drawRedObject(obj, alpha) {
    p.push();
    p.rectMode(p.CENTER);
    p.noStroke();
    
    let size = 50;
    let col = lerpCol([255, 180, 150], [230, 110, 85], frameT);
    
    p.fill(col[0], col[1], col[2], alpha * 0.34);
    p.rect(0, 0, size * 1.2, size * 1.2, 4);
    p.fill(col[0], col[1], col[2], alpha * 0.65);
    p.rect(0, 0, size * 0.85, size * 0.85, 3);
    p.fill(col[0], col[1], col[2], alpha);
    p.rect(0, 0, size * 0.5, size * 0.5, 2);
    
    p.pop();
  }

  function updateAndDrawBadItems() {
    for (let i = 0; i < badItems.length; i++) {
      let item = badItems[i];
      let screenX = (item.spawnTime * 45 - scrollX) + p.width * 0.8;
      if (screenX > p.width + 80 || screenX < -140) continue;

      item.x = screenX;
      item.alpha = p.constrain(
        p.map(screenX, p.width * 0.85, p.width * 0.6, 0, 160),
        0,
        p.constrain(p.map(screenX, 80, -100, 160, 0), 0, 160)
      );

      if (item.alpha <= 1) continue;

      p.push();
      p.translate(item.x, item.y);
      drawRedObject(item, item.alpha);
      p.pop();
    }
  }

  function drawShapeAt(shapeType, r, size) {
    if (shapeType === 'circle') {
      p.ellipse(0, 0, size * 2, size * 2);
    } else if (shapeType === 'diamond') {
      p.beginShape();
      p.vertex(0, -size * 1.15);
      p.vertex(size * 0.8, 0);
      p.vertex(0, size * 1.15);
      p.vertex(-size * 0.8, 0);
      p.endShape(p.CLOSE);
    } else if (shapeType === 'square') {
      p.rectMode(p.CENTER);
      p.rect(0, 0, size * 1.8, size * 1.8, size * 0.18);
    }
  }

  function drawGreenObject(obj) {
    let s = easeOut(obj.scale);
    if (s < 0.02) return;

    let glow = Math.sin(obj.glowPhase) * 0.5 + 0.5;

    p.push();
    p.translate(obj.x, obj.y);
    p.scale(s);

    if (!obj.packed) {
      p.noStroke();
      let glowR = obj.r * p.lerp(2.4, 3.8, glow);
      p.fill(C.softYellow[0], C.softYellow[1], C.softYellow[2], 55);
      drawShapeAt(obj.shape, obj.r, glowR);
      p.fill(C.softYellow[0], C.softYellow[1], C.softYellow[2], 120);
      drawShapeAt(obj.shape, obj.r, glowR * 0.65);
      p.fill(C.warmWhite[0], C.warmWhite[1], C.warmWhite[2], 240);
      drawShapeAt(obj.shape, obj.r, obj.r * 1.02);
      p.stroke(C.softYellow[0], C.softYellow[1], C.softYellow[2], 200);
      p.strokeWeight(2.2);
      p.noFill();
      drawShapeAt(obj.shape, obj.r, obj.r * 1.06);
    } else {
      p.noStroke();
      p.fill(240, 230, 150, 100);
      drawShapeAt(obj.shape, obj.r, obj.r * 1.05);
      p.stroke(C.softYellow[0], C.softYellow[1], C.softYellow[2], 210);
      p.strokeWeight(3.0);
      p.noFill();
      let cs = obj.r * 0.52;
      p.line(-cs, 0, -cs * 0.18, cs * 0.85);
      p.line(-cs * 0.18, cs * 0.85, cs * 1.2, -cs * 0.7);
    }
    
    p.pop();
  }

  function updateAndDrawGreenObjects() {
    let currentTime = frameT * SCENE5_DURATION;
    
    for (let i = 0; i < greenObjects.length; i++) {
      let obj = greenObjects[i];
      if (currentTime < obj.spawnTime) continue;
      
      // record scrollX at first activation so later objects appear at the right edge
      if (obj.spawnScrollX === null) obj.spawnScrollX = scrollX;
      let screenX = p.width * 0.8 + (currentTime - obj.spawnTime) * 45 - (scrollX - obj.spawnScrollX);
      
      if (screenX > p.width + obj.r * 3) continue;
      
      obj.x = screenX;
      obj.glowPhase += 0.045;
      
      if (!obj.packed) {
        obj.scale = Math.min(obj.scale + 0.045, 1);
      } else if (screenX < -obj.r * 5) {
        continue;
      }
      
      drawGreenObject(obj);
    }
  }

  function packObject(objIndex) {
    let obj = greenObjects[objIndex];
    obj.packed = true;
    packedCount++;

    // turn the lines this object owns green
    for (let k = 0; k < obj.linesOwned.length; k++) {
      let id = obj.linesOwned[k];
      if (id >= lines.length) continue;
      lines[id].greennessTarget = 1;
      lines[id].wobbleTarget = 0;
      lines[id].weightTarget = 0.7;
    }

    // spawn a burst of particles
    for (let i = 0; i < 50; i++) {
      let angle = p.random(p.TWO_PI);
      let spd = p.random(3.5, 12);
      bursts.push({
        x: obj.x, y: obj.y,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        life: 1, decay: p.random(0.010, 0.020),
        r: p.random(3, 8.5),
        col: p.random() < 0.6 ? C.softYellow : C.honeyGlow,
      });
    }

    // play the matching pack sound
    if (objIndex < s5Pack.length) playOneShot(s5Pack[objIndex], 0.7);
  }

  function updateAndDrawBursts() {
    p.noStroke();
    let alive = [];
    for (let i = 0; i < bursts.length; i++) {
      let b = bursts[i];
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= 0.90;
      b.vy *= 0.90;
      b.life -= b.decay;
      if (b.life <= 0) continue;
      p.fill(b.col[0], b.col[1], b.col[2], b.life * 230);
      p.ellipse(b.x, b.y, b.r * 2.2 * b.life);
      alive.push(b);
    }
    bursts = alive;
  }

  function drawPackingPrompt() {
    let prompts = [
      "Should I take these books?",
      "I probably need to pack clothes as well.",
      "Wait, I can't forget my documents...",
      "Do I need this thing with me?.."
    ];
    let prompt = prompts[packedCount] || "everything packed?";

    p.push();
    p.noStroke();
    p.rectMode(p.CENTER);
    p.textSize(13);
    p.textAlign(p.CENTER, p.CENTER);
    let boxW = p.textWidth(prompt) + 28;
    p.fill(248, 246, 242, 170);
    p.rect(p.width / 2, p.height - 40, boxW, 28, 999);
    p.fill(30, 28, 24, 215);
    p.text(prompt, p.width / 2, p.height - 39);
    p.pop();
  }

  function drawBadItemPopup() {
    if (!badItemPopup) return;
    badItemPopup.timer--;
    if (badItemPopup.timer <= 0) {
      badItemPopup.alpha = p.lerp(badItemPopup.alpha, 0, 0.12);
      if (badItemPopup.alpha < 2) { badItemPopup = null; return; }
    }
    p.push();
    p.rectMode(p.CENTER);
    p.noStroke();
    p.textSize(13);
    p.textAlign(p.CENTER, p.CENTER);
    let boxW = p.textWidth(badItemPopup.text) + 28;
    p.fill(248, 246, 242, badItemPopup.alpha * 0.85);
    p.rect(badItemPopup.x, badItemPopup.y, boxW, 28, 999);
    p.fill(30, 28, 24, badItemPopup.alpha);
    p.text(badItemPopup.text, badItemPopup.x, badItemPopup.y + 1);
    p.pop();
  }

  function scene5_mousePressed() {
    // check red bad items first
    for (let i = 0; i < badItems.length; i++) {
      let item = badItems[i];
      if (item.alpha <= 1) continue;
      if (p.dist(p.mouseX, p.mouseY, item.x, item.y) < 35) {
        badItemPopup = { text: item.popup, x: item.x, y: item.y - 50, alpha: 255, timer: 45 };
        return;
      }
    }

    // check green pack objects
    let currentTime = frameT * SCENE5_DURATION;
    for (let i = 0; i < greenObjects.length; i++) {
      let obj = greenObjects[i];
      if (obj.packed || currentTime < obj.spawnTime) continue;
      if (p.dist(p.mouseX, p.mouseY, obj.x, obj.y) < obj.r * 1.6 * easeOut(obj.scale)) {
        packObject(i);
        return;
      }
    }
  }

  // ─── p5 SETUP & DRAW ────────────────────────────────────────────────────────
  p.setup = function() {
    let containerEl = document.getElementById("scene-4-container");
    let w = containerEl ? containerEl.offsetWidth : p.windowWidth;
    let h = containerEl ? containerEl.offsetHeight : p.windowHeight;
    p.createCanvas(w, h);
    p.colorMode(p.RGB, 255);
    p.frameRate(60);
    p.pixelDensity(1);

    rects = buildGrid();
    extraRects = [];
    buildLines();
    scheduleGreenObjects();
    scheduleBadItems();

    setScene45ScrollLock(true);
  };

  p.draw = function() {
    // Don't start counting until scene-4-container is actually centred on screen
    if (sceneStartTime === null) {
      let containerEl = document.getElementById("scene-4-container");
      if (!containerEl) return;
      let rect = containerEl.getBoundingClientRect();
      let centred = rect.top < p.windowHeight / 2 && rect.bottom > p.windowHeight / 2;
      if (!centred) return;
      sceneStartTime = p.millis() / 1000;
    }

    let elapsed = p.millis() / 1000 - sceneStartTime;

    // Set audio targets BEFORE update so changes take effect this frame
    if (elapsed < SCENE4_DURATION) {
      let tempPct = p.constrain(elapsed / SCENE4_DURATION, 0, 1);
      let tempPhase = getCurrentPhase(tempPct);
      if (tempPhase !== 'PAUSE' && !countrysideMoment) {
        // louder during GLITCH phase
        bgScene4.setTarget(tempPhase === 'GLITCH' ? 0.75 : 0.55);
      } else {
        bgScene4.setTarget(0);
      }
    } else {
      bgScene4.setTarget(0);
    }
    bgScene4.update(p);

    // SCENE 4
    if (elapsed < SCENE4_DURATION) {
      currentScene = 4;
      let scenePct = p.constrain(elapsed / SCENE4_DURATION, 0, 1);
      currentPhase = getCurrentPhase(scenePct);

      if (freezeFrames > 0) {
        freezeFrames--;
        return;
      }

      if (countrysideMoment) {
        bgScene4.setTarget(0);
        drawCountrysideMoment();
        return;
      }

      mouseSpeed = p.dist(p.mouseX, p.mouseY, lastMousePos.x, lastMousePos.y);
      lastMousePos = { x: p.mouseX, y: p.mouseY };

      let speedAnxiety = p.map(Math.min(mouseSpeed, 50), 0, 50, 1, 1.8);
      let clickAnxiety = p.map(Math.min(clickCount, 20), 0, 20, 1, 1.5);
      anxiety = speedAnxiety * clickAnxiety;
      anxiety = p.constrain(anxiety, 0.8, 2.0);

      if (currentPhase === 'PAUSE' && freezeFrames === 0 && !countrysideMoment) {
        // immediately cut all scene 4 sounds
        if (!pauseStarted) {
          pauseStarted = true;
          bgScene4.immediateStop();
          for (let i = 0; i < s4Clicks.length; i++) {
            s4Clicks[i].pause();
            s4Clicks[i].currentTime = 0;
          }
        }
        triggerEnding();
        drawPause(scenePct);
        return;
      }

      if (currentPhase !== 'PAUSE') {
        bgScene4.setTarget(currentPhase === 'GLITCH' ? 0.75 : 0.55);
        p.background(...C.bg);
        drawBlocks(scenePct, currentPhase, anxiety);
        drawBoxLines();
        if (currentPhase !== 'ORDER') manageBoxLines(currentPhase);
        if (currentPhase === 'DENSITY' || currentPhase === 'GLITCH') {
          manageParticles(currentPhase, anxiety);
          drawParticles();
        }
        if (currentPhase === 'GLITCH') drawGlitch(scenePct);
        drawVignette(scenePct, currentPhase);
        /* if (currentPhase === 'DENSITY' || currentPhase === 'GLITCH') {
          drawBreathingPressure(scenePct, currentPhase);
        } */
        drawScene4Text(currentPhase);
      }
    }
    // SCENE 5
    else {
      currentScene = 5;
      bgScene4.setTarget(0);

      // on first scene 5 frame: stop scene 4 sounds, start scene 5 bg
      if (!scene5Started) {
        scene5Started = true;
        for (let i = 0; i < s4Clicks.length; i++) {
          s4Clicks[i].pause();
          s4Clicks[i].currentTime = 0;
        }
        s4Whoosh.pause();
        s4Whoosh.currentTime = 0;
        bgAudio5.play().catch(function() {});
      }

      let sceneElapsed = elapsed - SCENE4_DURATION;
      frameT = p.constrain(sceneElapsed / SCENE5_DURATION, 0, 1);
      scrollX += p.lerp(SCROLL_SPEED, SCROLL_SPEED * 0.55, smoothstep(0.88, 1.0, frameT));

      let bg = lerpCol(C.charcoal, [255, 255, 225], easeOut2(frameT));
      p.background(...bg);

      updateLines();
      drawLines();
      updateAndDrawBadItems();
      drawBadItemPopup();
      updateAndDrawGreenObjects();
      updateAndDrawBursts();
      drawPackingPrompt();

      if ((frameT >= 0.98 || packedCount === TOTAL_PACK) && !allLinesFinalGreenTriggered) {
        allLinesFinalGreenTriggered = true;
        for (let i = 0; i < lines.length; i++) {
          lines[i].greennessTarget = 1;
          lines[i].wobbleTarget = 0;
          lines[i].weightTarget = 0.7;
        }
      }

      if (packedCount === TOTAL_PACK && frameT > 0.5) {
        let pulse = Math.sin(p.frameCount * 0.05) * 0.08 + 0.92;
        let rtg = "READY TO GO";
        p.push();
        p.noStroke();
        p.rectMode(p.CENTER);
        p.textSize(24);
        p.textAlign(p.CENTER, p.CENTER);
        let rtgW = p.textWidth(rtg) + 36;
        p.fill(248, 246, 242, 170 * pulse);
        p.rect(p.width / 2, p.height / 2, rtgW, 42, 999);
        p.fill(30, 28, 24, 215 * pulse);
        p.text(rtg, p.width / 2, p.height / 2 + 1);
        p.pop();
      }
      
      // Unlock scroll and move to scene 6
      if (frameT >= 1.0) {
        bgAudio5.pause();
        bgAudio5.currentTime = 0;
        setScene45ScrollLock(false);
        setTimeout(function() {
          let scene6 = document.getElementById("scene-6");
          if (scene6) scene6.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 500);
      }
    }
  };

  p.mousePressed = function() {
    if (sceneStartTime === null) return;
    if (currentScene === 4) {
      scene4_mousePressed();
    } else if (currentScene === 5) {
      scene5_mousePressed();
    }
  };

  p.mouseDragged = function() {
    if (sceneStartTime === null) return;
    if (currentScene === 4) {
      scene4_mouseDragged();
    }
  };

  p.windowResized = function() {
    let containerEl = document.getElementById("scene-4-container");
    if (!containerEl) return;
    p.resizeCanvas(containerEl.offsetWidth, containerEl.offsetHeight);
    rects = buildGrid();
  };

}, "scene-4-container");



/* =========================================================

SCENE 6 — THE TRAIN STATION

========================================================= */



new p5(function (p) {

let scene6State = 1;

let ticketY = 0; //ticket moves down after click

let hasStamped = false; //checks if ticket is stamped

let stampTime = 0;

let activeDot = 0; //tracks the stops on trainline (what dot (destination) is lit up)

let lastDotChange = 0; //stores time when train ride starts



//sounds/audios

let stationAmbience = new AudioChannel('sounds/scene6/stationAmbience.mp3', true, 0.5);

let trainRide = new AudioChannel('sounds/scene6/pan_trainstopping.mp3', true, 0.8);


//preloaded sounds for sounds that play once

let stampClick;

let rollingSuitcase;



p.setup = function() {

let container = document.getElementById("scene-6-container");

p.createCanvas(container.offsetWidth, container.offsetHeight);



//prevents looping for soudns played once (AudioOnce class)

stampClick = new AudioOnce('sounds/scene6/ticketvalidationstamp.mp3', 1.0);

rollingSuitcase = new AudioOnce('sounds/scene6/rollingSuitcase.mp3', 0.6);



//arm the audio channels

stationAmbience.arm();

trainRide.arm();

stampClick.arm();

rollingSuitcase.arm();



//ensure everything is quiet until we are centered on the scene so they dont overlap

stationAmbience.setTarget(0);

trainRide.setTarget(0);

};



p.draw = function() {

p.background('#a3a49f');



//update the audio channels every frame

stationAmbience.update(p);

trainRide.update(p);



let scene = document.getElementById("scene-6");

let position = scene.getBoundingClientRect();


//checks if scene 6 is currently in view

let isCentered = (position.top < p.windowHeight / 2 && position.bottom > p.windowHeight / 2);



if (isCentered) {

if (scene6State === 1) {

stationAmbience.setTarget(0.5);

trainRide.setTarget(0);

stationBackground();

displayTicket();

}

else if (scene6State === 2) {

stationAmbience.setTarget(0);

trainRide.setTarget(0.8);

trainInterior();

updateMapProgress();

}

}

else {

// kill sounds if user scrolls away

stationAmbience.setTarget(0);

trainRide.setTarget(0);

}

};



function stationBackground() {

p.push();

p.rectMode(p.CORNER);


//wall of train station

p.fill('#BCBCBC');

p.noStroke();

p.rect(0, 0, p.width, p.height);


//entrance of station (Sized down more)

p.fill(80);

let entranceWidth = p.width * 0.6;

let entranceX = (p.width - entranceWidth) / 2;

p.rect(entranceX, p.height * 0.35, entranceWidth, p.height * 0.65);


//sign at the top

p.fill('#444B53');

p.rect(0, 0, p.width * 1.2, 50);


//text in sign that says "train station"

p.fill(255);

p.textAlign(p.CENTER, p.CENTER);

p.textFont('Arial');

p.textSize(20);

p.text("TRAIN STATION", p.width / 2, 25);


p.pop();

} //end of stationBackground



function trainInterior() {

p.push();

p.fill('#E5E5E5');

p.noStroke();

p.rect(0, 0, p.width, p.height);



let doorHeight = 350;

let doorWidth = 140;

let doorOffset = 75;


// train doors

if (activeDot === 3) {

p.drawingContext.shadowBlur = 60;

p.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.8)';

p.fill('#b6b2b2'); //door lighter color when destination reached

p.stroke(255);

p.strokeWeight(2);

} else {

p.fill('#7d838a'); //door color

p.noStroke();

}


p.rectMode(p.CENTER);

//main door panels

p.rect(p.width/2 - doorOffset, p.height/2 + 60, doorWidth, doorHeight, 5);

p.rect(p.width/2 + doorOffset, p.height/2 + 60, doorWidth, doorHeight, 5);


p.drawingContext.shadowBlur = 0;

p.fill('#A8DADC');

p.noStroke();

//windows centered on the door panels

p.rect(p.width/2 - doorOffset, p.height/2 + 30, 90, 140, 15);

p.rect(p.width/2 + doorOffset, p.height/2 + 30, 90, 140, 15);



//TRAIN LINE MAP

let mapY = p.height * 0.15;

p.fill(255);

p.rect(p.width/2, mapY, 280, 30, 5);


p.stroke('#BDBDBD');

p.strokeWeight(2);

let startX = p.width/2 - 100;

let endX = p.width/2 + 100;

p.line(startX, mapY, endX, mapY);



p.noStroke();

for (let i = 0; i < 4; i++) {

let x = p.map(i, 0, 3, startX, endX);

if (i === activeDot) {

p.fill('#FF516E');

p.ellipse(x, mapY, 12);

} else {

p.fill('#BDBDBD');

p.ellipse(x, mapY, 8);

}

}

p.pop();

} //end of trainInterior



function displayTicket() {

p.push();

p.translate(p.width / 2, p.height / 2 + ticketY);


p.fill('#A8DADC');

p.stroke(255, 100);

p.strokeWeight(2);

p.rectMode(p.CENTER);

p.rect(0, 0, 300, 180, 10);



p.fill(40);

p.noStroke();

p.textAlign(p.LEFT);

p.textFont('Courier New');

p.textSize(16);

p.text("RAIL PASS", -130, -50);

p.textSize(9);

p.text("ADULT STANDARD CLASS", -130, -38);

p.textSize(10);

p.text("YEAR-MONTH-DAY", -130, 25);

p.textSize(18);

p.text("2026 . 04 . 08", -130, 48);



p.noFill();

p.stroke(40);

p.strokeWeight(1);

p.drawingContext.setLineDash([6, 4]);

p.ellipse(90, 40, 60);

p.drawingContext.setLineDash([]);



if (hasStamped === true) {

p.fill('rgba(255, 60, 60, 0.7)');

p.noStroke();

p.ellipse(90, 40, 55);

p.fill(150, 0, 0);

p.textAlign(p.CENTER);

p.textSize(10);

p.text("VALIDATED", 90, 44);


let currentTime = p.millis();

if (currentTime - stampTime > 1500) {

ticketY += 20;

}


if (ticketY > p.height) {

scene6State = 2;

lastDotChange = p.millis();

}

}

p.pop();

}



function updateMapProgress() {

let elapsed = (p.millis() - lastDotChange) / 1000;

if (elapsed < 11) activeDot = 0;

else if (elapsed < 16) activeDot = 1;

else if (elapsed < 22) activeDot = 2;

else activeDot = 3;

}



p.mousePressed = function() {

if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;



if (scene6State === 1 && hasStamped === false) {

let stampX = p.width / 2 + 90;

let stampY = p.height / 2 + 40;


if (p.dist(p.mouseX, p.mouseY, stampX, stampY) < 30) {

hasStamped = true;

stampTime = p.millis();



if (stampClick) stampClick.play();

if (rollingSuitcase) rollingSuitcase.play();

}

}


if (scene6State === 2 && activeDot === 3) {

if (p.dist(p.mouseX, p.mouseY, p.width/2, p.height/2 + 60) < 100) {

unlockNextScene();

}

}

};



function unlockNextScene() {

const appEl = document.getElementById("app");

if (appEl) appEl.style.overflowY = "auto";

if (window.resetScene7Intro) window.resetScene7Intro();



const nextScene = document.getElementById("scene-7");

if (nextScene) {

setTimeout(() => {

nextScene.scrollIntoView({ behavior: "smooth", block: "start" });

}, 300);

}

}



p.windowResized = function() {

let container = document.getElementById("scene-6-container");

if (container) p.resizeCanvas(container.offsetWidth, container.offsetHeight);

};

}, "scene-6-container");


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
