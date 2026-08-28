import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ApolloCore } from './components/ApolloCore';
import { VoiceControls } from './components/VoiceControls';
import { Chat } from './components/Chat';
import { Sidebar } from './components/Sidebar';
import { MemoryPanel } from './components/MemoryPanel';
import { Settings } from './components/Settings';
import { ApolloAgent } from './agent/agent';
import { ApolloState } from './agent/types';
import { VoiceManager } from './voice/voice-manager';
import { SessionStorage, ChatSession, ChatMessage } from './storage/sessions';
import { Menu, Settings as SettingsIcon, Database, Volume2, VolumeX, AlertCircle } from 'lucide-react';

export default function App() {
  const agent = ApolloAgent.getInstance();
  const voiceManager = VoiceManager.getInstance();

  // App State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [agentState, setAgentState] = useState<ApolloState>('IDLE');
  const [statusDetail, setStatusDetail] = useState<string | undefined>(undefined);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [isVoiceListening, setIsVoiceListening] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // View Modals
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(voiceManager.getSettings().voiceEnabled);
  const [isContinuous, setIsContinuous] = useState(voiceManager.getSettings().continuousListening !== false);

  const voiceSupported = voiceManager.isSpeechRecognitionSupported();

  // Initialize and load sessions
  const loadSessions = useCallback(() => {
    let allSessions = SessionStorage.getSessions();
    if (allSessions.length === 0) {
      const initial = SessionStorage.createSession();
      allSessions = [initial];
    }
    setSessions(allSessions);

    const activeId = SessionStorage.getActiveSessionId() || allSessions[0].id;
    setActiveSessionId(activeId);
    SessionStorage.setActiveSessionId(activeId);

    const activeSession = allSessions.find((s) => s.id === activeId) || allSessions[0];
    setCurrentMessages(activeSession ? [...activeSession.messages] : []);
  }, []);

  useEffect(() => {
    loadSessions();

    // Subscribe to agent state changes
    const unsubState = agent.onStateChange((state, detail) => {
      setAgentState(state);
      setStatusDetail(detail);
      if (state === 'ERROR' && detail) {
        setErrorMessage(detail);
      }
      if (state === 'LISTENING') {
        setIsVoiceListening(true);
      } else if (state === 'IDLE' && !voiceManager.isListening()) {
        setIsVoiceListening(false);
      }
    });

    // Subscribe to live voice transcript
    const unsubTranscript = voiceManager.onTranscript((text, isFinal) => {
      setLiveTranscript(text);
      if (isFinal) {
        setLiveTranscript('');
      }
    });

    // Subscribe to voice errors
    const unsubError = voiceManager.onError((err) => {
      setErrorMessage(err);
    });

    return () => {
      unsubState();
      unsubTranscript();
      unsubError();
    };
  }, [loadSessions]);

  // Switch active session
  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    SessionStorage.setActiveSessionId(sessionId);
    const s = SessionStorage.getSession(sessionId);
    setCurrentMessages(s ? [...s.messages] : []);
    setIsMemoryOpen(false);
    setIsSettingsOpen(false);
  };

  // Create new session
  const handleNewSession = () => {
    const newSession = SessionStorage.createSession();
    loadSessions();
    setActiveSessionId(newSession.id);
    setCurrentMessages([]);
    setIsMemoryOpen(false);
    setIsSettingsOpen(false);
  };

  // Delete session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    SessionStorage.deleteSession(sessionId);
    loadSessions();
  };

  // Primary Agent Execution Handler
  const handleExecute = async (text: string, isVoice = false) => {
    if (!text.trim() || !activeSessionId) return;

    setErrorMessage(null);

    try {
      const { userMessage, assistantMessage, response } = await agent.processInput({
        sessionId: activeSessionId,
        text,
        isVoice,
      });

      // Update UI messages
      setCurrentMessages((prev) => [...prev, userMessage, assistantMessage]);
      loadSessions(); // refresh titles/ordering

      if (response.error) {
        setErrorMessage(response.error);
      } else if (response.text) {
        // If speech is enabled, speak response aloud (which will auto-resume listening when done)
        voiceManager.speakResponse(response.text);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Processing failed';
      setErrorMessage(msg);
      agent.setState('ERROR', msg);
    }
  };

  // Voice Listening Triggers (Supports Hands-Free Direct Voice Detection)
  const handleStartVoice = () => {
    setErrorMessage(null);
    setIsVoiceListening(true);
    voiceManager.startListening((finalTranscript) => {
      if (!isContinuous) {
        setIsVoiceListening(false);
      }
      handleExecute(finalTranscript, true);
    }, isContinuous);
  };

  const handleStopVoice = () => {
    voiceManager.stopListening();
    setIsVoiceListening(false);
  };

  const handleToggleContinuous = (enabled: boolean) => {
    setIsContinuous(enabled);
    voiceManager.updateSettings({ continuousListening: enabled });
    if (isVoiceListening) {
      // Re-arm with new continuous preference
      handleStopVoice();
      setTimeout(() => {
        handleStartVoice();
      }, 100);
    }
  };

  // Toggle Voice Output
  const handleToggleVoice = () => {
    const updated = !voiceEnabled;
    setVoiceEnabled(updated);
    voiceManager.updateSettings({ voiceEnabled: updated });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#080c14] text-slate-100 font-sans antialiased select-none">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onOpenMemory={() => {
          setIsMemoryOpen(true);
          setIsSettingsOpen(false);
        }}
        onOpenSettings={() => {
          setIsSettingsOpen(true);
          setIsMemoryOpen(false);
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Apollo View Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-900 transition-colors"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm tracking-widest text-sky-400 font-bold">APOLLO</span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">CENTRAL ASSISTANT</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Voice Output Toggle */}
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`p-2 rounded-lg transition-colors ${
                voiceEnabled
                  ? 'text-sky-400 hover:bg-sky-950/50'
                  : 'text-slate-500 hover:bg-slate-900'
              }`}
              title={voiceEnabled ? 'Voice Output: ON' : 'Voice Output: OFF'}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Quick Memory Button */}
            <button
              type="button"
              onClick={() => {
                setIsMemoryOpen(!isMemoryOpen);
                setIsSettingsOpen(false);
              }}
              className={`p-2 rounded-lg transition-colors ${
                isMemoryOpen
                  ? 'text-emerald-400 bg-emerald-950/50'
                  : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-900'
              }`}
              title="Memory Store"
            >
              <Database className="w-4 h-4" />
            </button>

            {/* Settings Button */}
            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen(!isSettingsOpen);
                setIsMemoryOpen(false);
              }}
              className={`p-2 rounded-lg transition-colors ${
                isSettingsOpen
                  ? 'text-indigo-400 bg-indigo-950/50'
                  : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-900'
              }`}
              title="Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Error Alert Banner if active */}
        {errorMessage && (
          <div className="bg-rose-950/80 border-b border-rose-800/80 px-4 py-2 text-xs text-rose-200 flex items-center justify-between font-mono z-20">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 text-xs uppercase"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Core Stage & Conversation Interface */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top Hero Section: The Glowing Apollo Core */}
          <div className="shrink-0 pt-2 pb-1 border-b border-slate-800/40 bg-gradient-to-b from-slate-950/40 to-transparent">
            <ApolloCore
              state={agentState}
              statusDetail={statusDetail}
              onCoreClick={() => {
                if (isVoiceListening) handleStopVoice();
                else handleStartVoice();
              }}
            />

            {/* Voice Controls: Large Mic Button */}
            <div className="mt-1 mb-2">
              <VoiceControls
                state={agentState}
                isListening={isVoiceListening}
                isSupported={voiceSupported}
                liveTranscript={liveTranscript}
                isContinuous={isContinuous}
                onToggleContinuous={handleToggleContinuous}
                onStartListening={handleStartVoice}
                onStopListening={handleStopVoice}
              />
            </div>
          </div>

          {/* Bottom Stream: Conversation HUD and Text Input */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/30">
            <Chat
              messages={currentMessages}
              state={agentState}
              onSendMessage={handleExecute}
              onStartVoice={handleStartVoice}
              isVoiceListening={isVoiceListening}
              voiceSupported={voiceSupported}
            />
          </div>
        </main>

        {/* Slide-over Drawer for Memory */}
        {isMemoryOpen && (
          <div className="absolute top-14 right-0 bottom-0 w-full sm:w-96 border-l border-slate-800 bg-slate-950 z-30 shadow-2xl">
            <MemoryPanel onClose={() => setIsMemoryOpen(false)} />
          </div>
        )}

        {/* Slide-over Drawer for Settings */}
        {isSettingsOpen && (
          <div className="absolute top-14 right-0 bottom-0 w-full sm:w-96 border-l border-slate-800 bg-slate-950 z-30 shadow-2xl">
            <Settings
              onClose={() => setIsSettingsOpen(false)}
              onDataChanged={() => loadSessions()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
