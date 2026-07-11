/**
 * ai-assistant.js - Groq-powered AI Study Assistant
 */

let conversationHistory = [];
let isThinking = false;

// Default Groq API key (optional — students can set their own in the UI)
const DEFAULT_GROQ_KEY = '';

function initAIAssistant() {
  // Auto-set the default key if no key is stored yet
  if (!localStorage.getItem('groqApiKey')) {
    localStorage.setItem('groqApiKey', DEFAULT_GROQ_KEY);
  }
  const storedKey = localStorage.getItem('groqApiKey');
  renderAISection(storedKey);
}

function renderAISection(apiKey) {
  const section = document.getElementById('section-ai');
  const student = JSON.parse(localStorage.getItem('currentStudent') || '{}');

  section.innerHTML = `
    <div class="ai-chat-container">
      <div class="ai-header" style="display:flex; align-items:center; justify-content:space-between; padding: 14px 20px; border-bottom: 1px solid var(--border); background: var(--bg); flex-shrink:0; z-index: 10;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="ai-avatar" style="background:var(--navy); color:white; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">🤖</div>
          <div>
            <div style="font-family:var(--font-body); font-weight:700; color:var(--navy); font-size:0.9rem; line-height:1.2;">StudyBot AI</div>
            <div style="font-size:0.75rem; color:var(--text-2); display:flex; align-items:center; gap:5px; line-height:1.2; margin-top:2px;">
              <span style="width:7px; height:7px; background:var(--green); border-radius:50%; display:inline-block;"></span>
              Online · Ready
            </div>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="clearChat()">Clear</button>
          <button class="btn btn-secondary btn-sm" onclick="showKeyModal()">API Key</button>
        </div>
      </div>

      <div class="ai-messages" id="chatMessages">
        <div class="ai-message assistant">
          <div class="ai-avatar">🤖</div>
          <div class="ai-bubble">
            👋 Hi ${student.name ? student.name.split(' ')[0] : 'Student'}! I'm your AI Study Assistant powered by Groq. I can help you with:<br><br>
            📚 Subject explanations<br>
            🧮 Math & Science problems<br>
            ✍️ Essay writing tips<br>
            🎯 Exam preparation strategies<br><br>
            Ask me anything! 🔥
          </div>
        </div>
      </div>

      <div class="ai-input-bar">
        <input
          type="text"
          id="aiInput"
          placeholder="Ask anything..."
        />
        <button class="ai-send-btn" id="aiSendBtn" onclick="sendAIMessage()">
          Send
        </button>
      </div>
    </div>

    <!-- API Key Modal -->
    <div class="modal-overlay" id="keyModal">
      <div class="modal" style="max-width:420px;">
        <div class="modal-header">
          <h3>🔑 Groq API Key</h3>
          <button class="modal-close" onclick="closeKeyModal()">✕</button>
        </div>
        <p style="margin-bottom:16px; font-size:0.85rem; color:var(--text-2); line-height:1.6;">
          Your custom API key is stored locally in your browser and never sent to our servers. Leave blank to use the secure Server Default Key.
          <br><br>
          <a href="https://console.groq.com/keys" target="_blank" style="color:var(--gold); font-weight:700; text-decoration:underline;">Get your free API key here →</a>
        </p>
        <div class="form-group">
          <label>Custom Groq API Key</label>
          <input type="password" id="modalApiKey" placeholder="gsk_..." value="${apiKey}" />
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" onclick="closeKeyModal()">Cancel</button>
          <button class="btn btn-primary" onclick="saveApiKeyFromModal()">Save & Activate</button>
          ${apiKey ? `<button class="btn btn-danger" onclick="removeApiKey()">Remove Key</button>` : ''}
        </div>
      </div>
    </div>
  `;

  // Setup enter key handler
  const input = document.getElementById('aiInput');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendAIMessage();
      }
    });
  }
}

async function sendAIMessage() {
  if (isThinking) return;
  const apiKey = localStorage.getItem('groqApiKey');

  const input = document.getElementById('aiInput');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  isThinking = true;
  document.getElementById('aiSendBtn').disabled = true;

  // Add user message to UI
  appendMessage('user', message);

  // Add to history
  conversationHistory.push({ role: 'user', content: message });

  // Show typing indicator
  const typingId = showTyping();

  try {
    let response;
    if (apiKey) {
      // Use student's custom API key
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are StudyBot AI, a helpful and encouraging AI study assistant for college students. 
You specialize in explaining academic concepts clearly, helping with homework, exam preparation, and providing study tips.
Be friendly, concise, and use emojis occasionally. Format code or math nicely when needed.`
            },
            ...conversationHistory,
          ],
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });
    } else {
      // Use secure server-side proxy
      response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory,
        }),
      });
    }

    removeTyping(typingId);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || err.error || 'API request failed');
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    conversationHistory.push({ role: 'assistant', content: reply });
    appendMessage('assistant', reply);

  } catch (err) {
    removeTyping(typingId);
    let errMsg = err.message;
    if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
      errMsg = 'Invalid API key. Please check your Groq API key.';
    }
    appendMessage('assistant', `❌ Error: ${errMsg}`);
    showToast(errMsg, 'error');
  }

  isThinking = false;
  document.getElementById('aiSendBtn').disabled = false;
  document.getElementById('aiInput').focus();
}

function appendMessage(role, content) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `ai-message ${role}`;

  // Convert markdown-like content to HTML (basic)
  const html = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(31,42,68,0.1);padding:2px 6px;border-radius:4px;font-size:0.85em;">$1</code>')
    .replace(/\n/g, '<br>');

  div.innerHTML = `
    <div class="ai-avatar">${role === 'assistant' ? '🤖' : '👤'}</div>
    <div class="ai-bubble">${html}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'ai-message assistant';
  div.innerHTML = `
    <div class="ai-avatar">🤖</div>
    <div class="ai-bubble">
      <div class="ai-typing">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function clearChat() {
  conversationHistory = [];
  const container = document.getElementById('chatMessages');
  if (!container) return;
  container.innerHTML = `
    <div class="ai-message assistant">
      <div class="ai-avatar">🤖</div>
      <div class="ai-bubble">Chat cleared! I'm ready to help you study. What would you like to learn? 📚</div>
    </div>
  `;
}

function showKeyModal() {
  document.getElementById('keyModal').classList.add('active');
}

function closeKeyModal() {
  document.getElementById('keyModal').classList.remove('active');
}

function saveApiKey() {
  const key = document.getElementById('apiKeyInline')?.value?.trim();
  if (!key) { showToast('Please enter your API key', 'warning'); return; }
  localStorage.setItem('groqApiKey', key);
  showToast('API key saved! AI assistant activated ✅', 'success');
  renderAISection(key);
}

function saveApiKeyFromModal() {
  const key = document.getElementById('modalApiKey')?.value?.trim();
  if (!key) { showToast('Please enter your API key', 'warning'); return; }
  localStorage.setItem('groqApiKey', key);
  closeKeyModal();
  showToast('API key saved! AI assistant activated ✅', 'success');
  renderAISection(key);
}

function removeApiKey() {
  localStorage.removeItem('groqApiKey');
  closeKeyModal();
  showToast('API key removed', 'info');
  renderAISection('');
}
