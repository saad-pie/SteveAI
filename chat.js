/* chat.js — UI glue (extracted from HTML script)
   - Sets up tools panel, file pickers, command hints, textarea autosize,
   - Exposes fallbacks for addMessage/addImageToGallery if index.js not loaded,
   - Does NOT change index.js function signatures (calls handleFileUpload if present)
   - Safe, minimal, runs after index.js is loaded (index.js must be included before chat.js)
*/

(function () {
  // Run once DOM is ready
  function init() {
    // DOM refs
    const filePickBtn = document.getElementById('filePickBtn');
    const fileUploadInput = document.getElementById('fileUploadInput');
    const visionPickBtn = document.getElementById('visionPickBtn');
    const visionUploadInput = document.getElementById('visionUploadInput');
    const toolsToggle = document.getElementById('toolsToggle');
    const toolsPanel = document.getElementById('toolsPanel');
    const toolsToggleMobile = document.getElementById('toolsToggleMobile');
    const inputEl = document.getElementById('messageInput');
    const hintsEl = document.getElementById('commandHints');

    // Helper: safe DOM focus
    const safeFocus = el => { try{ el && el.focus(); }catch(e){/*ignore*/} };

    // File picker wiring
    if (filePickBtn && fileUploadInput) {
      filePickBtn.addEventListener('click', () => fileUploadInput.click());
    }

    if (visionPickBtn && visionUploadInput) {
      visionPickBtn.addEventListener('click', () => visionUploadInput.click());
      visionUploadInput.addEventListener('change', (e) => {
        // dispatch a custom event 'vision-upload' for index.js to pick up, if it listens
        const ev = new Event('vision-upload', { bubbles: true });
        visionUploadInput.dispatchEvent(ev);
        // fallback: if index.js doesn't handle it, also call handleFileUpload if available
        const f = e.target.files && e.target.files[0];
        if (f && typeof handleFileUpload === 'function') handleFileUpload(f);
      });
    }

    // Tools panel toggle behavior
    function showTools(show) {
      if (window.innerWidth <= 900) {
        toolsPanel.style.display = show ? 'flex' : 'none';
        toolsPanel.style.flexDirection = 'column';
      } else {
        toolsPanel.style.display = 'flex';
        toolsPanel.style.flexDirection = 'column';
      }
    }
    // initial
    try { showTools(window.innerWidth > 900); } catch(e){}

    if (toolsToggle) {
      toolsToggle.addEventListener('click', () => {
        const isVisible = toolsPanel.style.display === 'flex';
        toolsPanel.style.display = isVisible ? 'none' : 'flex';
        toolsPanel.style.flexDirection = 'column';
      });
    }
    if (toolsToggleMobile) {
      toolsToggleMobile.addEventListener('click', () => {
        const isVisible = toolsPanel.style.display === 'flex';
        toolsPanel.style.display = isVisible ? 'none' : 'flex';
        toolsPanel.style.flexDirection = 'column';
      });
    }
    window.addEventListener('resize', () => {
      if (window.innerWidth <= 900) toolsPanel.style.display = 'none';
      else toolsPanel.style.display = 'flex';
    });

    // Command hints and textarea autosize
    if (inputEl) {
      inputEl.addEventListener('input', () => {
        hintsEl.hidden = !(inputEl.value.trim().startsWith('/'));
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(200, inputEl.scrollHeight) + 'px';
      });
      // autosize on load
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(200, inputEl.scrollHeight) + 'px';
    }

    // Command hints click
    document.querySelectorAll('#commandHints span').forEach(span => {
      span.onclick = () => {
        inputEl.value = span.textContent + ' ';
        safeFocus(inputEl);
        hintsEl.hidden = true;
      };
    });

    // Header quick buttons
    document.getElementById('memoryToggle')?.addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('active');
    });
    document.getElementById('aboutBtn')?.addEventListener('click', () => { alert('SteveAI — built by saadpie.'); });

    document.getElementById('exportBtn')?.addEventListener('click', () => {
      // Prefer index.js handling if available (via /export command)
      const form = document.getElementById('inputForm');
      if (form && typeof form.dispatchEvent === 'function') {
        const prev = inputEl.value;
        inputEl.value = '/export';
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        inputEl.value = prev;
      } else {
        alert('Export requested — but chat form not ready.');
      }
    });

    // fileUploadInput fallback: if index.js provides handleFileUpload it'll run; otherwise show a user message
    if (fileUploadInput) {
      fileUploadInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        // if index.js implements handleFileUpload, it may have its own listener; still call in case
        if (typeof handleFileUpload === 'function') {
          try { handleFileUpload(f); return; } catch (err) { console.warn('handleFileUpload threw', err); }
        }
        // fallback: simple UI message
        if (typeof addMessage === 'function') addMessage(`📄 Uploaded file: ${f.name}`, 'user');
      });
    }

    // Provide small shims if index.js not yet defined
    if (typeof window.addMessage !== 'function') {
      window.addMessage = function (txt, sender = 'bot') {
        const chat = document.getElementById('chat');
        if (!chat) return;
        const container = document.createElement('div'); container.className = `message-container ${sender}`;
        const bubble = document.createElement('div'); bubble.className = `bubble ${sender}`;
        const content = document.createElement('div'); content.className = 'bubble-content';
        content.innerText = txt;
        bubble.appendChild(content); container.appendChild(bubble);
        chat.appendChild(container);
        chat.scrollTop = chat.scrollHeight;
      };
    }

    if (typeof window.addImageToGallery !== 'function') {
      window.addImageToGallery = function (url) {
        const gallery = document.getElementById('imageGallery');
        if (!gallery) return;
        const img = document.createElement('img');
        img.src = url;
        img.onclick = () => window.open(url, '_blank');
        gallery.appendChild(img);
      };
    }

    // Small keyboard shortcut: Ctrl+K focuses input
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        safeFocus(inputEl);
      }
    });

    // Accessibility: submit form on Enter+Ctrl (to avoid accidental sends)
    const form = document.getElementById('inputForm');
    if (form && inputEl) {
      form.addEventListener('submit', (ev) => {
        // Let index.js handle the submit (it defined form.onsubmit). If not, do a basic behavior:
        if (typeof form.onsubmit === 'function') return; // index.js will handle
        ev.preventDefault();
        const msg = inputEl.value && inputEl.value.trim();
        if (!msg) return;
        // If index.js exposes getChatReply or send, try to use it; otherwise fall back to addMessage
        if (typeof window.getChatReply === 'function') {
          getChatReply(msg).then(reply => { if (reply) addMessage(reply, 'bot'); }).catch(err => addMessage('⚠️ Request failed.', 'bot'));
        } else {
          addMessage(msg, 'user');
          setTimeout(() => addMessage('No chat engine loaded.', 'bot'), 300);
        }
        inputEl.value = '';
        inputEl.style.height = 'auto';
      });
    }

    // Attach click handlers for command hint buttons created later (defensive)
    // Already wired above via querySelectorAll

    // Done init
    console.debug('chat.js initialized');
  } // init

  // Wait DOMContentLoaded. index.js should be loaded before chat.js (per your instruction)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
