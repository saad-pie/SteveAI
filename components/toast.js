// components/toast.js: Cyberpunk notifications – Neon slide-in for cmds/switches
// Usage: new Toast().show('Mode switched!', 2000, 'success');

export class Toast {
  constructor(parentEl = document.body) {
    this.parent = parentEl;
  }

  show(message, duration = 2000, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'model-toast';
    toast.textContent = message;
    const bg = type === 'error' ? 'rgba(255,0,0,0.9)' : 'rgba(0,247,255,0.9)';
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: ${bg}; color: #000; padding: 1rem; border-radius: 8px; 
      box-shadow: 0 0 20px var(--neon-cyan); z-index: 30; animation: slideIn 0.5s; font-family: Orbitron, monospace;
    `;
    this.parent.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
    console.log('🧠 Toast: Popped –', message);
  }
}

