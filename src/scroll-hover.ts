/** Keep scroll hover cleanup outside DIM-SUM's visible tab fades. */
export function installScrollHover() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let moving = false;

  function release() {
    // A scroll that happened near the handoff still gets its full idle delay.
    if (timer === undefined && document.body?.classList.contains('aegis-scrolling')) {
      document.body.classList.remove('aegis-scrolling');
    }
  }
  function start() { moving = true; }
  function handoff() { if (moving) release(); }
  function end() { moving = false; release(); }
  function visibility() { if (document.hidden) end(); }

  document.addEventListener('dimsum:tab-motion-start', start);
  document.addEventListener('dimsum:tab-motion-handoff', handoff);
  document.addEventListener('dimsum:tab-motion-end', end);
  document.addEventListener('dimsum:section-bridge-dispose', end);
  document.addEventListener('visibilitychange', visibility);

  return {
    scroll() {
      if (!document.body?.classList.contains('aegis-scrolling')) {
        document.body?.classList.add('aegis-scrolling');
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        if (!moving) release();
      }, 150);
    },
    dispose() {
      clearTimeout(timer); timer = undefined;
      document.removeEventListener('dimsum:tab-motion-start', start);
      document.removeEventListener('dimsum:tab-motion-handoff', handoff);
      document.removeEventListener('dimsum:tab-motion-end', end);
      document.removeEventListener('dimsum:section-bridge-dispose', end);
      document.removeEventListener('visibilitychange', visibility);
      end();
    },
  };
}
