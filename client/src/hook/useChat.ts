import { useState, useRef, useEffect, useCallback } from 'react';
import type { Message } from '../types/chat';
import { botStream, resetSession } from '../api/botApi';

export function useChat() {
  // Automatic System Dark/Light Theme Handler
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applySystemTheme = (e: MediaQueryList | MediaQueryListEvent) => {
      if (e.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    // Initial check
    applySystemTheme(mediaQuery);

    // Listen to OS system preference changes
    mediaQuery.addEventListener('change', applySystemTheme);
    return () => mediaQuery.removeEventListener('change', applySystemTheme);
  }, []);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'Hello! I am Zareena. How can I assist you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

    const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const botId = (Date.now() + 1).toString();

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), sender: 'user', text: userText, timestamp: now() },
      { id: botId, sender: 'bot', text: '', timestamp: now() },
    ]);
    setInput('');
    setIsTyping(true);

    const ac = new AbortController();
    abortRef.current = ac;
    const update = (patch: Partial<Message>) =>
      setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, ...patch } : m)));
    let acc = '';

    try {
      const reply = await botStream(userText, {
        signal: ac.signal,
        onDelta: (t) => { acc += t; update({ text: acc }); },
        onReset: () => { acc = ''; update({ text: '' }); },
        onReplace: (t) => { acc = t; update({ text: t }); },
      });
      if (reply.aborted) update({ text: acc ? `${acc} (stopped)` : 'Stopped.' });
      else update({ text: reply.text || acc, actions: reply.actions });
    } catch (error) {
      console.error(error);
      update({ text: acc || 'Something went wrong.' });
    } finally {
      abortRef.current = null;
      setIsTyping(false);
    }
  };

  const stopGenerating = () => abortRef.current?.abort();



  const resetChat = () => {
    abortRef.current?.abort();
    resetSession();
    setMessages([
      {
        id: '1',
        sender: 'bot',
        text: 'Hello! I am Zareena. How can I assist you today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInput('');
    setIsTyping(false);
  };

  return {
    messages,
    input,
    setInput,
    isTyping,
    messagesEndRef,
    sendMessage,
    resetChat,
    stopGenerating,
  };
}