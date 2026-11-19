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
Tests: see `tests/README.md` (headless Chrome, offline render checks).

## Mastering
- Upload WAV / MP3 / M4A / FLAC / AIFF (decoded in the browser, nothing is uploaded to a server).
- 8 delivery presets (Precise, Organic, Elevated, Vocal Glow, 808 Weight, Radio Punch, Night Drive, Raw Street) + **Depth** and **Presence** toggles.
- **Auto Master** analyzes crest factor / spectral balance and picks a preset.
- Chain: peak-normalize → low/high shelf EQ → gentle compressor → makeup gain (≤ 3 dB) → soft tanh ceiling at −1 dBFS → 16-bit WAV.
- iOS-safe download (Share sheet → Save to Files, with open-in-tab fallback).

## Smart Master (clean, analysis-driven mastering)
Tap **Smart Master** (pick **Subtle −14 / Balanced −11 / Loud −9 LUFS** first) or **Analyze & set up only**.
It listens to the whole mix *before* touching it, shows **What I found / What I'll fix**, sets the studio cards
below with small capped moves, then renders. Every card stays editable afterwards (tweak, then **Master it**).

**What it measures** (offline, in the browser): spectral balance in 6 broad bands vs a reference
modern pop / hip-hop long-term curve, integrated LUFS, true peak, PLR / crest factor, LRA, harshness (2–8 kHz),
sibilance (5–10 kHz), mud (200–500 Hz), low-end mono / phase correlation (< 120 Hz) and full-band correlation,
DC offset, clipped runs in the source file, and 50/60 Hz mains hum (tonal + harmonic, present through quiet parts).
Long songs are analysed from 12 × 5 s excerpts spread across the track so it stays fast on an iPad.

**How it decides (never over-process):** corrective EQ moves are ≤ ±3 dB (≤ ±2 dB on Subtle), only where the mix
is > 1 dB off the reference, the mud band is never boosted, the sub is never boosted when there's no real sub content,
air/presence boosts are capped lower. Dynamic EQ / de-esser thresholds come from the song's own detector statistics
*and* the reference, so they only act on moments that stand out; if nothing stands out they stay off.
Multiband and glue thresholds are set from the song's level distribution for ~1–2 dB of gain reduction.
After the limiter, if the average limiting would exceed the intensity's budget (0.8 / 1.5 / 3 dB), it backs the
loudness target off (bisection on the excerpts) and tells you: *"held back from −9 to stay clean"*.
Smart Master switches the preset stage **off** (its tanh soft-clip is a coloured sound) and keeps **Saturation off**.

**Why there's no "AI" shimmer / warble:** nothing on the audio path works in the FFT/spectral domain — no spectral
denoise or gating, no phase vocoder / pitch processing, no resynthesis, no waveshaping. The chain is only broad
minimum-phase IIR filters plus smooth gain: every gain-reduction signal goes through attack/release **and** a second
one-pole stage (C1-continuous, no zipper), applied per sample. Saturation (the only nonlinearity in the app) stays
optional, 4× oversampled, and off in Smart Master.

### Studio chain (Waves-style processors — original code)
> **About Waves:** Waves Audio has no web SDK, and Waves plugins (VST/AU/AAX) cannot run inside a browser or web app.
> These are **original in-browser processors written for this app**, modelled on the *kind* of studio tools big
> mastering rooms use. They contain no Waves, SSL or other third-party code, and this project is not affiliated with
> or endorsed by Waves Audio Ltd. or Solid State Logic; names are only used to describe the style.

Signal flow (export and live preview are the same; any card that is **Off** is bypassed completely):
```
mix → VoxBox (optional) → EQ → Saturation → Space FX → Immersive → preset master (optional) → Clean-Up → Mono Bass
    → Corrective EQ → Dynamic EQ → De-esser → Multiband → Glue Comp → Loudness Auto-Master + Ultra Limiter
    → Dither → Meter → WAV
```

| Card | What it does |
|---|---|
| **Smart Master** | Analysis + one-tap master, Subtle / Balanced / Loud, found/fix readout. |
| **Preset stage** toggle | ON = the original preset master (shelves, compressor, tanh soft ceiling). OFF = clean path (peak-normalise only). Smart turns it off. |
| **Clean-Up** | 3 Hz DC blocker, 4th-order Butterworth high-pass at 18 Hz (−0.2 dB at 30 Hz), optional cut-only notches at 50 or 60 Hz + 2 harmonics (Q 25) when hum is detected. |
| **Mono Bass** | Side channel high-passed by a Linkwitz-Riley 4th-order filter (default 120 Hz, same LR4 approach as the immersive stage): everything below is mono, the mid is untouched. |
| **Corrective EQ** | 6 broad min-phase bands — Sub shelf 50 Hz, bells (Q 0.7) at 120 / 350 / 1 k / 3.5 k, Air shelf 12 kHz. No narrow resonant boosts. Curve display. ±6 dB manual, Smart ≤ ±3 dB. |
| **Dynamic EQ** | Mud (default 300 Hz) and harshness (default 4 kHz) bands. Each detects its band level *relative to the full mix* and only cuts while it's above the threshold (soft knee, 3:1, smooth attack/release, cut capped at Max cut; 0 = band off). Implemented as `x − k·bandpass(x)` so the cut is a smooth bell with no coefficient switching. |
| **De-esser** | Same split-band structure at 5–10 kHz (default 7 kHz), fast 1.5 ms / 60 ms, 4:1, cut capped (Smart 4–6 dB). |
| **Multiband Comp** | 3 bands, LR4 crossovers (default 120 Hz / 2.5 kHz) with all-pass compensation on the low band so the bands sum to a flat all-pass (phase-coherent). Stereo-linked RMS detection, soft knee, low 30/300 ms, mid 15/200 ms, high 6/120 ms, GR soft-capped at 6 dB. |
| **Glue Comp (SSL-style)** | Stereo-linked bus compressor, 90 Hz sidechain high-pass, ratio 1.5/2/4, attack 0.1–30 ms (default 30), **Auto** dual-time-constant release (120 ms + 1.5 s program-dependent) or fixed 0.1–1.2 s, GR smoothly capped at **Max GR** (Smart ≤ 2 dB), Mix. |
| **Ultra Limiter (L2-style)** | Transparent true-peak brickwall: 4× oversampled true-peak detection, 3 ms lookahead with two cascaded box smoothers (S-shaped attack that still guarantees the gain is reached before the peak), dual-stage **Auto** release (fast recovery after isolated hits, slow under sustained limiting = no pumping) or Fast / Slow. Ceiling −1.0 / −1.5 / −2.0 dBTP. With Auto-Master on it replaces Auto-Master's limiter; alone it only catches peaks. |
| **Dither** | TPDF (±1 LSB triangular) before rounding to 16-bit; fixed seed so exports are repeatable. |

Live preview runs the studio chain in an `AudioWorklet` (`mm-studio`, same DSP source; ScriptProcessor fallback).

### Verification (headless Chrome 156, 48 kHz, test signals: pink noise, log sine sweep, drum loop, sibilant noise bursts)
- **Null test:** with every new card off, exports are **byte-identical** (SHA-256 of the WAV) to the previous release
  for: default preset, Auto-Master −14, EQ + Immersive Wide + Auto-Master, Auto-Master −9 with meter off.
- **Loudness / peaks:** all Smart runs and fixed targets (−14 / −11 / −9 with every studio card on) land within
  **±0.13 LU** of the target actually used, true peak **−1.1 dBTP** (≤ −1), sample peak ≤ −1.1 dBFS, no NaN/Inf.
- **Aliasing:** 1 kHz + 15 kHz tones through Smart **Loud**: worst spurious component **−126 dB** below the tone,
  nothing above 16 kHz (−150 dB).
- **Artifacts / warble:** 5-tone signal through Smart Balanced, residual after least-squares gain/phase match of the
  tones = **−92.8 dB** (no sidebands, no musical noise). Pink noise through Smart Loud: per-bin temporal spread
  5.57 dB in → 5.59 dB out (Δ 0.01 dB; spectral gating / "musical noise" would raise this). Gain-reduction traces of
  every dynamic stage: max slew ≤ 0.4 dB/ms, no steps (no zipper).
- Page loads with no console errors; live preview runs the studio worklet.

### Smart Master limitations
- The reference curve is one generic pop/hip-hop target; for very different genres (acoustic, classical, EDM sub-heavy)
  treat the EQ suggestions as a starting point.
- It can't undo clipping, bad mix balance or noise baked into the mix; it reports clipping and keeps the limiter gentle.
- No noise reduction beyond the sub-20 Hz filter and hum notches, on purpose (spectral denoise causes the "AI" sound).
- A 4-minute song takes ~25 s to Smart-master on a desktop browser; expect roughly 1 minute on an iPad.
- Preview is an approximation; the export numbers are exact.


## VoxBox (vocal presets and plugins)
A vocal-processing stage that runs **first** (on your take), before the mix tools and the mastering chain.
Tap a named preset or open any card and switch it on. The master **VoxBox: OFF** toggle bypasses the whole
stage completely — with it off, exports stay bit-identical to the previous chain.

> **About Waves and ValhallaDSP:** neither has a web SDK, and their plugins cannot run inside a browser.
> VoxBox processors are **original in-browser code written for this app**, modelled on the *kind* of vocal
> and space tools used on records. They contain no Waves, Valhalla, SSL or other third-party code, and this
> project is not affiliated with or endorsed by those companies; names are only used to describe the style.

All processing is time-domain: minimum-phase IIR filters, smooth gain (the same attack/release + second
one-pole stage as the studio chain), 4×-oversampled `tanh` warmth, Haas doubler, and delay-network reverbs.
There is **no pitch correction**, no phase vocoder, and **no shimmer** (no pitch-shifted reverb tails), so
you do not get a robot, warble or "AI" sound.

**Vocal presets:** Rap Lead, Clean R&B, Autotuned Pop (bright stacked pop chain — the name is the style,
not an autotune effect), Lo-Fi, Radio Ready, Podcast / Voice. Each one sets the cards below; you can tweak
anything afterwards (the preset then reads Custom).

| Card | What it does |
|---|---|
| **Vocal EQ** | 12 dB/oct high-pass plus broad Body (220 Hz), Nasal (900 Hz), Presence (4 kHz) and Air (11 kHz) bands, ±8 dB, curve display. |
| **Vocal De-esser** | Same split-band design as the studio de-esser (5–10 kHz, smooth capped cut). |
| **Vocal Comp** | Stereo-linked compressor, 120 Hz sidechain high-pass, soft knee, GR capped at Max GR, makeup and mix (parallel). |
| **Gate / Expander** | Soft-knee downward expander with a 120 Hz detector high-pass and double-smoothed gain — closes the floor between phrases without chatter or a hard mute. Range caps how far it can shut. |
| **Warmth** | The same level-matched, 4×-oversampled saturator as the mix Saturation tool, with milder vocal defaults. |
| **Doubler** | Short left/right Haas delays (about 12–30 ms) and a tiny time wobble, high-passed. Time-domain only — no detune. |
| **V-Space (Valhalla-style)** | Original plate / hall / room reverbs (dense FDN, Jot decay, loop damping, slow delay-time chorus, early reflections) and a vintage / ping-pong / slap delay with damped feedback and optional tape-style wow. Space presets: Tight Plate, Lush Hall, Intimate Room, Vintage Echo, Slapback, Dream Delay. Tails always decay; no octave shimmer. |

Live preview and export share the same path. Dynamics run in an `AudioWorklet` (`mm-vox`, same `VoxDSP` source;
ScriptProcessor fallback). Warmth, doubler and V-Space use the Web Audio graph (including on export, with tail).

## Tools / Chain
Five tools, each in its own card with an On/Off toggle (cards collapse; tap the title).

**Signal flow (live preview and export are the same):**

```
your mix → VoxBox (optional) → EQ → Saturation → Space FX → Immersive → preset master (shelves/comp/soft ceiling)
        → [studio chain, see Smart Master] → Loudness Auto-Master (LUFS gain + true-peak limiter) → Loudness Meter (read-only) → WAV / speakers
```

Why this order: VoxBox (when on) prepares a vocal take first; EQ/saturation/FX then shape the mix before
it is spatialised; the immersive stage places that sound (including reverb tails) in the virtual room; the
preset master glues it; loudness normalisation and the true-peak limiter go **last** so nothing after them
can change the LUFS result or push peaks over −1 dBTP. The meter is non-destructive and reads the final output.
With VoxBox, every tool and Immersive off, the export is bit-identical to the original mastering chain.

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
- The creative EQ is static (dynamic bands live in the separate Dynamic EQ card). Web Audio shelves ignore Q.
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
