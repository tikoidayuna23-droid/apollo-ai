import React from 'react';
import { ChatSession } from '../storage/sessions';
import { Plus, MessageSquare, Database, Settings as SettingsIcon, Trash2, X } from 'lucide-react';
import { formatDate } from '../utils/helpers';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onOpenMemory,
  onOpenSettings,
  isOpen,
  onClose,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 bottom-0 w-64 bg-slate-950/95 border-r border-slate-800/80 flex flex-col z-40 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Branding & Close Button */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/apollo-logo.svg" alt="Apollo" className="w-6 h-6" />
            <span className="font-bold text-slate-100 tracking-wider text-sm font-mono">APOLLO</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1 text-slate-400 hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Session Button */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              onNewSession();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full py-2 px-3 bg-gradient-to-r from-sky-600/90 to-indigo-600/90 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-sky-950/30 transition-all font-sans"
          >
            <Plus className="w-4 h-4" />
            <span>New Briefing</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Conversations
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-600 font-mono">
              No sessions yet
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id);
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                    isActive
                      ? 'bg-sky-950/60 border border-sky-500/40 text-sky-200'
                      : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans font-medium text-[12px]">{session.title || 'Briefing'}</p>
                      <span className="text-[10px] text-slate-500 font-mono block">{formatDate(session.updatedAt)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => onDeleteSession(session.id, e)}
                    title="Delete session"
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-500 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Nav: Memory & Settings */}
        <div className="p-3 border-t border-slate-800/80 space-y-1">
          <button
            type="button"
            onClick={() => {
              onOpenMemory();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-900 text-xs transition-colors"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">Memory Store</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-900 text-xs transition-colors"
          >
            <SettingsIcon className="w-4 h-4 text-indigo-400" />
            <span className="font-medium">Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
};
