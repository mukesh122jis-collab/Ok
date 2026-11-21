import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, Crown, Megaphone, Pin, Trophy } from 'lucide-react';
import { api } from '../api';
import type { CommunityData } from '../types';

export function CommunityTab() {
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getCommunity()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Unable to load community feed.')
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Loading community leaderboard & announcements...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 rounded-3xl border border-red-200 p-6 text-sm text-red-700">
        {error || 'Unable to load community data.'}
      </div>
    );
  }

  const topThree = data.leaderboard.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Community & Leaderboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Top earners, unlocked milestones, and verified platform announcements.
        </p>
      </div>

      {/* Top 3 Earners Spotlight */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {topThree.map((member) => {
          const isFirst = member.rank === 1;
          return (
            <div
              key={member.id}
              className={`rounded-3xl p-5 flex items-center gap-4 border ${
                isFirst
                  ? 'bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-600 text-white border-transparent'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="relative shrink-0">
                <img
                  src={
                    member.avatarUrl ||
                    '/src/assets/images/avatar_default_member_1795267685073.jpg'
                  }
                  alt={member.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-2xl object-cover border border-white/20"
                />
                <span
                  className={`absolute -top-2 -right-2 w-6 h-6 rounded-lg font-mono text-xs font-bold flex items-center justify-center ${
                    isFirst ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-white'
                  }`}
                >
                  #{member.rank}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-base truncate flex items-center gap-1.5">
                  <span className="truncate">{member.name}</span>
                  {isFirst && <Crown className="w-4 h-4 text-amber-300 shrink-0" />}
                </p>
                <p
                  className={`font-mono text-sm font-bold tabular-nums mt-0.5 ${
                    isFirst ? 'text-amber-300' : 'text-indigo-600'
                  }`}
                >
                  {member.lifetimeCoins.toLocaleString()} Coins
                </p>
                <p className={`text-xs mt-0.5 tabular-nums ${isFirst ? 'text-indigo-100' : 'text-slate-500'}`}>
                  {member.streakDays}-day streak
                </p>
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Leaderboard Table */}
        <section className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2 className="font-display text-base font-bold text-slate-900">
                Lifetime Coin Leaderboard
              </h2>
            </div>
            <span className="text-xs text-slate-500">Top {data.leaderboard.length} Members</span>
          </div>

          <div className="divide-y divide-slate-100">
            {data.leaderboard.map((entry) => (
              <div
                key={entry.id}
                className={`px-5 py-3.5 flex items-center justify-between gap-4 ${
                  entry.isCurrentUser ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-6 font-mono text-sm font-bold text-slate-500 tabular-nums shrink-0">
                    #{entry.rank}
                  </span>
                  <img
                    src={
                      entry.avatarUrl ||
                      '/src/assets/images/avatar_default_member_1795267685073.jpg'
                    }
                    alt={entry.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-xl object-cover shrink-0 bg-slate-100"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {entry.name}
                      {entry.isCurrentUser && (
                        <span className="text-xs font-medium text-indigo-600 ml-2">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {entry.streakDays} day streak
                    </p>
                  </div>
                </div>

                <span className="font-mono text-sm font-bold text-slate-900 tabular-nums shrink-0">
                  {entry.lifetimeCoins.toLocaleString()} Coins
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Right Column: Achievements & Announcements */}
        <div className="lg:col-span-5 space-y-6">
          {/* User Achievements */}
          <section className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <h2 className="font-display text-base font-bold text-slate-900">Your Achievements</h2>
            </div>
            <div className="space-y-3">
              {data.achievements.map((ach) => (
                <div
                  key={ach.id}
                  className={`p-3.5 rounded-2xl border ${
                    ach.unlocked
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        <span>{ach.title}</span>
                        {ach.unlocked && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{ach.description}</p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums shrink-0">
                      {ach.progress}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Community Announcements */}
          <section className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-orange-500" />
              <h2 className="font-display text-base font-bold text-slate-900">
                Community Announcements
              </h2>
            </div>

            {data.announcements.length === 0 ? (
              <p className="text-xs text-slate-500">No announcements posted yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.announcements.map((ann) => (
                  <article key={ann.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                      <span className="font-medium text-indigo-600 flex items-center gap-1">
                        {ann.is_pinned === 1 && <Pin className="w-3 h-3" />}
                        {ann.category}
                      </span>
                      <span>{new Date(ann.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-display text-sm font-bold text-slate-900">{ann.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                      {ann.body}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
