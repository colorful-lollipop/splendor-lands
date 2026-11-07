const COLLECTION_KEY = 'splendor-card-collection-v1';

export function mergeCollection(current: string[], purchased: string[]): string[] {
  const merged = new Set([...current, ...purchased]);
  return [...merged];
}

export function loadCollection(): string[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === 'string'))] : [];
  } catch {
    return [];
  }
}

export function saveCollection(cardIds: string[]) {
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(cardIds));
  } catch {
    // 隐私模式或存储空间不足时，图鉴仍在当前会话内可用。
  }
}
