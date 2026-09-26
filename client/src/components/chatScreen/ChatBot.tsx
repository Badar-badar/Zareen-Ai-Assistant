import React from 'react';
import { useChat } from '../../hook/useChat';
import { Header } from './Header';
import { Messages } from './Messages';
import { Footer } from './Footer';

export const ChatBot: React.FC = () => {
  const {
    messages,
    input,
    setInput,
    isTyping,
    messagesEndRef,
    sendMessage,
    resetChat,
  } = useChat();

  const handleSelectSuggestion = (suggestionText: string) => {
    setInput(suggestionText);
  };

  return (
    <div className="w-full max-w-2xl h-[650px] max-h-full flex flex-col min-h-0 bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300">
      <Header onReset={resetChat} />
      <Messages
        messages={messages}
        isTyping={isTyping}
        messagesEndRef={messagesEndRef}
        onSelectSuggestion={handleSelectSuggestion}
      />
      <Footer
        input={input}
        setInput={setInput}
        isTyping={isTyping}
        onSend={sendMessage}
      />
    </div>
  );
};