// chat.js — Combined UI Controller for SteveAI
(function () {
  function init() {
    /* =================== Elements =================== */
    const sidebar = document.getElementById('sidebar');
    const mobileOpen = document.getElementById('mobileOpen');
    const themeCards = document.querySelectorAll('.theme-card');
    const darkToggle = document.getElementById('darkToggle');
    const switchEl = document.querySelectorAll('.switch');
    const messages = document.getElementById('messages');
    const sendBtn = document.getElementById('sendBtn');
    const inputEl = document.getElementById('messageInput');
    const clearBtn = document.getElementById('clearBtn');
    const helpBtn = document.getElementById('helpBtn');
    const attachBtn = document.getElementById('attach');
    const msgTemplate = document.getElementById('msg-template');

    const filePickBtn = document.getElementById('filePickBtn');
    const fileUploadInput = document.getElementById('fileUploadInput');
    const visionPickBtn = document.getElementById('visionPickBtn');
    const visionUploadInput = document.getElementById('visionUploadInput');
    const toolsToggle = document.getElementById('toolsToggle');
    const toolsToggleMobile = document.getElementById('toolsToggleMobile');
    const toolsPanel = document.getElementById('toolsPanel');
    const hintsEl = document.getElementById('commandHints');
    const form = document.getElementById('inputForm');

    const safeFocus = el => { try { el?.focus(); } catch (_) {} };

    /* =================== LocalStorage =================== */
    const LS_THEME = 'sa_theme';
    const LS_DARK = 'sa_dark';
    const savedTheme = localStorage.getItem(LS_THEME) || 'classic';
    const savedDark = localStorage.getItem(LS_DARK) === 'true';

    /* =================== Theme / Dark =================== */
    function applyTheme(theme) {
      document.body.classList.remove('theme-classic', 'theme-imessage', 'theme-material', 'theme-terminal');
      document.body.classList.add(`theme-${theme}`);
      themeCards.forEach(card => {
        const is = card.dataset.theme === theme;
        card.classList.toggle('selected', is);
        card.setAttribute('aria-pressed', is ? 'true' : 'false');
      });
      localStorage.setItem(LS_THEME, theme);
    }

    function applyDark(on) {
      document.body.classList.toggle('dark', !!on);
      switchEl.forEach(s => s.classList.toggle('on', !!on));
      darkToggle?.setAttribute('aria-checked', !!on);
      localStorage.setItem(LS_DARK, !!on);
    }

    applyTheme(savedTheme);
    applyDark(savedDark);

    themeCards.forEach(card => {
      card.addEventListener('click', () => applyTheme(card.dataset.theme));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
    });

    darkToggle?.addEventListener('click', () => applyDark(!(localStorage.getItem(LS_DARK) === 'true')));
    darkToggle?.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); darkToggle.click(); }
    });

    /* =================== Sidebar Mobile =================== */
    mobileOpen?.addEventListener('click', () => sidebar?.classList.toggle('open'));
    document.addEventListener('click', e => {
      if (window.innerWidth <= 980 && sidebar?.classList.contains('open')) {
        const inside = e.composedPath().includes(sidebar) || e.target === mobileOpen;
        if (!inside) sidebar.classList.remove('open');
      }
    });

    /* =================== Message Append =================== */
    function appendMessage(text, who = 'bot') {
      if (!msgTemplate || !messages) return;
      const tpl = msgTemplate.content.cloneNode(true);
      const row = tpl.querySelector('.msg-row');
      const bubble = tpl.querySelector('.message');
      const meta = tpl.querySelector('.meta');

      row.classList.add(who === 'user' ? 'row-user' : 'row-bot');
      bubble.classList.add(who === 'user' ? 'bubble-user' : 'bubble-bot');

      bubble.textContent = text;
      meta.textContent = (who === 'user' ? 'You • ' : 'SteveAI • ') + new Date().toLocaleTimeString();

      messages.appendChild(row);
      messages.parentElement.scrollTop = messages.scrollHeight - messages.parentElement.clientHeight + 200;
    }

    appendMessage('Welcome to SteveAI — choose Appearance in the left sidebar to switch themes instantly.', 'bot');

    /* =================== Send / Enter =================== */
    sendBtn?.addEventListener('click', () => {
      const v = inputEl.value.trim();
      if (!v) return;
      appendMessage(v, 'user');
      inputEl.value = '';
      if (typeof window.sendChatMessage === 'function') {
        window.sendChatMessage(v);
      } else {
        // fallback demo
        setTimeout(() => appendMessage('Received: ' + (v.length > 120 ? v.slice(0, 120) + '…' : v), 'bot'), 650);
      }
    });

    inputEl?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
    });

    /* =================== Clear / Help / Attach =================== */
    clearBtn?.addEventListener('click', () => { messages.innerHTML = ''; appendMessage('Conversation cleared.', 'bot'); });
    helpBtn?.addEventListener('click', () => appendMessage('/help — available demo commands: /export /clear /theme', 'bot'));
    attachBtn?.addEventListener('click', () => appendMessage('Opened upload (demo).', 'bot'));

    /* =================== File Picker =================== */
    if (filePickBtn && fileUploadInput) {
      filePickBtn.addEventListener('click', () => fileUploadInput.click());
      fileUploadInput.addEventListener('change', e => {
        const f = e.target.files?.[0];
        if (f && typeof window.handleFileUpload === 'function') window.handleFileUpload(f);
      });
    }

    /* =================== Vision Picker =================== */
    if (visionPickBtn && visionUploadInput) {
      visionPickBtn.addEventListener('click', () => visionUploadInput.click());
      visionUploadInput.addEventListener('change', e => {
        const f = e.target.files?.[0];
        if (f && typeof window.handleFileUpload === 'function') window.handleFileUpload(f, true);
      });
    }

    /* =================== Tools Toggle =================== */
    function showTools(show) {
      if (!toolsPanel) return;
      toolsPanel.style.display = show ? 'flex' : 'none';
      toolsPanel.style.flexDirection = 'column';
    }
    showTools(window.innerWidth > 900);
    toolsToggle?.addEventListener('click', () => showTools(toolsPanel.style.display !== 'flex'));
    toolsToggleMobile?.addEventListener('click', () => showTools(toolsPanel.style.display !== 'flex'));
    window.addEventListener('resize', () => showTools(window.innerWidth > 900));

    /* =================== Input Autosize + Command Hints =================== */
    if (inputEl) {
      inputEl.addEventListener('input', () => {
        hintsEl.hidden = !(inputEl.value.trim().startsWith('/'));
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(200, inputEl.scrollHeight) + 'px';
      });
      document.querySelectorAll('#commandHints span').forEach(span => {
        span.onclick = () => { inputEl.value = span.textContent + ' '; safeFocus(inputEl); hintsEl.hidden = true; };
      });
    }

    /* =================== Shortcuts =================== */
    window.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); safeFocus(inputEl); }
    });

    /* =================== Auto Dark Mode =================== */
    if (localStorage.getItem(LS_DARK) === null) {
      try {
        const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefers) applyDark(true);
      } catch (e) {}
    }

    console.debug('chat.js: UI ready');

    /* =================== Global API =================== */
    window.SteveAI = {
      setTheme: applyTheme,
      setDark: applyDark,
      appendMessage,
      clear: () => { messages.innerHTML = ''; appendMessage('Conversation cleared.', 'bot'); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
