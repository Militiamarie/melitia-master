# Melitia Master
AI Online Mastering App — installable on phone.

Static PWA. Live at **https://militiamarie.github.io/melitia-master/** (GitHub Pages from `main`, root; `.nojekyll` keeps files served as-is).
All app URLs are relative, so it also works from any subfolder or on Vercel/Netlify.

## Install as an app
- **iPad / iPhone (Safari):** open the link → tap **Share** (square with arrow) → **Add to Home Screen** → **Add**. Launch it from the home-screen icon (full screen, no Safari bars).
- **Android / Chrome / Edge desktop:** open the link → **Install app** (address-bar icon or ⋮ menu).
- Works offline after the first visit (app shell is cached). Your audio never leaves the device.
- When a new version is published you'll see **Update available → Reload**.

PWA files: `manifest.json` (name, start_url/scope `./`, standalone, icons incl. maskable), `sw.js`
(precache app shell; network-first for the page with offline fallback; stale-while-revalidate for other assets;
bump `VERSION` on each release), `icons/` (192/512, maskable 192/512, apple-touch-icon 180, favicon 32).
No build step: everything (UI + audio engine) lives in `index.html`, plain HTML/CSS/vanilla JS + Web Audio API.

## Mastering
- Upload WAV / MP3 / M4A / FLAC / AIFF (decoded in the browser, nothing is uploaded to a server).
- 8 delivery presets (Precise, Organic, Elevated, Vocal Glow, 808 Weight, Radio Punch, Night Drive, Raw Street) + **Depth** and **Presence** toggles.
- **Auto Master** analyzes crest factor / spectral balance and picks a preset.
- Chain: peak-normalize → low/high shelf EQ → gentle compressor → makeup gain (≤ 3 dB) → soft tanh ceiling at −1 dBFS → 16-bit WAV.
- iOS-safe download (Share sheet → Save to Files, with open-in-tab fallback).

## Tools / Chain
Five tools, each in its own card with an On/Off toggle (cards collapse; tap the title).

**Signal flow (live preview and export are the same):**

```
your mix → EQ → Saturation → Space FX → Immersive → preset master (shelves/comp/soft ceiling)
        → Loudness Auto-Master (LUFS gain + true-peak limiter) → Loudness Meter (read-only) → WAV / speakers
```

Why this order: EQ/saturation/FX are *creative* tools, so they shape the raw mix before it is spatialised;
the immersive stage then places that sound (including reverb tails) in the virtual room; the preset master
glues it; loudness normalisation and the true-peak limiter go **last** so nothing after them can change the
LUFS result or push peaks over −1 dBTP. The meter is non-destructive and reads the final output.
With every tool and Immersive off, the export is bit-identical to the original mastering chain.

| Tool | Inspired by | What it does |
|---|---|---|
| **Parametric EQ** | TDR Nova-style curve EQ | 5 bands (low shelf, 3 bells, high shelf; any band can switch to notch / HP / LP). Drag the dots on the response curve (touch/pencil/mouse, pointer events), mouse-wheel = Q, or use the per-band sliders + number boxes. Curve is drawn from `BiquadFilterNode.getFrequencyResponse()`. Changes apply live during preview. |
| **Saturation** | Softube Saturation Knob-style | One big **Drive** knob (0–24 dB into a `tanh` `WaveShaperNode`, `oversample: "4x"`), **Tone** (dark ↔ bright tilt after the shaper) and **Mix** (parallel). Output is RMS-matched to the input so drive adds harmonics, not just level. |
| **Space FX** | Valhalla Supermassive-style | Modes: **Echo** (ping-pong, damped feedback, tape wobble), **Chorus** (3 LFO-modulated voices per side), **Flange** (short modulated delay with feedback), **Supermassive** (4-line feedback delay network, orthogonal Hadamard mixing, per-line LFO pitch drift, damping + low-cut in every loop, long lush tails). Controls: Mix, Feedback, Time/size, Mod/drift, Tone. |
| **Loudness Auto-Master** | LANDR-style loudness targeting | Target −14 (default, streaming), −9, −11, −16 or −23 LUFS, ceiling −1 dBTP. **Export:** integrated loudness is measured exactly from the rendered buffer (ITU-R BS.1770-4 K-weighting + gating), gain is applied, then a lookahead true-peak limiter (4× oversampled peak detection, 5 ms lookahead, smooth release) runs; it re-measures and iterates (secant steps) until the result is within ±0.1 LU. **Preview:** an AudioWorklet adapts the gain from the running loudness (≤ 6 dB/s) and compensates for limiter loss. |
| **Loudness Meter** | Youlean Loudness Meter-style | Momentary (400 ms), short-term (3 s), integrated (gated), true peak (4× oversampled, dBTP) and LRA (EBU Tech 3342), plus a 30-second loudness history graph during preview. After an export it shows the exact numbers for the whole file and its full short-term curve. |

**Realtime engine:** the meter and auto-master run in an `AudioWorklet` loaded from an inline Blob URL
(data-URL fallback, then `ScriptProcessorNode` fallback for older browsers). The same DSP code is used for the
worklets, the fallback and the offline export, so preview numbers and export numbers agree.

**Verified** (node-web-audio-api + Node tests): 1 kHz sine at −20 dBFS stereo = −20.0 LUFS; EBU Tech 3341
test 1 (−23 dBFS → −23.0 LUFS) and gating test (−36/−23/−36 dBFS → −23.0 LUFS); EBU Tech 3342 LRA tests (10 LU, 5 LU);
fs/4 sine at 45° phase: sample peak −3.01 dBFS, true peak ≈ 0.0 dBTP (−0.07); auto-master lands within ±0.1 LU
of every target with true peak ≤ −1 dBTP; Space FX stays bounded and decays at max feedback in every mode.

### Tools limitations
- “Inspired by” only: this project is **not affiliated with or endorsed by** Tokyo Dawn Records (TDR), Valhalla DSP, Softube, LANDR or Youlean. Their names are used only to describe the style of tool; none of their code or DSP is used.
- EQ is static (no dynamic EQ bands like Nova). Web Audio shelves ignore Q.
- Space FX is an algorithmic approximation (FDN + modulated delays), not a recreation of any commercial algorithm; there is no true pitch-shifter (the “pitch drift” comes from delay modulation, a few cents). Feedback is mapped to a decay time (max ≈ 15 s), so tails always die out; exports get extra length for the tail.
- Live preview is an approximation of the export: immersive gain matching, the preset master, and the auto-master gain are adaptive in realtime but exact (measured) in the export. Trust the export numbers.
- Mono files are measured as dual-mono (as most meters/streaming services do), i.e. ~3 dB higher than strict single-channel BS.1770.
- True peak uses a 48-tap windowed-sinc 4× interpolator (BS.1770-4 Annex 2 style, not the exact ITU coefficients) — accurate to ~0.1 dB on test signals.
- The `tanh` saturator's 4× oversampling latency is browser-dependent, so very low Mix settings can show slight comb filtering.
- Heavy processing (long reverb + immersive + auto-master) on a long song can take several seconds on an iPad; the screen waits until it’s done.

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

**Live preview** (or **Preview chain**) plays your original mix through the *whole* chain in real time — Tools → Immersive → preset mastering → Loudness Auto-Master → Meter — and updates when you change presets, sliders or EQ (EQ moves are applied live without restarting).

### How it works
1. 4th-order Linkwitz-Riley crossover at 120 Hz (two cascaded Butterworth filters; Web Audio lowpass/highpass `Q` is specified in dB, so −3.01 dB is used) — lows stay **mono and dry** (808s and kicks keep their weight and mono compatibility).
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
