(() => {
  const chapterCount = document.querySelectorAll('.chapter').length;
  const countEl = document.querySelector('#chapter-count');
  if (countEl) countEl.textContent = `${chapterCount} chapters`;
  document.documentElement.classList.add('app-ready');
})();
