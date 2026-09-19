import { LeaderboardEntry } from '../types';

const STORAGE_KEY = 'corod-assessment-leaderboard-v1';
const MAX_ENTRIES = 100;

/** Load the persisted leaderboard (highest score first). Safe on SSR/no-storage. */
export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LeaderboardEntry[];
    if (!Array.isArray(parsed)) return [];
    return sortLeaderboard(parsed);
  } catch {
    return [];
  }
}

/** Persist a full leaderboard array. */
function save(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore quota / disabled storage */
  }
}

/** Sort by score desc, then better (lower) avg reaction, then fewer hints. */
export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ar = a.avgReactionSec ?? Infinity;
    const br = b.avgReactionSec ?? Infinity;
    if (ar !== br) return ar - br;
    return a.hintsUsed - b.hintsUsed;
  });
}

/** Add a new entry and return the updated, sorted leaderboard. */
export function addLeaderboardEntry(entry: LeaderboardEntry): LeaderboardEntry[] {
  const next = sortLeaderboard([entry, ...loadLeaderboard()]).slice(0, MAX_ENTRIES);
  save(next);
  return next;
}

/** Clear all leaderboard entries. */
export function clearLeaderboard(): void {
  save([]);
}
