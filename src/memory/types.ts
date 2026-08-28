export interface MemoryItem {
  id: string;
  key?: string;
  content: string;
  category?: 'fact' | 'preference' | 'project' | 'general';
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface MemorySearchResult {
  item: MemoryItem;
  score: number;
}
