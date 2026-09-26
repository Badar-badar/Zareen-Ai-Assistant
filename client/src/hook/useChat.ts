import { useState, useRef, useEffect, useCallback } from 'react';
import type { Message } from '../types/chat';
import { botApi } from '../api/botApi';

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
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const replyText = await botApi(userText);
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }
    catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };



  const resetChat = () => {
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
  };
}