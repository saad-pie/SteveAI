// components/chatlist.js: Thread navigator – Render/delete, tab-isolated
// Usage: new ChatList(listEl, chats, currentId, onSwitch, onDelete).render();

export class ChatList {
  constructor(listEl, chats, currentId, onSwitch, onDelete) {
    this.listEl = listEl;
    this.chats = chats;
    this.currentId = currentId;
    this.onSwitch = onSwitch;
    this.onDelete = onDelete;
  }

  render() {
    this.listEl.innerHTML = '';
    this.chats.forEach(chat => {
      const li = document.createElement('li');
      li.className = `chat-item ${this.currentId === chat.id ? 'active' : ''}`;
      li.innerHTML = `
        <div class="chat-preview" onclick="${this.onSwitch.name}('${chat.id}')" style="cursor: pointer;">
          <span class="chat-title">${chat.title}</span>
          <span class="chat-snippet">${chat.preview}</span>
        </div>
        <button class="delete-chat" onclick="${this.onDelete.name}('${chat.id}'); event.stopPropagation();" style="cursor: pointer;">×</button>
      `;
      this.listEl.appendChild(li);
    });
    console.log('🧠 ChatList: Rendered', this.chats.length, 'threads.');
  }
}

