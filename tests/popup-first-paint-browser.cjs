const fs = require('node:fs');
const { bundle, runFixture } = require('./browser-helpers.cjs');
const nativeFactories = [require('./fixtures/dim/native-use-popper.cjs'), require('./fixtures/dim/native-use-popper.beta.cjs')];
async function run() {
  const adapter = await bundle('src/native-popup-positioning.ts', 'NativePopup');
  const interaction = await bundle('src/popup-interaction.ts', 'PopupInteraction');
  for (const nativeFactory of nativeFactories) for (const width of [1280, 960, 600]) {
    await runFixture(`<style>
      .item-popup { width:400px; }
      .native-layout { display:flex; }
      .item-popup[data-popper-placement^="right"] .native-layout { flex-direction:row-reverse; }
      .native-body { width:300px;height:400px; }
      .native-actions { width:100px;height:100px; }
      .arrow { position:absolute;width:8px;height:8px; }
      [data-aegis-details] { width:280px;height:200px; }
    </style><pre id="result">Running</pre><script>
    ${adapter}
    ${interaction}
    const originalFactory = ${nativeFactory.toString()};
    const check = (value, message) => { if (!value) throw Error(message); };
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    async function test() {
      // Emulate both the early chunk queue and the runtime replacing push.
      const host = {rspackChunkdim: []};
      let prepares = 0;
      const attach = popup => {
        const card = popup.querySelector('[data-aegis-details]');
        if (!card) return;
        const side = PopupInteraction.getPopupSidebarSide(popup, 280, !popup.hasAttribute('data-test-inline'));
        card.style.position = side ? 'absolute' : 'static';
        card.style.top = '0px';
        card.style.left = side === 'left' ? '-292px' : (popup.offsetWidth + 12) + 'px';
      };
      NativePopup.interceptDimPopupModules(host, popup => {
        prepares++;
        // Overview recommendations can widen DIM during synchronous preparation.
        if (innerWidth === 1280 && popup.querySelector('.native-body')) {
          popup.style.width = '480px';
          popup.querySelector('.native-body').style.width = '380px';
        }
        if (!popup.querySelector('[data-aegis-details]')) {
          const card = document.createElement('div'); card.dataset.aegisDetails = 'true';
          popup.append(card);
        }
        attach(popup);
      });
      document.addEventListener('aegis-popup-layout', event => attach(event.target));
      const modules = {};
      const priorPush = host.rspackChunkdim.push.bind(host.rspackChunkdim);
      host.rspackChunkdim.push = chunk => { Object.assign(modules, chunk[1]); return priorPush(chunk); };
      host.rspackChunkdim.push([[1], {native: originalFactory, unrelated: function() { return 42; }}]);
      check(modules.native !== originalFactory && modules.unrelated() === 42, 'Only native usePopper factory is adapted');
      let cleanup, effects = 0, execute = true;
      const react = {useLayoutEffect(effect) { effects++; if (execute) { cleanup?.(); cleanup = effect(); } }};
      const requireModule = () => react;
      requireModule.d = (exports, getters) => {
        for (const [key, getter] of Object.entries(getters)) Object.defineProperty(exports, key, {get: getter, enumerable: true});
      };
      const exports = {}; modules.native({}, exports, requireModule);
      const hook = Object.values(exports)[0];
      check(typeof hook === 'function', 'Captured DIM native hook export remains callable');
      execute = false;
      hook({contents:{current:null},reference:{current:null},arrowClassName:'arrow'});
      check(effects === 1 && prepares === 0, 'Ordinary tooltips retain native hook');
      execute = true;
      const tile = document.createElement('div');
      tile.style.cssText = 'position:fixed;left:' + (innerWidth - 180) + 'px;top:200px;width:80px;height:80px';
      document.body.append(tile);
      const popup = document.createElement('div'); popup.className='item-popup';
      popup.innerHTML = '<div class="native-layout"><div class="native-body">Overview</div><div class="native-actions">Quick actions</div></div><div class="arrow"></div>';
      document.body.append(popup);
      const options = {contents:{current:popup},reference:{current:tile},arrowClassName:'arrow',menuClassName:'native-actions',placement:'right'};
      hook(options);
      check(prepares === 1 && popup.querySelector('[data-aegis-details]'), 'Evaluation and sidebar attachment happen inside native layout effect');
      check(!popup.hasAttribute('data-aegis-placement-pending') && getComputedStyle(popup).visibility === 'visible', 'No visibility gate or reveal timer');
      const positions = [];
      for (let i=0;i<5;i++) { await frame(); positions.push(popup.getBoundingClientRect().toJSON()); }
      const expectedSide = innerWidth >= 960 ? 'left' : 'inline';
      check(popup.dataset.aegisNativePopupSide === expectedSide, 'Combined width determines initial native placement');
      check(positions.every(rect => rect.left === positions[0].left && rect.top === positions[0].top && rect.height === positions[0].height), 'First visible frame already has final geometry');
      if (expectedSide === 'left') {
        check(positions[0].left === innerWidth - 188 - popup.offsetWidth, 'Popup flips using expanded Overview width before its first paint');
        check(popup.querySelector('[data-aegis-details]').getBoundingClientRect().right < popup.getBoundingClientRect().left, 'Sidebar appears on far side');
        check(popup.querySelector('.native-actions').getBoundingClientRect().right < tile.getBoundingClientRect().left, 'Quick actions remain next to tile');
      } else {
        check(positions[0].height === 600, 'Inline height is included in initial native measurement');
      }
      const settledPrepares = prepares; await frame(); await frame();
      check(prepares === settledPrepares, 'Stable geometry does not trigger repeated placement');
      if (innerWidth >= 960) {
        tile.style.left = '40px';
        hook(options);
        await frame();
        check(popup.dataset.aegisNativePopupSide === 'right' && popup.getBoundingClientRect().left === 128,
          'Native effect handles the other anchor side on its first visible frame');
      }
      popup.setAttribute('data-test-inline','');
      attach(popup);
      await frame(); await frame();
      check(popup.dataset.aegisNativePopupSide === 'inline' && popup.getBoundingClientRect().height === 600, 'Changing layout preference uses the same native transaction');
      cleanup(); popup.remove(); tile.remove();
      const closed = document.createElement('div'); closed.className='item-popup';
      document.body.append(closed);
      const reference = document.createElement('div'); document.body.append(reference);
      hook({...options,contents:{current:closed},reference:{current:reference}});
      cleanup(); closed.remove(); reference.remove();
      await frame();
      check(!closed.hasAttribute('data-popper-placement'), 'Cancelled native calculation cannot write after close');
      document.querySelector('#result').textContent = 'PASS: Captured DIM placement hook, first paint, combined sizing, inline fallback, cleanup at ' + innerWidth + 'px';
    }
    test().catch(error => document.querySelector('#result').textContent = 'FAIL: ' + error.message);
    </script>`, {viewport:{width,height:800}});
  }
}
run().catch(error => { console.error(error); process.exitCode=1; });
