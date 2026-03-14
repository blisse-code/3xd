/**
 * Ambient Music System - 72 BPM
 * Generative soothing ambient music using Web Audio API.
 * Responds to scroll position to subtly shift character.
 * User must click to start (browser autoplay policy).
 */
(function() {
  'use strict';

  let ctx = null;
  let isPlaying = false;
  let masterGain = null;
  let scrollRatio = 0;
  let nextBeatTime = 0;
  let timerId = null;

  const BPM = 72;
  const BEAT_SEC = 60 / BPM;
  const SCHEDULE_AHEAD = 0.1;
  const LOOK_AHEAD_MS = 25;

  // Musical scales (pentatonic for guaranteed pleasant harmony)
  const SCALES = {
    warm:    [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33],  // C major pentatonic + octave
    deep:    [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66],  // C lower
    bright:  [523.25, 587.33, 659.26, 783.99, 880.00, 1046.50],         // C high
  };

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master volume
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);

    // Reverb (convolution-free approach: feedback delay)
    window._ambientReverb = createReverb();
    window._ambientReverb.connect(masterGain);

    // Track scroll for tonal shifts
    window.addEventListener('scroll', function() {
      var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      scrollRatio = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    }, { passive: true });
  }

  function createReverb() {
    var delay = ctx.createDelay(1);
    delay.delayTime.value = 0.3;
    var feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    var input = ctx.createGain();
    input.gain.value = 0.4;
    input.connect(delay);
    delay.connect(filter);
    filter.connect(feedback);
    feedback.connect(delay);
    delay.connect(masterGain);

    return input;
  }

  function start() {
    if (!ctx) init();
    if (ctx.state === 'suspended') ctx.resume();

    isPlaying = true;
    nextBeatTime = ctx.currentTime + 0.05;

    // Fade in
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 2);

    // Start drone
    startDrone();

    // Start scheduler
    scheduler();
  }

  function stop() {
    isPlaying = false;
    if (masterGain && ctx) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
    }
    if (timerId) { clearTimeout(timerId); timerId = null; }
    // Stop drone after fade
    setTimeout(function() {
      if (window._droneOscs) {
        window._droneOscs.forEach(function(o) { try { o.stop(); } catch(e) {} });
        window._droneOscs = [];
      }
    }, 2000);
  }

  // === DRONE (sustained pad that shifts with scroll) ===
  function startDrone() {
    if (window._droneOscs) {
      window._droneOscs.forEach(function(o) { try { o.stop(); } catch(e) {} });
    }
    window._droneOscs = [];

    var baseFreqs = [130.81, 196.00, 261.63]; // C2, G2, C3
    var droneGain = ctx.createGain();
    droneGain.gain.value = 0.06;
    droneGain.connect(masterGain);
    droneGain.connect(window._ambientReverb);

    baseFreqs.forEach(function(freq) {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // Gentle LFO for movement
      var lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.08 + Math.random() * 0.05;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * 0.003;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      osc.connect(droneGain);
      osc.start();
      window._droneOscs.push(osc, lfo);
    });

    // Shift drone based on scroll (every 3 seconds)
    function shiftDrone() {
      if (!isPlaying) return;
      var shift = 1 + scrollRatio * 0.12; // Subtle pitch rise as you scroll
      if (window._droneOscs) {
        for (var i = 0; i < window._droneOscs.length; i += 2) {
          var osc = window._droneOscs[i];
          if (osc && osc.frequency) {
            var base = baseFreqs[i / 2] || 130.81;
            osc.frequency.setTargetAtTime(base * shift, ctx.currentTime, 2);
          }
        }
      }
      setTimeout(shiftDrone, 3000);
    }
    shiftDrone();
  }

  // === BEAT SCHEDULER ===
  function scheduler() {
    while (nextBeatTime < ctx.currentTime + SCHEDULE_AHEAD) {
      scheduleBeat(nextBeatTime);
      nextBeatTime += BEAT_SEC;
    }
    if (isPlaying) {
      timerId = setTimeout(scheduler, LOOK_AHEAD_MS);
    }
  }

  var beatCount = 0;
  function scheduleBeat(time) {
    beatCount++;

    // Subtle pulse every beat (soft kick at 72bpm)
    if (beatCount % 4 === 1) {
      playPulse(time);
    }

    // Melodic note every 2-4 beats (random)
    if (beatCount % (2 + Math.floor(Math.random() * 3)) === 0) {
      playMelody(time);
    }

    // Shimmer every 8 beats
    if (beatCount % 8 === 0) {
      playShimmer(time);
    }
  }

  function playPulse(time) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55; // Sub bass A1
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  function playMelody(time) {
    // Pick scale based on scroll position
    var scaleKey = scrollRatio < 0.3 ? 'warm' : scrollRatio < 0.7 ? 'deep' : 'bright';
    var scale = SCALES[scaleKey];
    var freq = scale[Math.floor(Math.random() * scale.length)];

    var osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    var gain = ctx.createGain();
    var duration = BEAT_SEC * (1 + Math.random() * 2);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.04, time + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200 + scrollRatio * 800;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    gain.connect(window._ambientReverb);
    osc.start(time);
    osc.stop(time + duration);
  }

  function playShimmer(time) {
    var freq = SCALES.bright[Math.floor(Math.random() * SCALES.bright.length)];
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.015, time + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 2.5);

    osc.connect(gain);
    gain.connect(window._ambientReverb);
    osc.start(time);
    osc.stop(time + 2.5);
  }

  // === UI ===
  function createUI() {
    var style = document.createElement('style');
    style.textContent = [
      '.amb-toggle{position:fixed;bottom:1.5rem;left:1.5rem;z-index:10001;width:40px;height:40px;border-radius:50%;',
      'background:var(--c-bg-elevated,#141414);border:1px solid var(--c-border,#2A2A2A);cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;transition:all 200ms;opacity:0.5}',
      '.amb-toggle:hover{opacity:0.9;border-color:var(--c-accent,#C9A84C)}',
      '.amb-toggle.playing{opacity:0.8;border-color:var(--c-accent,#C9A84C)}',
      '.amb-toggle.playing .amb-bars span{animation:amb-bar 0.8s ease-in-out infinite alternate}',
      '.amb-bars{display:flex;align-items:flex-end;gap:2px;height:14px}',
      '.amb-bars span{display:block;width:2px;background:var(--c-accent,#C9A84C);border-radius:1px;height:4px;transition:height 0.3s}',
      '.amb-bars span:nth-child(1){animation-delay:0s}',
      '.amb-bars span:nth-child(2){animation-delay:0.15s}',
      '.amb-bars span:nth-child(3){animation-delay:0.3s}',
      '.amb-bars span:nth-child(4){animation-delay:0.45s}',
      '@keyframes amb-bar{0%{height:3px}100%{height:14px}}',
      '.amb-toggle:not(.playing) .amb-bars span{height:2px!important;animation:none!important}',
      '@media(prefers-reduced-motion:reduce){.amb-bars span{animation:none!important}}'
    ].join('\n');
    document.head.appendChild(style);

    var btn = document.createElement('button');
    btn.className = 'amb-toggle';
    btn.setAttribute('aria-label', 'Toggle ambient music');
    btn.title = 'Ambient music (72 BPM)';
    btn.innerHTML = '<div class="amb-bars"><span></span><span></span><span></span><span></span></div>';

    btn.addEventListener('click', function() {
      if (isPlaying) {
        stop();
        btn.classList.remove('playing');
      } else {
        start();
        btn.classList.add('playing');
      }
    });

    document.body.appendChild(btn);
  }

  // Init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createUI);
  } else {
    createUI();
  }
})();
