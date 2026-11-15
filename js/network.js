// Network layer for Supabase: a timeout on every request, a clear "no signal" state, and no writes without a connection.
// Reads fall back to the last good copy (see connectivity.js); writes are never queued or faked.
// Classic script (shared global scope); loaded before storage.js, which passes netFetch to the Supabase client.

const NET = { failures: 0, offline: false, listeners: [] };
const NET_TIMEOUT_MS = 20000;

function netNotify(kind) { NET.listeners.forEach(fn => { try { fn(kind); } catch (e) { /* a listener must not break requests */ } }); }
function netMarkFailed() { NET.failures++; if (!NET.offline) { NET.offline = true; netNotify('offline'); } }
function netMarkOk() { if (NET.offline) { NET.offline = false; netNotify('online'); } }

function netFetch(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    const isWrite = url.includes('/rest/v1/') && method !== 'GET' && method !== 'HEAD';
    if (isWrite && (navigator.onLine === false || NET.offline)) {
        // Do not even try: say so, and fail the way Supabase does so every caller sees an ordinary error
        netNotify('write-blocked');
        return Promise.resolve(new Response(JSON.stringify({ code: 'OFFLINE', message: 'No signal: that change was not saved. Try again when you are back online.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), NET_TIMEOUT_MS) : null;
    const options = Object.assign({}, init || {});
    if (controller && !options.signal) options.signal = controller.signal;
    return fetch(input, options).then(response => {
        clearTimeout(timer);
        netMarkOk();
        return response;
    }, error => {
        clearTimeout(timer);
        netMarkFailed();
        throw error;
    });
}

window.addEventListener('offline', () => { NET.offline = true; netNotify('offline'); });
window.addEventListener('online', () => netNotify('online-event'));
