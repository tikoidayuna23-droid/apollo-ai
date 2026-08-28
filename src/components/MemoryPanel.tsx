import React, { useState } from 'react';
import { ApolloMemory } from '../memory/memory';
import { MemoryItem } from '../memory/types';
import { Database, Plus, Trash2, Search, Tag, X } from 'lucide-react';
import { formatDate } from '../utils/helpers';

interface MemoryPanelProps {
  onClose?: () => void;
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({ onClose }) => {
  const [memories, setMemories] = useState<MemoryItem[]>(ApolloMemory.getAllMemories());
  const [searchQuery, setSearchQuery] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newKey, setNewKey] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const refreshMemories = () => {
    if (searchQuery.trim()) {
      setMemories(ApolloMemory.searchMemory(searchQuery.trim()));
    } else {
      setMemories(ApolloMemory.getAllMemories());
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (val.trim()) {
      setMemories(ApolloMemory.searchMemory(val.trim()));
    } else {
      setMemories(ApolloMemory.getAllMemories());
    }
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    ApolloMemory.saveMemory(newContent.trim(), {
      key: newKey.trim() || undefined,
    });
    setNewContent('');
    setNewKey('');
    setIsAdding(false);
    refreshMemories();
  };

  const handleDelete = (id: string) => {
    ApolloMemory.deleteMemory(id);
    refreshMemories();
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all stored long-term memories for Apollo?')) {
      ApolloMemory.clearMemory();
      refreshMemories();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-semibold text-slate-100">Apollo Memory</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-mono">
            {memories.length}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:text-slate-100 text-slate-400 rounded-lg hover:bg-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search and Action Bar */}
      <div className="p-3 border-b border-slate-800/80 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search saved facts & notes..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="text-xs px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isAdding ? 'Cancel' : 'Add Memory'}</span>
          </button>

          {memories.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Add Memory Form */}
        {isAdding && (
          <form onSubmit={handleAddMemory} className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">Key (Optional)</label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. project_name, user_city"
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">Memory Content</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={2}
                placeholder="e.g. My project is called Apollo."
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>
            <button
              type="submit"
              disabled={!newContent.trim()}
              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded font-medium transition-colors"
            >
              Save to Memory
            </button>
          </form>
        )}
      </div>

      {/* Memory List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {memories.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500 font-mono">
            {searchQuery ? 'No matching memories found.' : 'No long-term memories saved yet.'}
          </div>
        ) : (
          memories.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-1.5 group hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between text-xs">
                {item.key ? (
                  <span className="flex items-center gap-1 font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/60 text-[11px]">
                    <Tag className="w-3 h-3" />
                    {item.key}
                  </span>
                ) : (
                  <span className="text-slate-500 text-[11px] font-mono">General</span>
                )}
                <span className="text-[10px] text-slate-500">{formatDate(item.createdAt)}</span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-sans">{item.content}</p>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  title="Delete memory"
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
