/* Stable Syntax — the hero's WebGL field.

   A single full-screen quad running a domain-warped fBm gradient in the brand
   colours. No lights, no geometry beyond the quad, no textures: the whole scene
   is one draw call, and the cost is entirely in the fragment shader.

   It bows out silently in four cases — no canvas, no THREE global (CDN blocked),
   no WebGL context, or prefers-reduced-motion. In every one of those the CSS
   mesh behind it is simply left as it was, so the hero always has a background.

   Reads the palette from the CSS custom properties rather than hardcoding it,
   so the theme toggle retints the shader instead of fighting it. */

(function () {
  'use strict';

  var canvas = document.getElementById('scene');
  if (!canvas) return;
  if (typeof THREE === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var hero = canvas.closest('.hero');
  if (!hero) return;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,               // composite over the page background, no clear colour
      antialias: false,          // nothing here has an edge to alias
      powerPreference: 'low-power'
    });
  } catch (e) {
    return;                      // no WebGL — the CSS mesh stands in
  }

  // Deliberately BELOW 1. The usual advice is to cap devicePixelRatio at 2, but
  // that is for scenes with edges. This one is a soft gradient with no detail
  // finer than a few hundred pixels, so it renders at 0.65x and is upscaled by
  // the compositor for free — a 2.4x cut in fragment count that is invisible
  // side by side. At full DPR this shader saturates the GPU badly enough to
  // starve requestAnimationFrame and stall the page's CSS transitions.
  renderer.setPixelRatio(0.65);

  var scene = new THREE.Scene();

  // A fullscreen quad needs no perspective. The vertex shader passes clip-space
  // positions straight through, so this camera never has to be updated on
  // resize the way a PerspectiveCamera would.
  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var uniforms = {
    uTime:    { value: 0 },
    uAspect:  { value: 1 },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uC1:      { value: new THREE.Color('#5B8CFF') },
    uC2:      { value: new THREE.Color('#3FD9C4') },
    uC3:      { value: new THREE.Color('#FFA860') },
    // syncPalette() overwrites this before the first render, since the real
    // value is theme-dependent. It still holds the dark-mode figure rather than
    // a placeholder: a 0 here renders a completely invisible field, so anything
    // that ever stopped syncPalette() running would look exactly like the WebGL
    // having failed, with nothing in the console to say otherwise.
    uAlpha:   { value: 0.45 }
  };

  var vertexShader = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  var fragmentShader = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform float uAspect;',
    'uniform vec2  uPointer;',
    'uniform vec3  uC1;',
    'uniform vec3  uC2;',
    'uniform vec3  uC3;',
    'uniform float uAlpha;',

    'float hash(vec2 p) {',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
    '}',

    'float noise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',      // smoothstep, cheaper inline
    '  return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',

    // Four octaves, not five. The fifth contributes detail finer than the
    // blur this thing reads as anyway, and every octave here is paid for on
    // every fragment.
    'float fbm(vec2 p) {',
    '  float v = 0.0;',
    '  float a = 0.5;',
    '  for (int i = 0; i < 4; i++) {',
    '    v += a * noise(p);',
    '    p *= 2.02;',                            // not exactly 2.0, or octaves align
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',

    'void main() {',
    '  vec2 uv = vec2(vUv.x * uAspect, vUv.y);',
    '  float t = uTime * 0.055;',                // slow. this is a field, not a screensaver

    // Pointer pushes the warp around by a fraction of a cell — enough to feel
    // alive under the cursor, not enough to read as a cursor effect.
    '  vec2 push = (uPointer - 0.5) * 0.35;',

    // One round of domain warping, sampled twice, then a third read through it.
    // Three fbm calls rather than five: the second warp round cost 40% of the
    // frame and mostly added detail the alpha ramp throws away.
    '  vec2 q = vec2(fbm(uv * 1.5 + t),',
    '                fbm(uv * 1.5 + vec2(3.2, 1.7) - t * 0.8));',
    '  float f = fbm(uv * 1.35 + 2.6 * q + push + t * 0.5);',

    '  vec3 col = mix(uC1, uC2, smoothstep(0.15, 0.80, f));',
    '  col = mix(col, uC3, smoothstep(0.58, 1.02, (q.x + q.y) * 0.75));',

    // Only the crests of the noise are drawn. fBm averages around 0.5, so a
    // threshold below that fills the whole hero with flat colour and buries the
    // headline; starting at 0.45 leaves luminous ribbons with the page showing
    // through between them, which is the point.
    '  float body = smoothstep(0.45, 0.95, f);',

    // Fall off toward the edges so the field never meets the viewport border.
    '  float vig = smoothstep(0.92, 0.15, distance(vUv, vec2(0.5)));',

    '  gl_FragColor = vec4(col, uAlpha * vig * body);',
    '}'
  ].join('\n');

  // Created once, before the loop. Nothing in animate() allocates.
  var geometry = new THREE.PlaneGeometry(2, 2);
  var material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });

  var mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  /* ------------------------------------------------------------- palette */

  function readVar(name, fallback) {
    var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function syncPalette() {
    uniforms.uC1.value.set(readVar('--azure', '#5B8CFF'));
    uniforms.uC2.value.set(readVar('--aqua', '#3FD9C4'));
    uniforms.uC3.value.set(readVar('--ember', '#FFA860'));
    // Light mode has far less headroom before the field starts eating text
    // contrast, so it carries well under half the strength.
    // Both figures are the ceiling that keeps --muted body copy at or above
    // 4.5:1 where the copy actually sits, given the scrim in front of the field.
    uniforms.uAlpha.value = document.documentElement.dataset.theme === 'light' ? 0.24 : 0.45;
  }

  syncPalette();

  new MutationObserver(syncPalette)
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* -------------------------------------------------------------- sizing */

  function resize() {
    var w = hero.clientWidth;
    var h = hero.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);   // false: CSS owns the canvas box, not JS
    uniforms.uAspect.value = w / h;
  }

  resize();

  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(hero);
  } else {
    window.addEventListener('resize', resize, { passive: true });
  }

  /* --------------------------------------------------------------- loop */

  var pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  var raf = null;
  var startedAt = performance.now();

  function frame(now) {
    // Lerp rather than snap, so a fast cursor does not whip the field around.
    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;

    uniforms.uPointer.value.set(pointer.x, pointer.y);
    uniforms.uTime.value = (now - startedAt) / 1000;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  /* Nothing renders while the hero is off-screen — a scrolled-past hero should
     not cost a frame.

     Visibility is deliberately NOT a condition here. The original paused on
     `visibilitychange` and resumed with a bare play(), which is the bug: the
     resume ignored where the page was scrolled to, so returning to the tab
     restarted the loop on a hero that was long gone, and the observer never
     fired again to stop it because the intersection state had never changed.

     The fix is not to add `!document.hidden` to the condition — that gates the
     render loop on a signal some embedders report incorrectly, and it buys
     nothing, because browsers already suspend rAF in a background tab. One
     condition, owned by the observer, which is the thing that actually knows. */

  var onScreen = true;
  var contextLost = false;

  function sync() {
    var shouldRun = onScreen && !contextLost;
    if (shouldRun && raf === null) {
      raf = requestAnimationFrame(frame);
    } else if (!shouldRun && raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  // Start drawing immediately rather than waiting to be told to. The observer
  // below is a *correction*, not the trigger: the hero is at the top of the
  // document, so it is on screen at load in every ordinary case, and hanging the
  // first frame on a callback means anything that delays or drops that callback
  // leaves the hero permanently static with nothing in the console. If the page
  // did load scrolled past the hero, the observer pauses it a frame or two later.
  sync();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      sync();
    }, { threshold: 0 }).observe(hero);
  }

  /* ------------------------------------------------------- context loss */

  /* A WebGL context is not permanent. A GPU driver reset, a laptop switching
     between integrated and discrete graphics, or the browser reclaiming a
     context from a backgrounded tab all take it away mid-run, and the hero
     silently loses its field for the rest of the page's life.

     Three r128 already calls preventDefault() on the loss event and rebuilds
     its GPU state in initGLContext() on restore, which is what makes recovery
     possible at all — but it has no opinion about our loop or our CSS. Without
     these two handlers, rAF keeps spinning at 60fps through a render() that is
     a no-op for the whole outage, and the mesh stays dimmed to 0.6 behind a
     canvas that is drawing nothing. */

  canvas.addEventListener('webglcontextlost', function () {
    contextLost = true;
    sync();
    // Hand the hero back to the CSS mesh at full strength for the duration,
    // exactly as if WebGL had never been available.
    delete document.documentElement.dataset.webgl;
  });

  canvas.addEventListener('webglcontextrestored', function () {
    contextLost = false;
    resize();        // the drawing buffer does not survive the loss
    syncPalette();   // nor do the uniforms
    document.documentElement.dataset.webgl = 'on';
    sync();
  });

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    hero.addEventListener('pointermove', function (event) {
      var box = hero.getBoundingClientRect();
      pointer.tx = (event.clientX - box.left) / box.width;
      pointer.ty = 1.0 - (event.clientY - box.top) / box.height;
    }, { passive: true });
  }

  // Tells the CSS the hero has a live field, so the CSS mesh can step back
  // there and stop double-tinting.
  document.documentElement.dataset.webgl = 'on';

  /* ------------------------------------------------------------ teardown */

  // Three never releases GPU resources on its own; they sit in VRAM until this
  // runs. bfcache restores can re-enter, so this is on pagehide, not unload.
  window.addEventListener('pagehide', function () {
    onScreen = false;
    sync();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  });
})();
