import React, { useEffect, useState } from 'react';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Gamepad2,
  Gift,
  PlaySquare,
  ShieldCheck,
  Target,
  Tv,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { TaskItem, UserProfile } from '../types';

interface TasksTabProps {
  tasks: TaskItem[];
  initialPartnerFilter?: string | null;
  onClearPartnerFilter: () => void;
  onTaskCompleted: (user: UserProfile, rewardCoins: number, taskTitle: string) => void;
  activeTaskModal: TaskItem | null;
  onSetActiveTaskModal: (task: TaskItem | null) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All Tasks' },
  { id: 'sponsored_ad', label: 'Sponsored Ads' },
  { id: 'partner_offer', label: 'Partner Offers' },
  { id: 'daily_checkin', label: 'Daily Check-In' },
  { id: 'partner_game', label: 'Partner Games' },
  { id: 'daily_challenge', label: 'Daily Challenges' },
  { id: 'featured', label: 'Super & Mega' },
] as const;

function getCategoryLabel(cat: TaskItem['category']): string {
  switch (cat) {
    case 'sponsored_ad':
      return 'Sponsored Ad';
    case 'partner_offer':
      return 'Partner Offer';
    case 'daily_checkin':
      return 'Daily Check-In';
    case 'partner_game':
      return 'Partner Game';
    case 'daily_challenge':
      return 'Daily Challenge';
    case 'super_offer':
      return 'Super Offer';
    case 'mega_offer':
      return 'Mega Offer';
  }
}

function getCategoryIcon(cat: TaskItem['category']) {
  switch (cat) {
    case 'sponsored_ad':
      return Tv;
    case 'partner_offer':
      return Gift;
    case 'daily_checkin':
      return CalendarCheck2;
    case 'partner_game':
      return Gamepad2;
    case 'daily_challenge':
      return Target;
    default:
      return PlaySquare;
  }
}

export function TasksTab({
  tasks,
  initialPartnerFilter,
  onClearPartnerFilter,
  onTaskCompleted,
  activeTaskModal,
  onSetActiveTaskModal,
}: TasksTabProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [taskStatusMsg, setTaskStatusMsg] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredTasks = tasks.filter((t) => {
    if (initialPartnerFilter && t.partner_name !== initialPartnerFilter) {
      return false;
    }
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'featured') {
      return t.category === 'super_offer' || t.category === 'mega_offer';
    }
    return t.category === categoryFilter;
  });

  useEffect(() => {
    if (!activeTaskModal) {
      setSessionToken(null);
      setSecondsLeft(0);
      setTaskError(null);
      setTaskStatusMsg(null);
      return;
    }

    let cancelled = false;
    setTaskError(null);
    setTaskStatusMsg('Initializing verified task session...');

    api
      .startTask(activeTaskModal.id)
      .then((res) => {
        if (cancelled) return;
        setSessionToken(res.sessionToken);
        setSecondsLeft(res.requiredSeconds);
        setTaskStatusMsg('Keep this window open until the verification timer completes.');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTaskError(err instanceof Error ? err.message : 'Unable to start task.');
      });

    return () => {
      cancelled = true;
    };
  }, [activeTaskModal]);

  useEffect(() => {
    if (!activeTaskModal || !sessionToken || secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTaskModal, sessionToken, secondsLeft]);

  async function handleClaimReward() {
    if (!activeTaskModal || !sessionToken) return;
    setSubmitting(true);
    setTaskError(null);
    try {
      const res = await api.completeTask(activeTaskModal.id, sessionToken);
      onTaskCompleted(res.user, res.rewardCoins, activeTaskModal.title);
      onSetActiveTaskModal(null);
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : 'Failed to claim reward.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Earn Coins via Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">
            Every task reward is verified by the server upon timer completion.
          </p>
        </div>

        {initialPartnerFilter && (
          <button
            type="button"
            onClick={onClearPartnerFilter}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-indigo-100 cursor-pointer"
          >
            <span>Partner: {initialPartnerFilter}</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Interactive Category Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryFilter(cat.id)}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              categoryFilter === cat.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Tasks Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center">
          <p className="text-sm font-semibold text-slate-900">No tasks match the current filter.</p>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('all');
              onClearPartnerFilter();
            }}
            className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map((task) => {
            const Icon = getCategoryIcon(task.category);
            return (
              <div
                key={task.id}
                className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          {getCategoryLabel(task.category)} · {task.partner_name} · {task.duration_seconds}s
                        </p>
                        <h3 className="font-display text-base font-bold text-slate-900 mt-0.5 leading-snug">
                          {task.title}
                        </h3>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-base font-bold text-amber-600 tabular-nums">
                        +{task.reward_coins}
                      </span>
                      <p className="text-[11px] text-slate-500">Coins</p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-600 leading-relaxed">{task.description}</p>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                    <strong className="text-slate-700 font-medium">Instructions:</strong>{' '}
                    {task.instructions}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    {task.completed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">
                          {task.cooldown_hours === 0 ? 'Completed' : 'Completed Today'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{task.cooldown_hours === 0 ? 'One-time offer' : 'Repeatable daily'}</span>
                      </>
                    )}
                  </span>

                  <button
                    type="button"
                    disabled={task.completed}
                    onClick={() => onSetActiveTaskModal(task)}
                    className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      task.completed
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-95'
                    }`}
                  >
                    {task.completed ? 'Reward Claimed' : 'Start Task'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Task Verification Modal */}
      {activeTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-indigo-600">
                  {getCategoryLabel(activeTaskModal.category)} · {activeTaskModal.partner_name}
                </p>
                <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                  {activeTaskModal.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onSetActiveTaskModal(null)}
                aria-label="Close task modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
              <p className="text-sm text-slate-700">{activeTaskModal.instructions}</p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-xs text-slate-500">
                <span>Verified Payout</span>
                <span className="font-mono font-bold text-amber-600 tabular-nums">
                  +{activeTaskModal.reward_coins} Coins
                </span>
              </div>
            </div>

            {taskError ? (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {taskError}
              </div>
            ) : (
              <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                  <p className="text-xs sm:text-sm text-indigo-900">
                    {secondsLeft > 0
                      ? taskStatusMsg
                      : 'Verification timer complete. Ready to claim coins!'}
                  </p>
                </div>
                <span className="font-mono text-xl font-bold text-indigo-700 tabular-nums shrink-0">
                  {secondsLeft}s
                </span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSetActiveTaskModal(null)}
                className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!sessionToken || secondsLeft > 0 || submitting || Boolean(taskError)}
                onClick={handleClaimReward}
                className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm disabled:opacity-50 cursor-pointer"
              >
                {submitting
                  ? 'Verifying...'
                  : secondsLeft > 0
                  ? `Wait ${secondsLeft}s`
                  : `Claim +${activeTaskModal.reward_coins} Coins`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
