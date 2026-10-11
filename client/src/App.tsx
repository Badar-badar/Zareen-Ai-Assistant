import { useState } from 'react';
import { ChatBot } from './components/chatScreen/ChatBot';
import { Login } from './components/Login';
import { getToken } from './auth/token';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  return (
    <div className="h-dvh max-h-dvh w-screen bg-slate-100 dark:bg-[#0b141a] flex items-center justify-center p-0 sm:p-4 overflow-hidden transition-colors duration-300">
      {authed ? <ChatBot /> : <Login onSuccess={() => setAuthed(true)} />}
    </div>
  );
}