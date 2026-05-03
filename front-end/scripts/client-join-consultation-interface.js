document.addEventListener('DOMContentLoaded', async () => {
    // ── App State ────────────────────────────────────────────────────────────
    const _activeConsId = sessionStorage.getItem('active_cons_id');
    if (!_activeConsId) { window.location.href = 'client-consultation-dashboard.html'; return; }
    let currentConsId = _activeConsId;

    const currentUser = AuthService.requireAuth(['client']);
    if (!currentUser) return;
    const clientId = currentUser.id || currentUser.userId || currentUser.clientId;

    // All consultations cached from API
    let allConsultations = [];

    // ── DOM refs ─────────────────────────────────────────────────────────────
    const chatListContainer     = document.querySelector('.chat-list');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const headerName            = document.querySelector('.active-chat-text h2');
    const headerStatus          = document.querySelector('.active-chat-text .status');
    const headerAvatar          = document.querySelector('.active-chat-info .chat-avatar img');
    const chatForm              = document.getElementById('chat-form');
    const chatInput             = document.getElementById('chat-input');
    const sendBtn               = document.getElementById('btn-send-msg');
    const leaveBtn              = document.getElementById('btn-leave');
    const sidebarSearch         = document.getElementById('sidebar-search');

    // ── Init ─────────────────────────────────────────────────────────────────
    await init();

    async function init() {
        try {
            allConsultations = await LexFlowAPI.consultations.getMy(clientId, 'client');
        } catch (err) {
            console.error('[JoinConsultation] Failed to load consultations list:', err);
            allConsultations = [];
        }
        renderSidebar();
        await loadConsultation(currentConsId);
        setupEventListeners();
    }

    // ── Sidebar ──────────────────────────────────────────────────────────────
    function renderSidebar(filter = '') {
        if (!chatListContainer) return;

        const active = allConsultations.filter(c =>
            c.status !== 'CANCELLED' &&
            c.lawyerName && c.lawyerName !== 'undefined'
        );

        chatListContainer.innerHTML = '';
        const seenLawyers = new Set();

        active.forEach(cons => {
            const uniqueKey = cons.lawyerId || cons.lawyerName;
            if (seenLawyers.has(uniqueKey)) return;

            if (filter &&
                !(cons.lawyerName || '').toLowerCase().includes(filter.toLowerCase()) &&
                !(cons.firmName || '').toLowerCase().includes(filter.toLowerCase())) {
                return;
            }

            seenLawyers.add(uniqueKey);

            const isActive = cons.id === currentConsId;
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${isActive ? 'active' : ''}`;
            chatItem.dataset.id = cons.id;

            chatItem.innerHTML = `
                <div class="chat-avatar">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(cons.lawyerName)}&background=1e2a4a&color=fff" alt="${cons.lawyerName}">
                </div>
                <div class="chat-item-info">
                    <div class="chat-item-top">
                        <span class="chat-name">${cons.lawyerName}</span>
                        <span class="chat-time">${(cons.time || '').split(' - ')[0]}</span>
                    </div>
                    <div class="chat-item-bottom">
                        <span class="chat-snippet">${cons.firmName}</span>
                    </div>
                </div>`;

            chatItem.addEventListener('click', async () => {
                if (currentConsId !== cons.id) {
                    currentConsId = cons.id;
                    sessionStorage.setItem('active_cons_id', currentConsId);
                    renderSidebar(filter);
                    await loadConsultation(currentConsId);
                }
            });

            chatListContainer.appendChild(chatItem);
        });

        if (active.length === 0) {
            chatListContainer.innerHTML = `<div style="padding:24px;color:#9ca3af;font-size:13px;text-align:center;">No active consultations.</div>`;
        }
    }

    // ── Load a consultation into the main area ───────────────────────────────
    async function loadConsultation(id) {
        try {
            const consultation = allConsultations.find(c => c.id === id)
                || await LexFlowAPI.consultations.getById(id, 'client');

            if (!consultation) return;

            if (headerName) headerName.textContent = consultation.lawyerName || 'Awaiting Assignment';
            if (headerStatus) headerStatus.textContent = `${consultation.firmName} · ${consultation.date}`;
            if (headerAvatar && consultation.lawyerName) {
                headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(consultation.lawyerName)}&background=1e2a4a&color=fff`;
                headerAvatar.alt = consultation.lawyerName;
            }

            renderMessages(id, consultation.lawyerName);
        } catch (err) {
            console.error('[JoinConsultation] Failed to load consultation:', err);
            if (headerName) headerName.textContent = 'Error loading consultation';
        }
    }

    // ── Chat messages (localStorage mock) ───────────────────────────────────
    function getChatMessages(id) {
        try { return JSON.parse(localStorage.getItem(`lf_chat_${id}`) || '[]'); }
        catch { return []; }
    }
    function saveChatMessage(id, msg) {
        const msgs = getChatMessages(id);
        msgs.push(msg);
        localStorage.setItem(`lf_chat_${id}`, JSON.stringify(msgs));
    }

    function renderMessages(id, lawyerName) {
        if (!chatMessagesContainer) return;
        const messages = getChatMessages(id);
        chatMessagesContainer.innerHTML = '<div class="chat-divider"><span>Today</span></div>';

        if (messages.length === 0) {
            const welcome = {
                sender: 'lawyer',
                text: `Hello! I'm ${lawyerName || 'your lawyer'}. How can I assist you with your case today?`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            saveChatMessage(id, welcome);
            appendMessageToUI(welcome);
        } else {
            messages.forEach(msg => appendMessageToUI(msg));
        }
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    function appendMessageToUI(msg) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${msg.sender === 'user' ? 'outgoing' : 'incoming'}`;
        msgDiv.innerHTML = `
            <div class="msg-bubble">
                ${msg.text}
                <span class="msg-time">${msg.time || ''}</span>
            </div>`;
        chatMessagesContainer.appendChild(msgDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    // ── Send message ─────────────────────────────────────────────────────────
    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msg = { sender: 'user', text, time };
        saveChatMessage(currentConsId, msg);
        appendMessageToUI(msg);
        chatInput.value = '';

        const activeIdAtSend = currentConsId;
        setTimeout(() => {
            const replies = [
                "I've received your message. Let's discuss this further.",
                "Can you provide more details about this?",
                "I see. I'll look into the legal precedents for this matter.",
                "Understood. We should prepare the documentation accordingly."
            ];
            const reply = {
                sender: 'lawyer',
                text: replies[Math.floor(Math.random() * replies.length)],
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            saveChatMessage(activeIdAtSend, reply);
            if (sessionStorage.getItem('active_cons_id') === activeIdAtSend) {
                appendMessageToUI(reply);
            }
        }, 1500);
    }

    // ── Event listeners ──────────────────────────────────────────────────────
    function setupEventListeners() {
        if (chatForm) chatForm.addEventListener('submit', e => { e.preventDefault(); sendMessage(); });
        if (sendBtn)  sendBtn.addEventListener('click', sendMessage);
        if (sidebarSearch) sidebarSearch.addEventListener('input', e => renderSidebar(e.target.value));
        if (leaveBtn) leaveBtn.addEventListener('click', () => {
            if (confirm('End this consultation session?')) {
                window.location.href = 'client-consultation-dashboard.html';
            }
        });
    }
});
