(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!window.gsap || !window.ScrollTrigger || reduced.matches) return;
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('js-ready');

  /* ── Ambient loops (frozen by the reduced-motion toggle) ─────────────── */
  gsap.to('.hero-glyphs span', { yPercent: -10, stagger: .08, ease: 'none', duration: 10, repeat: -1, yoyo: true });
  gsap.to('.vault-ring.ring-one', { rotation: 360, duration: 45, ease: 'none', repeat: -1, transformOrigin: 'center center' });
  gsap.to('.vault-ring.ring-two', { rotation: -360, duration: 60, ease: 'none', repeat: -1, transformOrigin: 'center center' });

  const scenes = [...document.querySelectorAll('.chapter')];
  const ITEM_SELECTOR = '.kicker,h1,h2,.lead,.hero-bottom > *, .feature-card,.list-row,.script-main,.script-item,.engine-step,.privacy-points article,.arch-layer,.performance-card,.eval-row,.roadmap-item,.closing-details,.product-shot,.privacy-shot';

  function motionOff() {
    return reduced.matches || document.documentElement.classList.contains('reduced-motion');
  }

  function playScene(scene) {
    if (!scene || scene.dataset.hasPlayed === 'true') return;
    scene.dataset.hasPlayed = 'true';
    // When motion is disabled the content is already visible — never leave it
    // frozen mid-fade.
    if (motionOff()) return;

    const items = scene.querySelectorAll(ITEM_SELECTOR);
    if (items.length) {
      gsap.killTweensOf(items);
      gsap.fromTo(items, { y: 17, opacity: .25 },
        { y: 0, opacity: 1, duration: .62, stagger: .045, ease: 'power2.out', clearProps: 'opacity,transform' });
    }

    const connectors = scene.querySelectorAll('.engine-connector span');
    if (connectors.length) {
      gsap.fromTo(connectors, { scaleX: 0, transformOrigin: 'left center' },
        { scaleX: 1, duration: .5, stagger: .22, ease: 'power2.out', clearProps: 'transform' });
    }
  }

  /* A scene reveals itself whenever it becomes the active one. This used to be
     cinematic-only, which meant mobile/reduced-document users never saw any
     entrance animation at all. */
  const observer = new MutationObserver(records => {
    records.forEach(record => {
      const el = record.target;
      if (el.classList && el.classList.contains('is-scene-active')) playScene(el);
    });
  });
  scenes.forEach(scene => observer.observe(scene, { attributes: true, attributeFilter: ['class'] }));

  /* The first scene already carries the active class before this observer was
     attached, so play it explicitly. */
  const initial = document.querySelector('.chapter.is-scene-active');
  if (initial) playScene(initial);

  window.MatraScenes = { play: playScene };
})();
