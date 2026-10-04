/* Stable Syntax — "Luminous Editorial"

  ScrollTrigger handles entrances, CSS scroll timelines handle parallax and
  read progress, and IntersectionObserver is the motion-library fallback.
  Pointer effects stay limited to fine pointers; other loops are on demand.

   Order: theme, nav, headline split, reveals, marquee, pointer sheen,
   magnetics, counters, form, year. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function onView(el, cb, opts) {
    if (!('IntersectionObserver' in window)) { cb(el); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        cb(entry.target);
        io.unobserve(entry.target);
      });
    }, opts || { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
  }

  /* ------------------------------------------------- smooth scroll (trial) */

  /* Lenis, on trial rather than adopted. Load with ?lenis=off to compare
     against the native scroll — that switch is the whole point of it being
     here, so leave it in until the question is settled.

     Two things it is worth knowing before keeping it:

     1. Lenis scrolls for real (it eases window.scrollTo on a rAF), so the CSS
        scroll timelines driving the read-progress bar and the media parallax
        keep working. What changes is that scroll position is now written from
        the main thread every frame, so those animations lose the off-main-
        thread advantage they currently have for free.
     2. It replaces the browser's scrolling, which means keyboard paging, scroll
        anchoring and trackpad momentum are all now its problem rather than the
        platform's. That is the real cost, and it is not visible in a demo. */

  var lenis = null;
  var lenisOff = /(?:^|[?&])lenis=off(?:&|$)/.test(window.location.search);

  if (!reduced && !lenisOff && typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.05,          // shorter than the 1.2 default; 1.2 reads as syrup
      smoothWheel: true,
      touchMultiplier: 1.6
    });

    // Tells the stylesheet to drop scroll-behavior:smooth, which would otherwise
    // be a second easing fighting Lenis for the same scrollTop.
    document.documentElement.dataset.lenis = 'on';

    (function lenisLoop(time) {
      lenis.raf(time);
      requestAnimationFrame(lenisLoop);
    })(0);
  }

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;

  if (gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    if (lenis) lenis.on('scroll', ScrollTrigger.update);
  }

  /* Anchor links have to go through Lenis, or they jump instantly: the CSS
     smooth scrolling that used to handle them is switched off above. Focus is
     moved by hand too, because preventDefault() skips the browser's own
     "make the fragment target the focus start point" behaviour. */
  if (lenis) {
    var navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 76;

    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[href^="#"]');
      if (!link) return;

      var hash = link.getAttribute('href');
      if (!hash || hash === '#') return;

      var target = document.querySelector(hash);
      if (!target) return;

      event.preventDefault();
      lenis.scrollTo(target, { offset: -(navH + 24) });
      history.pushState(null, '', hash);

      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  /* ------------------------------------------------------------- theme */

  var themeBtn = document.getElementById('themebtn');
  var themeText = document.getElementById('themebtn-text');
  var themeColor = document.getElementById('theme-color');

  function paintTheme() {
    var dark = document.documentElement.dataset.theme === 'dark';
    themeText.textContent = dark ? 'Switch to light mode' : 'Switch to dark mode';
    themeBtn.setAttribute('title', themeText.textContent);
    // The browser chrome follows the site's theme, not the OS. Keying the meta
    // to prefers-color-scheme instead would put light chrome above a dark page
    // for anyone whose choice differs from their system setting.
    if (themeColor) themeColor.setAttribute('content', dark ? '#08090D' : '#F6F8FC');
  }

  if (themeBtn) {
    paintTheme();
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('ss-theme', next); } catch (e) { /* private mode */ }
      paintTheme();
    });
  }

  /* --------------------------------------------------------------- nav */

  var nav = document.getElementById('nav');
  var sentinel = document.getElementById('top-sentinel');

  if (nav && sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      nav.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  }

  /* ------------------------------------------------------- menu disclosure */

  /* Below 900px .nav__links is a panel rather than a row, and this is what
     opens it. A plain disclosure, not a modal: Escape and outside-press close
     it, but focus is not trapped — there is nothing behind it to protect. */

  var menuBtn = document.getElementById('menubtn');
  var menuText = document.getElementById('menubtn-text');
  var wideEnough = window.matchMedia('(min-width: 901px)');

  if (nav && menuBtn && menuText) {
    var menuOpen = function () { return menuBtn.getAttribute('aria-expanded') === 'true'; };

    var setMenu = function (open) {
      nav.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuText.textContent = open ? 'Close menu' : 'Open menu';
      menuBtn.setAttribute('title', menuText.textContent);
    };

    menuBtn.addEventListener('click', function () { setMenu(!menuOpen()); });

    // Every link here is an in-page jump, so leaving the panel open would park
    // it directly over the section it just scrolled to.
    nav.querySelectorAll('.nav__links a').forEach(function (link) {
      link.addEventListener('click', function () { setMenu(false); });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !menuOpen()) return;
      setMenu(false);
      menuBtn.focus();          // Escape must not strand focus inside a hidden panel
    });

    document.addEventListener('pointerdown', function (event) {
      if (menuOpen() && !nav.contains(event.target)) setMenu(false);
    });

    // Crossing back to desktop with the panel open would strand `is-open` on a
    // nav whose links are already visible, leaving the X frozen on the button.
    wideEnough.addEventListener('change', function (event) {
      if (event.matches) setMenu(false);
    });
  }

  /* ---------------------------------------------------- headline split */

  /* Words are wrapped so each one can rise out of an overflow mask. Element
     children (the gradient <em>) are wrapped whole rather than descended
     into — an inline-block inside a background-clip:text element breaks the
     clip in some engines. */
  function wrapWord(child, index) {
    var w = document.createElement('span');
    var inner = document.createElement('i');
    w.className = 'w';
    inner.style.setProperty('--wi', index);
    inner.appendChild(child);
    w.appendChild(inner);
    return w;
  }

  var headline = document.querySelector('[data-split]');

  if (headline) {
    var frag = document.createDocumentFragment();
    var index = 0;

    Array.prototype.slice.call(headline.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/\s+/).forEach(function (word) {
          if (!word) return;
          frag.appendChild(wrapWord(document.createTextNode(word), index++));
          frag.appendChild(document.createTextNode(' '));
        });
      } else if (node.nodeType === 1) {
        frag.appendChild(wrapWord(node.cloneNode(true), index++));
        frag.appendChild(document.createTextNode(' '));
      }
    });

    headline.textContent = '';
    headline.appendChild(frag);
    headline.classList.add('is-split');

    // Two frames: one for the browser to lay the wrapped words out, one for the
    // transition to have a start value to run from.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { headline.classList.add('is-in'); });
    });
  }

  /* ----------------------------------------------------------- reveals */

  var revealables = document.querySelectorAll('.reveal');
  var handledReveals = new Set();

  function markRevealed(elements) {
    elements.forEach(function (el) {
      handledReveals.add(el);
    });
  }

  function scrollReveal(elements, trigger, options) {
    if (!elements.length) return;
    markRevealed(elements);

    var settings = options || {};
    var delay = settings.delay || 0;

    gsap.fromTo(elements, {
      autoAlpha: 0,
      y: settings.y === undefined ? 22 : settings.y,
      filter: settings.blur ? 'blur(7px)' : 'blur(0px)'
    }, {
      autoAlpha: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: settings.duration || 0.82,
      delay: delay,
      stagger: settings.stagger || 0,
      ease: 'power3.out',
      clearProps: 'opacity,transform,visibility,filter',
      onStart: function () {
        elements.forEach(function (el) { el.classList.add('is-in'); });
      },
      scrollTrigger: {
        trigger: trigger,
        start: settings.start || 'top 84%',
        once: true
      }
    });
  }

  if (reduced) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else if (gsap && ScrollTrigger) {
    gsap.utils.toArray('.head').forEach(function (head) {
      var items = Array.prototype.slice.call(head.querySelectorAll('.reveal'));
      scrollReveal(items, head, { stagger: 0.11, blur: true, start: 'top 86%' });
    });

    document.querySelectorAll('.work__intro').forEach(function (intro) {
      scrollReveal([intro], intro, { y: 28, blur: true, duration: 0.95 });
    });

    document.querySelectorAll('.bento').forEach(function (bento) {
      var items = Array.prototype.slice.call(bento.querySelectorAll(':scope > .reveal'));
      scrollReveal(items, bento, { stagger: 0.1, y: 26 });
    });

    document.querySelectorAll('.why__showcase').forEach(function (showcase) {
      var spotlight = showcase.querySelector('.why__spotlight');
      var stackItems = Array.prototype.slice.call(showcase.querySelectorAll('.why__item'));
      if (spotlight) scrollReveal([spotlight], showcase, { y: 30, duration: 0.9 });
      if (stackItems.length) scrollReveal(stackItems, showcase, { stagger: 0.12, y: 20 });
    });

    document.querySelectorAll('.about__list').forEach(function (list) {
      var items = Array.prototype.slice.call(list.querySelectorAll('li'));
      scrollReveal([list], list, { y: 18, duration: 0.72 });
      if (items.length) {
        gsap.fromTo(items, { autoAlpha: 0, x: -12 }, {
          autoAlpha: 1,
          x: 0,
          duration: 0.62,
          stagger: 0.08,
          ease: 'power3.out',
          clearProps: 'opacity,transform,visibility',
          scrollTrigger: { trigger: list, start: 'top 84%', once: true }
        });
      }
    });

    document.querySelectorAll('.phases').forEach(function (phases) {
      var items = Array.prototype.slice.call(phases.querySelectorAll('.phase.reveal'));
      scrollReveal(items, phases, { stagger: 0.13, y: 20, duration: 0.72, start: 'top 82%' });
    });

    document.querySelectorAll('.work__item').forEach(function (item, index) {
      var preview = item.querySelector('.work__preview');
      var image = item.querySelector('.work__screen img');
      var copy = item.querySelector('.work__copy');
      markRevealed([item]);

      var timeline = gsap.timeline({
        scrollTrigger: {
          trigger: item,
          start: 'top 90%',
          end: 'top 38%',
          scrub: 0.9,
          once: true
        }
      });

      if (preview) {
        timeline.fromTo(preview, {
          clipPath: index % 2 === 0 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)',
          autoAlpha: 0
        }, {
          clipPath: 'inset(0 0 0 0)',
          autoAlpha: 1,
          duration: 1.25,
          ease: 'power3.inOut'
        }, 0);
      }
      if (image) {
        timeline.fromTo(image, { scale: 1.16, yPercent: 7, autoAlpha: 0.72 }, {
          scale: 1,
          yPercent: 0,
          autoAlpha: 1,
          duration: 1.45,
          ease: 'power3.out',
        }, 0);
      }
      if (copy) {
        timeline.fromTo(copy, { autoAlpha: 0, y: 22, filter: 'blur(5px)' }, {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.78,
          ease: 'power3.out',
        }, 0.18);
      }

      timeline.eventCallback('onStart', function () { item.classList.add('is-in'); });
      timeline.eventCallback('onComplete', function () { item.classList.add('is-preview-in'); });
    });

    document.querySelectorAll('.voice__inner.reveal').forEach(function (quote) {
      scrollReveal([quote], quote, { y: 24, blur: true, duration: 0.9 });
    });

    document.querySelectorAll('.contact__pitch').forEach(function (pitch) {
      var details = pitch.querySelector('.contact__list.reveal');
      if (details) scrollReveal([details], details, { y: 16, duration: 0.7 });
    });

    document.querySelectorAll('.form.reveal').forEach(function (form) {
      scrollReveal([form], form, { y: 28, duration: 0.9 });
    });

    revealables.forEach(function (el) {
      if (handledReveals.has(el)) return;
      var delay = (parseFloat(el.dataset.revealDelay) || 0) / 1000;
      scrollReveal([el], el, { y: 22, duration: 0.78, delay: delay });
    });
  } else {
    revealables.forEach(function (el) {
      onView(el, function (target) { target.classList.add('is-in'); });
    });
  }

  /* ----------------------------------------------------------- marquee */

  /* The row is duplicated and the pair translated by -50%, so the loop point
     lands exactly where the first copy began and never shows a seam. */
  document.querySelectorAll('[data-marquee]').forEach(function (marquee) {
    var row = marquee.querySelector('.marquee__row');
    if (!row) return;

    var track = document.createElement('div');
    track.className = 'marquee__track';
    marquee.insertBefore(track, row);
    track.appendChild(row);

    var copy = row.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    track.appendChild(copy);
  });

  /* ---------------------------------------------------- parallax fallback */

  /* Where the browser has scroll-driven animations, styles.css already runs the
     parallax off the compositor and this whole block is skipped. This is the
     stand-in for everything older: ONE passive listener, batched into a single
     rAF, writing the same `translate` property the CSS keyframes write.

     Reads (getBoundingClientRect) all happen before any writes, so a long list
     of layers cannot thrash layout. */
  var hasViewTimeline = window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()');
  var layers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));

  if (!hasViewTimeline && !reduced && layers.length) {
    document.documentElement.dataset.parallaxJs = 'on';

    // Depth comes from the same --px the CSS keyframes use, so the two engines
    // cannot drift apart. Read once here rather than per frame — getComputedStyle
    // is a style flush, and this value never changes.
    var tracked = layers.map(function (layer) {
      return {
        layer: layer,
        // Measure the frame, not the image. The image is scaled and translated
        // by this very effect, so driving it off its own rect would feed the
        // output back into the input. Mirrors the --shot named timeline in CSS.
        frame: layer.parentElement,
        depth: parseFloat(getComputedStyle(layer).getPropertyValue('--px')) || 6
      };
    });

    var queued = false;

    function place() {
      queued = false;
      var vh = window.innerHeight;

      // Every read happens here, before any write, so a long layer list cannot
      // thrash layout.
      var measured = tracked.map(function (item) {
        var box = item.frame.getBoundingClientRect();
        return { layer: item.layer, depth: item.depth, top: box.top, height: box.height };
      });

      measured.forEach(function (item) {
        // Skip anything comfortably off-screen rather than writing to it.
        if (item.top > vh + 200 || item.top + item.height < -200) return;

        // +1 when the frame is entering from the bottom, -1 when it has left the
        // top. Matches the direction of the CSS keyframes.
        var centre = item.top + item.height / 2;
        var progress = (centre - vh / 2) / (vh / 2 + item.height / 2);

        item.layer.style.translate = '0 ' + (-progress * item.depth).toFixed(2) + '%';
      });
    }

    function schedule() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(place);
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('load', schedule);
    place();
  }

  /* ----------------------------------------------- pointer-tracked sheen */

  if (fine) {
    document.querySelectorAll('.card').forEach(function (card) {
      // Per card, not shared across all of them: one handle for the whole page
      // means moving over one card cancels another's queued frame, and cards
      // that overlap (the deck) do overlap pointer events.
      var pending = null;

      card.addEventListener('pointermove', function (event) {
        if (pending) cancelAnimationFrame(pending);
        pending = requestAnimationFrame(function () {
          pending = null;
          var box = card.getBoundingClientRect();
          card.style.setProperty('--mx', ((event.clientX - box.left) / box.width * 100) + '%');
          card.style.setProperty('--my', ((event.clientY - box.top) / box.height * 100) + '%');
        });
      });
    });
  }

  /* ------------------------------------------------------------- cursor */

  /* Two elements: a ring that lags and a dot that does not. The dot is the
     part that matters — an eased ring on its own reads as imprecise the moment
     you try to click something small, because the thing under your hand is not
     where the pointer actually is.

     The loop is not permanent. It stops once the ring has caught up and starts
     again on the next move, so an idle tab is not paying for a rAF forever. */

  if (fine) {
    var ring = document.querySelector('.cursor');
    var ringDot = document.querySelector('.cursor__dot');

    if (ring && ringDot) {
      var root = document.documentElement;
      var px = window.innerWidth / 2, py = window.innerHeight / 2;
      var pxTarget = px, pyTarget = py;
      var cursorRaf = null;

      // Reduced motion keeps the cursor and drops the lag. The ring is the
      // design; the trailing is the animation, and only that has to go.
      var cursorEase = reduced ? 1 : 0.18;

      root.classList.add('has-cursor', 'is-cursor-idle');

      function drawCursor() {
        px += (pxTarget - px) * cursorEase;
        py += (pyTarget - py) * cursorEase;

        ring.style.transform = 'translate3d(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px,0)';
        ringDot.style.transform = 'translate3d(' + pxTarget + 'px,' + pyTarget + 'px,0)';

        // Settled: within half a pixel on both axes. Stop rather than spin.
        if (Math.abs(pxTarget - px) < 0.5 && Math.abs(pyTarget - py) < 0.5) {
          px = pxTarget; py = pyTarget;
          ring.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
          cursorRaf = null;
          return;
        }
        cursorRaf = requestAnimationFrame(drawCursor);
      }

      function wakeCursor() {
        if (cursorRaf === null) cursorRaf = requestAnimationFrame(drawCursor);
      }

      document.addEventListener('pointermove', function (event) {
        if (event.pointerType && event.pointerType !== 'mouse') return;

        pxTarget = event.clientX;
        pyTarget = event.clientY;

        var target = event.target;
        var overText = target.closest && target.closest('input, textarea');
        var overLink = target.closest && target.closest('a, button, [data-magnetic], label, select');

        root.classList.toggle('is-cursor-idle', !!overText);
        root.classList.toggle('is-pointing', !!overLink && !overText);

        wakeCursor();
      }, { passive: true });

      // Leaving the window entirely — relatedTarget is null only on a real exit,
      // not when crossing between elements inside the page.
      document.addEventListener('mouseout', function (event) {
        if (!event.relatedTarget) root.classList.add('is-cursor-idle');
      });
      document.addEventListener('mouseover', function () {
        root.classList.remove('is-cursor-idle');
      });

      // A tab that comes back should not replay the catch-up from wherever the
      // pointer was when it left.
      document.addEventListener('visibilitychange', function () {
        if (document.hidden && cursorRaf !== null) {
          cancelAnimationFrame(cursorRaf);
          cursorRaf = null;
        }
      });
    }
  }

  /* --------------------------------------------------------- magnetics */

  /* Displacement is capped at 7px. Past that it stops reading as the button
     leaning toward you and starts reading as the button running away. */
  if (fine && !reduced) {
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      var frame = null;

      el.addEventListener('pointermove', function (event) {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(function () {
          var box = el.getBoundingClientRect();
          var dx = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
          var dy = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);
          el.style.transform = 'translate(' + (dx * 7).toFixed(2) + 'px,' + (dy * 5).toFixed(2) + 'px)';
        });
      });

      el.addEventListener('pointerleave', function () {
        if (frame) cancelAnimationFrame(frame);
        el.style.transform = '';
      });
    });
  }

  /* ---------------------------------------------------------- counters */

  document.querySelectorAll('[data-count]').forEach(function (el) {
    var target = parseFloat(el.dataset.count);
    var prefix = el.dataset.countPrefix || '';

    if (reduced || !isFinite(target)) { el.textContent = prefix + target; return; }

    onView(el, function () {
      var duration = 1100;
      var start = null;

      function step(now) {
        if (start === null) start = now;
        var t = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3);          // ease-out cubic
        el.textContent = prefix + Math.round(target * eased);
        if (t < 1) requestAnimationFrame(step);
      }

      el.textContent = prefix + '0';
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
  });

  /* -------------------------------------------------------------- form */

  var form = document.getElementById('form');

  if (form) {
    var submit = document.getElementById('submit');
    var submitLabel = submit.querySelector('.form__submit-label');
    var status = document.getElementById('status');

    var checks = [
      { id: 'f-name',  error: 'e-name',  test: function (v) { return v.trim().length > 0; } },
      { id: 'f-email', error: 'e-email', test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); } },
      { id: 'f-brief', error: 'e-brief', test: function (v) { return v.trim().length > 9; } }
    ];

    function validate(check) {
      var input = document.getElementById(check.id);
      var error = document.getElementById(check.error);
      var ok = check.test(input.value);

      if (!ok) {
        input.closest('.field').classList.add('is-bad');
        input.setAttribute('aria-invalid', 'true');
        error.hidden = false;
      } else {
        input.closest('.field').classList.remove('is-bad');
        input.removeAttribute('aria-invalid');
        error.hidden = true;
      }
      return ok;
    }

    // Inline validation, but only after a field has already been flagged —
    // nobody wants to be told their email is wrong while still typing it.
    checks.forEach(function (check) {
      var input = document.getElementById(check.id);
      input.addEventListener('input', function () {
        if (input.closest('.field').classList.contains('is-bad')) validate(check);
      });
      input.addEventListener('blur', function () {
        if (input.value.trim().length) validate(check);
      });
    });

    // Replace this with a real request. The rejection path below is what a
    // failed one lands in.
    function send(payload) {
      return new Promise(function (resolve) {
        window.setTimeout(function () { resolve(payload); }, 900);
      });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var bad = checks.filter(function (check) { return !validate(check); });

      if (bad.length) {
        status.textContent = 'Check the highlighted fields and send again.';
        status.dataset.tone = 'bad';
        document.getElementById(bad[0].id).focus();
        return;
      }

      submit.disabled = true;
      submit.dataset.busy = 'true';
      submitLabel.textContent = 'Sending';
      status.textContent = '';
      delete status.dataset.tone;

      send(Object.fromEntries(new FormData(form)))
        .then(function () {
          form.reset();
          status.textContent = 'Sent. We reply within 24 hours.';
          status.dataset.tone = 'ok';
        })
        .catch(function () {
          status.textContent = 'That did not send. Try again, or write to stablesyntax@gmail.com.';
          status.dataset.tone = 'bad';
        })
        .then(function () {
          submit.disabled = false;
          delete submit.dataset.busy;
          submitLabel.textContent = 'Send the brief';
        });
    });
  }

  /* -------------------------------------------------------------- year */

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
