import React, { useState, type RefObject } from 'react';
import { Sparkles, Copy, Check } from 'lucide-react';
import type { Message } from '../../types/chat';

interface MessagesProps {
  messages: Message[];
  isTyping: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSelectSuggestion?: (text: string) => void;
}

export const Messages: React.FC<MessagesProps> = ({
  messages,
  isTyping,
  messagesEndRef,
  onSelectSuggestion,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const suggestions = [
    '✨ How can you help me today?',
    '💡 Explain code',
    '📝 Draft an email',
  ];

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-3 custom-scrollbar bg-slate-50/70 dark:bg-[#0b141a]/95">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
          <div className="p-2.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300/40 dark:border-emerald-700/40 shadow-2xs">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Chat with Zareena
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mt-0.5 leading-normal">
              Ask any question or pick a prompt to start.
            </p>
          </div>

          {onSelectSuggestion && (
            <div className="flex flex-wrap gap-1.5 justify-center max-w-sm pt-1">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => onSelectSuggestion(suggestion.replace(/^[\p{Emoji}\s]+/u, ''))}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-[#1f2c34] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 dark:hover:border-emerald-400 transition-all cursor-pointer font-medium shadow-2xs"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        messages.map((msg) => {
          const isBot = msg.sender === 'bot';
          const isCopied = copiedId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex animate-fadeIn ${
                isBot ? 'justify-start' : 'justify-end'
              }`}
            >
              {/* Message Bubble - Compact max-w-[70%] on all screen sizes */}
              <div className="relative group max-w-[75%] sm:max-w-[65%]">
                <div
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm leading-relaxed transition-colors duration-150 shadow-2xs ${
                    isBot
                      ? 'bg-white dark:bg-[#1f2c34] text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-slate-700/50'
                      : 'bg-emerald-600 dark:bg-[#005c4b] text-white font-normal rounded-br-xs'
                  }`}
                >
                  {/* Top Sender Name */}
                  <div className="flex items-center justify-between gap-2 mb-1 pb-0.5 border-b border-black/5 dark:border-white/5">
                    <span
                      className={`text-[10px] font-bold tracking-wide ${
                        isBot
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-emerald-100 dark:text-emerald-200'
                      }`}
                    >
                      {isBot ? 'Zareena' : 'You'}
                    </span>

                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      title="Copy message"
                      className={`flex items-center gap-1 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer ${
                        isBot
                          ? 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          : 'text-emerald-100 hover:text-white'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-300" />
                          <span className="text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                  <div className="flex justify-end mt-1">
                    <span
                      className={`text-[9px] select-none ${
                        isBot ? 'text-slate-400 dark:text-slate-400' : 'text-emerald-100/80'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Typing Indicator */}
      {isTyping && (
        <div className="flex justify-start animate-fadeIn">
          <div className="flex gap-1 py-1.5 px-3 bg-white dark:bg-[#1f2c34] rounded-xl rounded-bl-xs border border-slate-200/80 dark:border-slate-700/50 shadow-2xs">
            <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-bounce" />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
