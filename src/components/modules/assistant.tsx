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
import { suggestedPrompts } from '@/data/mock-data';
import { answer } from '@/lib/demo-assistant';
import { Button } from '@/components/ui/button';
import type { Module } from '@/types/business';
interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: string;
  module?: Module;
}
export function Assistant({
  initialPrompt,
  clearPrompt,
  navigate,
  notify,
}: {
  initialPrompt: string;
  clearPrompt: () => void;
  navigate: (m: Module) => void;
  notify: (m: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
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
                  'role' in m &&
                  (m.role === 'assistant' || m.role === 'user'),
              )
              .slice(-40),
          );
      }
    } catch {}
    setReady(true);
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem('nexus-chat', JSON.stringify(messages));
      } catch {}
    }
  }, [messages, ready]);
  const send = (text: string) => {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: text.trim() }]);
    setInput('');
    setLoading(true);
    pending.current = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', ...answer(text) },
      ]);
      setLoading(false);
    }, 650);
  };
  useEffect(() => {
    if (initialPrompt && ready) {
      send(initialPrompt);
      clearPrompt();
    } /* initial prompt is consumed once */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, ready]);
  useEffect(() => {
    if (messages.length) bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);
  const newChat = () => {
    if (pending.current) clearTimeout(pending.current);
    setLoading(false);
    setMessages([]);
    setInput('');
    notify('A fresh conversation is ready.');
  };
  return (
    <div className="assistant-workspace">
      <div className="assistant-toolbar">
        <span>
          <span className="live-dot" />
          TechNova business context
        </span>
        <Button variant="outline" size="sm" onClick={newChat}>
          <Plus size={14} />
          New conversation
        </Button>
      </div>
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
                <p>{message.text}</p>
                {message.source && (
                  <div className="message-source">
                    <Database size={12} />
                    {message.source}
                  </div>
                )}
                {message.module && (
                  <button className="text-link" onClick={() => navigate(message.module!)}>
                    Explore {message.module.toLowerCase()}
                    <ArrowUpRight size={13} />
                  </button>
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
          {loading && (
            <div className="thinking">
              <Sparkles size={16} />
              <span>Reviewing the sample business data…</span>
              <i />
              <i />
              <i />
            </div>
          )}
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
          <input
            aria-label="Ask a business question"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your business, or describe what you need…"
            disabled={loading}
          />
          <button aria-label="Send question" disabled={!input.trim() || loading}>
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
