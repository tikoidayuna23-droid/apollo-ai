import React from 'react';
import { ChatMessage } from '../storage/sessions';
import { ToolCall } from './ToolCall';
import { formatTime } from '../utils/helpers';
import { Mic, Volume2, Bot, Copy, Check, Sparkles, Database } from 'lucide-react';
import { VoiceManager } from '../voice/voice-manager';

interface MessageProps {
  message: ChatMessage;
}

export const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    VoiceManager.getInstance().speakResponse(message.content);
  };

  return (
    <div
      className={`flex flex-col gap-1 my-2.5 max-w-[92%] sm:max-w-[85%] ${
        isUser ? 'ml-auto items-end' : 'mr-auto items-start'
      }`}
    >
      <div className="flex items-center gap-1.5 px-1 text-[11px] text-slate-400 font-mono">
        {isUser ? (
          <>
            <span>You</span>
            {message.isVoiceInput && <Mic className="w-3 h-3 text-sky-400" title="Voice Input" />}
            <span className="text-slate-600">•</span>
            <span className="text-slate-500">{formatTime(message.timestamp)}</span>
          </>
        ) : (
          <>
            <Bot className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-sky-400 font-semibold">Apollo</span>
            {message.usedMemoriesCount && message.usedMemoriesCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[10px]">
                <Database className="w-2.5 h-2.5 text-emerald-400" />
                <span>Memory used</span>
              </span>
            )}
            <span className="text-slate-600">•</span>
            <span className="text-slate-500">{formatTime(message.timestamp)}</span>
          </>
        )}
      </div>

      <div
        className={`group relative px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-tr-sm shadow-md shadow-sky-950/40'
            : 'bg-slate-900/90 border border-slate-800 text-slate-100 rounded-tl-sm shadow-lg shadow-black/40 backdrop-blur-sm'
        }`}
      >
        {/* Tool Call Badges if any */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2">
            {message.toolCalls.map((tc) => (
              <ToolCall key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Message Content */}
        <p className="whitespace-pre-wrap select-text">{message.content}</p>

        {/* Action buttons on hover */}
        <div
          className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-950/80 p-1 rounded-md border border-slate-800 backdrop-blur-sm ${
            isUser ? 'text-white' : 'text-slate-400'
          }`}
        >
          <button
            type="button"
            onClick={handleCopy}
            title="Copy message"
            className="p-1 hover:text-sky-400 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
          {!isUser && (
            <button
              type="button"
              onClick={handleSpeak}
              title="Speak aloud"
              className="p-1 hover:text-sky-400 transition-colors"
            >
              <Volume2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

