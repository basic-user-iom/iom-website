/** Six indexed compressed media streams share one Web Audio mixer and transport.
 * No fetch, audio element or AudioContext exists until the first trusted play.
 * Browser media decoders stream the M4As; this module never decodes full PCM.
 * Media-element clocks are not sample-locked: small drift is rate-corrected,
 * larger drift is repaired behind a silent, synchronized restart barrier.
 */
export function createStemPlayer({ stems, duration = 213.624, headroom = .707, volume = .35, onChange = () => {} }) {
  if (!Array.isArray(stems) || !stems.length || new Set(stems.map(s => s.id)).size !== stems.length) throw new Error('Music requires unique stem IDs.');
  const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));
  const state = {
    status: 'idle', currentTime: 0, position: 0, duration, volume: clamp(volume), muted: false,
    loop: true, ready: false, activated: false, error: null, pauseReason: null,
    buffered: 0, driftMs: 0, maxDriftMs: 0, corrections: 0, loopCount: 0,
    stems: stems.map(stem => ({ id: stem.id, label: stem.label || stem.id, gain: 1, muted: false,
      solo: false, ready: false, buffered: 0, effectiveGain: 1 })),
  };
  const records = [], listeners = [], headroomGain = clamp(headroom);
  let context, master, envelope, analyser, meter, frequencyBins, tickTimer, pauseTimer;
  let generation = 0, wantsPlay = false, disposed = false, pending = null, starting = false;
  let lastCorrection = 0, fadeStartedAt = 0, lastAnalysisAt = 0;
  const analysis = { bass: 0, mid: 0, treble: 0, energy: 0, playing: false };
  const smooth = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
  function emit() { if (!disposed) onChange(state); }
  function setTime(value) { state.currentTime = state.position = clamp(value, 0, state.duration); }
  function ramp(param, value, seconds = .06) {
    if (!context || context.state === 'closed') return;
    const now = context.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { const current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
    param.linearRampToValueAtTime(value, now + seconds);
  }
  function mix() {
    const solo = state.stems.some(stem => stem.solo);
    for (let i = 0; i < state.stems.length; i++) {
      const stem = state.stems[i]; stem.effectiveGain = stem.muted || (solo && !stem.solo) ? 0 : stem.gain;
      if (records[i]) ramp(records[i].gain.gain, stem.effectiveGain);
    }
    if (master) ramp(master.gain, state.muted ? 0 : state.volume * headroomGain);
  }
  function pauseMedia() { for (const { media } of records) { media.pause(); media.playbackRate = 1; } }
  function silence() {
    if (!envelope) return;
    envelope.gain.cancelScheduledValues(context.currentTime);
    envelope.gain.setValueAtTime(0, context.currentTime);
  }
  function fail(message, blocked = false) {
    if (disposed) return false;
    generation++; wantsPlay = false; starting = false; clearTimeout(pauseTimer);
    silence(); pauseMedia(); state.status = blocked ? 'blocked' : 'error'; state.error = message;
    state.pauseReason = blocked ? 'permission' : 'error'; emit(); return false;
  }
  function listen(target, type, callback) {
    target.addEventListener(type, callback); listeners.push(() => target.removeEventListener(type, callback));
  }
  function initialize() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('This browser does not support the music mixer.');
    context = new AudioContextClass({ latencyHint: 'playback' });
    // Resume is called by play(), still within the originating trusted gesture.
    master = context.createGain(); envelope = context.createGain(); analyser = context.createAnalyser();
    master.gain.value = state.muted ? 0 : state.volume * headroomGain;
    envelope.gain.value = 0; analyser.fftSize = 1024; analyser.smoothingTimeConstant = .6;
    meter = new Float32Array(analyser.fftSize); frequencyBins = new Float32Array(analyser.frequencyBinCount);
    master.connect(envelope); envelope.connect(analyser); analyser.connect(context.destination);
    stems.forEach((stem, index) => {
      const media = new Audio(); media.preload = 'none'; media.crossOrigin = 'anonymous'; media.loop = false;
      media.playsInline = true; media.setAttribute('playsinline', ''); media.volume = 1;
      const source = context.createMediaElementSource(media), gain = context.createGain();
      gain.gain.value = state.stems[index].effectiveGain; source.connect(gain); gain.connect(master);
      records.push({ media, source, gain });
      listen(media, 'error', () => fail(`${state.stems[index].label} could not load. Press Play music to retry.`));
      listen(media, 'waiting', () => {
        if (state.status === 'playing' && wantsPlay && !starting) {
          setTime(records[0].media.currentTime); void begin('buffering');
        }
      });
      listen(media, 'ended', () => { if (state.status === 'playing' && wantsPlay) finish(); });
      media.src = stem.url; media.preload = 'auto'; media.load();
    });
    listen(context, 'statechange', () => {
      if (context.state !== 'running' && state.status === 'playing') pause('interrupted');
    });
    state.activated = true; tickTimer = setInterval(tick, 250);
  }
  function loadedAt(media, time) {
    return !media.error && media.readyState >= 3 && !media.seeking && Math.abs(media.currentTime - time) < .075;
  }
  function waitUntil(predicate, token, timeout = 25000) {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      const poll = () => {
        if (disposed || token !== generation) { resolve(false); return; }
        if (predicate()) { resolve(true); return; }
        if (performance.now() - start > timeout) { reject(new Error('Music is taking too long to load. Press Play music to retry.')); return; }
        setTimeout(poll, 40);
      };
      poll();
    });
  }
  function playAll() {
    // All calls occur in this synchronous loop, with immediate rejection handlers.
    return Promise.all(records.map(({ media }) => {
      try { return Promise.resolve(media.play()); } catch (error) { return Promise.reject(error); }
    }));
  }
  function withTimeout(promise, token) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Music is taking too long to load. Press Play music to retry.')), 25000);
      promise.then(value => { clearTimeout(timeout); resolve(value); }, error => { clearTimeout(timeout); reject(error); });
      // A paused/cancelled initial download must not keep the transport pending.
      const cancellation = setInterval(() => {
        if (token !== generation || disposed) { clearInterval(cancellation); clearTimeout(timeout); resolve(false); }
      }, 100);
      promise.finally(() => clearInterval(cancellation)).catch(() => {});
    });
  }
  function begin(status = 'loading') {
    if (disposed) return Promise.resolve(false);
    const unlockMedia = !context || state.status === 'blocked' || state.status === 'error';
    const token = ++generation; clearTimeout(pauseTimer); wantsPlay = true; starting = true;
    state.status = status; state.error = null; state.pauseReason = null;
    let resumePromise, initialPlay;
    try {
      if (!context) initialize();
      // Do not put an await before resume/play: Enter tour carries transient activation.
      resumePromise = context.resume(); silence(); pauseMedia();
      for (let i = 0; i < records.length; i++) {
        if (records[i].media.error) { records[i].media.src = stems[i].url; records[i].media.load(); }
      }
      // Only the first gesture (or permission retry) silently unlocks media.
      // Already-authorized streams stay paused throughout later buffering.
      initialPlay = Promise.all([resumePromise, unlockMedia ? playAll() : Promise.resolve()]);
    } catch (error) { return Promise.resolve(fail(error.message)); }
    emit();
    pending = (async () => {
      try {
        const startResult = await withTimeout(initialPlay.then(() => true), token);
        if (!startResult || token !== generation || disposed) return false;
        // Early ready streams may have advanced silently while others downloaded.
        // Rewind all six together before opening the audible envelope.
        pauseMedia();
        const position = state.currentTime >= state.duration - .02 ? 0 : state.currentTime;
        setTime(position);
        for (const { media } of records) media.currentTime = position;
        if (!await waitUntil(() => records.every(({ media }) => loadedAt(media, position)), token)) return false;
        await playAll();
        if (token !== generation || disposed) return false;
        state.ready = true; state.status = 'playing'; starting = false;
        fadeStartedAt = context.currentTime;
        ramp(envelope.gain, smooth((state.duration - position) / 8), 1.75); mix(); tick(); return true;
      } catch (error) {
        if (token !== generation || disposed) return false;
        return fail(error.name === 'NotAllowedError' ? 'Press Play music to allow sound in this browser.' : error.message,
          error.name === 'NotAllowedError');
      }
    })();
    return pending;
  }
  function play() {
    if (disposed) return Promise.resolve(false);
    if (!state.activated && navigator.userActivation && !navigator.userActivation.isActive) {
      state.status = 'blocked'; state.error = 'Press Play music to enable sound.'; emit(); return Promise.resolve(false);
    }
    if (document.hidden) { state.pauseReason = 'hidden'; state.status = 'paused'; emit(); return Promise.resolve(false); }
    if (state.status === 'playing') return Promise.resolve(true);
    if (starting && pending) return pending;
    return begin();
  }
  function pause(reason = 'manual') {
    if (disposed) return false;
    const wasPlaying = state.status === 'playing'; generation++; wantsPlay = false; starting = false; clearTimeout(pauseTimer);
    if (wasPlaying) setTime(records[0].media.currentTime);
    state.status = state.activated ? 'paused' : 'idle'; state.pauseReason = reason; state.error = null;
    if (envelope && wasPlaying && reason !== 'hidden') {
      ramp(envelope.gain, 0, reason === 'tour-exit' ? 1.0 : .25);
      const token = generation;
      pauseTimer = setTimeout(() => { if (token === generation) { setTime(records[0].media.currentTime); pauseMedia(); emit(); } }, reason === 'tour-exit' ? 1050 : 280);
    } else { silence(); pauseMedia(); }
    emit(); return true;
  }
  async function seek(seconds) {
    if (disposed || !Number.isFinite(seconds)) return false;
    const resume = wantsPlay; generation++; clearTimeout(pauseTimer); starting = false; silence(); pauseMedia();
    setTime(seconds); state.error = null;
    if (!state.activated) { emit(); return true; }
    if (resume && state.currentTime < state.duration - .02) return begin('buffering');
    wantsPlay = false; state.status = state.currentTime >= state.duration - .02 ? 'ended' : 'paused';
    const token = generation; emit();
    try {
      for (const { media } of records) if (media.readyState >= 1) media.currentTime = state.currentTime;
      await waitUntil(() => records.every(({ media }) => media.readyState >= 2 && !media.seeking), token);
      return token === generation && !disposed;
    } catch (error) { return token === generation ? fail(error.message) : false; }
  }
  function finish() {
    if (disposed || !wantsPlay) return;
    silence(); pauseMedia(); setTime(state.duration);
    if (state.loop && !document.hidden) { state.loopCount++; setTime(0); void begin('buffering'); }
    else { generation++; wantsPlay = false; state.status = 'ended'; emit(); }
  }
  function tick() {
    if (disposed) return;
    for (let i = 0; i < records.length; i++) {
      const media = records[i].media, stem = state.stems[i]; stem.ready = media.readyState >= 3;
      let end = 0;
      for (let j = 0; j < media.buffered.length; j++) if (media.buffered.start(j) <= state.currentTime + .5) end = Math.max(end, media.buffered.end(j));
      stem.buffered = clamp(end / state.duration);
    }
    state.buffered = Math.min(...state.stems.map(stem => stem.buffered));
    if (state.status === 'playing') {
      const time = records[0].media.currentTime; setTime(time);
      if (time >= state.duration - .025) { finish(); return; }
      const times = records.map(({ media }) => media.currentTime);
      state.driftMs = (Math.max(...times) - Math.min(...times)) * 1000;
      state.maxDriftMs = Math.max(state.maxDriftMs, state.driftMs);
      if (state.driftMs > 100 && performance.now() - lastCorrection > 1000) {
        state.corrections++; lastCorrection = performance.now(); void begin('buffering'); return;
      }
      for (let i = 1; i < records.length; i++) {
        const delta = time - records[i].media.currentTime;
        records[i].media.playbackRate = Math.abs(delta) > .012 ? 1 + clamp(delta * .25, -.025, .025) : 1;
      }
      // One shared 8-second tail fade preserves every stem's relative balance.
      // The final MP4 samples remain intact; only the output envelope changes.
      if (state.duration - time < 8) {
        const fadeIn = smooth((context.currentTime - fadeStartedAt + .25) / 1.75);
        const fadeOut = smooth((state.duration - time - .25) / 8);
        ramp(envelope.gain, fadeIn * fadeOut, .25);
      }
    }
    emit();
  }
  function setVolume(value) { if (disposed || !Number.isFinite(value)) return false; state.volume = clamp(value); mix(); emit(); return true; }
  function setMuted(value) { if (disposed) return false; state.muted = Boolean(value); mix(); emit(); return true; }
  function changeStem(id, key, value) {
    const stem = state.stems.find(s => s.id === id); if (disposed || !stem) return false;
    if (key === 'gain' && !Number.isFinite(value)) return false;
    stem[key] = key === 'gain' ? clamp(value) : Boolean(value); mix(); emit(); return true;
  }
  function resetMix() { if (disposed) return false; state.stems.forEach(s => { s.gain = 1; s.muted = false; s.solo = false; }); mix(); emit(); return true; }
  function setLoop(value) { if (disposed) return false; state.loop = Boolean(value); emit(); return true; }
  function getDiagnostics() {
    let rms = 0;
    if (analyser) { analyser.getFloatTimeDomainData(meter); rms = Math.sqrt(meter.reduce((sum, value) => sum + value * value, 0) / meter.length); }
    return { contextState: context?.state || 'none', rms, envelopeGain: envelope?.gain.value || 0,
      streaming: true, decodedBuffers: 0,
      media: records.map(({ media, gain }, i) => ({ id: stems[i].id, time: media.currentTime,
        paused: media.paused, readyState: media.readyState, playbackRate: media.playbackRate, gain: gain.gain.value })) };
  }
  function getAnalysis() {
    const now = performance.now(), delta = Math.min(.1, Math.max(.001, (now - lastAnalysisAt) / 1000));
    lastAnalysisAt = now;
    const audible = !disposed && state.status === 'playing' && !state.muted && state.volume > 0;
    let bass = 0, mid = 0, treble = 0, energy = 0;
    if (audible && analyser) {
      analyser.getFloatTimeDomainData(meter); analyser.getFloatFrequencyData(frequencyBins);
      for (const sample of meter) energy += sample * sample;
      energy = clamp(Math.sqrt(energy / meter.length) * 7);
      const band = (low, high) => {
        const hz = context.sampleRate / analyser.fftSize;
        const first = Math.max(1, Math.ceil(low / hz)), last = Math.min(frequencyBins.length - 1, Math.floor(high / hz));
        let sum = 0; for (let i = first; i <= last; i++) sum += Math.pow(10, frequencyBins[i] / 10);
        return clamp(Math.sqrt(sum / Math.max(1, last - first + 1)) * 24);
      };
      bass = band(40, 200); mid = band(200, 2500); treble = band(2500, 12000);
    }
    for (const [key, target] of [['bass', bass], ['mid', mid], ['treble', treble], ['energy', energy]]) {
      const factor = 1 - Math.exp(-delta / (target > analysis[key] ? .065 : .3));
      analysis[key] += (target - analysis[key]) * factor;
      if (analysis[key] < .0001) analysis[key] = 0;
    }
    analysis.playing = audible;
    return analysis;
  }
  function hidden() { if (document.hidden && (wantsPlay || starting)) pause('hidden'); }
  listen(document, 'visibilitychange', hidden);
  function dispose() {
    if (disposed) return;
    generation++; wantsPlay = false; starting = false; clearTimeout(pauseTimer); clearInterval(tickTimer);
    silence(); pauseMedia(); listeners.splice(0).forEach(remove => remove());
    for (const { media, source, gain } of records) { media.removeAttribute('src'); media.load(); source.disconnect(); gain.disconnect(); }
    master?.disconnect(); envelope?.disconnect(); analyser?.disconnect();
    void context?.close().catch(() => {}); state.status = 'disposed'; state.ready = false; state.pauseReason = 'disposed';
    onChange(state); disposed = true;
  }
  return { state, play, pause, seek, setVolume, setMuted, setLoop, resetMix, dispose, getDiagnostics, getAnalysis,
    setStemGain: (id, value) => changeStem(id, 'gain', value),
    setStemMuted: (id, value) => changeStem(id, 'muted', value),
    setStemSolo: (id, value) => changeStem(id, 'solo', value) };
}
