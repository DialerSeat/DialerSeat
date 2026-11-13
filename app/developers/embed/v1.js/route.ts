// =============================================================================
// dev.dialerseat.com/embed/v1.js — the miniplayer loader
// =============================================================================
// The one script a platform pastes. It defines window.DialerSeat.mount(), which
// puts the dialer frame in an element and relays its events to the page.
//
//   - The session token goes in the frame URL's #fragment, which browsers never
//     send to a server, so it cannot land in a log. The frame reads it and
//     clears it.
//   - Messages are accepted only from that frame's window and DialerSeat's
//     origin, and sent only to that frame, at DialerSeat's origin.
//   - Plain ES5, no dependencies, so it runs on any page a CRM has.
// =============================================================================

export const dynamic = 'force-static'

const LOADER = String.raw`/*! DialerSeat miniplayer loader v1 · https://dev.dialerseat.com/docs/miniplayer */
(function () {
  if (window.DialerSeat && window.DialerSeat.version) return;
  var script = document.currentScript;
  var src = script && script.src ? new URL(script.src) : null;
  if (!src) { console.error('DialerSeat: load v1.js with a <script src> tag.'); return; }
  var ORIGIN = src.origin;
  var ROOT = ORIGIN + src.pathname.replace(/\/embed\/v1\.js$/, '');
  var DEFAULT_KEY = script.getAttribute('data-key') || '';

  function mount(target, options) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) throw new Error('DialerSeat.mount: nothing on the page matches ' + target);
    var opts = options || {};
    if (!opts.session) throw new Error('DialerSeat.mount: pass { session }, the token from POST /v1/seats/{id}/sessions on your server.');

    var q = 'k=' + encodeURIComponent(opts.publishableKey || DEFAULT_KEY) +
      '&theme=' + encodeURIComponent(opts.theme === 'light' ? 'light' : 'dark') +
      (opts.campaign ? '&campaign=' + encodeURIComponent(opts.campaign) : '');
    var frame = document.createElement('iframe');
    frame.src = ROOT + '/embed/dialer?' + q + '#s=' + encodeURIComponent(opts.session);
    frame.title = 'DialerSeat dialer';
    frame.allow = 'microphone; autoplay';
    frame.setAttribute('style', 'width:100%;height:100%;min-height:560px;border:0;border-radius:16px;color-scheme:normal;display:block;');
    el.appendChild(frame);

    var listeners = {};
    var ready = false;
    var queue = [];
    function emit(type, payload) {
      var list = (listeners[type] || []).concat(listeners['*'] || []);
      for (var i = 0; i < list.length; i++) { try { list[i](payload, type); } catch (e) { console.error(e); } }
    }
    function post(type, payload) {
      var msg = { __dialerseat: 1, type: type, payload: payload };
      if (!ready) { queue.push(msg); return; }
      frame.contentWindow.postMessage(msg, ORIGIN);
    }
    function onMessage(e) {
      if (e.source !== frame.contentWindow || e.origin !== ORIGIN) return;
      var d = e.data;
      if (!d || d.__dialerseat !== 1 || typeof d.type !== 'string') return;
      if (d.type === 'ready') {
        ready = true;
        if (opts.leads) post('leads', opts.leads);
        while (queue.length) frame.contentWindow.postMessage(queue.shift(), ORIGIN);
      }
      emit(d.type, d.payload);
    }
    window.addEventListener('message', onMessage);

    return {
      on: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); return this; },
      off: function (type, fn) { listeners[type] = (listeners[type] || []).filter(function (f) { return f !== fn; }); return this; },
      setLeads: function (leads) { post('leads', leads); return this; },
      destroy: function () { window.removeEventListener('message', onMessage); if (frame.parentNode) frame.parentNode.removeChild(frame); listeners = {}; },
      frame: frame
    };
  }

  window.DialerSeat = { version: '1', mount: mount };
})();
`

export function GET() {
  return new Response(LOADER, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
