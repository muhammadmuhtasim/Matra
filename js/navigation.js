(() => {
  const chapters   = [...document.querySelectorAll('.chapter')];
  const links      = [...document.querySelectorAll('.rail-link')];
  const progress   = document.querySelector('#progress-bar');
  const chapterLabel  = document.querySelector('#chapter-label');
  const currentTitle  = document.querySelector('#current-chapter-title');
  const prevButton = document.querySelector('#prev-chapter');
  const nextButton = document.querySelector('#next-chapter');
  const desktop    = matchMedia('(min-width: 761px)');
  const reduced    = matchMedia('(prefers-reduced-motion: reduce)');

  let activeIndex = 0, cinematic = false, trigger = null, scrollTicking = false;
  let lastKnownIndex = 0;

  /* Smoothed scene position — decouples the crossfade from raw scroll so
     wheel/trackpad input feels cinematic instead of mechanical. */
  let targetValue = 0, shownValue = 0, sceneRaf = 0;
  const SCENE_EASE = 0.16;

  function motionReduced() {
    return reduced.matches || document.documentElement.classList.contains('reduced-motion');
  }

  /* Get the scrollable inner container for a chapter */
  function innerOf(chapter) {
    return chapter.querySelector('.chapter-inner');
  }

  function setActive(index) {
    activeIndex = Math.max(0, Math.min(chapters.length - 1, index));
    links.forEach((link, i) => {
      link.classList.toggle('is-active', i === activeIndex);
      if (i === activeIndex) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    // is-scene-active drives the entrance animations in scroll-scenes.js and is
    // therefore toggled in BOTH modes (previously mobile never revealed content).
    chapters.forEach((chapter, i) => {
      chapter.classList.toggle('is-scene-active', i === activeIndex);
      chapter.setAttribute('aria-hidden', cinematic && i !== activeIndex ? 'true' : 'false');
    });
    chapterLabel.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}`;
    currentTitle.textContent = chapters[activeIndex].dataset.title || `Chapter ${activeIndex + 1}`;
    prevButton.disabled = activeIndex === 0;
    nextButton.disabled = activeIndex === chapters.length - 1;
  }

  function goTo(index) {
    const i = Math.max(0, Math.min(chapters.length - 1, index));
    lastKnownIndex = i;
    if (cinematic && trigger) {
      const target = trigger.start + i * innerHeight;
      // Jumping across many scenes with a smooth document scroll flashes every
      // intermediate scene; reposition instantly and let the crossfade carry it.
      const farJump = Math.abs(window.scrollY - target) > innerHeight * 1.5;
      window.scrollTo({ top: target, behavior: 'auto' });
      targetValue = i;
      if (farJump) { stopSceneLoop(); shownValue = i; }
      if (window.ScrollTrigger && typeof ScrollTrigger.update === 'function') ScrollTrigger.update();
      if (farJump) renderScene(i);
      setActive(i);
    } else {
      chapters[i].scrollIntoView({ behavior: motionReduced() ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function regularUpdate() {
    const max    = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = `${max > 0 ? scrollY / max * 100 : 0}%`;
    const marker = innerHeight * 0.48;
    let closest  = 0, dist = Infinity;
    chapters.forEach((chapter, i) => {
      const r = chapter.getBoundingClientRect();
      const d = marker < r.top ? r.top - marker : marker > r.bottom ? marker - r.bottom : 0;
      if (d < dist) { dist = d; closest = i; }
    });
    lastKnownIndex = closest;
    setActive(closest);
    scrollTicking = false;
  }

  /* Render the crossfade between floor(value) and floor(value)+1 */
  function renderScene(value) {
    const n = chapters.length - 1;
    const clamped = Math.max(0, Math.min(n, value));
    const i = Math.min(n, Math.floor(clamped + 1e-6));
    const local = clamped - i;
    const eased = local * local * (3 - 2 * local); // smoothstep — symmetric crossfade

    chapters.forEach((chapter, idx) => {
      const isVisible = idx === i || idx === i + 1;
      chapter.style.visibility = isVisible ? 'visible' : 'hidden';
      // Only the *target* active scene is interactive, and only while visible.
      // Using the animated index here made the incoming chapter's scroll
      // container non-interactive mid-crossfade, so the wheel fell through to
      // the outgoing chapter / page and advanced scenes instead of scrolling
      // the chapter the user was reading.
      const interactive = isVisible && idx === activeIndex;
      chapter.style.pointerEvents = interactive ? 'auto' : 'none';
      const inner = innerOf(chapter);
      if (inner) inner.style.pointerEvents = interactive ? 'auto' : 'none';
    });

    const current = chapters[i];
    const next    = chapters[i + 1];
    if (current) {
      current.style.zIndex    = '20';
      current.style.opacity   = String(1 - eased);
      current.style.transform = `translate3d(0,${-local * 3}%,0) scale(${1 - local * 0.02})`;
      current.style.filter    = `blur(${local * 4}px)`;
    }
    if (next) {
      next.style.zIndex    = '21';
      next.style.opacity   = String(eased);
      next.style.transform = `translate3d(0,${(1 - local) * 3}%,0) scale(${0.98 + local * 0.02})`;
      next.style.filter    = `blur(${(1 - local) * 3}px)`;
    }
  }

  function sceneLoop() {
    sceneRaf = 0;
    const diff = targetValue - shownValue;
    if (Math.abs(diff) < 0.0015) { shownValue = targetValue; renderScene(shownValue); return; }
    shownValue += diff * SCENE_EASE;
    renderScene(shownValue);
    sceneRaf = requestAnimationFrame(sceneLoop);
  }

  function queueScene() { if (!sceneRaf) sceneRaf = requestAnimationFrame(sceneLoop); }
  function stopSceneLoop() { if (sceneRaf) cancelAnimationFrame(sceneRaf); sceneRaf = 0; }

  /* Reset scroll position of a chapter's inner container when entering it */
  function resetChapterScroll(index) {
    const inner = innerOf(chapters[index]);
    if (inner) inner.scrollTop = 0;
  }

  function enableCinematic() {
    if (cinematic || !desktop.matches || motionReduced() || !window.gsap || !window.ScrollTrigger) return;
    cinematic = true;
    document.documentElement.classList.add('cinematic-mode');

    chapters.forEach((c, i) => {
      c.style.zIndex     = String(chapters.length - i);
      c.style.visibility = i === 0 ? 'visible' : 'hidden';
      c.style.opacity    = i === 0 ? '1' : '0';
      c.classList.toggle('is-scene-active', i === 0);
      c.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    });

    let lastSceneIndex = 0;

    trigger = ScrollTrigger.create({
      trigger:            '#presentation',
      start:              'top top',
      end:                () => `+=${innerHeight * (chapters.length - 1)}`,
      pin:                true,
      pinSpacing:         true,
      scrub:              0.35,
      invalidateOnRefresh: true,
      onUpdate(self) {
        const n = chapters.length - 1;
        const value = self.progress * n;
        const i     = Math.min(n, Math.floor(value + 1e-6));
        progress.style.width = `${self.progress * 100}%`;

        // When we land on a new scene, reset its inner scroll
        if (i !== lastSceneIndex) {
          resetChapterScroll(i);
          lastSceneIndex = i;
        }

        lastKnownIndex = i;
        if (i !== activeIndex) setActive(i);

        targetValue = value;
        if (motionReduced()) { stopSceneLoop(); shownValue = value; renderScene(value); }
        else queueScene();
      },
    });

    targetValue = shownValue = 0;
    renderScene(0);
    setActive(0);
  }

  function disableCinematic() {
    if (!cinematic) return;
    const old = activeIndex;
    cinematic = false;
    stopSceneLoop();
    targetValue = shownValue = 0;
    if (trigger) { trigger.kill(true); trigger = null; }
    document.documentElement.classList.remove('cinematic-mode');
    chapters.forEach(c => {
      ['z-index','visibility','opacity','transform','filter','pointer-events'].forEach(p => c.style.removeProperty(p));
      const inner = innerOf(c);
      if (inner) ['overflow-y','pointer-events'].forEach(p => inner.style.removeProperty(p));
      c.classList.remove('is-scene-active');
      c.removeAttribute('aria-hidden');
    });
    setActive(old);
  }

  function updateMotionMode() {
    if (motionReduced() || !desktop.matches) {
      if (!cinematic) return false;
      const current = lastKnownIndex;
      disableCinematic();
      const chapter = chapters[current];
      if (chapter) {
        requestAnimationFrame(() => {
          document.documentElement.classList.add('instant-scroll');
          const top = chapter.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top, behavior: 'auto' });
          document.documentElement.classList.remove('instant-scroll');
          regularUpdate();
        });
      }
      return Boolean(chapter);
    } else if (desktop.matches && !cinematic) {
      const current = lastKnownIndex;
      enableCinematic();
      if (cinematic && trigger) {
        window.scrollTo({ top: trigger.start + current * innerHeight, behavior: 'auto' });
        targetValue = shownValue = current;
        ScrollTrigger.update();
        renderScene(current);
        setActive(current);
      }
    }
    return false;
  }

  addEventListener('scroll', () => {
    if (cinematic || scrollTicking) return;
    requestAnimationFrame(regularUpdate);
    scrollTicking = true;
  }, { passive: true });

  addEventListener('resize', () => {
    const restoringPosition = updateMotionMode();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
    if (!cinematic && !restoringPosition) regularUpdate();
  }, { capture: true });

  prevButton.addEventListener('click', () => goTo(activeIndex - 1));
  nextButton.addEventListener('click', () => goTo(activeIndex + 1));
  links.forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    goTo(Number(link.dataset.index));
  }));
  const restart = document.querySelector('#restart-presentation');
  if (restart) restart.addEventListener('click', () => goTo(0));

  window.MatraNavigation = { goTo, getActiveIndex: () => activeIndex, setActive, chapters, isCinematic: () => cinematic, updateMotionMode };

  if (window.gsap && window.ScrollTrigger) enableCinematic();
  if (!cinematic) regularUpdate();
})();
