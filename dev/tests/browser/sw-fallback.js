// sw.js: after an update the PREVIOUS version's saved copy is kept (activate deletes only older ones), and a page request with ?fallback=1
// is answered from that previous copy (its index.html), falling back to the normal network-first page when there is none. Plain node, no browser:
// the generated sw.js is run against small stand-ins for caches / fetch.
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync(require('path').resolve(__dirname, '../../../sw.js'), 'utf8');

function makeSW(cacheNames, contents) {
  const listeners = {};
  const store = new Map(cacheNames.map(n => [n, new Map(Object.entries(contents[n] || {}))]));
  const caches = {
    keys: async () => [...store.keys()],
    open: async (n) => { if (!store.has(n)) store.set(n, new Map()); const m = store.get(n); return { match: async (u) => m.get(typeof u === 'string' ? u : u.url) || undefined, put: async (u, r) => { m.set(typeof u === 'string' ? u : u.url, r); } }; },
    delete: async (n) => store.delete(n),
    match: async (u) => { for (const m of store.values()) { const k = typeof u === 'string' ? u : u.url; if (m.has(k)) return m.get(k); } return undefined; },
  };
  const self = { addEventListener: (type, fn) => { listeners[type] = fn; }, skipWaiting: () => {}, clients: { claim: async () => {} }, location: { href: 'https://example.com/', origin: 'https://example.com' } };
  const ctx = { self, caches, fetch: async () => ({ ok: true, clone() { return this; }, tag: 'network' }), URL, Response: { error: () => ({ error: true }) }, setTimeout, clearTimeout, Promise, console };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return { listeners, store, ctx };
}
const version = /const VERSION = '([^']+)'/.exec(src)[1];
const CUR = 'six-nations-' + version;
(async () => {
  // 1. activate keeps the current and the one before it, drops the older ones
  const sw = makeSW(['six-nations-aaaa', 'six-nations-bbbb', CUR], { 'six-nations-bbbb': { 'index.html': { tag: 'previous-page' } } });
  let waited; await new Promise(res => { sw.listeners.activate({ waitUntil: p => { waited = p.then(res); } }); }); await waited;
  const left = [...sw.store.keys()];
  console.log('activate keeps the current and the previous saved copy, drops older ones:', JSON.stringify(left), left.length === 2 && left.includes(CUR) && left.includes('six-nations-bbbb') && !left.includes('six-nations-aaaa'));
  // 2. ?fallback=1 is answered from the previous copy
  let answered;
  sw.listeners.fetch({ request: { method: 'GET', url: 'https://example.com/index.html?fallback=1&r=1', mode: 'navigate' }, respondWith: p => { answered = p; } });
  const resp = await answered;
  console.log('?fallback=1 serves the previous version\'s page:', JSON.stringify(resp), resp && resp.tag === 'previous-page');
  // 3. no previous copy: the normal page (network)
  const sw2 = makeSW([CUR], {});
  let answered2;
  sw2.listeners.fetch({ request: { method: 'GET', url: 'https://example.com/index.html?fallback=1', mode: 'navigate' }, respondWith: p => { answered2 = p; } });
  const resp2 = await answered2;
  console.log('no previous copy: falls back to the normal (network) page:', resp2 && resp2.tag === 'network');
  process.exit(0);
})();
