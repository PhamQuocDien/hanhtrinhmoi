(() => {
  'use strict';
  if (window.__boardUiV14) return;
  window.__boardUiV14 = true;
  const markBoardImagesEager = () => {
    document.querySelectorAll('#myBoard img,.board-container img,.board-wrap img,#main-board img').forEach(img => {
      img.loading = 'eager';
      img.decoding = 'sync';
      img.removeAttribute('width');
      img.removeAttribute('height');
    });
  };
  const resizeBoards = () => {
    markBoardImagesEager();
    try { if (window.board && typeof window.board.resize === 'function') window.board.resize(); } catch (_) {}
    window.dispatchEvent(new CustomEvent('board:v14-resize'));
  };
  const observer = new MutationObserver(mutations => {
    if (mutations.some(item => item.addedNodes.length)) requestAnimationFrame(markBoardImagesEager);
  });
  function setup() {
    document.body.classList.add('board-page');
    markBoardImagesEager();
    observer.observe(document.body, { childList: true, subtree: true });
    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => requestAnimationFrame(resizeBoards)) : null;
    const target = document.querySelector('.game-layout,.shell,.game-container,#myBoard,.board-container');
    if (ro && target) ro.observe(target);
    let timer;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(resizeBoards, 120); }, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(resizeBoards, 250), { passive: true });
    setTimeout(resizeBoards, 100);
    setTimeout(resizeBoards, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
