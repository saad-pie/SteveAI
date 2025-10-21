/* chat.js — UI controller only
   - Handles UI events (file pick, vision pick, tools toggle, textarea autosize, command hints)
   - Submits messages via window.sendChatMessage() (defined in index.js)
   - Does NOT render messages (dom.js handles that)
   - Requires: dom.js, utils.js, config.js, index.js (in that order before this file)
*/

(function () {
  function init() {
    const filePickBtn = document.getElementById('filePickBtn');
    const fileUploadInput = document.getElementById('fileUploadInput');
    const visionPickBtn = document.getElementById('visionPickBtn');
    const visionUploadInput = document.getElementById('visionUploadInput');
    const toolsToggle = document.getElementById('toolsToggle');
    const toolsToggleMobile = document.getElementById('toolsToggleMobile');
    const toolsPanel = document.getElementById('toolsPanel');
    const inputEl = document.getElementById('messageInput');
    const hintsEl = document.getElementById('commandHints');
    const form = document.getElementById('inputForm');

    const safeFocus = el => { try { el?.focus(); } catch (_) {} };

    /* =============== File Picker =============== */
    if (filePickBtn && fileUploadInput) {
      filePickBtn.addEventListener('click', () => fileUploadInput.click());
      fileUploadInput.addEventListener('change', (e) => {
        const f = e.target.files?.[0];
        if (f && typeof window.handleFileUpload === 'function') {
          window.handleFileUpload(f);
        }
      });
    }

    /* =============== Vision Picker =============== */
    if (visionPickBtn && visionUploadInput) {
      visionPickBtn.addEventListener('click', () => visionUploadInput.click());
      visionUploadInput.addEventListener('change', (e) => {
        const f = e.target.files?.[0];
        if (f && typeof window.handleFileUpload === 'function') {
          window.handleFileUpload(f, true); // mark as vision
        }
      });
    }

    /* =============== Tools Toggle =============== */
    function showTools(show) {
      toolsPanel.style.display = show ? 'flex' : 'none';
      toolsPanel.style.flexDirection = 'column';
    }
    showTools(window.innerWidth > 900);
    if (toolsToggle) toolsToggle.onclick = () => showTools(toolsPanel.style.display !== 'flex');
    if (toolsToggleMobile) toolsToggleMobile.onclick = () => showTools(toolsPanel.style.display !== 'flex');
    window.addEventListener('resize', () => showTools(window.innerWidth > 900));

    /* =============== Input Autosize + Hints =============== */
    if (inputEl) {
      inputEl.addEventListener('input', () => {
        hintsEl.hidden = !(inputEl.value.trim().startsWith('/'));
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(200, inputEl.scrollHeight) + 'px';
      });

      document.querySelectorAll('#commandHints span').forEach(span => {
        span.onclick = () => {
          inputEl.value = span.textContent + ' ';
          safeFocus(inputEl);
          hintsEl.hidden = true;
        };
      });
    }

    /* =============== Submit Handler =============== */
    if (form && inputEl) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const msg = inputEl.value.trim();
        if (!msg) return;

        if (typeof window.sendChatMessage === 'function') {
          window.sendChatMessage(msg);
        } else {
          alert("Chat engine not loaded (sendChatMessage missing)");
        }

        inputEl.value = '';
        inputEl.style.height = 'auto';
      });
    }

    /* =============== Shortcuts =============== */
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        safeFocus(inputEl);
      }
    });

    console.debug('chat.js: UI ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
