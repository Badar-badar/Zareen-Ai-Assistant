import React from 'react';
import { Send, Sparkles } from 'lucide-react';

interface FooterProps {
  input: string;
  setInput: (value: string) => void;
  isTyping: boolean;
  onSend: (e?: React.FormEvent) => void;
}

export const Footer: React.FC<FooterProps> = ({
  input,
  setInput,
  isTyping,
  onSend,
}) => {
  const quickPrompts = [
    '✨ How can you help?',
    '💡 Explain code',
    '📝 Draft an email',
  ];

  const handlePromptClick = (prompt: string) => {
    const textWithoutEmoji = prompt.replace(/^[\p{Emoji}\s]+/u, '');
    setInput(textWithoutEmoji);
  };

  return (
    <footer className="p-2.5 sm:p-3 bg-white dark:bg-[#111b21] border-t border-slate-200 dark:border-slate-800 shrink-0 transition-colors duration-200">
      {/* Quick Suggestions Bar */}
      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto no-scrollbar py-0.5">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handlePromptClick(prompt)}
            className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1f2c34] text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200/80 dark:border-slate-700/60 transition-colors whitespace-nowrap cursor-pointer shrink-0 font-medium"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Compact Input Form */}
      <form onSubmit={onSend} className="relative flex items-center gap-2">
        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Zareena anything..."
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-[#1f2c34] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1.5 focus:ring-emerald-500/60 focus:border-emerald-500 transition-all"
          />

          {input.length > 0 && (
            <span className="absolute right-3 text-[10px] font-mono text-slate-400 dark:text-slate-500 select-none">
              {input.length}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={!input.trim() || isTyping}
          className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-medium rounded-xl transition-all duration-150 cursor-pointer shadow-xs shrink-0 active:scale-95 flex items-center justify-center"
          title="Send message"
        >
          {isTyping ? (
            <Sparkles className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </footer>
  );
};
