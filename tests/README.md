# Offline audio tests (headless Chrome)
Needs Node 18+, Google Chrome and `npm i puppeteer-core`. Serve the app on :8811 and the previous release on :8812
(for the byte-identical null test), then `node tests/run.mjs` (writes results.json):
```
python3 -m http.server 8811 -d . &
git archive 8166a0c | (mkdir -p /tmp/old && tar -x -C /tmp/old) && python3 -m http.server 8812 -d /tmp/old &
node tests/run.mjs
```
Covers: null test vs previous release, Smart Master on pink noise / sweep / drum loop / sibilant bursts (LUFS, true peak,
NaN), fixed LUFS targets with every studio card on, aliasing (1 k + 15 k tones), multitone residual (warble/musical
noise), pink-noise per-bin spread, gain-trace smoothness, live-preview worklet.
