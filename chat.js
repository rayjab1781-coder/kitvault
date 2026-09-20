// Floating AI support widget. Talks to /.netlify/functions/chat, which is
// grounded in the real product catalogue and policies.
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('chat-fab');
  const panel = document.getElementById('chat-panel');
  if (!btn || !panel) return;

  const closeBtn = document.getElementById('chat-close');
  const log = document.getElementById('chat-log');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  let history = [];

  function bubble(role, text) {
    const d = document.createElement('div');
    d.className = 'chat-msg chat-' + role;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function toggle(open) {
    panel.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      if (!log.childElementCount) bubble('bot', "Hi! I'm the KitVLT assistant. Ask me about shirts, sizing, shipping or returns.");
      input.focus();
    }
  }

  btn.addEventListener('click', () => toggle(!panel.classList.contains('open')));
  if (closeBtn) closeBtn.addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('open')) toggle(false); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    bubble('user', msg);
    history.push({ role: 'user', content: msg });
    input.value = '';

    const thinking = bubble('bot', '…');
    try {
      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: history.slice(0, -1) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      thinking.textContent = data.reply;
      history.push({ role: 'assistant', content: data.reply });
    } catch (err) {
      thinking.textContent = "Sorry — I can't reach the assistant right now. Email KitVaultCustomerService@gmail.com and we'll help.";
    }
  });
});
