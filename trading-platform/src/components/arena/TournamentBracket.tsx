'use client';

import { useArenaStore } from '@/stores/arenaStore';
import type { BotGroupName } from '@/types/arena';
import { Crown, Dna, Swords, ChevronRight, Zap } from 'lucide-react';

const GROUP_COLORS: Record<BotGroupName, { text: string; bg: string; border: string; bar: string }> = {
  Alpha: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', bar: 'bg-blue-500' },
  Beta: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', bar: 'bg-green-500' },
  Gamma: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', bar: 'bg-amber-500' },
};

function GroupStage({ groupName }: { groupName: BotGroupName }) {
  const bots = useArenaStore(state => state.bots.filter(b => b.groupName === groupName));
  const entries = useArenaStore(state => state.leaderboard.filter(e => e.groupName === groupName));
  const colors = GROUP_COLORS[groupName];

  // Top 3 from this group (elites that will survive evolution)
  const top3 = entries.slice(0, 3);
  const eliminated = entries.slice(3);

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${colors.bar}`} />
        <span className={`text-xs font-bold ${colors.text}`}>{groupName}</span>
        <span className="text-[9px] text-gray-500">{bots.length} bots</span>
      </div>

      {/* Survivors (elites) */}
      <div className="space-y-1 mb-2">
        {top3.map((entry, i) => (
          <div key={entry.botId} className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800/60">
            <span className={`text-[9px] font-bold w-3 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : 'text-amber-700'}`}>
              {i + 1}
            </span>
            <span className="text-[10px] text-white truncate flex-1">{entry.botName}</span>
            <span className={`text-[9px] font-mono ${entry.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {entry.totalPnLPercent >= 0 ? '+' : ''}{entry.totalPnLPercent.toFixed(1)}%
            </span>
            {i < 2 && <Crown className="w-2.5 h-2.5 text-amber-400/60" />}
          </div>
        ))}
      </div>

      {/* Eliminated / to be replaced */}
      {eliminated.length > 0 && (
        <div className="border-t border-gray-700/50 pt-1.5 mt-1.5">
          <div className="text-[8px] text-gray-500 mb-1">Replaced by offspring</div>
          {eliminated.map(entry => (
            <div key={entry.botId} className="flex items-center gap-1.5 px-2 py-0.5 opacity-40">
              <span className="text-[10px] text-gray-400 truncate flex-1 line-through">{entry.botName}</span>
              <span className={`text-[9px] font-mono ${entry.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {entry.totalPnLPercent >= 0 ? '+' : ''}{entry.totalPnLPercent.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TournamentBracket() {
  const { tournament, status, evolutionHistory, masterBot } = useArenaStore();
  const leaderboard = useArenaStore(s => s.leaderboard);
  const generation = status?.generation ?? 0;

  const isRunning = tournament?.status === 'running';
  const isComplete = tournament?.status === 'completed';

  // Overall top 3 across all groups
  const overallTop3 = leaderboard.slice(0, 3);
  const champion = overallTop3[0];

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Swords className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-bold text-white">Tournament Bracket</span>
        <span className="text-xs text-gray-500">Gen {generation}</span>
        {isRunning && (
          <span className="text-[10px] text-green-400 font-medium ml-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Round {tournament?.currentRound}/{tournament?.totalRounds}
          </span>
        )}
      </div>

      <div className="flex items-stretch gap-3">
        {/* Group Stages */}
        <div className="flex-1 space-y-2">
          <div className="text-[10px] text-gray-500 font-medium text-center mb-1">Group Stage</div>
          {(['Alpha', 'Beta', 'Gamma'] as BotGroupName[]).map(name => (
            <GroupStage key={name} groupName={name} />
          ))}
        </div>

        {/* Arrow connector */}
        <div className="flex flex-col items-center justify-center w-8">
          <div className="h-full flex flex-col items-center justify-center gap-1">
            <div className="w-px h-8 bg-gray-700" />
            <ChevronRight className="w-4 h-4 text-gray-600" />
            <div className="text-[8px] text-gray-500 writing-mode-vertical rotate-0">
              {isComplete ? 'EVOLVE' : isRunning ? 'COMPETING' : 'READY'}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
            <div className="w-px h-8 bg-gray-700" />
          </div>
        </div>

        {/* Evolution + Champion column */}
        <div className="w-40 flex flex-col gap-2">
          {/* Evolution cycle */}
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 flex-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Dna className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-bold text-purple-300">Evolution</span>
            </div>

            {evolutionHistory.length > 0 ? (
              <div className="space-y-1.5">
                {evolutionHistory.map((result, i) => {
                  const improvement = result.avgFitnessAfter - result.avgFitnessBefore;
                  return (
                    <div key={i} className="text-[9px] flex items-center justify-between">
                      <span className={GROUP_COLORS[result.groupName].text}>{result.groupName}</span>
                      <span className={improvement >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {improvement >= 0 ? '+' : ''}{(improvement * 100).toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[9px] text-gray-500 text-center py-2">
                Awaiting first evolution
              </div>
            )}
          </div>

          {/* Champion */}
          <div className={`rounded-lg border p-3 ${champion ? 'border-amber-500/40 bg-amber-500/5' : 'border-gray-700 bg-gray-800/30'}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-300">Champion</span>
            </div>

            {champion ? (
              <div>
                <div className="text-xs font-bold text-white">{champion.botName}</div>
                <div className={`text-[10px] ${GROUP_COLORS[champion.groupName].text}`}>
                  {champion.groupName} | {champion.symbol}
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <div>
                    <div className="text-[8px] text-gray-500">P&L</div>
                    <div className={`text-xs font-bold font-mono ${champion.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {champion.totalPnLPercent >= 0 ? '+' : ''}{champion.totalPnLPercent.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-500">Fitness</div>
                    <div className="text-xs font-bold font-mono text-purple-400">
                      {(champion.fitness * 100).toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[9px] text-gray-500 text-center py-2">
                Start a tournament
              </div>
            )}
          </div>

          {/* Master Bot indicator */}
          {masterBot && (
            <div className="rounded-lg border border-amber-600/20 bg-amber-900/10 p-2 text-center">
              <Zap className="w-3 h-3 text-amber-400 mx-auto mb-1" />
              <div className="text-[9px] text-amber-300 font-medium">Master Bot Active</div>
              <div className="text-[8px] text-gray-500">Gen {masterBot.generation}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
