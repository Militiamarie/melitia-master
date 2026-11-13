# Melitia Master
AI Online Mastering App — installable on phone.

Static PWA. Deploy to Vercel by pushing this folder or linking the project.
No build step: everything (UI + audio engine) lives in `index.html`, plain HTML/CSS/vanilla JS + Web Audio API.

## Mastering
- Upload WAV / MP3 / M4A / FLAC / AIFF (decoded in the browser, nothing is uploaded to a server).
- 8 delivery presets (Precise, Organic, Elevated, Vocal Glow, 808 Weight, Radio Punch, Night Drive, Raw Street) + **Depth** and **Presence** toggles.
- **Auto Master** analyzes crest factor / spectral balance and picks a preset.
- Chain: peak-normalize → low/high shelf EQ → gentle compressor → makeup gain (≤ 3 dB) → soft tanh ceiling at −1 dBFS → 16-bit WAV.
- iOS-safe download (Share sheet → Save to Files, with open-in-tab fallback).

## Immersive / spatial audio (Atmos-style approximation)
> **Not Dolby Atmos.** This is an in-browser approximation built on the Web Audio API. It uses no Dolby SDK,
> encoder or renderer, produces no ADM BWF / Dolby Atmos master (.atmos / DAMF), and is not Dolby-certified.
> The output is a normal **2-channel stereo/binaural WAV**.

Open the **Immersive / spatial** card, switch **Immersive: ON**, pick a preset, adjust sliders, then press
**Master it** or **Auto Master**. The spatial stage runs first, then the regular mastering chain and limiter.

| Preset | What it does | Listen on |
|---|---|---|
| Off | Stage bypassed — master is identical to the normal chain | anything |
| Immersive | Virtual 7.1.4 bed + 4 height speakers, blended with the stereo master | headphones |
| Binaural | Full HRTF render of a virtual 7.1.4 room, low height level, out-of-head image | headphones only |
| Surround 5.1 | Virtual L/C/R + side surrounds, no height layer | headphones |
| Surround 7.1.4 | Virtual 7.1 bed + 4 overhead speakers (Atmos-style layout) | headphones |
| Wide Stereo | Mid/side widening + light room, no HRTF | speakers or headphones |

Sliders (moving one switches the preset to **Custom**):
- **Width** (0–200 %) — mid/side width of everything above 120 Hz (100 % = unchanged).
- **Height / elev.** — level of the 4 overhead virtual speakers and their elevation (30°→60°), with an 8 kHz presence lift and a ~6.5 kHz pinna-style notch as elevation cues. In 5.1 it lifts the bed instead.
- **Distance / room** — speaker distance, air-absorption darkening and send into a short synthetic room (early reflections + 0.2–0.9 s tail).
- **Rear / surround** — level of the decorrelated (delayed, side-derived) surround / rear-surround feeds.
- **Binaural depth** — blend between the plain widened stereo and the HRTF virtual-speaker render.

**Live preview** plays your original mix through the spatial stage in real time (with a safety limiter, no mastering EQ/comp) and re-renders when you change presets or sliders.

### How it works
1. 4th-order Linkwitz-Riley crossover at 120 Hz — lows stay **mono and dry** (808s and kicks keep their weight and mono compatibility).
2. Mid/side matrix with width control → L′/R′.
3. Upmix into virtual speaker feeds: L, R, C (mid), side/rear surrounds (side signal + some L′/R′, 11–23 ms delays, low-passed), 4 tops (high-passed > 1.5 kHz, short delays, height EQ).
4. Each virtual speaker → `PannerNode` (`panningModel: "HRTF"`) at its 5.1 / 7.1.4 azimuth/elevation → binaural stereo sum.
5. `ConvolverNode` with a deterministic synthetic room impulse (repeatable exports).
6. Gain staging: export render is RMS-matched to the input and peak-capped at −1 dBFS before the existing compressor and soft ceiling, so loudness matches a non-immersive master.

The same graph builder drives both the live preview (`AudioContext`) and the export (`OfflineAudioContext`).

### Limitations
- HRTF is the browser's built-in generic dataset (not personalised); results vary between Safari and Chrome.
- Binaural/Immersive presets are designed for headphones and can sound coloured or phasey on speakers — use Wide Stereo or Off for speaker playback.
- Mono uploads get limited spatialisation (there is no side information to spread).
- Width > 100 % reduces mono compatibility of the mids/highs (bass stays mono).
- Long songs on older iPads: the spatial render adds ~0.1× realtime of processing on top of mastering.
- For a real Dolby Atmos release you still need a Dolby Atmos Renderer / DAW Atmos workflow (e.g. Logic Pro, Pro Tools) and ADM BWF delivery.
