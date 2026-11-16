'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, Check, Copy, Database, Plus, ShieldCheck } from 'lucide-react';
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
      <div className="analysis-layout">
        <aside className="analysis-context">
          <span className="section-label">WORKSPACE CONTEXT</span>
          <strong>{companyName}</strong>
          <p>November {15 - days}–14, 2026</p>
          <dl>
            <div>
              <dt>Customers</dt>
              <dd>{data.customers.length}</dd>
            </div>
            <div>
              <dt>Products</dt>
              <dd>{data.products.length}</dd>
            </div>
            <div>
              <dt>Orders</dt>
              <dd>{data.orders.length}</dd>
            </div>
            <div>
              <dt>Invoices</dt>
              <dd>{data.invoices.length}</dd>
            </div>
          </dl>
          <span className="section-label">SUGGESTED ANALYSES</span>
          <div className="prompt-grid">
            {suggestedPrompts.map((prompt) => (
              <button key={prompt} onClick={() => send(prompt)}>
                <span>{prompt}</span>
                <ArrowUpRight size={13} />
              </button>
            ))}
          </div>
          <p className="context-note">
            Uses local sample records. Historical sales aggregates are separate from the order
            ledger.
          </p>
        </aside>
        <div className="analysis-main">
          {messages.length === 0 ? (
            <div className="assistant-welcome">
              <span className="section-label">BUSINESS ANALYSIS</span>
              <h2>Start with a question.</h2>
              <p>
                Review performance, investigate overdue invoices, or identify products to reorder.
                Each supported analysis includes its source records.
              </p>
              <div className="analysis-example">
                <span>Example question</span>
                <p>Which products need restocking?</p>
                <button
                  className="text-link"
                  onClick={() => send('Which products need restocking?')}
                >
                  Run this analysis <ArrowUpRight size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="conversation" role="log" aria-label="Conversation">
              {messages.map((message) => (
                <div key={message.id} className={`message message-${message.role}`}>
                  <div className={message.role === 'assistant' ? 'message-avatar' : 'user-avatar'}>
                    {message.role === 'assistant' ? 'N' : 'AM'}
                  </div>
                  <div className="message-body">
                    <div className="message-label">
                      {message.role === 'assistant' ? 'Analysis' : 'Question'}
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
                              .map((p) => ({
                                kind: 'Inventory' as Module,
                                id: p.id,
                                label: p.name,
                              }))
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
                placeholder="Ask a question about your business records…"
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
      </div>
    </div>
  );
}
