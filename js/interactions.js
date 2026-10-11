/* interactions.js — Matra presentation interactive components
   All animations use GSAP timelines for cinematic motion.
   Reduced-motion preference is respected globally. */
(() => {
  /* ─── Fullscreen + Motion toggle ─────────────────────────────────────── */
  const fullscreenButton = document.querySelector('#fullscreen-toggle');
  const motionButton     = document.querySelector('#motion-toggle');
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function applyMotionSetting() {
    document.body.classList.toggle('reduced-motion', reducedMotion);
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
    motionButton.setAttribute('aria-pressed', String(reducedMotion));
    motionButton.setAttribute('aria-label', reducedMotion ? 'Turn motion on' : 'Turn motion off');
    motionButton.querySelector('.button-label').textContent = reducedMotion ? 'Motion off' : 'Motion';
    if (window.gsap) {
      const timeline = window.gsap.globalTimeline;
      if (reducedMotion) {
        // Finish any one-shot reveal/timeline tween before freezing, otherwise
        // elements that were mid-fade stay stuck at a partial opacity.
        timeline.getChildren(true, true, true).forEach(tween => {
          const repeats = typeof tween.repeat === 'function' ? tween.repeat() : 0;
          if (repeats === -1) return; // keep ambient loops where they are
          if (typeof tween.progress === 'function') tween.progress(1);
        });
        timeline.pause();
      } else {
        timeline.resume();
      }
    }
    window.MatraNavigation?.updateMotionMode();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  motionButton.addEventListener('click', () => { reducedMotion = !reducedMotion; applyMotionSetting(); });

  fullscreenButton.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) {
      console.warn('Fullscreen unavailable:', err);
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const fullscreen = Boolean(document.fullscreenElement);
    fullscreenButton.querySelector('.button-label').textContent = fullscreen ? 'Exit fullscreen' : 'Fullscreen';
    fullscreenButton.setAttribute('aria-label', fullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
  });

  /* In cinematic mode each chapter owns a scroll container, while the page-level
     scroll is what changes scenes. Let PageDown/Space/arrow keys consume the
     chapter's own overflow first, so keyboard users can read a tall chapter
     before the presentation advances. Falls through to native scrolling when
     there is nothing left to reveal. */
  function scrollActiveInnerBy(direction) {
    const inner = document.querySelector('.chapter.is-scene-active .chapter-inner');
    if (!inner || inner.scrollHeight - inner.clientHeight <= 1) return false;
    const atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 1;
    const atTop    = inner.scrollTop <= 1;
    if (direction > 0 && atBottom) return false;
    if (direction < 0 && atTop)    return false;
    const step = Math.max(80, Math.round(inner.clientHeight * 0.82));
    inner.scrollBy({ top: direction * step, behavior: 'auto' });
    return true;
  }

  /* Keyboard navigation */
  window.addEventListener('keydown', event => {
    const target = event.target;
    const interactive = target instanceof Element && target.closest('input, textarea, select, button, a[href], [role="button"], [contenteditable="true"]');
    if (interactive || event.altKey || event.ctrlKey || event.metaKey) return;

    // Vertical keys reveal the active chapter's own overflow before advancing.
    if (event.key === 'ArrowDown') { if (scrollActiveInnerBy(1)) event.preventDefault(); return; }
    if (event.key === 'ArrowUp')   { if (scrollActiveInnerBy(-1)) event.preventDefault(); return; }

    if (['ArrowRight','PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey)) {
      if (scrollActiveInnerBy(1)) { event.preventDefault(); return; }
      event.preventDefault();
      window.MatraNavigation?.goTo(window.MatraNavigation.getActiveIndex() + 1);
    } else if (['ArrowLeft','PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey)) {
      if (scrollActiveInnerBy(-1)) { event.preventDefault(); return; }
      event.preventDefault();
      window.MatraNavigation?.goTo(window.MatraNavigation.getActiveIndex() - 1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault(); fullscreenButton.click();
    } else if (event.key === 'Home') {
      event.preventDefault();
      window.MatraNavigation?.goTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      window.MatraNavigation?.goTo(window.MatraNavigation.chapters.length - 1);
    }
  });

  applyMotionSetting();
})();


/* ═══════════════════════════════════════════════════════════════════════════
   CINEMATIC INTERACTIVE COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  /* Helper: safe gsap shorthand */
  const G   = () => window.gsap;
  const can = () => !document.body.classList.contains('reduced-motion') && !!window.gsap;

  /* Cancel the previous timeline for a component before starting a new one.
     Killing (rather than tween-level overwriting) also drops pending `.call`
     content swaps, so rapid interaction can never desync from the visible UI. */
  function replaceTimeline(state, key, config) {
    if (state[key]) { state[key].kill(); state[key] = null; }
    state[key] = G().timeline(config);
    return state[key];
  }

  /* ══════════════════════════════════════════════════════════════════════
     CHAPTER 05 — Engine Demo (sequence choice buttons)
     ════════════════════════════════════════════════════════════════════ */
  const examples = {
    kkh: { keys: ['k','k','h'], output: 'ক্ষ', match: '3 characters', caption: 'Illustrative grapheme', matchIndex: 0 },
    bh:  { keys: ['b','h'],     output: 'ভ',   match: '2 characters', caption: 'Illustrative grapheme', matchIndex: 1 },
    sh:  { keys: ['s','h'],     output: 'শ',   match: '2 characters', caption: 'Illustrative grapheme', matchIndex: 1 },
  };

  const demo = document.querySelector('#engine-demo');
  if (demo) {
    const keyRow     = document.querySelector('#engine-input-keys');
    const outputEl   = document.querySelector('#engine-output');
    const captionEl  = document.querySelector('#engine-output-caption');
    const matchRows  = [...demo.querySelectorAll('.match-stack span')];
    const connectors = [...demo.querySelectorAll('.engine-connector span')];
    const state      = { tl: null };

    document.querySelectorAll('.sequence-choice').forEach(button => {
      button.addEventListener('click', () => {
        const sample = examples[button.dataset.sequence];
        if (!sample) return;

        /* Update aria */
        document.querySelectorAll('.sequence-choice').forEach(item => {
          const sel = item === button;
          item.classList.toggle('is-selected', sel);
          item.setAttribute('aria-pressed', String(sel));
        });

        /* Update match stack */
        matchRows.forEach((row, i) => row.classList.toggle('match-active', i === sample.matchIndex));

        if (!can()) {
          /* No-animation fallback */
          if (state.tl) { state.tl.kill(); state.tl = null; }
          keyRow.replaceChildren(...sample.keys.map(k => { const s = document.createElement('span'); s.textContent = k; return s; }));
          outputEl.textContent = sample.output;
          captionEl.textContent = sample.caption;
          return;
        }

        const tl = replaceTimeline(state, 'tl', { defaults: { ease: 'power3.out' } });

        /* 1. Keys fly out upward */
        const oldKeys = [...keyRow.querySelectorAll('span')];
        if (oldKeys.length) {
          tl.to(oldKeys, { y: -18, opacity: 0, stagger: 0.04, duration: 0.22, ease: 'power2.in' });
        }

        /* 2. Build the incoming key spans now (not inside the timeline) so that
              the enter tween targets the NEW nodes. Previously the tween was
              built from a live query that captured the OLD nodes, leaving the
              new keys stuck at opacity 0. */
        const newKeys = sample.keys.map(k => {
          const s = document.createElement('span');
          s.textContent = k;
          return s;
        });
        tl.call(() => { keyRow.replaceChildren(...newKeys); });
        tl.fromTo(newKeys, { y: 14, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.07, duration: 0.3 });

        /* 3. Connector lines redraw */
        if (connectors.length) {
          tl.fromTo(connectors, { scaleX: 0, transformOrigin: 'left center' },
            { scaleX: 1, duration: 0.35, stagger: 0.15 }, '<0.1');
        }

        /* 4. Match stack highlight flash */
        tl.fromTo(matchRows[sample.matchIndex],
          { background: 'rgba(162,195,141,.35)', color: 'var(--accent)' },
          { background: 'rgba(162,195,141,.08)', duration: 0.6, ease: 'power1.out' }, '<');

        /* 5. Output glyph: current exits, new enters with bounce */
        tl.to(outputEl, { y: -10, scale: 0.8, opacity: 0, duration: 0.2, ease: 'power2.in' }, '<0.1');
        tl.call(() => { outputEl.textContent = sample.output; captionEl.textContent = sample.caption; });
        tl.fromTo(outputEl,
          { y: 22, scale: 0.7, opacity: 0 },
          { y: 0, scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.6)' });
      });
    });
  }


  /* ══════════════════════════════════════════════════════════════════════
     CHAPTER 04 — Script profile selector
     ════════════════════════════════════════════════════════════════════ */
  const previewLabel       = document.querySelector('#script-preview-label');
  const previewWord        = document.querySelector('#script-preview-word');
  const previewTranslation = document.querySelector('#script-preview-translation');
  const scriptState        = { tl: null };

  document.querySelectorAll('.script-item[data-profile]').forEach(button => {
    const activate = () => {
      const alreadySelected = button.classList.contains('is-selected');
      if (alreadySelected) return;

      /* Update selection state */
      document.querySelectorAll('.script-item[data-profile]').forEach(item => {
        const sel = item === button;
        item.classList.toggle('is-selected', sel);
        item.setAttribute('aria-pressed', String(sel));
      });

      if (!can()) {
        /* Fallback — instant update */
        if (scriptState.tl) { scriptState.tl.kill(); scriptState.tl = null; }
        previewLabel.textContent       = button.dataset.label;
        previewWord.textContent        = button.dataset.word;
        previewTranslation.textContent = button.dataset.transliteration;
        previewWord.setAttribute('lang', button.dataset.lang || 'bn');
        return;
      }

      const tl = replaceTimeline(scriptState, 'tl', { defaults: { ease: 'expo.out' } });

      /* 1. Old word exits left + fade */
      tl.to(previewWord, { x: -22, opacity: 0, duration: 0.22, ease: 'power2.in' });
      tl.to(previewLabel, { opacity: 0, duration: 0.15 }, '<');
      tl.to(previewTranslation, { opacity: 0, y: 5, duration: 0.15 }, '<');

      /* 2. Swap content */
      tl.call(() => {
        previewLabel.textContent       = button.dataset.label;
        previewWord.textContent        = button.dataset.word;
        previewTranslation.textContent = button.dataset.transliteration;
        previewWord.setAttribute('lang', button.dataset.lang || 'bn');
      });

      /* 3. New word slides in from right */
      tl.fromTo(previewWord,
        { x: 30, opacity: 0, scale: 0.88 },
        { x: 0,  opacity: 1, scale: 1, duration: 0.55 });

      /* 4. Label and translation fade in with stagger */
      tl.fromTo([previewLabel, previewTranslation],
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.08 }, '<0.1');

      /* 5. Underline draws across */
      const underline = document.querySelector('.script-underline');
      if (underline) {
        tl.fromTo(underline,
          { scaleX: 0, transformOrigin: 'left center' },
          { scaleX: 1, duration: 0.45, ease: 'power3.out' }, '<');
      }

      /* 6. The selected item itself flickers accent border */
      tl.fromTo(button,
        { outline: '2px solid rgba(82,125,54,0.6)', outlineOffset: '0px' },
        { outline: '2px solid rgba(82,125,54,0)', outlineOffset: '4px', duration: 0.7, ease: 'power2.out',
          clearProps: 'outline,outlineOffset' }, '<');
    };

    button.addEventListener('click', activate);
    button.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
    });
  });


  /* ══════════════════════════════════════════════════════════════════════
     CHAPTER 06 — Privacy Vault toggle
     ════════════════════════════════════════════════════════════════════ */
  const vaultToggle = document.querySelector('#vault-toggle');
  const vaultDetail = document.querySelector('#vault-detail');
  const ringOne     = document.querySelector('.vault-ring.ring-one');
  const ringTwo     = document.querySelector('.vault-ring.ring-two');

  if (vaultToggle && vaultDetail) {
    const vaultState = { tl: null };
    vaultToggle.addEventListener('click', () => {
      const expanded = vaultToggle.getAttribute('aria-expanded') !== 'true';
      vaultToggle.setAttribute('aria-expanded', String(expanded));
      vaultToggle.querySelector('.vault-action').textContent = expanded ? 'TAP TO CLOSE' : 'TAP TO INSPECT';

      if (!can()) {
        if (vaultState.tl) { vaultState.tl.kill(); vaultState.tl = null; }
        vaultDetail.hidden = !expanded;
        ['opacity', 'transform', 'filter'].forEach(p => vaultDetail.style.removeProperty(p));
        return;
      }

      if (expanded) {
        /* Open: reveal vault detail with cinematic scale-in */
        vaultDetail.hidden = false;
        const tl = replaceTimeline(vaultState, 'tl', { defaults: { ease: 'expo.out' } });

        /* Rings pulse outward */
        tl.to([ringOne, ringTwo],
          { scale: 1.08, opacity: 0.6, duration: 0.28, ease: 'power2.out', yoyo: true, repeat: 1 }, 0);

        /* Vault core "unlocking" nudge */
        tl.to(vaultToggle, { scale: 0.92, duration: 0.15, ease: 'power2.in' }, 0);
        tl.to(vaultToggle, { scale: 1, duration: 0.5, ease: 'back.out(2.2)' });

        /* Detail panel grows from centre */
        tl.fromTo(vaultDetail,
          { scale: 0.7, opacity: 0, y: 10, filter: 'blur(6px)' },
          { scale: 1,   opacity: 1, y: 0,  filter: 'blur(0px)', duration: 0.55 }, '<0.1');

        /* Content inside detail staggers in */
        const children = [...vaultDetail.children];
        tl.fromTo(children,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, stagger: 0.09, duration: 0.32 }, '<0.15');

        /* Glow around vault core */
        tl.fromTo(vaultToggle,
          { boxShadow: '0 0 0 10px rgba(82,125,54,.08)' },
          { boxShadow: '0 0 0 24px rgba(82,125,54,.18)', duration: 0.5, ease: 'power2.out',
            yoyo: true, repeat: 1 }, '<');

      } else {
        /* Close: collapse detail */
        const tl = replaceTimeline(vaultState, 'tl', { defaults: { ease: 'power3.in' } });
        tl.to(vaultDetail, { scale: 0.85, opacity: 0, y: -8, filter: 'blur(4px)', duration: 0.25 });
        tl.call(() => { vaultDetail.hidden = true; G().set(vaultDetail, { clearProps: 'all' }); });
        tl.to(vaultToggle, { scale: 0.93, duration: 0.12 }, 0);
        tl.to(vaultToggle, { scale: 1, duration: 0.4, ease: 'back.out(2)' });
      }
    });
  }


  /* ══════════════════════════════════════════════════════════════════════
     CHAPTER 07 — Architecture layers
     ════════════════════════════════════════════════════════════════════ */
  const archDetail = document.querySelector('#arch-detail');
  const archState  = { tl: null };

  document.querySelectorAll('.arch-layer[data-arch-detail]').forEach(button => {
    const activate = () => {
      const wasExpanded = button.getAttribute('aria-expanded') === 'true';

      /* Update all layers */
      document.querySelectorAll('.arch-layer[data-arch-detail]').forEach(item => {
        item.setAttribute('aria-expanded', 'false');
        item.classList.remove('is-arch-active');
      });

      const newText = wasExpanded
        ? 'Select a layer to inspect its responsibility.'
        : button.dataset.archDetail;

      if (!wasExpanded) {
        button.setAttribute('aria-expanded', 'true');
        button.classList.add('is-arch-active');
      }

      if (!can()) {
        if (archState.tl) { archState.tl.kill(); archState.tl = null; }
        archDetail.textContent = newText;
        return;
      }

      const tl = replaceTimeline(archState, 'tl', { defaults: { ease: 'expo.out' } });

      if (!wasExpanded) {
        /* Lift the selected layer */
        tl.to(button, { y: -4, boxShadow: '0 8px 32px rgba(82,125,54,.18)', duration: 0.35 }, 0);

        /* Dim the other layers */
        const others = [...document.querySelectorAll('.arch-layer[data-arch-detail]')].filter(l => l !== button);
        tl.to(others, { opacity: 0.55, duration: 0.3 }, 0);

        /* Nodes inside pop */
        const nodes = [...button.querySelectorAll('.arch-nodes span')];
        tl.fromTo(nodes,
          { scale: 0.9, opacity: 0.5 },
          { scale: 1,   opacity: 1, stagger: 0.06, duration: 0.35 }, 0);
      } else {
        /* Deselect — reset all layers */
        const all = [...document.querySelectorAll('.arch-layer[data-arch-detail]')];
        tl.to(all, { y: 0, opacity: 1, boxShadow: 'none', duration: 0.3 }, 0);
      }

      /* Arch detail text: fade out, swap, fade in */
      tl.to(archDetail, { opacity: 0, y: -5, duration: 0.18, ease: 'power2.in' }, 0);
      tl.call(() => { archDetail.textContent = newText; });
      tl.fromTo(archDetail,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.38 });
    };

    button.addEventListener('click', activate);
    button.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
    });
  });


  /* ══════════════════════════════════════════════════════════════════════
     CHAPTER 10 — Roadmap items hover lift
     ════════════════════════════════════════════════════════════════════ */
  document.querySelectorAll('.roadmap-item').forEach(item => {
    const marker = item.querySelector('.roadmap-marker');
    const arrow  = item.querySelector('.roadmap-arrow');

    item.addEventListener('mouseenter', () => {
      if (!can()) return;
      G().to(marker, { scale: 1.12, borderColor: 'var(--accent-dark)', duration: 0.28, ease: 'back.out(2)' });
      G().to(arrow,  { x: 4, y: -4, color: 'var(--accent-dark)', opacity: 1, duration: 0.28, ease: 'power2.out' });
      G().to(item,   { backgroundColor: 'rgba(82,125,54,.04)', duration: 0.25 });
    });
    item.addEventListener('mouseleave', () => {
      if (!can()) return;
      G().to(marker, { scale: 1, borderColor: '#bfc5b7', duration: 0.28, ease: 'power2.out' });
      G().to(arrow,  { x: 0, y: 0, color: 'var(--muted)', opacity: 1, duration: 0.25 });
      G().to(item,   { backgroundColor: 'transparent', duration: 0.25 });
    });
  });


  /* ══════════════════════════════════════════════════════════════════════
     CHAPTER 02 — Problem list rows hover
     ════════════════════════════════════════════════════════════════════ */
  document.querySelectorAll('.list-row').forEach(row => {
    const mark   = row.querySelector('.row-mark');
    const number = row.querySelector('.row-number');

    row.addEventListener('mouseenter', () => {
      if (!can()) return;
      G().to(mark,   { x: 3, y: -3, color: 'var(--accent-dark)', duration: 0.25, ease: 'power2.out' });
      G().to(number, { color: 'var(--accent-dark)', duration: 0.2 });
    });
    row.addEventListener('mouseleave', () => {
      if (!can()) return;
      G().to(mark,   { x: 0, y: 0, color: 'var(--muted)', duration: 0.22 });
      G().to(number, { color: 'var(--accent-dark)', duration: 0.2 });
    });
  });
})();
