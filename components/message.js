// components/message.js: Neural msg bubbles – User plain, bot MD/thinking toggle
// Usage: new Message(divEl, role, contentOrObj).render(); – Handles string/obj.

import config from '../config.js';  // For marked? Assume CDN in HTML

export class Message {
  constructor(el, role, contentOrObj) {
    this.el = el;
    this.role = role;
    this.content = contentOrObj;
  }

  render() {
    this.el.className = `message ${this.role}`;
    if (this.role === 'user') {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'content';
      contentDiv.textContent = typeof this.content === 'object' ? this.content.content : this.content;
      this.el.appendChild(contentDiv);
    } else {
      let main = this.content;
      let thinking = null;
      if (typeof this.content === 'object' && this.content.thinking) {
        main = this.content.content;
        thinking = this.content.thinking;
      } else if (typeof this.content === 'string') {
        const match = this.content.match(/<think>([\s\S]*?)<\/think>/i);
        if (match) {
          thinking = match[1].trim();
          main = this.content.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
        }
      }
      this.el.innerHTML = this.buildHTML(main, thinking);
      this.wireCollapse(thinking);
      if (thinking) this.el.querySelector('.content-think').innerHTML = marked.parse(thinking);  // MD
    }
    // Fade in
    this.el.style.opacity = '1';
    this.el.style.transform = 'translateY(0)';
    console.log('🧠 Message: Rendered', this.role, 'with thinking?', !!thinking);
  }

  buildHTML(main, thinking) {
    let html = `<div class="msg-main"><div class="content-main">${marked.parse(main)}</div></div>`;
    if (thinking) {
      html = `
        <div class="msg-header" style="cursor: pointer;">
          <span class="arrow">▶</span>
          <span class="header-text">Neural Thought Matrix [Collapsed]</span>
        </div>
        <div class="msg-think" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease;">
          <div class="content-think"></div>
        </div>
      ` + html;
    }
    return html;
  }

  wireCollapse(thinking) {
    if (!thinking) return;
    const header = this.el.querySelector('.msg-header');
    header.onclick = () => {
      const thinkDiv = this.el.querySelector('.msg-think');
      const isExpanded = thinkDiv.style.maxHeight !== '0px';
      thinkDiv.style.maxHeight = isExpanded ? '0px' : `${thinkDiv.scrollHeight}px`;
      const arrow = header.querySelector('.arrow');
      const text = header.querySelector('.header-text');
      arrow.textContent = isExpanded ? '▶' : '▼';
      arrow.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
      text.textContent = isExpanded ? '[Collapsed]' : '[Expanded]';
      thinkDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
  }
}

