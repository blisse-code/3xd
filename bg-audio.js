/**
 * Background Audio System
 * Plays background music from Spotify embed or uploaded audio file.
 * NO frontend UI - controlled entirely from admin panel via site-config.json.
 * Auto-plays after first user interaction (browser autoplay policy).
 *
 * site-config.json fields:
 *   backgroundMusic.type: "spotify" | "file" | "none"
 *   backgroundMusic.url: Spotify track/playlist URL or path to audio file
 *   backgroundMusic.volume: 0.0 to 1.0 (default 0.15)
 *   backgroundMusic.autoplay: true/false (default true)
 */
(function() {
  'use strict';

  var config = null;
  var started = false;
  var audioEl = null;
  var spotifyFrame = null;

  function loadConfig() {
    fetch('site-config.json')
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(cfg) {
        if (!cfg || !cfg.backgroundMusic) return;
        config = cfg.backgroundMusic;
        if (config.type === 'none' || !config.url) return;
        if (config.autoplay === false) return;

        // Wait for first user interaction to start audio
        document.addEventListener('click', startOnce, { once: true, passive: true });
        document.addEventListener('scroll', startOnce, { once: true, passive: true });
        document.addEventListener('keydown', startOnce, { once: true, passive: true });
      })
      .catch(function() {});
  }

  function startOnce() {
    if (started || !config) return;
    started = true;

    if (config.type === 'spotify') {
      startSpotify(config.url);
    } else if (config.type === 'file') {
      startAudioFile(config.url, config.volume || 0.15);
    }
  }

  function startSpotify(url) {
    // Convert Spotify URL to embed URL
    // Input: https://open.spotify.com/track/xxx or https://open.spotify.com/playlist/xxx
    // Output: https://open.spotify.com/embed/track/xxx?utm_source=generator&theme=0
    var embedUrl = url;
    if (url.includes('open.spotify.com') && !url.includes('/embed/')) {
      embedUrl = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
    }
    if (!embedUrl.includes('?')) {
      embedUrl += '?utm_source=generator&theme=0';
    }

    // Create invisible iframe
    spotifyFrame = document.createElement('iframe');
    spotifyFrame.src = embedUrl;
    spotifyFrame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    spotifyFrame.loading = 'lazy';
    spotifyFrame.style.cssText = 'position:fixed;bottom:-200px;left:-200px;width:1px;height:1px;opacity:0;pointer-events:none;border:none;z-index:-9999';
    spotifyFrame.setAttribute('aria-hidden', 'true');
    spotifyFrame.tabIndex = -1;
    document.body.appendChild(spotifyFrame);
  }

  function startAudioFile(url, volume) {
    audioEl = new Audio(url);
    audioEl.volume = Math.max(0, Math.min(1, volume));
    audioEl.loop = true;
    audioEl.preload = 'auto';

    // Fade in over 3 seconds
    audioEl.volume = 0;
    var targetVol = Math.max(0, Math.min(1, volume));
    audioEl.play().then(function() {
      var steps = 30;
      var step = 0;
      var interval = setInterval(function() {
        step++;
        audioEl.volume = (step / steps) * targetVol;
        if (step >= steps) clearInterval(interval);
      }, 100);
    }).catch(function() {
      // Autoplay blocked, try again on next click
      started = false;
      document.addEventListener('click', startOnce, { once: true, passive: true });
    });
  }

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadConfig);
  } else {
    loadConfig();
  }
})();
