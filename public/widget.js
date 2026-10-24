/*
 * LeadFlow website widget loader. Add to any page:
 *   <script src="https://YOUR-LEADFLOW-HOST/widget.js" data-key="pk_..." async></script>
 * Optional: data-color="#0f766e" (button and chat colour), data-label="Chat with us",
 * data-teaser="Questions about treatment or prices? Ask me!" (or "off").
 */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || window.__leadflowWidget) return;
  var key = script.getAttribute('data-key');
  if (!key) return;
  window.__leadflowWidget = true;

  var origin = new URL(script.src, location.href).origin;
  var color = script.getAttribute('data-color') || '#0f766e';
  if (!/^#[0-9a-f]{3,8}$/i.test(color)) color = '#0f766e';
  var label = script.getAttribute('data-label') || 'Chat with us';
  var teaserText = script.getAttribute('data-teaser');
  if (teaserText === null) teaserText = 'Hi! Questions about treatments, prices or booking? I can help.';

  var button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML =
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  button.style.cssText =
    'position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;z-index:2147483646;' +
    'display:grid;place-items:center;color:#fff;background:' + color + ';box-shadow:0 8px 24px rgba(0,0,0,.2);';

  var frame = null;
  function sizeFrame() {
    if (!frame) return;
    var small = window.innerWidth < 480;
    frame.style.cssText =
      'position:fixed;z-index:2147483647;border:0;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.25);' +
      (small
        ? 'inset:0;width:100%;height:100%;border-radius:0;'
        : 'right:20px;bottom:92px;width:380px;height:620px;max-height:calc(100vh - 112px);border-radius:16px;') +
      (frame.hidden ? 'display:none;' : '');
  }

  // A small greeting bubble next to the button, once per visit.
  var teaser = null;
  function hideTeaser() {
    if (teaser) teaser.remove();
    teaser = null;
  }
  function showTeaser() {
    try {
      if (sessionStorage.getItem('leadflow:teaser')) return;
      sessionStorage.setItem('leadflow:teaser', '1');
    } catch (e) {
      /* storage blocked: show it anyway */
    }
    if ((frame && !frame.hidden) || !teaserText || teaserText === 'off') return;
    teaser = document.createElement('div');
    teaser.setAttribute('role', 'status');
    teaser.textContent = teaserText;
    teaser.style.cssText =
      'position:fixed;right:20px;bottom:92px;max-width:260px;padding:12px 14px;border-radius:14px;z-index:2147483646;cursor:pointer;' +
      'background:#fff;color:#16202a;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.18);';
    teaser.addEventListener('click', function () {
      hideTeaser();
      open();
    });
    document.body.appendChild(teaser);
    setTimeout(hideTeaser, 12000);
  }

  function open() {
    hideTeaser();
    if (!frame) {
      frame = document.createElement('iframe');
      frame.title = label;
      frame.src = origin + '/chat.html?embed=1&key=' + encodeURIComponent(key) + '&color=' + encodeURIComponent(color);
      frame.setAttribute('allow', 'clipboard-write');
      document.body.appendChild(frame);
    }
    frame.hidden = false;
    sizeFrame();
    button.setAttribute('aria-expanded', 'true');
  }

  function close() {
    if (!frame) return;
    frame.hidden = true;
    sizeFrame();
    button.setAttribute('aria-expanded', 'false');
    button.focus();
  }

  button.addEventListener('click', function () {
    if (frame && !frame.hidden) close();
    else open();
  });
  window.addEventListener('message', function (e) {
    if (e.origin === origin && e.data && e.data.type === 'leadflow:close') close();
  });
  window.addEventListener('resize', sizeFrame);

  function mount() {
    document.body.appendChild(button);
    setTimeout(showTeaser, 6000);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
