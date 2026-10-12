# Makeathon 2027 — Doom requires your presence

A scroll-driven site for Makeathon 2027 (SELECT, VIT Vellore). The visitor scrolls through eight chapters with Doctor Doom on one stage inside the O·Machine instrument frame. The camera, Doom's gestures, the 3D pieces, the light, the music and Doom's lines are all driven by scroll position. Built for desktop and laptop screens.

## Run it

Serve the folder with any static server, then open `index.html`:

```
python3 -m http.server 8765
# http://127.0.0.1:8765/
```

The page needs WebGL2. Without it, or with `?plain`, it shows a plain, readable version of all the content. That version is also what screen readers read.

Useful parameters:

- `?shot=archive:0.6` jumps straight to a chapter at a given progress (0–1). Chapters: `summons`, `prediction`, `thesis`, `armoury`, `archive`, `future`, `oath`, `bench`, `farewell`.
- `?plain` opens the plain version.

## The chapters

| # | Chapter | What happens (scrubbed by scroll) |
|---|---------|-----------------------------------|
| 0 | Cold read | Types the visitor's real local time. Adds a line on phones and another on a return visit. The visitor chooses music or silence. |
| I | The Summons | The armour cools from white-hot, the eyes ignite, and the pitch line is written word by word. |
| II | The Prediction | Doom offers a sealed envelope. It flies to the corner and stays there. |
| III | Science & Sorcery | A blueprint and a rune circle slide in and are pushed together into the M logo. |
| IV | The Armoury | Five plates turn to face the visitor one at a time and open to show their domain. Choosing one opens the envelope: "You chose Firmware." |
| V | The Archive | The 2026 numbers count up beneath a raised gauntlet, then the six photos wipe in one at a time. |
| VI | 2027 | Rings rise and spin, the year rolls over to 2027, and the sealed items hum. |
| VII | The Oath | Email sign-up. A scroll levitates above Doom's open palm over a turning rune circle, and the email is written onto it as the visitor types. His other hand casts a wax seal onto it, the scroll dissolves upward, and the form shatters and re-forms. A bad email crumples the scroll in mid-air as his hand closes into a fist. |
| VIII | The Bench | FAQ and contact. Then Doom turns into the fog, looks back, and names anything the visitor skipped. |

Running throughout:

- Doom's gaze leads toward the next text.
- He drums his fingers when the visitor stops scrolling.
- Ten clicks on him gets "ENOUGH."
- The music dips before the two big moments.
- A progress line traces the frame, with a "Next" chapter label.

## Wire up the sign-up

The form is front-end only for now. In `js/main.js`, replace `submitEmail(email)` with the real request. It must return a promise that rejects on failure.

## Structure

```
index.html            content, semantic markup, the plain version
css/site.css          layout, the frame, typography, plain + reduced-motion modes
js/main.js            boot: cold read, loading, Lenis smooth scroll, toggles
js/director.js        scroll → camera path, chapters, gestures, light, music, gaze, idle
js/story.js           memory (localStorage), the cold read, Doom's lines, scrubbed subtitles
js/ui.js              scrubbed blocks, frame trace, reel, counters, envelope, shatter, cursor
js/audio.js           music bed + a few cues (WebAudio)
js/gfx/engine.js      renderer, HDR bloom/tone-map/grade, adaptive resolution
js/gfx/doom.js        the Doom model: IK gestures, finger curls, gaze, forge heat, eyes, cape
js/gfx/cloth.js       GPU cloth (Verlet + constraints in fragment passes), CPU fallback
js/gfx/world.js       the stage, blueprint grid, panels, M logo, plates, rings, props
js/gfx/particles.js   embers, dust, warp streaks, fog
js/gfx/textures.js    canvas-drawn blueprint, code runes, plate engravings, oath scroll
assets/               model, HDRI, textures, audio, event photos
vendor/               three.js r170, GSAP, Lenis
```

`O-Machine.dc.html`, `support.js` and `vendor/react*.js` are the original O·Machine design export, kept for reference. The new site doesn't use them.

## The Doom model

`assets/models/doom.glb` was converted from `doctor-doom.zip`, a Blender file rigged with Auto-Rig Pro. During the conversion:

- the deform bones were given a real parent hierarchy (Auto-Rig Pro drives them with constraints, which glTF can't carry);
- the static cloak was removed and replaced by the simulated cape;
- the textures were exported as JPEG, so the model is 2.1 MB.

The model depicts Marvel's Doctor Doom, and its textures look like they come from a game asset. Check the rights before making the site public.

## Credits

- Music: "Lightless Dawn" by Kevin MacLeod (incompetech.com), licensed under CC BY 4.0. The credit also appears in the contact section.
- Sound cues: Kenney (kenney.nl), CC0.
- HDRI and stone and fabric textures: Poly Haven, CC0.
- Libraries: three.js (MIT), GSAP (GreenSock standard license), Lenis (MIT).
- Event photos: Makeathon 2026.
