import React from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';

interface HeaderProps {
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onReset }) => {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 bg-emerald-700 dark:bg-[#111b21] text-white border-b border-emerald-800 dark:border-slate-800 shrink-0 transition-colors duration-200 shadow-xs">
      <div className="flex items-center gap-2.5">
        {/* Sleek Bot Avatar */}
        <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 dark:from-emerald-600 dark:to-teal-500 text-white shadow-xs">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-300 border-2 border-emerald-700 dark:border-[#111b21] rounded-full" />
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold text-white text-sm tracking-tight leading-none">
              Zareena
            </h1>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 dark:bg-emerald-400" />
            <span className="text-[10px] text-emerald-100 dark:text-emerald-300 font-medium">
              Online
            </span>
          </div>
          <p className="text-[10px] text-emerald-100/70 dark:text-slate-400 font-normal">
            AI Assistant
          </p>
        </div>
      </div>

      <button
        onClick={onReset}
        title="Reset conversation"
        className="p-1.5 text-emerald-100 hover:text-white dark:text-slate-400 dark:hover:text-slate-100 hover:bg-emerald-600 dark:hover:bg-slate-800 rounded-lg transition-all duration-150 cursor-pointer border border-emerald-600/30 dark:border-slate-700/50"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </header>
  );
};
