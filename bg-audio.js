/**
 * Background Audio System v2
 * - Music on/off toggle visible to visitor (bottom-left, next to SFX toggle)
 * - Up to 5 tracks on loop (sequential)
 * - Generative audio mode that adapts to visitor interaction patterns
 * - Choice: generative or tracks in admin
 * - Auto-duck volume when interaction sounds play, fade-in when idle
 */
(function() {
  'use strict';

  var config = null;
  var started = false;
  var isPlaying = false;
  var mode = 'none';
  var masterVolume = 0.15;

  // Track mode
  var audioEl = null;
  var trackList = [];
  var currentTrackIdx = 0;

  // Generative mode
  var actx = null;
  var genMaster = null;
  var genDrones = [];
  var genTimerId = null;
  var genBeatCount = 0;
  var genReverb = null;
  var scrollRatio = 0;
  var clickRate = 0;
  var clickTimes = [];

  // Ducking
  var duckGain = null;
  var duckTimeout = null;

  var BPM = 72;
  var BEAT_SEC = 60 / BPM;
  var SCALES = {
    calm:   [261.63, 293.66, 329.63, 392.00, 440.00],
    active: [329.63, 369.99, 415.30, 493.88, 554.37],
    deep:   [130.81, 146.83, 164.81, 196.00, 220.00],
    bright: [523.25, 587.33, 659.26, 783.99, 880.00]
  };

  function loadConfig() {
    fetch('site-config.json')
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(cfg) {
        if (!cfg || !cfg.backgroundMusic) { createUI(); return; }
        config = cfg.backgroundMusic;
        mode = config.mode || 'none';
        masterVolume = config.volume !== undefined ? config.volume : 0.15;
        trackList = config.tracks || [];
        createUI();
        if (mode === 'none' || config.autoplay === false) return;
        ['click','scroll','keydown'].forEach(function(e) {
          document.addEventListener(e, startOnce, { once: true, passive: true });
        });
      })
      .catch(function() { createUI(); });
  }

  function startOnce() {
    if (started) return;
    started = true;
    startMusic();
  }

  function startMusic() {
    if (isPlaying) return;
    isPlaying = true;
    updateUI();
    if (mode === 'generative') startGenerative();
    else if (mode === 'tracks' && trackList.length > 0) startTracks();
  }

  function stopMusic() {
    isPlaying = false;
    updateUI();
    if (mode === 'generative') stopGenerative();
    else if (mode === 'tracks') stopTracks();
  }

  // === TRACK MODE ===
  function startTracks() {
    currentTrackIdx = 0;
    playTrack(0);
  }

  function playTrack(idx) {
    if (idx >= trackList.length) idx = 0;
    currentTrackIdx = idx;
    var t = trackList[idx];
    var url = typeof t === 'string' ? t : (t.url || '');
    if (!url) return;
    if (url.includes('spotify.com')) {
      var eu = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
      if (!eu.includes('?')) eu += '?utm_source=generator&theme=0';
      var f = document.createElement('iframe');
      f.src = eu; f.allow = 'autoplay; encrypted-media';
      f.style.cssText = 'position:fixed;bottom:-300px;left:-300px;width:1px;height:1px;opacity:0;pointer-events:none;border:none';
      f.setAttribute('aria-hidden','true');
      document.body.appendChild(f);
      return;
    }
    if (audioEl) { audioEl.pause(); audioEl.src = ''; }
    audioEl = new Audio(url);
    audioEl.volume = 0;
    audioEl.loop = trackList.length === 1;
    audioEl.play().then(function() {
      fadeAudio(audioEl, masterVolume, 2000);
    }).catch(function() {
      started = false;
      document.addEventListener('click', startOnce, { once: true, passive: true });
    });
    if (trackList.length > 1) {
      audioEl.addEventListener('ended', function() {
        playTrack((currentTrackIdx + 1) % trackList.length);
      });
    }
  }

  function stopTracks() {
    if (audioEl) { fadeAudio(audioEl, 0, 800); setTimeout(function() { if(audioEl){audioEl.pause();audioEl.src='';} }, 1000); }
    document.querySelectorAll('iframe[src*="spotify"]').forEach(function(f){f.remove();});
  }

  function fadeAudio(el, target, ms) {
    if (!el) return;
    var start = el.volume, steps = 25, step = 0;
    var iv = setInterval(function() {
      step++;
      el.volume = Math.max(0, Math.min(1, start + (target - start) * (step / steps)));
      if (step >= steps) clearInterval(iv);
    }, ms / steps);
  }

  // === GENERATIVE MODE ===
  function getCtx() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  function startGenerative() {
    var c = getCtx();
    genMaster = c.createGain();
    genMaster.gain.value = masterVolume;
    duckGain = c.createGain();
    duckGain.gain.value = 1;
    genMaster.connect(duckGain);
    duckGain.connect(c.destination);

    // Reverb
    var del = c.createDelay(1); del.delayTime.value = 0.3;
    var fb = c.createGain(); fb.gain.value = 0.3;
    var flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 1800;
    genReverb = c.createGain(); genReverb.gain.value = 0.35;
    genReverb.connect(del); del.connect(flt); flt.connect(fb); fb.connect(del); del.connect(duckGain);

    // Drones
    [130.81, 196.00, 261.63].forEach(function(freq) {
      var o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      var lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.06 + Math.random() * 0.04;
      var lg = c.createGain(); lg.gain.value = freq * 0.004;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start();
      var dg = c.createGain(); dg.gain.value = 0.05;
      o.connect(dg); dg.connect(genMaster); o.start();
      genDrones.push(o, lfo);
    });

    // Track interactions
    document.addEventListener('click', trackClick, { passive: true });
    window.addEventListener('scroll', function() {
      var ms = document.documentElement.scrollHeight - window.innerHeight;
      scrollRatio = ms > 0 ? window.scrollY / ms : 0;
    }, { passive: true });

    // Scheduler
    var nextBeat = c.currentTime + 0.1;
    genBeatCount = 0;
    function sched() {
      if (!isPlaying) return;
      while (nextBeat < c.currentTime + 0.1) { genBeat(c, nextBeat); nextBeat += BEAT_SEC; }
      genTimerId = setTimeout(sched, 25);
    }
    sched();
  }

  function stopGenerative() {
    if (genTimerId) { clearTimeout(genTimerId); genTimerId = null; }
    if (genMaster && actx) genMaster.gain.linearRampToValueAtTime(0, actx.currentTime + 1);
    setTimeout(function() { genDrones.forEach(function(o){try{o.stop();}catch(e){}}); genDrones=[]; }, 1500);
    document.removeEventListener('click', trackClick);
  }

  function trackClick() {
    clickTimes.push(Date.now());
    clickTimes = clickTimes.filter(function(t) { return Date.now() - t < 10000; });
    clickRate = clickTimes.length;
  }

  function genBeat(c, time) {
    genBeatCount++;
    var energy = Math.min(1, clickRate * 0.12);

    if (genBeatCount % 4 === 1) {
      var o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 55;
      var g = c.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.06 + energy * 0.04, time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
      o.connect(g); g.connect(genMaster); o.start(time); o.stop(time + 0.5);
    }

    var melodyMod = energy > 0.3 ? 2 : 3;
    if (genBeatCount % melodyMod === 0) {
      var sk = energy > 0.5 ? 'active' : scrollRatio > 0.6 ? 'bright' : scrollRatio > 0.3 ? 'calm' : 'deep';
      var sc = SCALES[sk];
      var freq = sc[Math.floor(Math.random() * sc.length)];
      var o2 = c.createOscillator(); o2.type = energy > 0.4 ? 'triangle' : 'sine'; o2.frequency.value = freq;
      var g2 = c.createGain(); var dur = BEAT_SEC * (1 + Math.random() * 2);
      g2.gain.setValueAtTime(0, time);
      g2.gain.linearRampToValueAtTime(0.03 + energy * 0.02, time + 0.08);
      g2.gain.exponentialRampToValueAtTime(0.001, time + dur);
      var fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1000 + energy * 1200;
      o2.connect(fl); fl.connect(g2); g2.connect(genMaster); g2.connect(genReverb);
      o2.start(time); o2.stop(time + dur);
    }

    if (genBeatCount % (energy > 0.3 ? 6 : 8) === 0) {
      var sf = SCALES.bright[Math.floor(Math.random() * SCALES.bright.length)];
      var so = c.createOscillator(); so.type = 'sine'; so.frequency.value = sf;
      var sg = c.createGain();
      sg.gain.setValueAtTime(0, time); sg.gain.linearRampToValueAtTime(0.012, time + 0.2);
      sg.gain.exponentialRampToValueAtTime(0.001, time + 2);
      so.connect(sg); sg.connect(genReverb); so.start(time); so.stop(time + 2);
    }
  }

  // === DUCKING ===
  window.BgAudioDuck = function() {
    if (!isPlaying) return;
    if (window.SoundFX && !window.SoundFX.isEnabled()) return;
    if (duckGain && actx) { duckGain.gain.cancelScheduledValues(actx.currentTime); duckGain.gain.setTargetAtTime(0.25, actx.currentTime, 0.05); }
    if (audioEl) fadeAudio(audioEl, masterVolume * 0.25, 100);
    clearTimeout(duckTimeout);
    duckTimeout = setTimeout(function() {
      if (duckGain && actx && isPlaying) duckGain.gain.setTargetAtTime(1, actx.currentTime, 0.4);
      if (audioEl && isPlaying) fadeAudio(audioEl, masterVolume, 500);
    }, 700);
  };

  // === UI ===
  function createUI() {
    var show = config && config.mode && config.mode !== 'none';
    var s = document.createElement('style');
    s.textContent = '.music-toggle{position:fixed;bottom:1.5rem;left:4.5rem;z-index:10001;height:36px;border-radius:18px;background:var(--c-bg-elevated,#141414);border:1px solid var(--c-border,#2A2A2A);cursor:pointer;display:flex;align-items:center;gap:6px;padding:0 12px;transition:all 200ms;opacity:0.5;font-family:var(--font-mono,"JetBrains Mono",monospace)}.music-toggle:hover{opacity:0.9;border-color:var(--c-accent,#C9A84C)}.music-toggle.on{opacity:0.8;border-color:var(--c-accent,#C9A84C)}.music-toggle__label{font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:var(--c-text-tertiary,#807A72);white-space:nowrap}.music-toggle.on .music-toggle__label{color:var(--c-accent,#C9A84C)}.music-toggle__bars{display:flex;align-items:flex-end;gap:1.5px;height:12px}.music-toggle__bars span{display:block;width:2px;background:var(--c-text-tertiary,#807A72);border-radius:1px;height:3px}.music-toggle.on .music-toggle__bars span{background:var(--c-accent,#C9A84C);animation:mb .8s ease-in-out infinite alternate}.music-toggle.on .music-toggle__bars span:nth-child(2){animation-delay:.15s}.music-toggle.on .music-toggle__bars span:nth-child(3){animation-delay:.3s}@keyframes mb{0%{height:3px}100%{height:12px}}';
    document.head.appendChild(s);

    if (!show) return;

    var btn = document.createElement('button');
    btn.className = 'music-toggle';
    btn.setAttribute('aria-label','Toggle background music');
    btn.title = 'Background music';
    btn.innerHTML = '<div class="music-toggle__bars"><span></span><span></span><span></span></div><span class="music-toggle__label">Music off</span>';
    btn.addEventListener('click', function() {
      if (isPlaying) stopMusic(); else { if(!started)started=true; startMusic(); }
      btn.classList.toggle('on', isPlaying);
      btn.querySelector('.music-toggle__label').textContent = isPlaying ? 'Music on' : 'Music off';
    });
    window._musicBtn = btn;
    document.body.appendChild(btn);
  }

  function updateUI() {
    var btn = window._musicBtn;
    if (!btn) return;
    btn.classList.toggle('on', isPlaying);
    var l = btn.querySelector('.music-toggle__label');
    if (l) l.textContent = isPlaying ? 'Music on' : 'Music off';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadConfig);
  else loadConfig();
})();
