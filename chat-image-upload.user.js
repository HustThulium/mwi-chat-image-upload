// ==UserScript==
// @name         银河奶牛放置 - 聊天图床
// @namespace    mwi-plugins
// @author       Thulium
// @version      0.1.5
// @description  在游戏内开关 Imgloc 上传面板，方便复制图片链接到聊天。
// @homepageURL  https://github.com/HustThulium/mwi-chat-image-upload
// @supportURL   https://github.com/HustThulium/mwi-chat-image-upload/issues
// @updateURL    https://raw.githubusercontent.com/HustThulium/mwi-chat-image-upload/main/chat-image-upload.user.js
// @downloadURL  https://raw.githubusercontent.com/HustThulium/mwi-chat-image-upload/main/chat-image-upload.user.js
// @match        https://www.milkywayidle.com/game*
// @match        https://milkywayidle.com/game*
// @grant        none
// @noframes
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';
  if (document.getElementById('mwi-image-host')) return;
  const root = document.createElement('div');
  root.id = 'mwi-image-host';
  const shadow = root.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; position: fixed; right: 20px; bottom: 64px; z-index: 10000; font: 14px system-ui, sans-serif; color: #eee; }
      button, a { font: inherit; color: #eee; }
      button { cursor: pointer; background: #424d8e; border: 1px solid #7581c0; border-radius: 5px; padding: 7px 12px; }
      :host { width: 44px; height: 44px; }
      .toggle { display: grid; place-items: center; box-sizing: border-box; width: 44px; height: 44px; padding: 0; border-radius: 50%; touch-action: none; user-select: none; box-shadow: 0 3px 12px #0006; }
      .toggle svg { width: 23px; height: 23px; pointer-events: none; }
      .toggle[aria-expanded="true"] { background: #5967ad; }
      .toggle:focus-visible { outline: 2px solid #b7c4ff; outline-offset: 3px; }
      .toggle.dragging { cursor: grabbing; }
      .panel { position: absolute; box-sizing: border-box; width: min(470px, calc(100vw - 24px)); height: min(440px, calc(100dvh - 150px)); background: #171821; border: 1px solid #626888; border-radius: 8px; overflow: hidden; box-shadow: 0 8px 30px #0008; display: flex; flex-direction: column; }
      .panel[hidden] { display: none; }
      .panel.focused { border-color: #63ff78; box-shadow: 0 0 0 2px #63ff78, 0 0 18px #63ff7880, 0 8px 30px #0008; }
      .resize-handle { position: absolute; z-index: 2; touch-action: none; user-select: none; }
      .resize-handle[data-edge="n"], .resize-handle[data-edge="s"] { left: 12px; right: 12px; height: 8px; cursor: ns-resize; }
      .resize-handle[data-edge="n"] { top: 0; }
      .resize-handle[data-edge="s"] { bottom: 0; }
      .resize-handle[data-edge="e"], .resize-handle[data-edge="w"] { top: 12px; bottom: 12px; width: 8px; cursor: ew-resize; }
      .resize-handle[data-edge="e"] { right: 0; }
      .resize-handle[data-edge="w"] { left: 0; }
      .resize-handle[data-edge="nw"], .resize-handle[data-edge="ne"], .resize-handle[data-edge="sw"], .resize-handle[data-edge="se"] { width: 12px; height: 12px; }
      .resize-handle[data-edge="nw"] { top: 0; left: 0; cursor: nwse-resize; }
      .resize-handle[data-edge="ne"] { top: 0; right: 0; cursor: nesw-resize; }
      .resize-handle[data-edge="sw"] { bottom: 0; left: 0; cursor: nesw-resize; }
      .resize-handle[data-edge="se"] { bottom: 0; right: 0; cursor: nwse-resize; background: linear-gradient(135deg, transparent 50%, #9098ba 50%, #9098ba 60%, transparent 60%); }
      .panel.resizing iframe { pointer-events: none; }
      header { display: flex; align-items: center; gap: 12px; padding: 8px 10px; }
      strong { flex: 1; }
      header button { padding: 3px 8px; }
      p { margin: 0; padding: 0 10px 8px; font-size: 12px; color: #c5c8d9; }
      iframe { width: 100%; flex: 1; min-height: 0; border: 0; background: #171717; }
      @media (max-width: 520px) { :host { right: 12px; } }
    </style>
    <section class="panel" id="panel" aria-label="图片上传" hidden>
      <header><strong>聊天图床</strong><a href="https://imgloc.com/" target="_blank" rel="noopener noreferrer">独立打开</a><button class="close" aria-label="关闭图床">×</button></header>
      <p><span class="focus-status" role="status">点击图床页面可粘贴图片。</span> 上传后复制链接到聊天框。</p>
    </section>
    <button class="toggle" aria-controls="panel" aria-expanded="false" aria-label="打开图床" title="打开图床 · 拖动可移动位置">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg>
    </button>
  `;
  const panel = shadow.querySelector('.panel');
  const toggle = shadow.querySelector('.toggle');
  const focusStatus = shadow.querySelector('.focus-status');
  let frame;
  let focusTimer;
  const positionKey = 'mwi-chat-image-upload-position';
  const sizeKey = 'mwi-chat-image-upload-size';
  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
  let panelSize = { width: 470, height: 440 };
  try {
    const saved = JSON.parse(localStorage.getItem(sizeKey));
    if (saved && Number.isFinite(saved.width) && saved.width > 0 && Number.isFinite(saved.height) && saved.height > 0) panelSize = saved;
  } catch { /* 存储不可用时使用默认尺寸。 */ }
  function sizeLimits() {
    const maxWidth = Math.max(1, innerWidth - 24);
    const maxHeight = Math.max(1, innerHeight - 24);
    return { maxWidth, maxHeight, minWidth: Math.min(320, maxWidth), minHeight: Math.min(240, maxHeight) };
  }
  function applyPanelSize() {
    const limits = sizeLimits();
    panel.style.width = `${clamp(panelSize.width, limits.minWidth, limits.maxWidth)}px`;
    panel.style.height = `${clamp(panelSize.height, limits.minHeight, limits.maxHeight)}px`;
  }
  let position = { x: innerWidth - 64, y: innerHeight - 108 };
  try {
    const saved = JSON.parse(localStorage.getItem(positionKey));
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) position = saved;
  } catch { /* 存储不可用时仍可拖动。 */ }
  function placePanel() {
    if (panel.hidden) return;
    applyPanelSize();
    const bounds = panel.getBoundingClientRect();
    const x = clamp(position.x + 44 - bounds.width, 12, innerWidth - bounds.width - 12);
    const above = position.y - bounds.height - 8;
    const y = clamp(above >= 12 ? above : position.y + 52, 12, innerHeight - bounds.height - 12);
    panel.style.left = `${x - position.x}px`;
    panel.style.top = `${y - position.y}px`;
  }
  function placeButton() {
    position.x = clamp(position.x, 8, innerWidth - 52);
    position.y = clamp(position.y, 8, innerHeight - 52);
    Object.assign(root.style, { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' });
    placePanel();
  }
  function savePosition() {
    try { localStorage.setItem(positionKey, JSON.stringify(position)); } catch { /* 忽略存储限制。 */ }
  }
  function updateFocus() {
    // Shadow DOM 中必须检查 shadow.activeElement；跨域页面内部无需读取。
    const focused = !panel.hidden && document.hasFocus() && shadow.activeElement === frame;
    panel.classList.toggle('focused', focused);
    focusStatus.textContent = focused ? '图床已聚焦，可直接 Ctrl+V 粘贴图片。' : '点击图床页面可粘贴图片。';
  }
  function focusFrame() {
    if (panel.hidden || !frame) return;
    frame.focus({ preventScroll: true });
    frame.contentWindow?.focus();
    updateFocus();
  }
  let resizing;
  function finishResize(event) {
    if (!resizing || event.pointerId !== resizing.id) return;
    const handle = resizing.handle;
    resizing = undefined;
    panel.classList.remove('resizing');
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    const bounds = panel.getBoundingClientRect();
    panelSize = { width: bounds.width, height: bounds.height };
    try { localStorage.setItem(sizeKey, JSON.stringify(panelSize)); } catch { /* 忽略存储限制。 */ }
    focusFrame();
  }
  for (const edge of ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']) {
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.dataset.edge = edge;
    handle.setAttribute('aria-hidden', 'true');
    handle.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      resizing = { id: event.pointerId, handle, edge, x: event.clientX, y: event.clientY, bounds: panel.getBoundingClientRect() };
      handle.setPointerCapture(event.pointerId);
      panel.classList.add('resizing');
    });
    handle.addEventListener('pointermove', event => {
      if (!resizing || resizing.handle !== handle || event.pointerId !== resizing.id) return;
      const { bounds, x, y } = resizing;
      const limits = sizeLimits();
      let left = bounds.left, right = bounds.right, top = bounds.top, bottom = bounds.bottom;
      if (edge.includes('w')) left = clamp(bounds.left + event.clientX - x, 12, right - limits.minWidth);
      if (edge.includes('e')) right = clamp(bounds.right + event.clientX - x, left + limits.minWidth, innerWidth - 12);
      if (edge.includes('n')) top = clamp(bounds.top + event.clientY - y, 12, bottom - limits.minHeight);
      if (edge.includes('s')) bottom = clamp(bounds.bottom + event.clientY - y, top + limits.minHeight, innerHeight - 12);
      Object.assign(panel.style, { left: `${left - position.x}px`, top: `${top - position.y}px`, width: `${right - left}px`, height: `${bottom - top}px` });
    });
    handle.addEventListener('pointerup', finishResize);
    handle.addEventListener('pointercancel', finishResize);
    handle.addEventListener('lostpointercapture', finishResize);
    panel.append(handle);
  }
  function setOpen(open) {
    if (open && !frame) {
      frame = document.createElement('iframe');
      frame.title = 'Imgloc 图片上传';
      frame.tabIndex = 0;
      frame.addEventListener('load', () => {
        // 初次加载完成后补一次聚焦；用户已切回游戏时不抢焦点。
        if (!panel.hidden && document.hasFocus() && shadow.activeElement === frame) focusFrame();
      });
      // 跨域 iframe 需要显式委托剪贴板写入权限，才能复制上传链接。
      frame.allow = "clipboard-write https://imgloc.com";
      frame.src = 'https://imgloc.com/';
      panel.append(frame);
    }
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    const label = open ? '收起图床' : '打开图床';
    toggle.setAttribute('aria-label', label);
    toggle.title = `${label} · 拖动可移动位置`;
    placePanel();
    clearInterval(focusTimer);
    if (open) {
      focusFrame();
      // 跨域 iframe 内的焦点事件不会冒泡，打开时同步检查实际焦点。
      focusTimer = setInterval(updateFocus, 150);
    } else {
      updateFocus();
    }
  }
  document.addEventListener('focusin', updateFocus);
  shadow.addEventListener('focusin', updateFocus);
  shadow.addEventListener('focusout', () => queueMicrotask(updateFocus));
  window.addEventListener('focus', updateFocus);
  window.addEventListener('blur', () => setTimeout(updateFocus, 0));
  let drag;
  let suppressClick = false;
  toggle.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: position.x, startY: position.y, moved: false };
    toggle.setPointerCapture(event.pointerId);
  });
  toggle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    toggle.classList.add('dragging');
    position = { x: drag.startX + dx, y: drag.startY + dy };
    placeButton();
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    suppressClick = drag.moved;
    if (drag.moved) savePosition();
    drag = undefined;
    toggle.classList.remove('dragging');
    if (toggle.hasPointerCapture(event.pointerId)) toggle.releasePointerCapture(event.pointerId);
  }
  toggle.addEventListener('pointerup', finishDrag);
  toggle.addEventListener('pointercancel', finishDrag);
  toggle.addEventListener('lostpointercapture', finishDrag);
  toggle.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
    setOpen(panel.hidden);
  });
  window.addEventListener('resize', placeButton);
  shadow.querySelector('.close').addEventListener('click', () => setOpen(false));
  shadow.addEventListener('keydown', event => {
    if (event.key === 'Escape') { setOpen(false); toggle.focus(); }
  });
  document.body.append(root);
  placeButton();
})();
