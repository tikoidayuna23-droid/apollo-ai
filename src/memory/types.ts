export type MemoryCategory =
  | 'USER'
  | 'PREFERENCE'
  | 'PROJECT'
  | 'GOAL'
  | 'FACT'
  | 'INSTRUCTION'
  | 'CONTEXT';

export type MemorySource = 'user' | 'agent' | 'system' | 'import';

export interface MemoryItem {
  id: string;
  content: string;
  category: MemoryCategory;
  importance: number; // 1 (Low) to 5 (Critical)
  source: MemorySource;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  key?: string;
  projectId?: string;
}

export interface MemorySearchResult {
  item: MemoryItem;
  score: number;
  matchedTerms?: string[];
}

export interface MemoryQueryOptions {
  category?: MemoryCategory | 'ALL';
  tags?: string[];
  projectId?: string;
  minImportance?: number;
  limit?: number;
}
