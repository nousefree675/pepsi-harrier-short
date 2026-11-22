# Pepsi Harrier - cartoon short film project

A 9:16 cartoon short (720x1280, 30 fps) built with the cartoon-short-kit v2 renderer:
a code-driven WebGL pipeline (three.js r160 in headless Chromium) that renders frames
for a scripted narrated short, plus the synthesized music/SFX mix.

- `web/` - renderer engine and this film's shot plan (`story.js`), scene code (`main.js`, `paint.js`, `roman.js`, `motion.js`, `toon*.js`)
- `tools/` - pipeline scripts: `render.mjs` (frames), `finish.sh` (encode + QA), `synth.py`/`mix.py`/`audio.py` (sound), `timing.py`, `sheet.py`
- `script.txt`, `voice.mp3`, `mix_raw.wav` - this film's script, generated narration, and pre-mixed audio
- `.github/workflows/render.yml` - renders a frame range as a build artifact; final assembly and QA happen in the project pipeline

Kit: cartoon-short-kit v2 by the WHATIF ANIMATIONSTORYS channel (see KIT-README.md),
built on claude-animated-shorts (MIT, see LICENSE-claude-animated-shorts.txt).
Published by the rights holder. Asset credits in ATTRIBUTION.md.
