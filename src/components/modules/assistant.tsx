'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Check,
  Copy,
  Database,
  Package,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { useBusiness } from '@/lib/business-context';
import { suggestedPrompts } from '@/data/mock-data';
import { answer } from '@/lib/demo-assistant';
import { Button } from '@/components/ui/button';
import type { Module } from '@/types/business';
const validModule = (m: unknown) =>
  m === undefined ||
  [
    'Overview',
    'AI Assistant',
    'Analytics',
    'Customers',
    'Sales',
    'Inventory',
    'Finance',
    'Alerts',
    'Automations',
    'Reports',
    'Settings',
  ].includes(String(m));
interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: string;
  module?: Module;
}
export function Assistant({
  initialPrompt,
  days = 14,
  clearPrompt,
  navigate,
  notify,
}: {
  initialPrompt: string;
  days?: number;
  clearPrompt: () => void;
  navigate: (m: Module, query?: string) => void;
  notify: (m: string) => void;
}) {
  const { data, companyName } = useBusiness();
  const [archive, setArchive] = useState<{ id: string; title: string; messages: Message[] }[]>([]);
  const [storageError, setStorageError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [ready, setReady] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    try {
      const raw = localStorage.getItem('nexus-chat');
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed))
          setMessages(
            parsed
              .filter(
                (m): m is Message =>
                  !!m &&
                  typeof m === 'object' &&
                  'text' in m &&
                  typeof m.text === 'string' &&
                  'id' in m &&
                  typeof m.id === 'string' &&
                  'role' in m &&
                  (m.role === 'assistant' || m.role === 'user') &&
                  (!('source' in m) || typeof m.source === 'string') &&
                  validModule('module' in m ? m.module : undefined),
              )
              .slice(-40),
          );
      }
      const saved = JSON.parse(localStorage.getItem('nexus-conversations') ?? '[]');
      if (Array.isArray(saved))
        setArchive(
          saved
            .filter(
              (c) =>
                typeof c?.id === 'string' &&
                typeof c.title === 'string' &&
                Array.isArray(c.messages) &&
                c.messages.every(
                  (m: Message) =>
                    m &&
                    typeof m.id === 'string' &&
                    typeof m.text === 'string' &&
                    ['user', 'assistant'].includes(m.role) &&
                    (!m.source || typeof m.source === 'string') &&
                    validModule(m.module),
                ),
            )
            .slice(0, 20),
        );
    } catch {
      setStorageError('Conversation history could not be loaded.');
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem('nexus-chat', JSON.stringify(messages.slice(-100)));
        localStorage.setItem('nexus-conversations', JSON.stringify(archive));
      } catch {
        setStorageError('Conversation history could not be saved on this device.');
      }
    }
  }, [messages, archive, ready]);
  const send = (text: string) => {
    if (!text.trim() || !ready) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text: text.trim() },
      { id: crypto.randomUUID(), role: 'assistant', ...answer(text, days, data) },
    ]);
    setInput('');
  };
  useEffect(() => {
    if (initialPrompt && ready) {
      send(initialPrompt);
      clearPrompt();
    } /* initial prompt is consumed once */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, ready]);
  useEffect(() => {
    if (messages.length) bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);
  const newChat = () => {
    if (messages.length)
      setArchive((prev) =>
        [
          {
            id: crypto.randomUUID(),
            title: messages.find((m) => m.role === 'user')?.text.slice(0, 70) ?? 'Conversation',
            messages,
          },
          ...prev,
        ].slice(0, 20),
      );
    setMessages([]);
    setInput('');
    notify('A fresh conversation is ready.');
  };
  return (
    <div className="assistant-workspace">
      <div className="assistant-toolbar">
        <span>
          <span className="live-dot" />
          {companyName} · Nov {15 - days}–14, 2026
        </span>
        <Button variant="outline" size="sm" onClick={newChat}>
          <Plus size={14} />
          New conversation
        </Button>
      </div>
      {storageError && (
        <p className="form-error" role="alert">
          {storageError}
        </p>
      )}
      {archive.length > 0 && (
        <div className="conversation-history">
          <label>
            Saved conversations{' '}
            <select
              aria-label="Open saved conversation"
              value=""
              onChange={(e) => {
                const found = archive.find((c) => c.id === e.target.value);
                if (found) {
                  if (messages.length)
                    setArchive((prev) =>
                      [
                        { id: crypto.randomUUID(), title: messages[0].text.slice(0, 70), messages },
                        ...prev.filter((c) => c.id !== found.id),
                      ].slice(0, 20),
                    );
                  else setArchive((prev) => prev.filter((c) => c.id !== found.id));
                  setMessages(found.messages);
                }
              }}
            >
              <option value="">Choose a conversation</option>
              {archive.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <Button variant="ghost" size="sm" onClick={() => setArchive([])}>
            Clear saved conversations
          </Button>
        </div>
      )}
      {messages.length === 0 ? (
        <div className="assistant-welcome">
          <div className="assistant-emblem">
            <Sparkles size={30} />
          </div>
          <span className="eyebrow">LESS SEARCHING. MORE CLARITY.</span>
          <h2>
            What’s your next
            <br />
            business question?
          </h2>
          <p>
            Your sales, customers, inventory and finances.
            <br />
            One place to see the bigger picture.
          </p>
          <div className="prompt-grid">
            {suggestedPrompts.map((prompt, i) => {
              const Icon = [BarChart3, Package, Wallet, Users][i];
              return (
                <button key={prompt} onClick={() => send(prompt)}>
                  <Icon size={19} />
                  <span>{prompt}</span>
                  <ArrowUpRight size={15} />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="conversation" role="log" aria-label="Conversation">
          {messages.map((message) => (
            <div key={message.id} className={`message message-${message.role}`}>
              <div className={message.role === 'assistant' ? 'message-avatar' : 'user-avatar'}>
                {message.role === 'assistant' ? <Sparkles size={17} /> : 'AM'}
              </div>
              <div className="message-body">
                <div className="message-label">
                  {message.role === 'assistant' ? 'Nexus assistant' : 'You'}
                  <span>{message.role === 'assistant' ? 'Demo analysis' : ''}</span>
                </div>
                <div className="answer-content">
                  {message.text.split('\n\n').map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
                {message.source && (
                  <div className="message-source">
                    <Database size={12} />
                    {message.source}
                  </div>
                )}
                {message.module && (
                  <button
                    className="text-link"
                    onClick={() =>
                      navigate(
                        message.module!,
                        message.module === 'Inventory'
                          ? 'status=Low+stock'
                          : message.module === 'Finance'
                            ? 'status=Overdue'
                            : undefined,
                      )
                    }
                  >
                    Explore {message.module.toLowerCase()}
                    <ArrowUpRight size={13} />
                  </button>
                )}
                {message.role === 'assistant' && message.module && (
                  <div className="answer-records">
                    {(message.module === 'Inventory'
                      ? data.products
                          .filter((p) => p.stock < p.reorder)
                          .map((p) => ({ kind: 'Inventory' as Module, id: p.id, label: p.name }))
                      : message.module === 'Finance'
                        ? data.invoices
                            .filter((i) => i.status === 'Overdue')
                            .map((i) => ({ kind: 'Finance' as Module, id: i.id, label: i.id }))
                        : message.module === 'Customers'
                          ? [...data.customers]
                              .sort((a, b) => b.revenue - a.revenue)
                              .slice(0, 3)
                              .map((c) => ({
                                kind: 'Customers' as Module,
                                id: c.id,
                                label: c.name,
                              }))
                          : []
                    ).map((r) => (
                      <button
                        key={r.id}
                        className="text-link"
                        onClick={() => navigate(r.kind, `id=${encodeURIComponent(r.id)}`)}
                      >
                        {r.label}
                        <ArrowUpRight size={12} />
                      </button>
                    ))}
                  </div>
                )}
                {message.role === 'assistant' && (
                  <button
                    className="copy-button"
                    aria-label="Copy response"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(message.text);
                        setCopied(message.id);
                        notify('Response copied.');
                      } catch {
                        notify('Clipboard unavailable in this browser.');
                      }
                    }}
                  >
                    {copied === message.id ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div ref={bottom} />
        </div>
      )}
      <div className="assistant-composer">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Sparkles size={19} />
          <textarea
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            aria-label="Ask a business question"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your business, or describe what you need…"
            disabled={!ready}
          />
          <button type="submit" aria-label="Send question" disabled={!input.trim() || !ready}>
            <ArrowUp size={19} />
          </button>
        </form>
        <p>
          <ShieldCheck size={12} />
          Frontend demo · Responses use predefined logic and fictional data. No AI is connected.
        </p>
      </div>
    </div>
  );
}
