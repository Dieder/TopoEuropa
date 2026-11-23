import { Achievement, LeaderboardEntry, LevelConfig, PlayerStats, ProgressMap } from '../types/game';
import { ALL_LEVELS } from '../data/levels';

const STORAGE_KEY = 'topovlucht_progress_v1';
const PRACTICE_MODE_KEY = 'topovlucht_unlock_all_v1';
const STATS_KEY = 'topovlucht_stats_v1';
const LEADERBOARD_KEY = 'topovlucht_leaderboard_v1';
const ACTIVE_PILOT_KEY = 'topovlucht_active_pilot_v1';

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

export function loadStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { visitedPlaceIds: [], totalLandings: 0 };
    const parsed = JSON.parse(raw) as Partial<PlayerStats>;
    return {
      visitedPlaceIds: Array.isArray(parsed.visitedPlaceIds) ? parsed.visitedPlaceIds : [],
      totalLandings: typeof parsed.totalLandings === 'number' ? parsed.totalLandings : 0,
    };
  } catch {
    return { visitedPlaceIds: [], totalLandings: 0 };
  }
}

export function saveStats(stats: PlayerStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota errors
  }
}

export function computeAchievements(progress: ProgressMap, stats: PlayerStats): Achievement[] {
  const completedLevels = ALL_LEVELS.filter((lvl) => (progress[lvl.id]?.stars ?? 0) >= 1).length;
  const totalStars = getTotalStars(progress);
  const visitedCount = stats.visitedPlaceIds.length;
  const flawlessLevels = ALL_LEVELS.filter(
    (lvl) => (progress[lvl.id]?.stars ?? 0) >= 1 && progress[lvl.id]?.bestPenalties === 0
  ).length;
  const nlThreeStars =
    (progress[1]?.stars ?? 0) === 3 && (progress[2]?.stars ?? 0) === 3 ? 2 :
    ((progress[1]?.stars ?? 0) === 3 ? 1 : 0) + ((progress[2]?.stars ?? 0) === 3 ? 1 : 0);
  const rocketDone = (progress[5]?.stars ?? 0) >= 1;
  const goldLevels = ALL_LEVELS.filter((lvl) => (progress[lvl.id]?.stars ?? 0) === 3).length;

  return [
    {
      id: 'first_flight',
      title: 'Eerste Vlucht',
      description: 'Voltooi je allereerste topografie-level.',
      unlocked: completedLevels >= 1,
      progressCurrent: Math.min(1, completedLevels),
      progressTarget: 1,
    },
    {
      id: 'explorer_100',
      title: '100 locaties bezocht',
      description: 'Bezoek 100 unieke plekken verspreid over alle kaarten.',
      unlocked: visitedCount >= 100,
      progressCurrent: Math.min(100, visitedCount),
      progressTarget: 100,
    },
    {
      id: 'flawless_level',
      title: 'Scherpschutter',
      description: 'Voltooi minstens één level zonder enige strafminuut.',
      unlocked: flawlessLevels >= 1,
      progressCurrent: Math.min(1, flawlessLevels),
      progressTarget: 1,
    },
    {
      id: 'flawless_all',
      title: 'Foutloos in alle levels',
      description: 'Behaal 0 strafpunten in alle 9 levels.',
      unlocked: flawlessLevels === ALL_LEVELS.length,
      progressCurrent: flawlessLevels,
      progressTarget: ALL_LEVELS.length,
    },
    {
      id: 'nl_master',
      title: 'Nederland Kenner',
      description: 'Behaal 3 sterren in zowel Level 1 als Level 2.',
      unlocked: nlThreeStars === 2,
      progressCurrent: nlThreeStars,
      progressTarget: 2,
    },
    {
      id: 'rocket_launch',
      title: 'Ruimtepiloot',
      description: 'Voltooi de raketmissie (Level 5: Oceanen & Werelddelen).',
      unlocked: rocketDone,
      progressCurrent: rocketDone ? 1 : 0,
      progressTarget: 1,
    },
    {
      id: 'stars_15',
      title: 'Sterrenverzamelaar',
      description: 'Verzamel in totaal 15 sterren over alle missies.',
      unlocked: totalStars >= 15,
      progressCurrent: Math.min(15, totalStars),
      progressTarget: 15,
    },
    {
      id: 'all_gold',
      title: 'Grootmeester Topografie',
      description: 'Behaal de maximale 3 sterren in alle 9 levels.',
      unlocked: goldLevels === ALL_LEVELS.length,
      progressCurrent: goldLevels,
      progressTarget: ALL_LEVELS.length,
    },
  ];
}

export interface ActivePilotProfile {
  id: string;
  name: string;
}

export function loadActivePilot(): ActivePilotProfile {
  try {
    const raw = localStorage.getItem(ACTIVE_PILOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ActivePilotProfile>;
      if (parsed.id && parsed.name) {
        return { id: parsed.id, name: parsed.name };
      }
    }
  } catch {
    // fallback
  }
  const initial: ActivePilotProfile = { id: 'pilot-1', name: 'Piloot 1' };
  saveActivePilot(initial);
  return initial;
}

export function saveActivePilot(profile: ActivePilotProfile): void {
  try {
    localStorage.setItem(ACTIVE_PILOT_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LeaderboardEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors
  }
}

export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.completedLevels !== a.completedLevels) {
      return b.completedLevels - a.completedLevels;
    }
    if (a.totalTimeSec !== b.totalTimeSec) {
      return a.totalTimeSec - b.totalTimeSec;
    }
    return b.totalStars - a.totalStars;
  });
}

export function upsertPilotLeaderboard(
  entries: LeaderboardEntry[],
  pilot: ActivePilotProfile,
  progress: ProgressMap
): LeaderboardEntry[] {
  const levelBestTimes: Record<number, number> = {};
  const levelBestPenalties: Record<number, number> = {};

  for (const lvl of ALL_LEVELS) {
    const rec = progress[lvl.id];
    if (rec && rec.stars >= 1 && rec.bestTotalTimeSec !== null) {
      levelBestTimes[lvl.id] = rec.bestTotalTimeSec;
      levelBestPenalties[lvl.id] = rec.bestPenalties ?? 0;
    }
  }

  const completedLevels = Object.keys(levelBestTimes).length;
  if (completedLevels === 0) {
    return sortLeaderboard(entries);
  }

  const totalTimeSec = Object.values(levelBestTimes).reduce((sum, t) => sum + t, 0);
  const totalStars = getTotalStars(progress);

  const nextEntry: LeaderboardEntry = {
    id: pilot.id,
    pilotName: pilot.name.trim() || 'Piloot',
    levelBestTimes,
    levelBestPenalties,
    totalStars,
    completedLevels,
    totalTimeSec,
    updatedAt: new Date().toISOString(),
  };

  const idx = entries.findIndex((e) => e.id === pilot.id);
  const updated =
    idx >= 0 ? entries.map((e, i) => (i === idx ? nextEntry : e)) : [...entries, nextEntry];

  return sortLeaderboard(updated);
}
