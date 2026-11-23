import { LevelConfig, ProgressMap } from '../types/game';

const STORAGE_KEY = 'topovlucht_progress_v1';
const PRACTICE_MODE_KEY = 'topovlucht_unlock_all_v1';

export interface PilotRank {
  title: string;
  minStars: number;
  nextStars: number | null;
}

const RANKS: PilotRank[] = [
  { title: 'Leerling-Piloot', minStars: 0, nextStars: 3 },
  { title: 'Nederland-Verkenner', minStars: 3, nextStars: 7 },
  { title: 'Europa-Navigator', minStars: 7, nextStars: 12 },
  { title: 'Ruimtevaarder', minStars: 12, nextStars: 17 },
  { title: 'Wereld-Gezagvoerder', minStars: 17, nextStars: 23 },
  { title: 'Grootmeester Topografie', minStars: 23, nextStars: null },
];

export function getRankForStars(stars: number): PilotRank {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (stars >= r.minStars) {
      current = r;
    }
  }
  return current;
}

export function calculateStars(level: LevelConfig, totalTimeSec: number): 1 | 2 | 3 {
  const [gold, silver] = level.starThresholdsSec;
  if (totalTimeSec <= gold) return 3;
  if (totalTimeSec <= silver) return 2;
  return 1;
}

export function loadProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ProgressMap;
  } catch {
    return {};
  }
}

export function saveProgress(progress: ProgressMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadUnlockAll(): boolean {
  try {
    return localStorage.getItem(PRACTICE_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveUnlockAll(value: boolean): void {
  try {
    localStorage.setItem(PRACTICE_MODE_KEY, value ? 'true' : 'false');
  } catch {
    // Ignore storage quota errors
  }
}

export function isLevelUnlocked(
  levelId: number,
  progress: ProgressMap,
  unlockAll: boolean
): boolean {
  if (unlockAll || levelId <= 1) return true;
  const prev = progress[levelId - 1];
  return Boolean(prev && prev.stars >= 1);
}

export function getTotalStars(progress: ProgressMap): number {
  return Object.values(progress).reduce((sum, rec) => sum + (rec.stars || 0), 0);
}
