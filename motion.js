/**
 * Motion Design System
 * Vanilla JS/CSS equivalents of MagicUI, HeroUI, Aceternity, motion-primitives.
 * - Canvas particle background
 * - Card tilt on hover (motion-primitives style)
 * - Image zoom/blur entrance (HeroUI style)
 * - Micro-transitions on interactive elements
 * - Magnetic cursor effect on CTAs
 * - Smooth counter animation on stats
 * - Staggered card entrances
 */
(function() {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ===== 1. PARTICLE BACKGROUND (configurable presets + density) =====
  function initParticles() {
    fetch('site-config.json').then(function(r){return r.ok?r.json():null}).then(function(cfg) {
      var pc = (cfg && cfg.particles) || { preset: 'connections', density: 3 };
      buildParticles(pc.preset || 'connections', pc.density || 3);
    }).catch(function() { buildParticles('connections', 3); });
  }

  function buildParticles(preset, density) {
    var canvas = document.createElement('canvas');
    canvas.id = 'particles-bg';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0.5';
    document.body.prepend(canvas);

    var ctx = canvas.getContext('2d');
    var particles = [];
    var mouse = { x: -1000, y: -1000 };
    var BASE_COUNT = [20, 40, 60, 90, 120];
    var PARTICLE_COUNT = Math.min(BASE_COUNT[density - 1] || 60, Math.floor(window.innerWidth / 12));
    var CONNECTION_DIST = 100 + density * 15;

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', debounce(resize, 200));
    document.addEventListener('mousemove', function(e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

    var accentHex = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() || '#C9A84C';
    function hexRgb(h) { h = h.replace('#',''); return { r: parseInt(h.substr(0,2),16), g: parseInt(h.substr(2,2),16), b: parseInt(h.substr(4,2),16) }; }
    var rgb = hexRgb(accentHex);

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * (canvas.width||800),
        y: Math.random() * (canvas.height||600),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.6 + 0.15,
        phase: Math.random() * Math.PI * 2
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      var t = Date.now() * 0.001;

      particles.forEach(function(p) {
        // Mouse interaction
        var dx = p.x - mouse.x, dy = p.y - mouse.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          var force = (180 - dist) / 180 * 0.015;
          p.vx += dx * force;
          p.vy += dy * force;
        }
        p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;

        // Preset-specific rendering
        if (preset === 'fireflies') {
          var glow = 0.3 + 0.7 * Math.sin(t * 1.5 + p.phase);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (p.alpha * glow) + ')';
          ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.3)';
          ctx.fill(); ctx.shadowBlur = 0;
        } else if (preset === 'matrix') {
          p.vy = Math.abs(p.vy) + 0.3;
          if (p.y > canvas.height) { p.y = 0; p.x = Math.random() * canvas.width; }
          ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (p.alpha * 0.6) + ')';
          ctx.fillRect(p.x, p.y, 1.5, 6 + Math.random() * 8);
        } else if (preset === 'aurora') {
          var wave = Math.sin(p.x * 0.005 + t + p.phase) * 40;
          ctx.beginPath(); ctx.arc(p.x, p.y + wave, p.size, 0, Math.PI * 2);
          var hue = (p.x / canvas.width * 60 + t * 20) % 360;
          ctx.fillStyle = 'hsla(' + (30 + hue * 0.3) + ', 70%, 60%, ' + (p.alpha * 0.4) + ')';
          ctx.fill();
        } else {
          // connections + constellation
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + p.alpha + ')';
          ctx.fill();
        }
      });

      // Connections (for connections + constellation presets)
      if (preset === 'connections' || preset === 'constellation') {
        var lineWidth = preset === 'constellation' ? 0.3 : 0.6;
        var glowing = preset === 'connections';
        for (var i = 0; i < particles.length; i++) {
          for (var j = i + 1; j < particles.length; j++) {
            var dx = particles[i].x - particles[j].x;
            var dy = particles[i].y - particles[j].y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CONNECTION_DIST) {
              var alpha = (1 - dist / CONNECTION_DIST) * (glowing ? 0.18 : 0.08);
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.strokeStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
              ctx.lineWidth = lineWidth;
              ctx.stroke();
            }
          }
        }
      }

      requestAnimationFrame(animate);
    }
    animate();
  }

  // ===== 2. TILT EFFECT (motion-primitives style) =====
  function initTilt() {
    var cards = document.querySelectorAll('.case-card, .brand-card, .pillar, .testimonial-card, .stat');

    cards.forEach(function(card) {
      card.style.transition = 'transform 0.3s cubic-bezier(0.22,1,0.36,1)';
      card.style.transformStyle = 'preserve-3d';
      card.style.willChange = 'transform';

      card.addEventListener('mousemove', function(e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var centerX = rect.width / 2;
        var centerY = rect.height / 2;

        var rotateX = ((y - centerY) / centerY) * -4;
        var rotateY = ((x - centerX) / centerX) * 4;

        card.style.transform = 'perspective(800px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) scale3d(1.02,1.02,1.02) translateY(-3px)';
      });

      card.addEventListener('mouseleave', function() {
        card.style.transform = '';
      });
    });
  }

  // ===== 3. IMAGE ANIMATION (HeroUI zoom/blur entrance) =====
  function initImageAnimations() {
    var style = document.createElement('style');
    style.textContent = [
      '@keyframes imgReveal{from{opacity:0;filter:blur(12px);transform:scale(1.08)}to{opacity:1;filter:blur(0);transform:scale(1)}}',
      '.img-reveal{animation:imgReveal 0.8s cubic-bezier(0.22,1,0.36,1) both}',
      '.case-card__visual img,.article-card img,.testimonial-card img{transition:transform 0.6s cubic-bezier(0.22,1,0.36,1)}',
      '.case-card:hover .case-card__visual img,.article-card:hover img{transform:scale(1.05)}'
    ].join('\n');
    document.head.appendChild(style);

    // Observe images entering viewport
    var imgObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('img-reveal');
          imgObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.case-card__visual, .brand-card, .stat').forEach(function(el) {
      imgObserver.observe(el);
    });
  }

  // ===== 4. MICRO-TRANSITIONS =====
  function initMicroTransitions() {
    var style = document.createElement('style');
    style.textContent = [
      // Smooth link underline animation
      '.nav__link{position:relative}',
      '.nav__link::after{content:"";position:absolute;bottom:-2px;left:0;width:0;height:1px;background:var(--c-accent);transition:width 0.3s cubic-bezier(0.22,1,0.36,1)}',
      '.nav__link:hover::after{width:100%}',

      // Button press effect
      '.btn:active{transform:scale(0.97);transition:transform 0.1s}',

      // Tag subtle pulse on hover
      '.tag{transition:all 0.2s cubic-bezier(0.22,1,0.36,1)}',
      '.tag:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,0.1)}',

      // Social link icon lift
      '.social-link{transition:all 0.25s cubic-bezier(0.22,1,0.36,1)}',
      '.social-link:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.08)}',

      // Section label fade slide
      '.section-label{transition:opacity 0.6s,transform 0.6s;transition-timing-function:cubic-bezier(0.22,1,0.36,1)}',

      // Divider glow on scroll
      '.divider{transition:box-shadow 0.6s}',
      '.divider:hover{box-shadow:0 0 8px rgba(201,168,76,0.15)}',

      // Stat number shimmer
      '@keyframes statShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}',
      '.stat__number{background:linear-gradient(90deg,var(--c-accent) 0%,var(--c-accent-hover) 50%,var(--c-accent) 100%);background-size:200% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}',

      // Case card CTA arrow bounce
      '.case-card__cta{transition:gap 0.3s}',
      '.case-card:hover .case-card__cta{gap:var(--sp-3,0.75rem)}',

      // Testimonial card quote icon pulse
      '.testimonial-card:hover .testimonial-card__icon{opacity:0.7;transform:scale(1.1);transition:all 0.3s}',

      // Avatar ring on hover
      '.testimonial-card:hover .testimonial-card__avatar{border-color:var(--c-accent);box-shadow:0 0 0 3px var(--c-accent-muted)}',
      '.testimonial-card__avatar{transition:all 0.3s}',

      // Smooth scroll indicator pulse
      '.hero__scroll-hint svg{transition:transform 0.3s}',
      '.hero__scroll-hint:hover svg{transform:translateY(3px)}',

      // Contact title gradient shift
      '.contact__title em{transition:color 0.5s}',

      // Footer admin link subtle
      '.footer__admin{transition:opacity 0.3s,letter-spacing 0.3s}',
      '.footer__admin:hover{letter-spacing:0.1em}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ===== 5. STAT COUNTER ANIMATION =====
  function initCounters() {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var text = el.textContent.trim();
        var match = text.match(/^(\d+)/);
        if (!match) return;

        var target = parseInt(match[1]);
        var suffix = text.replace(/^\d+/, '');
        var start = 0;
        var duration = 1200;
        var startTime = null;

        function step(timestamp) {
          if (!startTime) startTime = timestamp;
          var progress = Math.min((timestamp - startTime) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          var current = Math.round(start + (target - start) * eased);
          el.textContent = current + suffix;
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        observer.unobserve(el);
      });
    }, { threshold: 0.5 });

    document.querySelectorAll('.stat__number').forEach(function(el) {
      observer.observe(el);
    });
  }

  // ===== 6. STAGGERED REVEAL =====
  function initStaggeredReveal() {
    var groups = [
      { selector: '.pillars__grid .pillar', delay: 80 },
      { selector: '.testimonials__grid .testimonial-card', delay: 120 },
      { selector: '.about__stats .stat', delay: 100 }
    ];

    groups.forEach(function(group) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (!entry.isIntersecting) return;
          var parent = entry.target;
          var children = parent.querySelectorAll(group.selector.split(' ').pop());
          children.forEach(function(child, i) {
            child.style.opacity = '0';
            child.style.transform = 'translateY(20px)';
            child.style.transition = 'opacity 0.5s cubic-bezier(0.22,1,0.36,1), transform 0.5s cubic-bezier(0.22,1,0.36,1)';
            child.style.transitionDelay = (i * group.delay) + 'ms';
            setTimeout(function() {
              child.style.opacity = '1';
              child.style.transform = 'translateY(0)';
            }, 50);
          });
          observer.unobserve(parent);
        });
      }, { threshold: 0.15 });

      var parentSelector = group.selector.split(' ').slice(0, -1).join(' ');
      document.querySelectorAll(parentSelector).forEach(function(el) {
        observer.observe(el);
      });
    });
  }

  // ===== 7. MAGNETIC CTA BUTTONS =====
  function initMagneticButtons() {
    document.querySelectorAll('.btn--primary').forEach(function(btn) {
      btn.addEventListener('mousemove', function(e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = 'translate(' + (x * 0.15) + 'px,' + (y * 0.15) + 'px)';
      });
      btn.addEventListener('mouseleave', function() {
        btn.style.transform = '';
        btn.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
        setTimeout(function() { btn.style.transition = ''; }, 400);
      });
    });
  }

  // ===== UTILITIES =====
  function debounce(fn, ms) {
    var timer;
    return function() {
      clearTimeout(timer);
      var args = arguments;
      var ctx = this;
      timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
    };
  }

  // ===== INIT =====
  function init() {
    initParticles();
    initTilt();
    initImageAnimations();
    initMicroTransitions();
    initCounters();
    initStaggeredReveal();
    initMagneticButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
