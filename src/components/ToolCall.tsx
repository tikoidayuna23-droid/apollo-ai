import React, { useState } from 'react';
import { ToolCallRecord } from '../storage/sessions';
import {
  Calculator,
  Database,
  Search,
  Clock,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  Sparkles,
  FileText,
  BarChart2,
  FileCode,
} from 'lucide-react';

interface ToolCallProps {
  toolCall: ToolCallRecord;
}

export const ToolCall: React.FC<ToolCallProps> = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);

  const getToolIcon = () => {
    switch (toolCall.name) {
      case 'calculator':
        return <Calculator className="w-3.5 h-3.5 text-amber-400" />;
      case 'time':
        return <Clock className="w-3.5 h-3.5 text-purple-400" />;
      case 'save_memory':
        return <Database className="w-3.5 h-3.5 text-emerald-400" />;
      case 'search_memory':
        return <Search className="w-3.5 h-3.5 text-sky-400" />;
      case 'memory':
        return <Database className="w-3.5 h-3.5 text-cyan-400" />;
      case 'text_intelligence':
        return <FileText className="w-3.5 h-3.5 text-blue-400" />;
      case 'data_analysis':
        return <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'file_intelligence':
        return <FileCode className="w-3.5 h-3.5 text-violet-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const formatSummary = () => {
    if (toolCall.name === 'calculator' && toolCall.args?.expression) {
      return `Calc: ${toolCall.args.expression}`;
    }
    if (toolCall.name === 'time') {
      return 'Time: Local Chrono';
    }
    if (toolCall.name === 'save_memory' && toolCall.args?.content) {
      return `Memory: "${String(toolCall.args.content).slice(0, 24)}..."`;
    }
    if (toolCall.name === 'search_memory' && toolCall.args?.query) {
      return `Search: "${toolCall.args.query}"`;
    }
    if (toolCall.name === 'memory') {
      return `Memory: ${toolCall.args?.action || 'Access'}`;
    }
    if (toolCall.name === 'text_intelligence') {
      const action = toolCall.args?.action || 'Process';
      return `Text: ${String(action).replace(/_/g, ' ')}`;
    }
    if (toolCall.name === 'data_analysis') {
      const action = toolCall.args?.action || 'Analysis';
      const col = toolCall.args?.column ? ` (${toolCall.args.column})` : '';
      return `Data: ${String(action).replace(/_/g, ' ')}${col}`;
    }
    if (toolCall.name === 'file_intelligence') {
      const fn = toolCall.args?.filename ? ` "${toolCall.args.filename}"` : '';
      return `File: ${toolCall.args?.action || 'Inspect'}${fn}`;
    }
    return toolCall.name.replace(/_/g, ' ');
  };

  return (
    <div className="my-1.5 rounded-lg border border-slate-800 bg-slate-900/60 text-xs overflow-hidden font-mono">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-800/50 transition-colors text-slate-300"
      >
        <div className="flex items-center gap-2">
          {getToolIcon()}
          <span className="text-slate-400 font-semibold">{formatSummary()}</span>
          {toolCall.status === 'completed' && <Check className="w-3 h-3 text-emerald-400" />}
          {toolCall.status === 'error' && <AlertCircle className="w-3 h-3 text-rose-400" />}
        </div>
        <div className="text-slate-500 hover:text-slate-300">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/70 space-y-2 text-[11px]">
          <div>
            <span className="text-slate-500 uppercase tracking-wider block mb-0.5">Arguments:</span>
            <pre className="text-slate-300 bg-slate-900 p-1.5 rounded overflow-x-auto">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
          {toolCall.result !== undefined && (
            <div>
              <span className="text-slate-500 uppercase tracking-wider block mb-0.5">Result:</span>
              <pre className="text-emerald-300 bg-slate-900 p-1.5 rounded overflow-x-auto">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
