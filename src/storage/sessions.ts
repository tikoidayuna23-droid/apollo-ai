import { db } from './database';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'completed' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallRecord[];
  isVoiceInput?: boolean;
  usedMemoriesCount?: number;
  usedMemories?: Array<{ id: string; content: string; category: string }>;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

const SESSIONS_KEY = 'sessions_list';
const CURRENT_SESSION_ID_KEY = 'active_session_id';

export class SessionStorage {
  static getSessions(): ChatSession[] {
    const sessions = db.getItem<ChatSession[]>(SESSIONS_KEY, []);
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  static getSession(id: string): ChatSession | null {
    const sessions = this.getSessions();
    return sessions.find((s) => s.id === id) || null;
  }

  static createSession(firstMessageSnippet?: string): ChatSession {
    const newSession: ChatSession = {
      id: generateId(),
      title: firstMessageSnippet ? firstMessageSnippet.slice(0, 30) : 'New Briefing',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };

    const sessions = this.getSessions();
    sessions.unshift(newSession);
    db.setItem(SESSIONS_KEY, sessions);
    this.setActiveSessionId(newSession.id);
    logger.info('Sessions', `Created session ${newSession.id}`);
    return newSession;
  }

  static updateSession(session: ChatSession): void {
    const sessions = this.getSessions();
    const index = sessions.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      sessions[index] = { ...session, updatedAt: Date.now() };
    } else {
      sessions.unshift(session);
    }
    db.setItem(SESSIONS_KEY, sessions);
  }

  static addMessage(sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): ChatMessage {
    const fullMessage: ChatMessage = {
      id: message.id || generateId(),
      timestamp: message.timestamp || Date.now(),
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls,
      isVoiceInput: message.isVoiceInput,
      usedMemoriesCount: message.usedMemoriesCount,
      usedMemories: message.usedMemories,
    };

    const session = this.getSession(sessionId);
    if (session) {
      session.messages.push(fullMessage);
      if (session.messages.length === 1 && fullMessage.role === 'user') {
        session.title = fullMessage.content.slice(0, 32) || 'Apollo Session';
      }
      this.updateSession(session);
    }

    return fullMessage;
  }

  static deleteSession(sessionId: string): void {
    const sessions = this.getSessions().filter((s) => s.id !== sessionId);
    db.setItem(SESSIONS_KEY, sessions);
    logger.info('Sessions', `Deleted session ${sessionId}`);

    if (this.getActiveSessionId() === sessionId) {
      if (sessions.length > 0) {
        this.setActiveSessionId(sessions[0].id);
      } else {
        db.removeItem(CURRENT_SESSION_ID_KEY);
      }
    }
  }

  static clearAllSessions(): void {
    db.removeItem(SESSIONS_KEY);
    db.removeItem(CURRENT_SESSION_ID_KEY);
    logger.info('Sessions', 'Cleared all sessions');
  }

  static getActiveSessionId(): string | null {
    return db.getItem<string | null>(CURRENT_SESSION_ID_KEY, null);
  }

  static setActiveSessionId(sessionId: string): void {
    db.setItem(CURRENT_SESSION_ID_KEY, sessionId);
  }
}
