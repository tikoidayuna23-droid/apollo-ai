import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../storage/sessions';
import { Message } from './Message';
import { ApolloState } from '../agent/types';
import { Send, Mic, Sparkles } from 'lucide-react';

interface ChatProps {
  messages: ChatMessage[];
  state: ApolloState;
  onSendMessage: (text: string, isVoice?: boolean) => void;
  onStartVoice: () => void;
  isVoiceListening: boolean;
  voiceSupported: boolean;
}

const QUICK_PROMPTS = [
  'Hello Apollo.',
  "What is 125 multiplied by 48?",
  'Remember that my project is called Apollo.',
  'What is my project called?',
];

export const Chat: React.FC<ChatProps> = ({
  messages,
  state,
  onSendMessage,
  onStartVoice,
  isVoiceListening,
  voiceSupported,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isBusy = state === 'THINKING' || state === 'USING_TOOL';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, state]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isBusy) return;
    const text = input.trim();
    setInput('');
    onSendMessage(text, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 font-mono text-xs space-y-3">
            <Sparkles className="w-6 h-6 text-sky-400/40 animate-pulse" />
            <p>Apollo Voice & Text Agent is ready.</p>
            <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-lg mt-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSendMessage(prompt, false)}
                  className="px-3 py-1 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 rounded-full text-slate-400 hover:text-sky-300 transition-colors text-[11px]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <Message key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isBusy}
            placeholder={isBusy ? 'Apollo is thinking...' : 'Ask Apollo something or speak...'}
            className="w-full pl-4 pr-10 py-2.5 bg-slate-900/90 border border-slate-800 focus:border-sky-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50 font-sans transition-all disabled:opacity-60"
          />

          {voiceSupported && (
            <button
              type="button"
              onClick={onStartVoice}
              disabled={isBusy}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                isVoiceListening
                  ? 'text-rose-400 hover:text-rose-300 animate-pulse'
                  : 'text-slate-400 hover:text-sky-400'
              }`}
              title="Voice Input"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!input.trim() || isBusy}
          className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-40 disabled:hover:from-sky-600 disabled:hover:to-indigo-600 text-white rounded-xl text-sm font-medium transition-all shadow-md shadow-sky-950/40 flex items-center gap-1.5 focus:outline-none"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
