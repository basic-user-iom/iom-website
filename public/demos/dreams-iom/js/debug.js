/**
 * Debug panel for fullscreen / viewport analysis.
 * Press D to toggle. Shows viewport, canvas, and wrapper dimensions.
 */
(function () {
  'use strict';

  var panel = document.getElementById('debug-panel');
  if (!panel) return;

  function formatRect(r) {
    if (!r || r.width === undefined) return 'N/A';
    return Math.round(r.width) + '×' + Math.round(r.height) + ' at ' + Math.round(r.left) + ',' + Math.round(r.top);
  }

  function update() {
    var vp = window.visualViewport;
    var winW = window.innerWidth;
    var winH = window.innerHeight;
    var docEl = document.documentElement;
    var bodyEl = document.body;
    var canvasBg = document.getElementById('waterCanvas');
    var canvasOverlay = document.getElementById('waterCanvasOverlay');
    var wrapBg = document.querySelector('.intro-bg-wrap');
    var wrapOverlay = document.querySelector('.intro-overlay-wrap');
    var section = document.querySelector('.chapter--intro');

    var lines = [];

    /* Viewport */
    lines.push('[Viewport]');
    lines.push('  window.innerWidth × innerHeight: ' + winW + ' × ' + winH);
    if (vp) {
      lines.push('  visualViewport: ' + Math.round(vp.width) + '×' + Math.round(vp.height) + ' offset ' + Math.round(vp.offsetLeft) + ',' + Math.round(vp.offsetTop));
      var same = (Math.round(vp.width) === winW && Math.round(vp.height) === winH) ? ' (same)' : ' (DIFFERENT – possible cause)';
      lines.push('  visualViewport vs inner: ' + same);
    } else {
      lines.push('  visualViewport: not available');
    }
    lines.push('  documentElement.clientWidth × clientHeight: ' + docEl.clientWidth + ' × ' + docEl.clientHeight);
    lines.push('  body.getBoundingClientRect(): ' + formatRect(bodyEl.getBoundingClientRect()));
    lines.push('');

    /* Water canvases */
    lines.push('[Water canvases]');
    if (canvasBg) {
      var rBg = canvasBg.getBoundingClientRect();
      var attrW = canvasBg.getAttribute('width');
      var attrH = canvasBg.getAttribute('height');
      var styleW = canvasBg.style.width || '(not set)';
      var styleH = canvasBg.style.height || '(not set)';
      var comp = window.getComputedStyle(canvasBg);
      lines.push('  #waterCanvas:');
      lines.push('    attr width×height: ' + (attrW || '—') + ' × ' + (attrH || '—'));
      lines.push('    style.width / height: ' + styleW + ' / ' + styleH);
      lines.push('    clientWidth × clientHeight: ' + canvasBg.clientWidth + ' × ' + canvasBg.clientHeight);
      lines.push('    getBoundingClientRect(): ' + formatRect(rBg));
      lines.push('    computed position: ' + comp.position + ', top ' + comp.top + ', left ' + comp.left);
      var fullscreen = (rBg.width >= winW - 2 && rBg.height >= winH - 2) ? ' OK' : ' NOT fullscreen (w=' + Math.round(rBg.width) + ' h=' + Math.round(rBg.height) + ')';
      lines.push('    vs viewport: ' + fullscreen);
    } else {
      lines.push('  #waterCanvas: not found');
    }
    if (canvasOverlay) {
      var rOl = canvasOverlay.getBoundingClientRect();
      lines.push('  #waterCanvasOverlay getBoundingClientRect(): ' + formatRect(rOl));
    }
    lines.push('');

    /* Wrappers */
    lines.push('[Wrappers]');
    if (wrapBg) {
      var rWrap = wrapBg.getBoundingClientRect();
      var wrapComp = window.getComputedStyle(wrapBg);
      lines.push('  .intro-bg-wrap:');
      lines.push('    getBoundingClientRect(): ' + formatRect(rWrap));
      lines.push('    computed position: ' + wrapComp.position + ', inset: ' + (wrapComp.top || '') + ' ' + (wrapComp.right || '') + ' ' + (wrapComp.bottom || '') + ' ' + (wrapComp.left || ''));
    }
    if (wrapOverlay) {
      lines.push('  .intro-overlay-wrap getBoundingClientRect(): ' + formatRect(wrapOverlay.getBoundingClientRect()));
    }
    if (!wrapBg && !wrapOverlay) lines.push('  (wrappers removed – canvases direct on body)');
    lines.push('');

    /* Section */
    lines.push('[Intro section]');
    if (section) {
      var rSec = section.getBoundingClientRect();
      var secComp = window.getComputedStyle(section);
      lines.push('  .chapter--intro:');
      lines.push('    getBoundingClientRect(): ' + formatRect(rSec));
      lines.push('    computed position: ' + secComp.position + ', z-index: ' + secComp.zIndex);
    }
    lines.push('');
    lines.push('Press D to hide. Resize window to refresh.');

    panel.innerHTML = lines.join('\n');

    /* Also log once to console for copy/paste */
    if (window.__debugLastLog !== lines.join('\n')) {
      window.__debugLastLog = lines.join('\n');
      console.log('[Dream debug]\n' + lines.join('\n'));
    }
  }

  function toggle() {
    panel.classList.toggle('debug-panel--hidden');
    if (!panel.classList.contains('debug-panel--hidden')) {
      update();
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'd' || e.key === 'D') {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggle();
      }
    }
  });

  window.addEventListener('resize', update);
  window.addEventListener('load', update);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', update);
    window.visualViewport.addEventListener('scroll', update);
  }

  /* Run once after a short delay so water-gl has set canvas size */
  setTimeout(update, 100);
  setTimeout(update, 500);

  /* Show panel on load if ?debug=1 in URL */
  if (/[?&]debug=1/.test(window.location.search)) {
    panel.classList.remove('debug-panel--hidden');
    update();
  }
})();
