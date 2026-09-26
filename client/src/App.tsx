import { ChatBot } from './components/chatScreen/ChatBot';

export default function App() {
  return (
    <div className="h-dvh max-h-dvh w-screen bg-slate-100 dark:bg-[#0b141a] flex items-center justify-center p-0 sm:p-4 overflow-hidden transition-colors duration-300">
      <ChatBot />
    </div>
  );
}