# Audiostory — Communications Lab Project 3

**Live site:** https://dsshji.github.io/comm-lab-audiostory/

A browser-based audio story about a burnt-out office worker finding their way back to the countryside. The story is told primarily through sound, with abstract p5.js visuals and minimal text supporting the narrative. The experience is first-person and fully interactive — you don't just watch it, you move through it.

---

## Concept

Abstract shapes and lines visualize the emotional atmosphere of each scene. Sounds describe the external world (locations, objects, actions). Text captures the character's internal thoughts. Together these three layers tell a story that unfolds only when the user engages with it.

---

## Scenes

| Scene | Title | Visual author |
|-------|-------|---------------|
| 1 | Childhood memory / dream | Ruslan |
| 2 | Morning routine / wake up | Ruslan |
| 3 | Commute | Mariam |
| 4 | Office burnout | Dasha |
| 5 | Packing up | Dasha |
| 6 | Train station | Mariam |
| 7 | Arriving at the countryside | Ruslan |

Scenes 1 and 7 share the same landscape visualization intentionally — a full-circle moment for the character.

---

## How to run

Clone the repo and open `index.html` in a browser, or visit the live site above.
> **Note:** Audio requires a user interaction to start (browser autoplay policy). Click anywhere on the first scene to begin.

---

## File structure

```
comm-lab-audiostory/
├── index.html
├── style.css
├── sketch.js          # All p5.js scenes (scenes 1–7)
├── sounds/
│   ├── scene1/        # Childhood / dream ambience, alarm
│   ├── scene2/        # Morning sounds (tap, toaster, drawer, door)
│   ├── scene3/        # Traffic, heartbeat
│   ├── scene4/        # Office loop, click sounds, camera shutter
│   ├── scene5/        # Bedroom ambience, packing sounds
│   ├── scene6/        # Station ambience, train, stamp, suitcase
│   └── scene7/        # Countryside ambience
└── README.md
```

---

## Technical overview

All scenes are written in vanilla JavaScript using [p5.js](https://p5js.org/). Scenes 1 and 7 use the global p5 instance; scenes 2–6 each run in their own `new p5(...)` instance attached to a dedicated container element.

### Shared systems (used across scenes)

- **`AudioChannel`** — wrapper around the Web Audio API's `HTMLAudioElement` with lerp-based volume fading, `setTarget()`, `immediateStop()`, and per-frame `update()`. Used wherever smooth fade-in/fade-out is needed.
- **`DetachedAudioChannel`** — one-shot variant that clones the audio node on each play so overlapping calls don't cut each other off. Used for toaster, drawer, stamp, and packing sounds.
- **`SimpleNode`** — interactive click target with hover detection, glow rendering, and label display. Used in scenes 1 and 2.
- **`SimpleParticle` / `SimpleGrassBlade`** — lightweight atmospheric visual classes used in the landscape scenes.
- **Scroll locking** — `overflowY: hidden` + `preventDefault()` on `wheel`, `touchmove`, and `keydown` events keeps the user inside a scene until the intended interaction is complete.

---

## Team

| Name | Role |
|------|------|
| **Vy** | Audio (recording, editing, Audacity processing — ~70 files across 7 scenes) |
| **Ruslan** | Scenes 1, 2, 7 — p5.js visuals + shared architecture (scroll lock, transition logic, AudioChannel class) |
| **Mariam** | Scenes 3, 6 — p5.js visuals + interactive logic |
| **Dasha** | Scenes 4, 5 — p5.js visuals + audio integration |

---

## References

- [p5.js Reference](https://p5js.org/reference/)
- [The Coding Train — Nature of Code / Perlin Noise](https://youtu.be/8ZEMLCnn8v0)
- [The Coding Train — Experiment videos](https://www.youtube.com/watch?v=mhjuuHl6qHM)
- [Khan Academy — Advanced JS: Natural Simulations](https://www.khanacademy.org/computing/computer-programming/programming-natural-simulations)
- [Pixabay](https://pixabay.com/sound-effects/) — royalty-free sound library
- [Mixkit](https://mixkit.co/free-sound-effects/) — royalty-free sound library
- [Audacity](https://www.audacityteam.org/) — audio editing
- [MONTREAL](https://montreal.leeroy.ca/?l=en) — visual inspiration
- [Kitchen Chaos](https://xiaotianfan.github.io/Kitchen-Chaos/) — interaction inspiration
- Gemini Guided Learning Mode — debugging and concept exploration
