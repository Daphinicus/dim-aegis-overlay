const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/scroll-hover.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const document = new EventTarget();
const classes = new Set();
let classWrites = 0;
document.body = { classList: { add: value => classes.add(value), remove: value => { classWrites++; classes.delete(value); }, contains: value => classes.has(value) } };
document.hidden = false;
let now = 0, nextId = 0;
const timers = new Map();
const advance = ms => {
  now += ms;
  for (const [id, task] of timers) if (task.time <= now) { timers.delete(id); task.callback(); }
};
const exportsObject = {};
new Function('exports', 'document', 'setTimeout', 'clearTimeout', source)(exportsObject, document,
  (callback, delay) => { const id = ++nextId; timers.set(id, { callback, time: now + delay }); return id; },
  id => timers.delete(id));
const controller = exportsObject.installScrollHover();
const signal = phase => document.dispatchEvent(new Event('dimsum:tab-motion-' + phase));
const suppressed = () => classes.has('aegis-scrolling');

signal('start'); signal('handoff'); signal('end');
assert.equal(classWrites, 0, 'Motion without scrolling does not write the body class');
controller.scroll(); advance(149); assert.equal(suppressed(), true);
advance(1); assert.equal(suppressed(), false, 'Standalone scrolling retains the 150 ms idle delay');
signal('start'); controller.scroll(); advance(150);
assert.equal(suppressed(), true, 'Timer expiry cannot invalidate hover styles during the outgoing fade');
signal('handoff'); assert.equal(suppressed(), false, 'Due cleanup runs before the incoming paint boundary');
controller.scroll(); advance(150);
assert.equal(suppressed(), true, 'A real scroll during entrance stays suppressed through its fade');
signal('end'); assert.equal(suppressed(), false);

signal('start'); controller.scroll(); advance(100); controller.scroll(); advance(60);
signal('handoff'); assert.equal(suppressed(), true, 'Handoff cannot shorten the latest scroll idle delay');
signal('end'); advance(89); assert.equal(suppressed(), true);
advance(1); assert.equal(suppressed(), false);

for (const cancel of [() => signal('end'),
  () => document.dispatchEvent(new Event('dimsum:section-bridge-dispose')),
  () => { document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); }]) {
  document.hidden = false; signal('start'); controller.scroll(); advance(150); cancel();
  assert.equal(suppressed(), false, 'Cancellation, bridge disposal, and hiding release due cleanup');
}
signal('start'); controller.scroll(); controller.dispose(); advance(1000);
assert.equal(suppressed(), false); assert.equal(timers.size, 0);
signal('start'); signal('handoff'); signal('end');
assert.equal(suppressed(), false, 'Disposal removes listeners and pending work');
console.log('PASS: scroll idle, tab handoff, repeated scrolling, cancellation, visibility, and disposal.');
