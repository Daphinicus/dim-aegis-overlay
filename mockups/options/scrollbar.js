document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    html { scrollbar-width: none; }
    html::-webkit-scrollbar { display: none; }
    .preview-scrollbar { position: fixed; inset: 3px 1px 3px auto; width: 8px; z-index: 2147483647; touch-action: none; }
    .preview-scrollbar[hidden] { display: none; }
    .preview-scrollbar-thumb { position: absolute; top: 0; right: 1px; width: 3px; border-radius: 8px; background: #727282; opacity: .65; }
    .preview-scrollbar:hover .preview-scrollbar-thumb, .preview-scrollbar:focus-visible .preview-scrollbar-thumb { width: 6px; background: #b3a17d; opacity: 1; }
    .preview-scrollbar:focus-visible { outline: 1px solid #ffc04a; border-radius: 4px; }
  `;
  document.head.append(style);
  const names = {en:'Scroll preview',es:'Desplazar vista previa',ko:'미리보기 스크롤',ja:'プレビューをスクロール','zh-CHS':'滚动预览','zh-CHT':'捲動預覽'};
  const track = document.createElement('div');
  track.className = 'preview-scrollbar';
  track.tabIndex = 0;
  track.setAttribute('role', 'scrollbar');
  track.setAttribute('aria-orientation', 'vertical');
  track.setAttribute('aria-valuemin', '0');
  document.documentElement.id ||= 'preview-page';
  track.setAttribute('aria-controls', document.documentElement.id);
  const thumb = document.createElement('div');
  thumb.className = 'preview-scrollbar-thumb';
  track.append(thumb);
  document.body.append(track);
  const scroller = document.scrollingElement;
  let pending = false;
  let travel = 0;
  let limit = 0;
  function update() {
    pending = false;
    limit = Math.max(0, scroller.scrollHeight - innerHeight);
    track.hidden = limit <= 1;
    track.setAttribute('aria-label', names[store.aegisLanguage] || names.en);
    track.setAttribute('aria-valuemax', String(limit));
    track.setAttribute('aria-valuenow', String(Math.round(scroller.scrollTop)));
    const height = Math.max(28, (innerHeight - 6) * innerHeight / scroller.scrollHeight);
    travel = Math.max(0, innerHeight - 6 - height);
    thumb.style.height = height + 'px';
    thumb.style.transform = `translateY(${limit ? scroller.scrollTop / limit * travel : 0}px)`;
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  }
  addEventListener('scroll', schedule, {passive:true});
  addEventListener('resize', schedule);
  new ResizeObserver(schedule).observe(document.body);
  let drag;
  track.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !travel) return;
    event.preventDefault();
    if (event.target !== thumb) {
      scroller.scrollTop = Math.max(0, Math.min(1, (event.clientY - 3 - thumb.offsetHeight / 2) / travel)) * limit;
    }
    drag = {y:event.clientY, scroll:scroller.scrollTop};
    track.setPointerCapture(event.pointerId);
  });
  track.addEventListener('pointermove', event => {
    if (drag && travel) scroller.scrollTop = drag.scroll + (event.clientY - drag.y) / travel * limit;
  });
  track.addEventListener('lostpointercapture', () => { drag = undefined; });
  track.addEventListener('pointerup', event => { track.releasePointerCapture(event.pointerId); });
  track.addEventListener('keydown', event => {
    const delta = {ArrowDown:40, ArrowUp:-40, PageDown:innerHeight * .9, PageUp:-innerHeight * .9}[event.key];
    if (delta !== undefined) scroller.scrollTop += delta;
    else if (event.key === 'Home') scroller.scrollTop = 0;
    else if (event.key === 'End') scroller.scrollTop = limit;
    else return;
    event.preventDefault();
  });
  update();
});
