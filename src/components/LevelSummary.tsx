import React from 'react';
import { ArrowRight, CheckCircle2, RotateCcw, Star, Trophy, XCircle } from 'lucide-react';
import { AnswerLog, LevelConfig } from '../types/game';
import { formatTime } from '../utils/geo';
import { AircraftIcon } from './AircraftSprite';
import { getVehicleLabel } from '../data/levels';

interface LevelSummaryProps {
  level: LevelConfig;
  flightTimeSec: number;
  penalties: number;
  totalTimeSec: number;
  starsEarned: 1 | 2 | 3;
  isNewBest: boolean;
  logs: AnswerLog[];
  hasNextLevel: boolean;
  onReplay: () => void;
  onNextLevel: () => void;
  onBackToMenu: () => void;
}

export const LevelSummary: React.FC<LevelSummaryProps> = ({
  level,
  flightTimeSec,
  penalties,
  totalTimeSec,
  starsEarned,
  isNewBest,
  logs,
  hasNextLevel,
  onReplay,
  onNextLevel,
  onBackToMenu,
}) => {
  const firstTryCount = logs.filter((l) => l.mistakesOnThisTarget === 0).length;
  const accuracyPct = logs.length > 0 ? Math.round((firstTryCount / logs.length) * 100) : 100;

  return (
    <div className="min-h-screen bg-[#F4F7FA] py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Main Result Card */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
                <span>Level {level.id} voltooid</span>
                <span aria-hidden="true">·</span>
                <span>{level.regionLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{getVehicleLabel(level.vehicle)}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 font-display">
                {level.title}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {[1, 2, 3].map((idx) => (
                <Star
                  key={idx}
                  className={`w-8 h-8 ${
                    idx <= starsEarned
                      ? 'text-amber-500 fill-amber-400'
                      : 'text-slate-200 fill-slate-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Quantitative Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">Vliegtijd</div>
              <div className="font-mono-tabular text-2xl font-bold text-slate-900 mt-1">
                {formatTime(flightTimeSec)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Strafpunten ({penalties}x)</div>
              <div
                className={`font-mono-tabular text-2xl font-bold mt-1 ${
                  penalties > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                +{penalties}:00
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <span>Eindtijd</span>
                {isNewBest && (
                  <span className="text-amber-600 font-semibold inline-flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5" /> Record
                  </span>
                )}
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-sky-700 mt-1">
                {formatTime(totalTimeSec)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Direct goed</div>
              <div className="font-mono-tabular text-2xl font-bold text-slate-900 mt-1">
                {firstTryCount}/{logs.length}{' '}
                <span className="text-sm font-medium text-slate-500">({accuracyPct}%)</span>
              </div>
            </div>
          </div>

          {/* Star Threshold Guide & Actions */}
          <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
                <AircraftIcon vehicle={level.vehicle} className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-800">Tijdnormen (incl. straftijd)</div>
                <div className="font-mono-tabular text-slate-500 mt-0.5">
                  3★ ≤ {formatTime(level.starThresholdsSec[0])} · 2★ ≤{' '}
                  {formatTime(level.starThresholdsSec[1])} · 1★ ≤{' '}
                  {formatTime(level.starThresholdsSec[2])}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onReplay}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                Opnieuw vliegen
              </button>
              <button
                type="button"
                onClick={onBackToMenu}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm cursor-pointer whitespace-nowrap"
              >
                Alle levels
              </button>
              {hasNextLevel && (
                <button
                  type="button"
                  onClick={onNextLevel}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  Volgend level
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Flight Log Review */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 font-display">Vluchtlogboek</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Overzicht van alle {logs.length} opdrachten uit deze vlucht.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4 font-semibold">#</th>
                  <th className="py-2.5 pr-4 font-semibold">Plek</th>
                  <th className="py-2.5 pr-4 font-semibold">Resultaat</th>
                  <th className="py-2.5 text-right font-semibold">Tijd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((entry, idx) => (
                  <tr key={entry.placeId} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-4 font-mono-tabular text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 pr-4 font-semibold text-slate-800">{entry.placeName}</td>
                    <td className="py-2.5 pr-4">
                      {entry.mistakesOnThisTarget === 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Direct goed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
                          <XCircle className="w-4 h-4" />
                          {entry.mistakesOnThisTarget}x mis ({entry.wrongGuesses.join(', ')})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-mono-tabular text-slate-600">
                      {formatTime(entry.timeTakenSec)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
