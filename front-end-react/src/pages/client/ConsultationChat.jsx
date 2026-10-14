/**
 * Consultation Chat - WhatsApp-style chat room for an active consultation.
 *
 * Used by BOTH roles:
 *   client (default)  - chats are grouped per lawyer, canned lawyer replies
 *   lawyer (staff)    - chats are grouped per client, no auto-replies
 *
 * Messages are stored in localStorage under "lf_chat_<consultationId>" so a
 * client and their lawyer can see the same thread on the same machine
 * (great for demos). Each message: { sender: 'client'|'lawyer', text, time }.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import { Button, Input } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { nowTime, initials } from '../../lib/format.js';

export default function ConsultationChat({ staff = false, consId }) {
  const { user, toast } = useApp();

  const [consultations, setConsultations] = useState([]); // list for the sidebar
  const [search, setSearch] = useState('');
  const [current, setCurrent] = useState(null);           // active consultation object
  const [messages, setMessages] = useState([]);           // messages of the active chat
  const [draft, setDraft] = useState('');                 // text being typed
  const bottomRef = useRef(null);                         // to auto-scroll
  const currentIdRef = useRef(null);                      // open chat id (for timeouts)

  const myRole = staff ? 'lawyer' : 'client';             // how MY bubbles are labelled

  /* ── Load the chat list once ── */
  useEffect(() => {
    (async () => {
      try {
        let list = [];
        if (staff) {
          // Firm staff see every consultation of their firm.
          list = await api.consultations.getAll(user?.firmId ? { firmId: user.firmId } : {}, (user?.role || 'firmadmin').toLowerCase());
        } else {
          const clientId = user?.id || user?.userId || user?.clientId;
          list = await api.consultations.getMy(clientId, 'client');
        }
        list = Array.isArray(list) ? list : [];
        /* Keep only live conversations and keep ONE chat per counter-part. */
        const seen = new Set();
        list = list.filter((c) => {
          if ((c.status || '').toUpperCase() === 'CANCELLED') return false;
          const counterpart = staff ? (c.clientName || c.clientId) : (c.lawyerName || c.lawyerId);
          if (!counterpart || counterpart === 'undefined') return false;
          if (seen.has(counterpart)) return false; // already have a chat with them
          seen.add(counterpart);
          return true;
        });
        setConsultations(list);

        /* Which chat is open? URL param -> sessionStorage -> first in list. */
        const wanted = consId || sessionStorage.getItem('active_cons_id') || list[0]?.id;
        if (wanted) openChat(wanted, list);
      } catch (err) {
        toast(`Could not load consultations: ${err.message}`, 'error');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Open one chat (updates header + messages) ── */
  const openChat = (id, list = consultations) => {
    const cons = list.find((c) => String(c.id) === String(id)) || null;
    setCurrent(cons);
    currentIdRef.current = String(id);              // ref stays fresh for timeouts
    sessionStorage.setItem('active_cons_id', String(id)); // remembered like vanilla

    const key = `lf_chat_${id}`;
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* ignore */ }

    if (stored.length === 0) {
      // Seed the thread with a friendly first message from the OTHER side.
      const greeting = {
        sender: myRole === 'client' ? 'lawyer' : 'client',
        text: myRole === 'client'
          ? `Hello! I'm ${cons?.lawyerName || 'your lawyer'}. How can I assist you with your case today?`
          : 'Hello! I\'m your legal counsel. How can I help you today?',
        time: nowTime(),
      };
      stored = [greeting];
      localStorage.setItem(key, JSON.stringify(stored));
    }
    setMessages(stored);
  };

  /* ── Keep the chat scrolled to the newest message ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, current]);

  /* ── Send a message ── */
  const send = (e) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || !current) return;

    const key = `lf_chat_${current.id}`;
    const mine = { sender: myRole, text, time: nowTime() };
    const updated = [...messages, mine];
    localStorage.setItem(key, JSON.stringify(updated)); // persist
    setMessages(updated);
    setDraft('');

    // Client-side nicety (same as vanilla): a canned reply arrives 1.5s later.
    if (!staff) {
      const consIdAtSend = current.id;
      setTimeout(() => {
        const replies = [
          "I've received your message. Let's discuss this further.",
          'Can you provide more details about this?',
          "I see. I'll look into the legal precedents for this matter.",
          'Understood. We should prepare the documentation accordingly.',
        ];
        const reply = { sender: 'lawyer', text: replies[Math.floor(Math.random() * replies.length)], time: nowTime() };
        // Re-read in case the thread changed while we waited.
        let latest = [];
        try { latest = JSON.parse(localStorage.getItem(`lf_chat_${consIdAtSend}`) || '[]'); } catch { /* ignore */ }
        latest.push(reply);
        localStorage.setItem(`lf_chat_${consIdAtSend}`, JSON.stringify(latest));
        // Only touch the UI if this chat is still the open one (ref compare,
        // so we never call setState from inside another setState updater).
        if (currentIdRef.current === String(consIdAtSend)) setMessages(latest);
      }, 1500);
    }
  };

  /* ── Sidebar list filtered by the search box ── */
  const visibleChats = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return consultations;
    return consultations.filter((c) => {
      const name = staff ? (c.clientName || '') : (c.lawyerName || '');
      return (name + ' ' + (c.firmName || '')).toLowerCase().includes(q);
    });
  }, [consultations, search, staff]);

  /* ── End consultation ── */
  const endConsultation = async () => {
    if (!window.confirm('End this consultation session?')) return;
    if (staff && current) {
      try {
        await api.consultations.update(current.id, { status: 'COMPLETED' }, (user?.role || 'firmadmin').toLowerCase());
        toast('Consultation marked as completed.');
      } catch (err) {
        toast(`Could not complete: ${err.message}`, 'error');
      }
    }
    navigate(staff ? '/firm/dashboard' : '/client/dashboard');
  };

  /* The name shown in the chat header (the person we talk to). */
  const counterpartName = current
    ? (staff ? (current.clientName || 'Client') : (current.lawyerName || 'Awaiting Assignment'))
    : '';

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-5rem)] overflow-hidden border-y border-slate-200 bg-white md:-mx-8 md:my-0 md:h-screen md:border-0">
      {/* ── Left: chat list ── */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
          <span className="font-bold text-brand">{staff ? 'Client Chats' : 'LexFlow Chats'}</span>
          <Icon name="message" size={16} className="text-slate-400" />
        </div>
        <div className="p-3">
          <Input placeholder="Search or start new chat" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto">
          {visibleChats.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-400">No active consultations.</p>
          ) : visibleChats.map((c) => {
            const name = staff ? (c.clientName || 'Client') : (c.lawyerName || 'Awaiting Assignment');
            const isActive = current && String(c.id) === String(current.id);
            return (
              <button key={c.id} onClick={() => openChat(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${isActive ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {initials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
                    <span className="text-[10px] text-slate-400">{(c.time || '').split(' - ')[0]}</span>
                  </div>
                  <p className="truncate text-xs text-slate-400">{staff ? `${c.id} • New Client` : c.firmName}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Right: the open conversation ── */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              {initials(counterpartName)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-bold text-slate-900">
                {counterpartName}{staff ? ' (Client)' : ''}
              </h2>
              <p className="text-xs text-slate-400">
                {current ? `${current.firmName || ''} · ${current.date || ''}` : 'Online'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600 sm:block">
              End-to-End Encrypted
            </span>
            <Button variant="danger" className="!px-3 !py-1.5 !text-xs" onClick={endConsultation}>
              End Consultation
            </Button>
          </div>
        </div>

        {/* messages */}
        <div className="thin-scroll flex-1 space-y-3 overflow-y-auto bg-slate-50 p-5">
          {/* "Today" divider */}
          <div className="flex justify-center">
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 shadow-sm">Today</span>
          </div>

          {messages.map((m, i) => {
            /* My messages float right in brand colour; theirs float left. */
            const mine = m.sender === myRole;
            return (
              <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm
                  ${mine ? 'rounded-br-sm bg-brand text-white' : 'rounded-bl-sm bg-white text-slate-800'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`mt-1 text-right text-[10px] ${mine ? 'text-white/60' : 'text-slate-400'}`}>{m.time}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} /> {/* scroll anchor */}
        </div>

        {/* composer */}
        <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-100 bg-white px-4 py-3">
          <button type="button" className="rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="Attach">
            <Icon name="paperclip" size={18} />
          </button>
          <Input placeholder="Type a message..." value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1" />
          <Button type="submit" className="!rounded-full !p-2.5" aria-label="Send">
            <Icon name="send" size={16} />
          </Button>
        </form>
      </main>
    </div>
  );
}