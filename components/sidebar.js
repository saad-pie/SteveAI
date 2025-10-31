// components/sidebar.js: Slide-in neural hub – Toggle, models, glow hovers
// Mount: new Sidebar(sidebarEl, toggleBtn, overlayEl, modelDropdown, onSwitchCb).mount();

export class Sidebar {
  constructor(sidebarEl, toggleBtn, overlayEl, modelDropdown, onModelSwitch) {
    this.sidebar = sidebarEl;
    this.toggleBtn = toggleBtn;
    this.overlay = overlayEl;
    this.modelDropdown = modelDropdown;
    this.onModelSwitch = onModelSwitch;
    this.isOpen = false;
  }

  mount() {
    this.sidebar.classList.remove('open');
    this.overlay.style.display = 'none';
    this.wireEvents();
    console.log('🧠 Sidebar: Mounted – Slide ready.');
  }

  wireEvents() {
    this.toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    this.overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
    // Models
    this.modelDropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item) return;
      const mode = item.dataset.mode;
      this.onModelSwitch(mode);
      this.close();
      // Highlight
      this.modelDropdown.querySelectorAll('.dropdown-item').forEach(i => i.style.background = 'none');
      item.style.background = 'rgba(0,247,255,0.2)';
    });
    // Glow hovers
    this.modelDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.boxShadow = '0 0 10px var(--neon-cyan)');
      item.addEventListener('mouseleave', () => item.style.boxShadow = 'none');
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.sidebar.classList.toggle('open', this.isOpen);
    this.overlay.style.display = this.isOpen ? 'block' : 'none';
    this.overlay.style.zIndex = this.isOpen ? '19' : '-1';
    console.log('🧠 Sidebar: Toggled to', this.isOpen ? 'OPEN' : 'CLOSED');
  }

  open() { this.toggle(); }
  close() { 
    this.isOpen = false; 
    this.sidebar.classList.remove('open'); 
    this.overlay.style.display = 'none'; 
  }
}

