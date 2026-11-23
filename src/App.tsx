import { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Compass,
  Lock,
  MapPin,
  Medal,
  Play,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  Unlock,
  UserPlus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ALL_LEVELS, getLevelById, getVehicleLabel } from './data/levels';
import {
  AchievementId,
  AnswerLog,
  GameScreen,
  LeaderboardEntry,
  LevelConfig,
  PlayerStats,
  ProgressMap,
} from './types/game';
import {
  ActivePilotProfile,
  calculateStars,
  computeAchievements,
  getRankForStars,
  getTotalStars,
  isLevelUnlocked,
  loadActivePilot,
  loadLeaderboard,
  loadProgress,
  loadStats,
  loadUnlockAll,
  saveActivePilot,
  saveLeaderboard,
  saveProgress,
  saveStats,
  saveUnlockAll,
  sortLeaderboard,
  upsertPilotLeaderboard,
} from './utils/progression';
import { formatTime } from './utils/geo';
import { soundEngine } from './audio/soundEngine';
import { AircraftIcon } from './components/AircraftSprite';
import { FlightGameMap } from './components/FlightGameMap';
import { LevelSummary } from './components/LevelSummary';

interface SummaryState {
  level: LevelConfig;
  flightTimeSec: number;
  penalties: number;
  totalTimeSec: number;
  starsEarned: 1 | 2 | 3;
  isNewBest: boolean;
  logs: AnswerLog[];
}

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('MENU');
  const [activeLevelId, setActiveLevelId] = useState<number>(1);
  const [runKey, setRunKey] = useState<number>(0);
  const [progress, setProgress] = useState<ProgressMap>(() => loadProgress());
  const [stats, setStats] = useState<PlayerStats>(() => loadStats());
  const [activePilot, setActivePilot] = useState<ActivePilotProfile>(() => loadActivePilot());
  const [pilotNameInput, setPilotNameInput] = useState<string>(() => loadActivePilot().name);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    const initialProgress = loadProgress();
    const initialPilot = loadActivePilot();
    const existing = loadLeaderboard();
    const synced = upsertPilotLeaderboard(existing, initialPilot, initialProgress);
    if (synced.length !== existing.length) {
      saveLeaderboard(synced);
    }
    return synced;
  });
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | 'complete'>('all');
  const [confirmClearBoard, setConfirmClearBoard] = useState<boolean>(false);
  const [unlockAll, setUnlockAll] = useState<boolean>(() => loadUnlockAll());
  const [muted, setMuted] = useState<boolean>(false);
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const totalStars = useMemo(() => getTotalStars(progress), [progress]);
  const maxStars = ALL_LEVELS.length * 3;
  const pilotRank = useMemo(() => getRankForStars(totalStars), [totalStars]);
  const achievements = useMemo(
    () => computeAchievements(progress, stats),
    [progress, stats]
  );
  const unlockedAchievementCount = useMemo(
    () => achievements.filter((a) => a.unlocked).length,
    [achievements]
  );

  const filteredLeaderboard = useMemo(() => {
    const sorted = sortLeaderboard(leaderboard);
    if (leaderboardFilter === 'complete') {
      return sorted.filter((entry) => entry.completedLevels === ALL_LEVELS.length);
    }
    return sorted;
  }, [leaderboard, leaderboardFilter]);

  // Next recommended playable level
  const recommendedLevel = useMemo(() => {
    const firstUnfinished = ALL_LEVELS.find(
      (lvl) => !progress[lvl.id] || progress[lvl.id].stars === 0
    );
    return firstUnfinished ?? ALL_LEVELS[0];
  }, [progress]);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const handleToggleUnlockAll = () => {
    const next = !unlockAll;
    setUnlockAll(next);
    saveUnlockAll(next);
  };

  const handleStartLevel = (levelId: number) => {
    soundEngine.unlock();
    setActiveLevelId(levelId);
    setRunKey((k) => k + 1);
    setSummary(null);
    setScreen('PLAYING');
  };

  const handleCompleteLevel = (result: {
    flightTimeSec: number;
    penalties: number;
    totalTimeSec: number;
    logs: AnswerLog[];
  }) => {
    const level = getLevelById(activeLevelId);
    const starsEarned = calculateStars(level, result.totalTimeSec);
    const existing = progress[level.id];
    const isNewBest =
      !existing ||
      existing.bestTotalTimeSec === null ||
      result.totalTimeSec < existing.bestTotalTimeSec;

    const updated: ProgressMap = {
      ...progress,
      [level.id]: {
        bestTotalTimeSec:
          existing?.bestTotalTimeSec !== null && existing?.bestTotalTimeSec !== undefined
            ? Math.min(existing.bestTotalTimeSec, result.totalTimeSec)
            : result.totalTimeSec,
        bestFlightTimeSec:
          existing?.bestFlightTimeSec !== null && existing?.bestFlightTimeSec !== undefined
            ? Math.min(existing.bestFlightTimeSec, result.flightTimeSec)
            : result.flightTimeSec,
        bestPenalties:
          existing?.bestPenalties !== null && existing?.bestPenalties !== undefined
            ? Math.min(existing.bestPenalties, result.penalties)
            : result.penalties,
        stars: Math.max(existing?.stars ?? 0, starsEarned) as 0 | 1 | 2 | 3,
        plays: (existing?.plays ?? 0) + 1,
      },
    };

    setProgress(updated);
    saveProgress(updated);
    const nextLeaderboard = upsertPilotLeaderboard(leaderboard, activePilot, updated);
    setLeaderboard(nextLeaderboard);
    saveLeaderboard(nextLeaderboard);
    setSummary({
      level,
      flightTimeSec: result.flightTimeSec,
      penalties: result.penalties,
      totalTimeSec: result.totalTimeSec,
      starsEarned,
      isNewBest,
      logs: result.logs,
    });
    setScreen('SUMMARY');
  };

  const handleSavePilotName = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pilotNameInput.trim();
    if (!trimmed) return;
    const updatedPilot: ActivePilotProfile = { ...activePilot, name: trimmed };
    setActivePilot(updatedPilot);
    saveActivePilot(updatedPilot);

    const updatedBoard = leaderboard.map((entry) =>
      entry.id === updatedPilot.id ? { ...entry, pilotName: trimmed } : entry
    );
    setLeaderboard(updatedBoard);
    saveLeaderboard(updatedBoard);
  };

  const handleNewPilotSession = () => {
    const nextNum = leaderboard.length + 1;
    const suggestedName = `Piloot ${nextNum}`;
    const newPilot: ActivePilotProfile = {
      id: `pilot-${Date.now()}`,
      name: suggestedName,
    };
    setActivePilot(newPilot);
    setPilotNameInput(suggestedName);
    saveActivePilot(newPilot);

    setProgress({});
    saveProgress({});
    const emptyStats: PlayerStats = { visitedPlaceIds: [], totalLandings: 0 };
    setStats(emptyStats);
    saveStats(emptyStats);
    setConfirmReset(false);
  };

  const handleClearLeaderboard = () => {
    if (!confirmClearBoard) {
      setConfirmClearBoard(true);
      return;
    }
    setLeaderboard([]);
    saveLeaderboard([]);
    setConfirmClearBoard(false);
  };

  const handlePlaceFound = (placeId: string) => {
    setStats((prev) => {
      const hasVisited = prev.visitedPlaceIds.includes(placeId);
      const next: PlayerStats = {
        visitedPlaceIds: hasVisited ? prev.visitedPlaceIds : [...prev.visitedPlaceIds, placeId],
        totalLandings: prev.totalLandings + 1,
      };
      saveStats(next);
      return next;
    });
  };

  const handleResetProgress = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setProgress({});
    saveProgress({});
    const emptyStats: PlayerStats = { visitedPlaceIds: [], totalLandings: 0 };
    setStats(emptyStats);
    saveStats(emptyStats);
    setConfirmReset(false);
  };

  if (screen === 'PLAYING') {
    const level = getLevelById(activeLevelId);
    return (
      <FlightGameMap
        key={`${level.id}-${runKey}`}
        level={level}
        initialMuted={muted}
        onToggleMute={handleToggleMute}
        onExitToMenu={() => {
          soundEngine.stopEngine();
          setScreen('MENU');
        }}
        onPlaceFound={handlePlaceFound}
        onCompleteLevel={handleCompleteLevel}
      />
    );
  }

  if (screen === 'SUMMARY' && summary) {
    const nextLevelExists = summary.level.id < ALL_LEVELS.length;
    return (
      <LevelSummary
        level={summary.level}
        flightTimeSec={summary.flightTimeSec}
        penalties={summary.penalties}
        totalTimeSec={summary.totalTimeSec}
        starsEarned={summary.starsEarned}
        isNewBest={summary.isNewBest}
        logs={summary.logs}
        hasNextLevel={nextLevelExists}
        onReplay={() => handleStartLevel(summary.level.id)}
        onNextLevel={() => handleStartLevel(summary.level.id + 1)}
        onBackToMenu={() => setScreen('MENU')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FA] text-slate-900 flex flex-col">
      {/* Top Navigation Bar — 3-Zone Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-xl font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            TopoVlucht
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#missies"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Missiekaart
            </a>
            <a
              href="#prestaties"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Prestaties
            </a>
            <a
              href="#klassement"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Beste Piloten
            </a>
            <a
              href="#besturing"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Besturing
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => handleStartLevel(recommendedLevel.id)}
              className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Start Level {recommendedLevel.id}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="max-w-6xl w-full mx-auto px-6 py-10 space-y-12 flex-1">
        {/* Hero Overview */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-7 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 flex flex-wrap items-center gap-2">
                <span>Topografie vliegspel</span>
                <span aria-hidden="true">·</span>
                <span>Open kaarten zonder plaatsnamen</span>
                <span aria-hidden="true">·</span>
                <span>9 missies</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-3 font-display [text-wrap:balance]">
                Leer Nederland, Europa en de wereld vanuit de lucht
              </h1>
              <p className="text-base text-slate-600 mt-3 max-w-2xl leading-relaxed">
                Vlieg met je helikopter over Nederlandse rivieren en steden, schakel over naar het
                vliegtuig voor Europa en de continenten, en lanceer de raket voor de oceanen van de
                wereld. Plekken lichten op zodra je dichtbij komt.
              </p>
            </div>

            <div className="mt-7 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2.5">
                  <AircraftIcon vehicle="helicopter" className="w-7 h-7" />
                  <div className="text-xs">
                    <div className="font-semibold text-slate-800">Level 1–2</div>
                    <div className="text-slate-500">Helikopter</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <AircraftIcon vehicle="airplane" className="w-7 h-7" />
                  <div className="text-xs">
                    <div className="font-semibold text-slate-800">Level 3–4 & 6–9</div>
                    <div className="text-slate-500">Vliegtuig + zoom</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <AircraftIcon vehicle="rocket" className="w-7 h-7" />
                  <div className="text-xs">
                    <div className="font-semibold text-slate-800">Level 5</div>
                    <div className="text-slate-500">Raket + zoom</div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleMute}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                {muted ? 'Geluid uit' : 'Geluid aan'}
              </button>
            </div>
          </div>

          {/* Pilot Rank & Progress Summary Card */}
          <aside
            id="rangen"
            className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-7 flex flex-col justify-between"
          >
            <div>
              <div className="text-xs font-medium text-slate-500">Vliegbrevet</div>
              <h2 className="text-2xl font-bold text-slate-900 mt-1 font-display">
                {pilotRank.title}
              </h2>

              <div className="mt-5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-600">Verdiende sterren</span>
                  <span className="font-mono-tabular font-bold text-slate-900">
                    {totalStars} / {maxStars}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-amber-500 transition-transform duration-300 origin-left"
                    style={{
                      transform: `scaleX(${Math.max(0.02, totalStars / maxStars)})`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {pilotRank.nextStars !== null
                    ? `Nog ${pilotRank.nextStars - totalStars} sterren tot de volgende rang.`
                    : 'Hoogste rang bereikt!'}
                </p>
              </div>
            </div>

            <div className="pt-5 mt-5 border-t border-slate-100 space-y-3">
              <button
                type="button"
                onClick={handleToggleUnlockAll}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {unlockAll ? <Unlock className="w-4 h-4 text-sky-600" /> : <Lock className="w-4 h-4 text-slate-500" />}
                  Alle levels vrijgeven (Oefenmodus)
                </span>
                <span className={unlockAll ? 'text-sky-700' : 'text-slate-400'}>
                  {unlockAll ? 'Aan' : 'Uit'}
                </span>
              </button>

              {(totalStars > 0 || stats.visitedPlaceIds.length > 0) && (
                <button
                  type="button"
                  onClick={handleResetProgress}
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {confirmReset ? 'Klik nogmaals om records te wissen' : 'Voortgang wissen'}
                </button>
              )}
            </div>
          </aside>
        </section>

        {/* 9-Level Progression Grid */}
        <section id="missies" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 font-display">
                9 Topografie-Missies
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Haal minstens 1 ster om het volgende level te ontgrendelen, of zet de oefenmodus aan.
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono-tabular">
              1 fout gekozen plek = +01:00 straftijd
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {ALL_LEVELS.map((level) => {
              const unlocked = isLevelUnlocked(level.id, progress, unlockAll);
              const rec = progress[level.id];
              const stars = rec?.stars ?? 0;

              return (
                <article
                  key={level.id}
                  className={`bg-white border rounded-2xl p-6 flex flex-col justify-between transition-colors ${
                    unlocked
                      ? 'border-slate-200 hover:border-sky-300'
                      : 'border-slate-200/70 opacity-70'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">Level {level.id}</span>
                        <span aria-hidden="true">·</span>
                        <span>{level.targetCount} opdrachten</span>
                        <span aria-hidden="true">·</span>
                        <span>{getVehicleLabel(level.vehicle)}</span>
                      </div>
                      <AircraftIcon vehicle={level.vehicle} className="w-6 h-6 shrink-0" />
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mt-2.5 font-display">
                      {level.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                      {level.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= stars
                                ? 'text-amber-500 fill-amber-400'
                                : 'text-slate-200 fill-slate-100'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="text-xs text-slate-500 font-mono-tabular mt-1">
                        {rec?.bestTotalTimeSec !== null && rec?.bestTotalTimeSec !== undefined
                          ? `Record: ${formatTime(rec.bestTotalTimeSec)}`
                          : `3★ ≤ ${formatTime(level.starThresholdsSec[0])}`}
                      </div>
                    </div>

                    {unlocked ? (
                      <button
                        type="button"
                        onClick={() => handleStartLevel(level.id)}
                        className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {stars > 0 ? 'Opnieuw' : 'Vliegen'}
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                        <Lock className="w-3.5 h-3.5" />
                        Haal Level {level.id - 1}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Prestaties (Badges & Milestones) */}
        <section id="prestaties" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 font-display">Prestaties</h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Verdien badges door mijlpalen te behalen tijdens je vluchten.
              </p>
            </div>
            <div className="text-xs text-slate-600 font-mono-tabular">
              {unlockedAchievementCount} / {achievements.length} badges behaald ·{' '}
              {stats.visitedPlaceIds.length} unieke locaties bezocht
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {achievements.map((badge) => {
              const pct = Math.round(
                (badge.progressCurrent / Math.max(1, badge.progressTarget)) * 100
              );

              const renderBadgeIcon = (id: AchievementId) => {
                const iconClass = `w-5 h-5 ${
                  badge.unlocked ? 'text-amber-600' : 'text-slate-400'
                }`;
                switch (id) {
                  case 'first_flight':
                    return <Compass className={iconClass} />;
                  case 'explorer_100':
                    return <MapPin className={iconClass} />;
                  case 'flawless_level':
                    return <Target className={iconClass} />;
                  case 'flawless_all':
                    return <ShieldCheck className={iconClass} />;
                  case 'nl_master':
                    return <Award className={iconClass} />;
                  case 'rocket_launch':
                    return <Rocket className={iconClass} />;
                  case 'stars_15':
                    return <Star className={iconClass} />;
                  case 'all_gold':
                    return <Trophy className={iconClass} />;
                }
              };

              return (
                <article
                  key={badge.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
                    badge.unlocked
                      ? 'bg-white border-amber-300 shadow-xs'
                      : 'bg-white/75 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                          badge.unlocked
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {renderBadgeIcon(badge.id)}
                      </div>

                      {badge.unlocked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Behaald
                        </span>
                      ) : (
                        <span className="text-xs font-mono-tabular text-slate-400 whitespace-nowrap">
                          {badge.progressCurrent}/{badge.progressTarget}
                        </span>
                      )}
                    </div>

                    <h3
                      className={`text-base font-bold mt-3.5 font-display ${
                        badge.unlocked ? 'text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      {badge.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {badge.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-transform duration-300 origin-left ${
                          badge.unlocked ? 'bg-amber-500' : 'bg-sky-600/70'
                        }`}
                        style={{ transform: `scaleX(${Math.max(0.02, pct / 100)})` }}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Beste Piloten (Leaderboard in localStorage) */}
        <section id="klassement" className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <Medal className="w-5 h-5 text-amber-500" />
                <h2 className="text-2xl font-bold text-slate-900 font-display">Beste Piloten</h2>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Klassement op basis van de laagste totale tijd over alle voltooide levels
                (opgeslagen in deze browser).
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setLeaderboardFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  leaderboardFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Alle piloten
              </button>
              <button
                type="button"
                onClick={() => setLeaderboardFilter('complete')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  leaderboardFilter === 'complete'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Alle 9 levels voltooid
              </button>
            </div>
          </div>

          {/* Active Pilot Name & Switch Player Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <form onSubmit={handleSavePilotName} className="flex flex-wrap items-center gap-2.5">
              <label htmlFor="pilot-name-input" className="text-xs font-semibold text-slate-700">
                Jouw pilootnaam:
              </label>
              <input
                id="pilot-name-input"
                type="text"
                maxLength={24}
                value={pilotNameInput}
                onChange={(e) => setPilotNameInput(e.target.value)}
                placeholder="Bijv. Emma"
                className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                Naam opslaan
              </button>
            </form>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNewPilotSession}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Start een nieuwe speler op dit apparaat zonder eerdere records te wissen"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Nieuwe speler
              </button>

              {leaderboard.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLeaderboard}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {confirmClearBoard ? 'Bevestig wissen' : 'Klassement wissen'}
                </button>
              )}
            </div>
          </div>

          {filteredLeaderboard.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-sm text-slate-500">
              {leaderboardFilter === 'complete'
                ? 'Nog niemand heeft alle 9 levels voltooid. Vlieg alle missies voor een plek in dit overzicht.'
                : 'Nog geen voltooide vluchten opgeslagen. Speel een level om op het klassement te komen.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2.5 pr-4 font-semibold">#</th>
                    <th className="py-2.5 pr-4 font-semibold">Piloot</th>
                    <th className="py-2.5 pr-4 font-semibold">Voltooide levels</th>
                    <th className="py-2.5 pr-4 font-semibold">Sterren</th>
                    <th className="py-2.5 pr-4 font-semibold">Strafpunten</th>
                    <th className="py-2.5 text-right font-semibold">Totale tijd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeaderboard.map((entry, idx) => {
                    const isCurrent = entry.id === activePilot.id;
                    const totalPenalties = Object.values(entry.levelBestPenalties).reduce(
                      (sum, p) => sum + p,
                      0
                    );
                    return (
                      <tr
                        key={entry.id}
                        className={isCurrent ? 'bg-sky-50/60' : 'hover:bg-slate-50/70'}
                      >
                        <td className="py-3 pr-4 font-mono-tabular font-bold text-slate-700">
                          {idx === 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <Trophy className="w-4 h-4" />1
                            </span>
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td className="py-3 pr-4 font-semibold text-slate-900">
                          {entry.pilotName}
                          {isCurrent && (
                            <span className="text-xs font-medium text-sky-700 ml-2">· Actief</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-mono-tabular text-slate-700">
                          {entry.completedLevels} / {ALL_LEVELS.length}
                        </td>
                        <td className="py-3 pr-4 font-mono-tabular text-slate-700">
                          {entry.totalStars} / {maxStars}
                        </td>
                        <td className="py-3 pr-4 font-mono-tabular text-slate-600">
                          {totalPenalties}
                        </td>
                        <td className="py-3 text-right font-mono-tabular font-bold text-slate-900">
                          {formatTime(entry.totalTimeSec)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Flight Rules & Controls Guide */}
        <section
          id="besturing"
          className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8"
        >
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-sky-600" />
            <h2 className="text-xl font-bold text-slate-900 font-display">
              Hoe werkt het vliegen?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-5 text-sm text-slate-600">
            <div>
              <h3 className="font-semibold text-slate-900">1. Besturen & Vliegen</h3>
              <p className="mt-1 leading-relaxed">
                Gebruik de pijltjestoetsen of WASD om te sturen (Shift voor extra snelheid), of klik
                ergens op de open kaart om erheen te vliegen.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">2. Oplichten & Kiezen</h3>
              <p className="mt-1 leading-relaxed">
                Kom je in de buurt van een stad, rivier, bergketen of oceaan, dan licht die plek
                op. Druk op Spatie of klik op het verlichte punt om te kiezen.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">3. Tijd, Straf & Inzoomen</h3>
              <p className="mt-1 leading-relaxed">
                Kies je een verkeerde plek, dan krijg je 1 strafminuut bij je tijd. Met het
                vliegtuig en de raket zoomt de kaart dichterbij in en helpt de overzichtskaart rechtsonder.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>TopoVlucht · Open topografische oefenkaarten</span>
          <span>Kaartgegevens © OpenStreetMap-bijdragers · © Esri</span>
        </div>
      </footer>
    </div>
  );
}
