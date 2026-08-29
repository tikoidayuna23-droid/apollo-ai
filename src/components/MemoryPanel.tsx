import React, { useState, useRef } from 'react';
import { ApolloMemory } from '../memory/memory';
import { MemoryItem, MemoryCategory } from '../memory/types';
import { UserManager, UserProfile } from '../memory/user';
import { ProjectMemoryManager, ProjectItem } from '../memory/projects';
import {
  Database,
  Plus,
  Trash2,
  Search,
  Tag,
  X,
  Edit2,
  Download,
  Upload,
  Star,
  User,
  Folder,
  AlertTriangle,
  Check,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { formatDate } from '../utils/helpers';

interface MemoryPanelProps {
  onClose?: () => void;
}

const CATEGORIES: Array<{ key: MemoryCategory | 'ALL'; label: string; color: string }> = [
  { key: 'ALL', label: 'All', color: 'bg-slate-800 text-slate-200 border-slate-700' },
  { key: 'USER', label: 'User', color: 'bg-amber-950/60 text-amber-300 border-amber-800/60' },
  { key: 'PROJECT', label: 'Projects', color: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60' },
  { key: 'PREFERENCE', label: 'Preferences', color: 'bg-purple-950/60 text-purple-300 border-purple-800/60' },
  { key: 'GOAL', label: 'Goals', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' },
  { key: 'FACT', label: 'Facts', color: 'bg-blue-950/60 text-blue-300 border-blue-800/60' },
  { key: 'INSTRUCTION', label: 'Instructions', color: 'bg-rose-950/60 text-rose-300 border-rose-800/60' },
  { key: 'CONTEXT', label: 'Context', color: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60' },
];

const IMPORTANCE_LABELS: Record<number, string> = {
  1: '1 - Low',
  2: '2 - Minor',
  3: '3 - Useful',
  4: '4 - Important',
  5: '5 - Critical',
};

export const MemoryPanel: React.FC<MemoryPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'memories' | 'user' | 'projects'>('memories');
  const [memories, setMemories] = useState<MemoryItem[]>(ApolloMemory.getAllMemories());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MemoryCategory | 'ALL'>('ALL');

  // Add / Edit State
  const [isAdding, setIsAdding] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);

  // Form State
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<MemoryCategory>('FACT');
  const [formImportance, setFormImportance] = useState<number>(3);
  const [formTags, setFormTags] = useState('');
  const [formKey, setFormKey] = useState('');

  // Delete & Clear Confirmations
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // User Profile & Projects State
  const [userProfile, setUserProfile] = useState<UserProfile>(UserManager.getProfile());
  const [projects, setProjects] = useState<ProjectItem[]>(ProjectMemoryManager.getAllProjects());
  const [newPreferenceInput, setNewPreferenceInput] = useState('');
  const [newGoalInput, setNewGoalInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const refreshData = () => {
    setMemories(ApolloMemory.searchMemory(searchQuery.trim(), selectedCategory));
    setUserProfile(UserManager.getProfile());
    setProjects(ProjectMemoryManager.getAllProjects());
  };

  const handleSearch = (query: string, cat: MemoryCategory | 'ALL' = selectedCategory) => {
    setSearchQuery(query);
    setSelectedCategory(cat);
    setMemories(ApolloMemory.searchMemory(query.trim(), cat));
  };

  const handleCategorySelect = (cat: MemoryCategory | 'ALL') => {
    setSelectedCategory(cat);
    setMemories(ApolloMemory.searchMemory(searchQuery.trim(), cat));
  };

  const handleOpenAdd = () => {
    setFormContent('');
    setFormCategory('FACT');
    setFormImportance(3);
    setFormTags('');
    setFormKey('');
    setEditingMemory(null);
    setIsAdding(true);
  };

  const handleOpenEdit = (item: MemoryItem) => {
    setFormContent(item.content);
    setFormCategory(item.category);
    setFormImportance(item.importance || 3);
    setFormTags(item.tags.join(', '));
    setFormKey(item.key || '');
    setEditingMemory(item);
    setIsAdding(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) return;

    const tags = formTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (editingMemory) {
      // Update
      ApolloMemory.updateMemory(editingMemory.id, {
        content: formContent.trim(),
        category: formCategory,
        importance: formImportance,
        tags,
        key: formKey.trim() || undefined,
      });
      showToast('Memory updated.');
    } else {
      // Create
      const res = ApolloMemory.saveMemory(formContent.trim(), {
        category: formCategory,
        importance: formImportance,
        tags,
        key: formKey.trim() || undefined,
        source: 'user',
      });
      if (res.securityWarning) {
        showToast(res.securityWarning);
      } else {
        showToast(res.isUpdated ? 'Existing duplicate updated.' : 'New memory logged.');
      }
    }

    setIsAdding(false);
    setEditingMemory(null);
    refreshData();
  };

  const handleDeleteConfirm = (id: string) => {
    ApolloMemory.deleteMemory(id);
    setDeletingId(null);
    showToast('Memory deleted.');
    refreshData();
  };

  const handleClearAll = () => {
    ApolloMemory.clearMemory();
    setShowClearConfirm(false);
    showToast('All memories cleared.');
    refreshData();
  };

  const handleExport = () => {
    const jsonStr = ApolloMemory.exportMemories();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apollo_memories_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported memory archive.');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = ApolloMemory.importMemories(content);
        if (res.errors.length > 0) {
          showToast(`Imported ${res.importedCount} items with ${res.errors.length} warnings.`);
        } else {
          showToast(`Successfully imported ${res.importedCount} memories (${res.updatedCount} updated).`);
        }
        refreshData();
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderStars = (rating: number, interactive = false, onSelect?: (r: number) => void) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= rating;
          return (
            <button
              key={star}
              type="button"
              disabled={!interactive}
              onClick={() => onSelect?.(star)}
              className={`${interactive ? 'hover:scale-110 cursor-pointer p-0.5' : 'cursor-default'} transition-transform`}
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  isFilled
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-600 hover:text-amber-400'
                }`}
              />
            </button>
          );
        })}
      </div>
    );
  };

  const getCategoryBadge = (category: MemoryCategory) => {
    const catObj = CATEGORIES.find((c) => c.key === category);
    return (
      <span
        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-semibold border ${
          catObj ? catObj.color : 'bg-slate-800 text-slate-300 border-slate-700'
        }`}
      >
        {category}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 border border-emerald-500/80 rounded-full text-xs font-mono text-emerald-300 shadow-xl shadow-black/80 flex items-center gap-2 animate-fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden File Input for Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFile}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Main Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 shadow-md shadow-emerald-950/40">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-slate-100 uppercase font-mono">
                APOLLO MEMORY
              </h2>
              <span className="text-[11px] px-2 py-0.2 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono font-medium">
                {memories.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Local-first neural archive & long-term facts
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:text-slate-100 text-slate-400 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center border-b border-slate-800 bg-slate-900/40 px-3 pt-2 gap-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('memories')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-mono font-medium transition-colors ${
            activeTab === 'memories'
              ? 'border-emerald-400 text-emerald-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Memories ({memories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('user')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-mono font-medium transition-colors ${
            activeTab === 'user'
              ? 'border-emerald-400 text-emerald-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>User Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-mono font-medium transition-colors ${
            activeTab === 'projects'
              ? 'border-emerald-400 text-emerald-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          <span>Projects ({projects.length})</span>
        </button>
      </div>

      {activeTab === 'memories' && (
        <>
          {/* Controls: Search, Category Filters, and Action Buttons */}
          <div className="p-3 border-b border-slate-800/80 space-y-2.5 bg-slate-950/60">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search memories, keywords, tags, keys..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleCategorySelect(cat.key)}
                    className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-all font-mono ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-semibold shadow-sm shadow-emerald-900/40'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleOpenAdd}
                className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Memory</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExport}
                  title="Export Memories to JSON"
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Export</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Import Memories from JSON"
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs flex items-center gap-1 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden sm:inline">Import</span>
                </button>

                {memories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    title="Clear All Memories"
                    className="p-1.5 bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800 rounded-lg text-xs flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline">Clear All</span>
                  </button>
                )}
              </div>
            </div>

            {/* Clear All Confirmation Dialog */}
            {showClearConfirm && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-xl space-y-2 text-xs animate-fade-in">
                <div className="flex items-center gap-2 text-rose-300 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Purge all stored memories?</span>
                </div>
                <p className="text-[11px] text-rose-200/80">
                  This permanently removes all long-term facts, preferences, and project records from local storage.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded text-xs"
                  >
                    Confirm Purge
                  </button>
                </div>
              </div>
            )}

            {/* Add / Edit Form Modal/Drawer */}
            {isAdding && (
              <form
                onSubmit={handleSaveForm}
                className="p-3.5 bg-slate-900/95 rounded-xl border border-emerald-500/50 shadow-2xl space-y-3 text-xs animate-fade-in"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-semibold text-slate-100 font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    {editingMemory ? 'Edit Memory' : '+ Add New Memory'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingMemory(null);
                    }}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-mono uppercase tracking-wider block mb-1">
                    Memory Content *
                  </label>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    rows={2}
                    placeholder="e.g. Apollo is my main AI project."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 font-mono uppercase tracking-wider block mb-1">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as MemoryCategory)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="USER">USER</option>
                      <option value="PROJECT">PROJECT</option>
                      <option value="PREFERENCE">PREFERENCE</option>
                      <option value="GOAL">GOAL</option>
                      <option value="FACT">FACT</option>
                      <option value="INSTRUCTION">INSTRUCTION</option>
                      <option value="CONTEXT">CONTEXT</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-mono uppercase tracking-wider block mb-1">
                      Importance ({IMPORTANCE_LABELS[formImportance]})
                    </label>
                    <div className="py-1.5 px-2 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                      {renderStars(formImportance, true, setFormImportance)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 font-mono uppercase tracking-wider block mb-1">
                      Key (Optional)
                    </label>
                    <input
                      type="text"
                      value={formKey}
                      onChange={(e) => setFormKey(e.target.value)}
                      placeholder="e.g. main_project"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-mono uppercase tracking-wider block mb-1">
                      Tags (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      placeholder="e.g. apollo, ai, priority"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-sans focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingMemory(null);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formContent.trim()}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium rounded-lg shadow-md transition-colors"
                  >
                    {editingMemory ? 'Update Memory' : 'Save to Archive'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Memories List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {memories.length === 0 ? (
              <div className="text-center py-16 text-slate-500 font-mono space-y-2">
                <Database className="w-8 h-8 mx-auto text-slate-700" />
                <p className="text-xs">
                  {searchQuery ? 'No matching memories found.' : 'No long-term memories saved yet.'}
                </p>
                <p className="text-[11px] text-slate-600">
                  Say &ldquo;Remember that...&rdquo; or click &ldquo;+ Add Memory&rdquo; above.
                </p>
              </div>
            ) : (
              memories.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-slate-900/70 border border-slate-800/90 hover:border-slate-700 rounded-xl space-y-2 group transition-all"
                >
                  {/* Top Bar: Category, Importance, Date */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {getCategoryBadge(item.category)}
                      {item.key && (
                        <span className="flex items-center gap-1 font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/60 text-[10px]">
                          <Tag className="w-2.5 h-2.5" />
                          {item.key}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {renderStars(item.importance || 3)}
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {formatDate(item.updatedAt || item.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <p className="text-xs text-slate-100 leading-relaxed font-sans select-text">
                    {item.content}
                  </p>

                  {/* Tags & Action Buttons */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/40">
                    <div className="flex items-center gap-1 flex-wrap">
                      {item.tags && item.tags.length > 0 ? (
                        item.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono"
                          >
                            #{t}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono">Source: {item.source || 'user'}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        title="Edit Memory"
                        className="p-1 hover:text-emerald-400 text-slate-400 hover:bg-slate-800 rounded transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {deletingId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteConfirm(item.id)}
                            className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-semibold"
                          >
                            Delete?
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(null)}
                            className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingId(item.id)}
                          title="Delete Memory"
                          className="p-1 hover:text-rose-400 text-slate-400 hover:bg-slate-800 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* User Profile Tab */}
      {activeTab === 'user' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
            <h3 className="font-semibold text-slate-100 font-mono flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" />
              <span>Identity & Tactical Settings</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 font-mono uppercase block mb-1">User Name</label>
                <input
                  type="text"
                  value={userProfile.name}
                  onChange={(e) => {
                    const updated = UserManager.updateProfile({ name: e.target.value });
                    setUserProfile(updated);
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-mono uppercase block mb-1">AI Callsign</label>
                <input
                  type="text"
                  value={userProfile.assistantCallsign}
                  onChange={(e) => {
                    const updated = UserManager.updateProfile({ assistantCallsign: e.target.value });
                    setUserProfile(updated);
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                />
              </div>
            </div>
          </div>

          {/* User Preferences List */}
          <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-200 font-mono">Known User Preferences</h4>
              <span className="text-[10px] text-slate-500 font-mono">{userProfile.preferences.length} saved</span>
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={newPreferenceInput}
                onChange={(e) => setNewPreferenceInput(e.target.value)}
                placeholder="e.g. Concise responses, Dark mode"
                className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-sans"
              />
              <button
                type="button"
                onClick={() => {
                  if (newPreferenceInput.trim()) {
                    const updated = UserManager.addPreference(newPreferenceInput.trim());
                    setUserProfile(updated);
                    setNewPreferenceInput('');
                    refreshData();
                  }
                }}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium"
              >
                Add
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              {userProfile.preferences.length === 0 ? (
                <p className="text-[11px] text-slate-500 font-mono">No preferences logged yet.</p>
              ) : (
                userProfile.preferences.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-slate-950/60 border border-slate-800/60 rounded-lg text-slate-200"
                  >
                    <span>{p}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = UserManager.removePreference(p);
                        setUserProfile(updated);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* User Goals List */}
          <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-200 font-mono">Current Goals</h4>
              <span className="text-[10px] text-slate-500 font-mono">{userProfile.goals.length} active</span>
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={newGoalInput}
                onChange={(e) => setNewGoalInput(e.target.value)}
                placeholder="e.g. Complete Apollo Phase 2"
                className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-sans"
              />
              <button
                type="button"
                onClick={() => {
                  if (newGoalInput.trim()) {
                    const updated = UserManager.addGoal(newGoalInput.trim());
                    setUserProfile(updated);
                    setNewGoalInput('');
                    refreshData();
                  }
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium"
              >
                Add
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              {userProfile.goals.length === 0 ? (
                <p className="text-[11px] text-slate-500 font-mono">No goals logged yet.</p>
              ) : (
                userProfile.goals.map((g, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-slate-950/60 border border-slate-800/60 rounded-lg text-slate-200"
                  >
                    <span>{g}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = UserManager.removeGoal(g);
                        setUserProfile(updated);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between pb-1">
            <h3 className="font-semibold text-slate-100 font-mono flex items-center gap-2">
              <Folder className="w-4 h-4 text-cyan-400" />
              <span>Tracked Projects Archive</span>
            </h3>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-16 text-slate-500 font-mono space-y-1">
              <Folder className="w-8 h-8 mx-auto text-slate-700" />
              <p className="text-xs">No projects registered yet.</p>
              <p className="text-[11px] text-slate-600">Tell Apollo: &ldquo;Remember my main project is Apollo&rdquo;</p>
            </div>
          ) : (
            projects.map((proj) => (
              <div
                key={proj.id}
                className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-100 text-sm font-mono text-cyan-300">
                    {proj.name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-cyan-950 border border-cyan-800 text-cyan-300">
                    {proj.status}
                  </span>
                </div>
                {proj.description && (
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{proj.description}</p>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/40 text-[10px] text-slate-500 font-mono">
                  <span>Linked memories: {proj.memories.length}</span>
                  <span>Updated: {formatDate(proj.updatedAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
