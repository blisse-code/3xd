/**
 * Sound FX System
 * Plays subtle interaction sounds using Web Audio API.
 * Default state: ALL sounds OFF (including ambient music).
 * User toggles via a unified sound control button.
 */
(function() {
  'use strict';

  let ctx = null;
  let soundEnabled = false;
  const STORAGE_KEY = 'cb-sound-enabled';

  // Check saved preference (default: OFF)
  var saved = localStorage.getItem(STORAGE_KEY);
  soundEnabled = saved === 'true';

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // === SOUND DEFINITIONS ===
  function playClick() {
    if (!soundEnabled) return;
    var c = getCtx();
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.04, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.06);
  }

  function playHover() {
    if (!soundEnabled) return;
    var c = getCtx();
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.015, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.04);
  }

  function playChatOpen() {
    if (!soundEnabled) return;
    var c = getCtx();
    [440, 554, 659].forEach(function(freq, i) {
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, c.currentTime + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.03, c.currentTime + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.06 + 0.15);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime + i * 0.06);
      osc.stop(c.currentTime + i * 0.06 + 0.15);
    });
  }

  function playChatClose() {
    if (!soundEnabled) return;
    var c = getCtx();
    [659, 554, 440].forEach(function(freq, i) {
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, c.currentTime + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.025, c.currentTime + i * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.05 + 0.12);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime + i * 0.05);
      osc.stop(c.currentTime + i * 0.05 + 0.12);
    });
  }

  function playMessageSend() {
    if (!soundEnabled) return;
    var c = getCtx();
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, c.currentTime);
    osc.frequency.linearRampToValueAtTime(600, c.currentTime + 0.08);
    gain.gain.setValueAtTime(0.035, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.12);
  }

  function playMessageReceive() {
    if (!soundEnabled) return;
    var c = getCtx();
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, c.currentTime);
    osc.frequency.linearRampToValueAtTime(659, c.currentTime + 0.1);
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.03, c.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.2);
  }

  function playToggle() {
    if (!soundEnabled) return;
    var c = getCtx();
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = 700;
    gain.gain.setValueAtTime(0.03, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.08);
  }

  // === ATTACH TO DOM INTERACTIONS ===
  function attachSounds() {
    // Buttons and links click
    document.addEventListener('click', function(e) {
      var t = e.target.closest('a, button, .btn, .nav__link, .case-card, .article-card, .pillar, .social-link');
      if (t) playClick();
    }, { passive: true });

    // Nav link hover
    document.querySelectorAll('.nav__link, .btn, .social-link').forEach(function(el) {
      el.addEventListener('mouseenter', playHover, { passive: true });
    });

    // Theme toggle
    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', playToggle, { passive: true });
  }

  // === EXPOSE GLOBAL for chat widget integration ===
  window.SoundFX = {
    chatOpen: playChatOpen,
    chatClose: playChatClose,
    messageSend: playMessageSend,
    messageReceive: playMessageReceive,
    click: playClick,
    toggle: playToggle,
    isEnabled: function() { return soundEnabled; }
  };

  // === SOUND CONTROL UI (replaces separate music toggle) ===
  function createUI() {
    var style = document.createElement('style');
    style.textContent = [
      '.sfx-toggle{position:fixed;bottom:1.5rem;left:1.5rem;z-index:10001;height:36px;border-radius:18px;',
      'background:var(--c-bg-elevated,#141414);border:1px solid var(--c-border,#2A2A2A);cursor:pointer;',
      'display:flex;align-items:center;gap:6px;padding:0 12px;transition:all 200ms;opacity:0.5;font-size:0;',
      'font-family:var(--font-mono,"JetBrains Mono",monospace)}',
      '.sfx-toggle:hover{opacity:0.9;border-color:var(--c-accent,#C9A84C)}',
      '.sfx-toggle.on{opacity:0.8;border-color:var(--c-accent,#C9A84C)}',
      '.sfx-toggle__icon{width:16px;height:16px;color:var(--c-text-secondary,#B5AFA6)}',
      '.sfx-toggle.on .sfx-toggle__icon{color:var(--c-accent,#C9A84C)}',
      '.sfx-toggle__label{font-size:9px;letter-spacing:0.08em;text-transform:uppercase;',
      'color:var(--c-text-tertiary,#807A72);white-space:nowrap}'
    ].join('\n');
    document.head.appendChild(style);

    var btn = document.createElement('button');
    btn.className = 'sfx-toggle' + (soundEnabled ? ' on' : '');
    btn.setAttribute('aria-label', 'Toggle interaction sounds');
    btn.title = 'Toggle interaction sounds';
    btn.innerHTML = '<svg class="sfx-toggle__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
      '<path d="M15.54 8.46a5 5 0 010 7.07"/>' +
      '<path d="M19.07 4.93a10 10 0 010 14.14"/>' +
      '</svg>' +
      '<span class="sfx-toggle__label">' + (soundEnabled ? 'SFX on' : 'SFX off') + '</span>';

    btn.addEventListener('click', function() {
      soundEnabled = !soundEnabled;
      localStorage.setItem(STORAGE_KEY, soundEnabled ? 'true' : 'false');
      btn.classList.toggle('on', soundEnabled);
      btn.querySelector('.sfx-toggle__label').textContent = soundEnabled ? 'SFX on' : 'SFX off';
      if (soundEnabled) playToggle();
    });

    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      attachSounds();
      createUI();
    });
  } else {
    attachSounds();
    createUI();
  }
})();
