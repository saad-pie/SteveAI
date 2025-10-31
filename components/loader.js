// components/loader.js: Quantum orb spinner – Show/hide for sends
// Usage: new Loader(messagesEl).show('Thinking...'); loader.hide();

export class Loader {
  constructor(containerEl) {
    this.container = containerEl;
    this.orbEl = null;
  }

  show(text = 'Syncing neural net... (Quantum processing)') {
    this.orbEl = document.createElement('div');
    this.orbEl.className = 'message bot';
    this.orbEl.innerHTML = `<div class="generating"><div class="orb"></div><span>${text}</span></div>`;
    this.container.appendChild(this.orbEl);
    this.container.scrollTop = this.container.scrollHeight;
    console.log('🧠 Loader: Orb shown –', text);
  }

  hide() {
    if (this.orbEl) {
      const genDiv = this.orbEl.querySelector('.generating');
      if (genDiv) this.orbEl.innerHTML = '';  // Nuke anim
      console.log('🧠 Loader: Orb hidden.');
    }
  }
}

