/**
 * Chiranjeet Banerjee - Portfolio AI Assistant
 * 
 * Scoped exclusively to public information about Chiranjeet.
 * Cannot discuss anything unrelated. Logs visitor queries for admin review.
 * Reads knowledge from public-knowledge.json and availability from availability.json.
 */

(function() {
  'use strict';

  // ===== CONFIG =====
  const STORAGE_KEY = 'cb_visitor_logs';
  const MAX_STORED_QUERIES = 200;
  const MAX_CONVERSATION_TURNS = 20;

  // ===== STATE =====
  let knowledge = null;
  let availability = null;
  let conversationHistory = [];
  let isOpen = false;
  let isLoading = false;

  // ===== LOAD KNOWLEDGE BASE =====
  async function loadKnowledge() {
    try {
      const [kRes, aRes] = await Promise.all([
        fetch('public-knowledge.json'),
        fetch('availability.json')
      ]);
      if (kRes.ok) knowledge = await kRes.json();
      if (aRes.ok) availability = await aRes.json();
    } catch (e) {
      console.warn('Chat: Could not load knowledge base');
    }
  }

  // ===== BUILD SYSTEM PROMPT =====
  function buildSystemPrompt() {
    const k = knowledge || {};
    const a = availability || {};
    const identity = k.identity || {};
    const brands = k.brands || {};
    const bc = brands.blisseCode || {};
    const bk = brands.broeknCamera || {};

    const availStatus = a.currentStatus === 'available'
      ? `Chiranjeet is currently available for select projects. ${a.statusNote || ''}`
      : a.currentStatus === 'busy'
        ? `Chiranjeet is not available right now. ${a.statusNote || ''}`
        : `Availability is not confirmed. Suggest booking a call.`;

    const faqBlock = (k.faq || []).map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');
    const customFacts = (k.customFacts || []).map(f => `- ${f}`).join('\n');

    return `You are the portfolio assistant for ${identity.name || 'Chiranjeet Banerjee'}, ${identity.title || 'Experience Design Lead'} based in ${identity.location || 'Kuala Lumpur, Malaysia'} with ${identity.experienceYears || '13+'} years of experience.

YOUR SOLE PURPOSE: Help visitors learn about Chiranjeet as a professional. You exist to make Chiranjeet a compelling candidate to recruit, hire, partner with, or commission for work.

STRICT SCOPE RULES (non-negotiable):
- You can ONLY discuss Chiranjeet Banerjee, his work, skills, services, experience, brands, and professional background.
- You CANNOT discuss anything unrelated to Chiranjeet: no weather, no news, no general knowledge, no coding help, no opinions on unrelated topics.
- If asked about anything outside scope, respond: "I'm here specifically to help you learn about Chiranjeet and his work. Is there something about his experience, services, or availability I can help with?"
- You CANNOT share personal information: no home address, phone number, family details, daily schedule, or whereabouts.
- You CAN share: general location (Kuala Lumpur, Malaysia), professional background, services offered, expertise areas, and availability status.
- For availability: you can ONLY say whether Chiranjeet is "available" or "not available" for projects. You CANNOT share what he is doing, where he is going, or any schedule details.
- NEVER fabricate information. If you do not know something, say so and suggest they reach out directly.
- Do not use em dashes in responses.

AVAILABILITY STATUS:
${availStatus}
Booking link: ${a.bookingUrl || 'https://calendly.com/meetchiranjeet/30min'}

ABOUT CHIRANJEET:
${identity.summary || ''}

TWO PRACTICES:
1. ${bc.name || 'Blisse Code'}: ${bc.focus || 'UX strategy and AI consulting'}
   Services: ${(bc.services || []).join(', ')}

2. ${bk.name || 'Broekn Camera'}: ${bk.focus || 'Cinematic visuals and AI art'}
   Services: ${(bk.services || []).join(', ')}

EXPERTISE: ${(k.expertise || []).join(', ')}

INDUSTRIES SERVED: ${(k.industries || []).join(', ')}

APPROACH:
${(k.approach || []).map(a => '- ' + a).join('\n')}

OFFER LADDER:
- Free: ${(k.offerLadder || {}).free || 'Content and posts'}
- Entry: ${(k.offerLadder || {}).entry || 'UX audit or mini consult'}
- Mid: ${(k.offerLadder || {}).mid || 'Workshops and sprints'}
- High: ${(k.offerLadder || {}).high || 'Premium retainers and commissions'}

VALUES:
${(k.values || []).map(v => '- ' + v).join('\n')}

CONTACT:
- Book a call: ${(k.contact || {}).booking || ''}
- Email: ${(k.contact || {}).email || ''}
- LinkedIn: ${(k.contact || {}).linkedin || ''}

FREQUENTLY ASKED:
${faqBlock}

${customFacts ? 'ADDITIONAL FACTS:\n' + customFacts : ''}

TONE: Warm, direct, concise. Confident but not arrogant. Slightly informal. No corporate jargon. No motivational fluff. Practical and helpful.

GOAL: Every response should move the visitor closer to either:
1. Booking a call with Chiranjeet
2. Understanding why Chiranjeet is the right person for their need
3. Exploring his portfolio work

Keep responses brief (2-4 sentences typical). Offer to go deeper if the visitor wants.`;
  }

  // ===== ANTHROPIC API CALL =====
  async function sendMessage(userMessage) {
    if (!userMessage.trim()) return null;

    conversationHistory.push({ role: 'user', content: userMessage });

    // Trim conversation to max turns
    if (conversationHistory.length > MAX_CONVERSATION_TURNS * 2) {
      conversationHistory = conversationHistory.slice(-MAX_CONVERSATION_TURNS * 2);
    }

    // Log the query for admin insights
    logVisitorQuery(userMessage);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: buildSystemPrompt(),
          messages: conversationHistory
        })
      });

      if (!response.ok) {
        throw new Error('API error: ' + response.status);
      }

      const data = await response.json();
      const assistantMessage = data.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');

      conversationHistory.push({ role: 'assistant', content: assistantMessage });
      return assistantMessage;

    } catch (e) {
      console.error('Chat API error:', e);
      conversationHistory.pop(); // Remove failed user message
      return 'I am having trouble connecting right now. You can reach Chiranjeet directly at ' +
        ((knowledge && knowledge.contact && knowledge.contact.email) || 'hello@chiranjeetbanerjee.com') +
        ' or book a call via Calendly.';
    }
  }

  // ===== VISITOR QUERY LOGGING =====
  function logVisitorQuery(query) {
    try {
      const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      logs.push({
        q: query,
        t: new Date().toISOString(),
        s: document.referrer || 'direct'
      });
      // Keep only recent queries
      if (logs.length > MAX_STORED_QUERIES) {
        logs.splice(0, logs.length - MAX_STORED_QUERIES);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch (e) { /* storage full or unavailable */ }
  }

  // ===== GET VISITOR LOGS (for admin) =====
  window.CB_getVisitorLogs = function() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) { return []; }
  };

  window.CB_clearVisitorLogs = function() {
    localStorage.removeItem(STORAGE_KEY);
  };

  // ===== UI CREATION =====
  function createChatUI() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      .cb-chat-fab {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 150;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #C9A84C;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        transition: transform 200ms cubic-bezier(0.22,1,0.36,1), background 150ms;
      }
      .cb-chat-fab:hover { transform: scale(1.08); background: #DFC06A; }
      .cb-chat-fab svg { width: 24px; height: 24px; color: #0C0C0C; }
      .cb-chat-fab.open svg.icon-chat { display: none; }
      .cb-chat-fab:not(.open) svg.icon-close { display: none; }

      .cb-chat-panel {
        position: fixed;
        bottom: 5.5rem;
        right: 1.5rem;
        z-index: 149;
        width: 380px;
        max-height: 520px;
        background: #0C0C0C;
        border: 1px solid #2A2A2A;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: translateY(16px) scale(0.96);
        pointer-events: none;
        transition: opacity 250ms cubic-bezier(0.22,1,0.36,1),
                    transform 250ms cubic-bezier(0.22,1,0.36,1);
        box-shadow: 0 8px 40px rgba(0,0,0,0.5);
      }
      .cb-chat-panel.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .cb-chat-header {
        padding: 1rem 1.25rem;
        border-bottom: 1px solid #1E1E1E;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .cb-chat-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #1A1A1A;
        border: 1px solid #2A2A2A;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 600;
        color: #C9A84C;
        flex-shrink: 0;
      }
      .cb-chat-header-text h4 {
        font-size: 0.85rem;
        font-weight: 500;
        color: #E8E2D9;
        margin: 0;
        line-height: 1.3;
      }
      .cb-chat-header-text p {
        font-size: 0.7rem;
        color: #5A5650;
        margin: 0;
        font-family: 'JetBrains Mono', monospace;
        letter-spacing: 0.03em;
      }

      .cb-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-height: 280px;
        max-height: 340px;
      }
      .cb-chat-messages::-webkit-scrollbar { width: 4px; }
      .cb-chat-messages::-webkit-scrollbar-track { background: transparent; }
      .cb-chat-messages::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 4px; }

      .cb-msg {
        max-width: 85%;
        padding: 0.65rem 0.9rem;
        border-radius: 10px;
        font-size: 0.85rem;
        line-height: 1.5;
        word-wrap: break-word;
      }
      .cb-msg--assistant {
        background: #161616;
        color: #E8E2D9;
        border: 1px solid #1E1E1E;
        align-self: flex-start;
        border-bottom-left-radius: 4px;
      }
      .cb-msg--user {
        background: #C9A84C;
        color: #0C0C0C;
        align-self: flex-end;
        border-bottom-right-radius: 4px;
      }
      .cb-msg--system {
        font-size: 0.75rem;
        color: #5A5650;
        text-align: center;
        align-self: center;
        padding: 0.3rem 0;
      }

      .cb-msg a {
        color: #C9A84C;
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      .cb-msg--user a { color: #0C0C0C; }

      .cb-typing {
        display: flex;
        gap: 4px;
        align-items: center;
        padding: 0.65rem 0.9rem;
        align-self: flex-start;
      }
      .cb-typing span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #5A5650;
        animation: cb-pulse 1s ease-in-out infinite;
      }
      .cb-typing span:nth-child(2) { animation-delay: 0.15s; }
      .cb-typing span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes cb-pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }

      .cb-chat-input-area {
        padding: 0.75rem 1rem;
        border-top: 1px solid #1E1E1E;
        display: flex;
        gap: 0.5rem;
        align-items: flex-end;
      }
      .cb-chat-input {
        flex: 1;
        background: #111;
        border: 1px solid #2A2A2A;
        border-radius: 8px;
        padding: 0.6rem 0.8rem;
        color: #E8E2D9;
        font-family: 'DM Sans', system-ui, sans-serif;
        font-size: 0.85rem;
        resize: none;
        max-height: 80px;
        line-height: 1.4;
      }
      .cb-chat-input:focus { outline: none; border-color: #C9A84C; }
      .cb-chat-input::placeholder { color: #5A5650; }

      .cb-chat-send {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: #C9A84C;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 120ms;
      }
      .cb-chat-send:hover { background: #DFC06A; }
      .cb-chat-send:disabled { opacity: 0.4; cursor: default; }
      .cb-chat-send svg { width: 16px; height: 16px; color: #0C0C0C; }

      .cb-chat-footer {
        padding: 0.4rem 1rem;
        text-align: center;
        font-size: 0.6rem;
        color: #3A3630;
        border-top: 1px solid #1A1A1A;
      }

      .cb-quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-top: 0.5rem;
      }
      .cb-quick-btn {
        padding: 0.3rem 0.65rem;
        background: #1A1A1A;
        border: 1px solid #2A2A2A;
        border-radius: 20px;
        font-size: 0.72rem;
        color: #8A8578;
        cursor: pointer;
        font-family: 'DM Sans', system-ui, sans-serif;
        transition: all 120ms;
        white-space: nowrap;
      }
      .cb-quick-btn:hover {
        border-color: #C9A84C;
        color: #C9A84C;
        background: rgba(201,168,76,0.08);
      }

      @media (max-width: 480px) {
        .cb-chat-panel {
          right: 0.75rem;
          left: 0.75rem;
          bottom: 5rem;
          width: auto;
          max-height: 70vh;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .cb-chat-panel, .cb-chat-fab { transition: none !important; }
        .cb-typing span { animation: none !important; opacity: 0.6; }
      }
    `;
    document.head.appendChild(style);

    // FAB button
    const fab = document.createElement('button');
    fab.className = 'cb-chat-fab';
    fab.setAttribute('aria-label', 'Chat with AI assistant');
    fab.innerHTML = `
      <svg class="icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    `;

    // Chat panel
    const panel = document.createElement('div');
    panel.className = 'cb-chat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat with portfolio assistant');
    panel.innerHTML = `
      <div class="cb-chat-header">
        <div class="cb-chat-avatar">CB</div>
        <div class="cb-chat-header-text">
          <h4>Ask about Chiranjeet</h4>
          <p>AI assistant / public info only</p>
        </div>
      </div>
      <div class="cb-chat-messages" id="cb-chat-messages">
        <div class="cb-msg cb-msg--assistant">
          Hi! I can help you learn about Chiranjeet's work, skills, services, and availability. What would you like to know?
          <div class="cb-quick-actions">
            <button class="cb-quick-btn" data-q="What does Chiranjeet specialize in?">Specializations</button>
            <button class="cb-quick-btn" data-q="What services does Chiranjeet offer?">Services</button>
            <button class="cb-quick-btn" data-q="Is Chiranjeet available for projects?">Availability</button>
            <button class="cb-quick-btn" data-q="How can I work with Chiranjeet?">Work together</button>
          </div>
        </div>
      </div>
      <div class="cb-chat-input-area">
        <textarea class="cb-chat-input" id="cb-chat-input" rows="1" placeholder="Ask about Chiranjeet..." maxlength="500"></textarea>
        <button class="cb-chat-send" id="cb-chat-send" aria-label="Send message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <div class="cb-chat-footer">Only shares public professional information</div>
    `;

    document.body.appendChild(panel);
    document.body.appendChild(fab);

    // ===== EVENT HANDLERS =====
    const messages = panel.querySelector('#cb-chat-messages');
    const input = panel.querySelector('#cb-chat-input');
    const sendBtn = panel.querySelector('#cb-chat-send');

    fab.addEventListener('click', () => {
      isOpen = !isOpen;
      fab.classList.toggle('open', isOpen);
      panel.classList.toggle('open', isOpen);
      if (isOpen) {
        setTimeout(() => input.focus(), 300);
      }
    });

    // Quick action buttons
    panel.addEventListener('click', (e) => {
      if (e.target.classList.contains('cb-quick-btn')) {
        const q = e.target.getAttribute('data-q');
        if (q) handleSend(q);
      }
    });

    sendBtn.addEventListener('click', () => handleSend());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    });

    async function handleSend(overrideText) {
      const text = overrideText || input.value.trim();
      if (!text || isLoading) return;

      input.value = '';
      input.style.height = 'auto';

      // Add user message
      appendMessage(text, 'user');

      // Show typing indicator
      isLoading = true;
      sendBtn.disabled = true;
      const typingEl = document.createElement('div');
      typingEl.className = 'cb-typing';
      typingEl.innerHTML = '<span></span><span></span><span></span>';
      messages.appendChild(typingEl);
      scrollToBottom();

      // Get response
      const reply = await sendMessage(text);

      // Remove typing indicator
      if (typingEl.parentNode) typingEl.remove();
      isLoading = false;
      sendBtn.disabled = false;

      if (reply) {
        appendMessage(reply, 'assistant');
      }

      input.focus();
    }

    function appendMessage(text, role) {
      const el = document.createElement('div');
      el.className = 'cb-msg cb-msg--' + role;

      // Simple markdown-like formatting for assistant messages
      if (role === 'assistant') {
        let html = text
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/\[(.*?)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
          .replace(/\n/g, '<br>');
        el.innerHTML = html;
      } else {
        el.textContent = text;
      }

      // Remove quick actions from previous messages
      const oldQuicks = messages.querySelectorAll('.cb-quick-actions');
      oldQuicks.forEach(q => q.remove());

      messages.appendChild(el);
      scrollToBottom();
    }

    function scrollToBottom() {
      requestAnimationFrame(() => {
        messages.scrollTop = messages.scrollHeight;
      });
    }

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        isOpen = false;
        fab.classList.remove('open');
        panel.classList.remove('open');
      }
    });
  }

  // ===== INIT =====
  async function init() {
    await loadKnowledge();
    createChatUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
