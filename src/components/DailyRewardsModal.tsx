import React, { useEffect, useState } from 'react';
import { CalendarCheck2, Disc3, Gift, History, Trophy, X } from 'lucide-react';
import { api } from '../api';
import type { RewardsStatus, UserProfile } from '../types';

interface DailyRewardsModalProps {
  open: boolean;
  onClose: () => void;
  onBalanceUpdated: (user: UserProfile, toastMessage: string) => void;
}

export function DailyRewardsModal({
  open,
  onClose,
  onBalanceUpdated,
}: DailyRewardsModalProps) {
  const [status, setStatus] = useState<RewardsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRewardsStatus();
      setStatus(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load daily rewards.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setSpinResult(null);
      loadStatus();
    }
  }, [open]);

  if (!open) return null;

  async function handleCheckin() {
    setError(null);
    try {
      const res = await api.dailyCheckin();
      const bonusMsg =
        res.weeklyMilestoneAwarded > 0
          ? ` + ${res.weeklyMilestoneAwarded} Weekly Milestone!`
          : '';
      onBalanceUpdated(
        res.user,
        `Day ${res.streakDays} Check-In: +${res.checkinReward} Coins${bonusMsg}`
      );
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Daily check-in failed.');
    }
  }

  async function handleSpin() {
    if (!status || status.spunToday || spinning) return;
    setError(null);
    setSpinning(true);
    setSpinResult(null);
    try {
      const res = await api.spinWheel();
      const segCount = status.spinSegments.length;
      const sliceDeg = 360 / segCount;
      // Target slice center under top pointer (0 deg)
      const targetAngle = 360 - (res.segmentIndex * sliceDeg + sliceDeg / 2);
      const nextRotation = wheelRotation + 360 * 5 + targetAngle - (wheelRotation % 360);
      setWheelRotation(nextRotation);

      setTimeout(async () => {
        setSpinning(false);
        setSpinResult(`You won +${res.rewardCoins} Coins!`);
        onBalanceUpdated(res.user, `Daily Spin Wheel: +${res.rewardCoins} Coins`);
        await loadStatus();
      }, 3100);
    } catch (err: unknown) {
      setSpinning(false);
      setError(err instanceof Error ? err.message : 'Unable to spin wheel.');
    }
  }

  const segments = status?.spinSegments || [];
  const sliceAngle = segments.length > 0 ? 360 / segments.length : 60;
  const streakCycle =
    status && status.streakDays > 0 ? ((status.streakDays - 1) % 7) + 1 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Daily Rewards & Spin Wheel
              </h2>
              <p className="text-xs text-slate-500">
                Daily check-in bonuses, 7-day milestones, and transparent wheel odds
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Daily Rewards"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !status ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading daily rewards...</div>
        ) : (
          status && (
            <>
              {/* Daily Check-In + 7-Day Weekly Milestone */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Daily Check-In & Weekly Milestone
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      Current streak: {status.streakDays} days · Day 7 unlocks +{status.weeklyMilestoneBonus} bonus coins
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={status.checkedInToday}
                    onClick={handleCheckin}
                    className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer ${
                      status.checkedInToday
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    <CalendarCheck2 className="w-4 h-4" />
                    <span>
                      {status.checkedInToday
                        ? 'Checked In Today'
                        : `Check In (+${status.dailyCheckinBase}+)`}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                    const completed = day <= streakCycle;
                    const dayReward =
                      status.dailyCheckinBase + (day - 1) * 10 + (day === 7 ? status.weeklyMilestoneBonus : 0);
                    return (
                      <div
                        key={day}
                        className={`rounded-xl p-2 text-center border ${
                          completed
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        <p className="text-[11px] font-medium">D{day}</p>
                        <p className="font-mono text-xs font-bold tabular-nums mt-0.5">+{dayReward}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Daily Spin Wheel + Transparent Odds */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                <div className="md:col-span-6 flex flex-col items-center">
                  <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
                    {/* Top Pointer */}
                    <div className="absolute -top-2 z-20 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-slate-900" />

                    <svg
                      viewBox="0 0 200 200"
                      className="w-full h-full drop-shadow-md"
                      style={{
                        transform: `rotate(${wheelRotation}deg)`,
                        transition: spinning
                          ? 'transform 3s cubic-bezier(0.16, 1, 0.3, 1)'
                          : 'none',
                      }}
                    >
                      {segments.map((seg, i) => {
                        const startAngle = (i * sliceAngle - 90) * (Math.PI / 180);
                        const endAngle = ((i + 1) * sliceAngle - 90) * (Math.PI / 180);
                        const x1 = 100 + 95 * Math.cos(startAngle);
                        const y1 = 100 + 95 * Math.sin(startAngle);
                        const x2 = 100 + 95 * Math.cos(endAngle);
                        const y2 = 100 + 95 * Math.sin(endAngle);
                        const midAngle = (i * sliceAngle + sliceAngle / 2 - 90) * (Math.PI / 180);
                        const tx = 100 + 62 * Math.cos(midAngle);
                        const ty = 100 + 62 * Math.sin(midAngle);

                        return (
                          <g key={seg.label}>
                            <path
                              d={`M100,100 L${x1},${y1} A95,95 0 0,1 ${x2},${y2} Z`}
                              fill={seg.color}
                              stroke="#FFFFFF"
                              strokeWidth="2"
                            />
                            <text
                              x={tx}
                              y={ty}
                              fill="#FFFFFF"
                              fontSize="11"
                              fontWeight="700"
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              {seg.coins}
                            </text>
                          </g>
                        );
                      })}
                      <circle cx="100" cy="100" r="18" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
                    </svg>
                  </div>

                  {spinResult && (
                    <p className="mt-3 text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      {spinResult}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={status.spunToday || spinning}
                    onClick={handleSpin}
                    className="mt-4 min-h-[48px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Disc3 className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
                    <span>
                      {spinning
                        ? 'Spinning...'
                        : status.spunToday
                        ? 'Daily Spin Used'
                        : 'Spin Daily Wheel'}
                    </span>
                  </button>
                </div>

                {/* Transparent Probability Table */}
                <div className="md:col-span-6 rounded-2xl border border-slate-200 p-4 space-y-3">
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Spin Wheel Odds (Server-Selected)
                  </h3>
                  <div className="divide-y divide-slate-100">
                    {segments.map((seg) => (
                      <div
                        key={seg.label}
                        className="py-2 flex items-center justify-between text-xs sm:text-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: seg.color }}
                          />
                          <span className="font-medium text-slate-800">{seg.label}</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-600 tabular-nums">
                          {seg.probability}% chance
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reward History */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <History className="w-4 h-4 text-slate-500" />
                  <span>Recent Reward History</span>
                </div>
                {status.history.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3">
                    No rewards recorded yet. Complete your first daily check-in or spin!
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {status.history.slice(0, 8).map((item) => (
                      <div
                        key={item.id}
                        className="px-4 py-3 flex items-center justify-between gap-4 text-xs sm:text-sm bg-white"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{item.description}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-emerald-600 tabular-nums shrink-0">
                          +{item.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
