import { useMemo, useState } from 'react';
import {
  Compass,
  Lock,
  Play,
  RotateCcw,
  Star,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ALL_LEVELS, getLevelById, getVehicleLabel } from './data/levels';
import { AnswerLog, GameScreen, LevelConfig, ProgressMap } from './types/game';
import {
  calculateStars,
  getRankForStars,
  getTotalStars,
  isLevelUnlocked,
  loadProgress,
  loadUnlockAll,
  saveProgress,
  saveUnlockAll,
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
  const [unlockAll, setUnlockAll] = useState<boolean>(() => loadUnlockAll());
  const [muted, setMuted] = useState<boolean>(false);
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const totalStars = useMemo(() => getTotalStars(progress), [progress]);
  const maxStars = ALL_LEVELS.length * 3;
  const pilotRank = useMemo(() => getRankForStars(totalStars), [totalStars]);

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

  const handleResetProgress = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setProgress({});
    saveProgress({});
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
              href="#rangen"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Rangen & Sterren
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

              {totalStars > 0 && (
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
