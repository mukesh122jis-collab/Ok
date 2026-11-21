import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  Coins,
  Copy,
  Disc3,
  Flame,
  Gift,
  Handshake,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import type { AppTab, DashboardData, TaskItem } from '../types';

interface HomeTabProps {
  dashboard: DashboardData;
  onNavigateTab: (tab: AppTab, partnerFilter?: string) => void;
  onOpenDailyRewards: () => void;
  onOpenReferrals: () => void;
  onLaunchTask: (task: TaskItem) => void;
  onQuickCheckin: () => Promise<void>;
  checkinLoading: boolean;
}

export function HomeTab({
  dashboard,
  onNavigateTab,
  onOpenDailyRewards,
  onOpenReferrals,
  onLaunchTask,
  onQuickCheckin,
  checkinLoading,
}: HomeTabProps) {
  const { user, tasks, partners, dailyStatus, settings } = dashboard;
  const [copiedCode, setCopiedCode] = useState(false);

  const firstName = user.name.split(' ')[0] || user.name;
  const inrValue = (user.coin_balance / settings.coinsPerInr).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const superOffer = tasks.find((t) => t.category === 'super_offer') || tasks[0];
  const megaOffer = tasks.find((t) => t.category === 'mega_offer') || tasks[1];

  const streakCycle = dailyStatus.streakDays === 0 ? 0 : ((dailyStatus.streakDays - 1) % 7) + 1;

  function handleCopyCode() {
    navigator.clipboard?.writeText(user.referral_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  }

  return (
    <div className="space-y-6">
      {/* Greeting Header Row */}
      <section className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={() => onNavigateTab('profile')}
            aria-label="Open Profile"
            className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 bg-indigo-50 shrink-0 hover:ring-2 hover:ring-indigo-500 transition-all cursor-pointer"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="w-full h-full flex items-center justify-center font-display font-bold text-indigo-700">
                {firstName.charAt(0).toUpperCase()}
              </span>
            )}
          </button>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">
              {user.streak_days > 0 ? `${user.streak_days}-day active streak` : 'Welcome to RewardX'}
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 truncate">
              Hi, {firstName}!
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenDailyRewards}
          aria-label="Open Daily Rewards and Spin Wheel"
          className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold text-sm flex items-center gap-2 shadow-sm hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer shrink-0"
        >
          <Gift className="w-5 h-5" />
          <span className="hidden sm:inline whitespace-nowrap">Daily Rewards</span>
        </button>
      </section>

      {/* Main Balance Hero + Refer & Daily Win Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Prominent Total Coins Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="lg:col-span-7 relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-600 text-white p-6 sm:p-7 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-indigo-100">Total Coins Balance</p>
              <div className="mt-2 flex items-baseline gap-2.5">
                <Coins className="w-7 h-7 text-amber-300 shrink-0 self-center" />
                <span className="font-display text-4xl sm:text-5xl font-extrabold tabular-nums tracking-tight">
                  {user.coin_balance.toLocaleString()}
                </span>
                <span className="text-sm font-semibold text-amber-200">Coins</span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-indigo-100 tabular-nums">
                Estimated value: <strong className="text-white">₹{inrValue} INR</strong>
                {user.pending_coins > 0 && (
                  <span> · {user.pending_coins.toLocaleString('en-IN')} Coins pending payout</span>
                )}
              </p>
            </div>

            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-xs text-indigo-200">Lifetime Earned</span>
              <span className="font-mono text-lg font-bold tabular-nums mt-0.5">
                {user.lifetime_coins.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="mt-7 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-indigo-100 tabular-nums">
              {settings.coinsPerInr.toLocaleString('en-IN')} Coins = ₹1.00 INR · Min payout{' '}
              {settings.minWithdrawalCoins.toLocaleString('en-IN')} Coins (₹
              {(settings.minWithdrawalCoins / settings.coinsPerInr).toLocaleString('en-IN')})
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('wallet')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-indigo-700 font-semibold text-sm flex items-center gap-2 hover:bg-indigo-50 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
            >
              <Wallet className="w-4 h-4" />
              <span>Go to Wallet</span>
            </button>
          </div>
        </motion.div>

        {/* Right Stack: Refer & Earn + Daily Win */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          {/* Refer & Earn Card */}
          <div className="rounded-3xl bg-white border border-slate-200 p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-orange-600">Refer & Earn</p>
                <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                  Invite friends for +{settings.referralRewardReferrer} Coins
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Friends also receive +{settings.referralRewardReferee} bonus coins on signup.
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-mono text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="truncate">{user.referral_code}</span>
                {copiedCode ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-500 shrink-0" />
                )}
              </button>
              <button
                type="button"
                onClick={onOpenReferrals}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
              >
                Share & Track
              </button>
            </div>
          </div>

          {/* Daily Win Rewards Card */}
          <div className="rounded-3xl bg-white border border-slate-200 p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-indigo-600">Daily Win Rewards</p>
                <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                  Check-In & Spin Wheel
                </h2>
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  Weekly 7-day milestone: {streakCycle}/7 days (+{settings.weeklyMilestoneBonus} Coins)
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${(streakCycle / 7) * 100}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={dailyStatus.checkedInToday || checkinLoading}
                onClick={onQuickCheckin}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  dailyStatus.checkedInToday
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <CalendarCheck2 className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {dailyStatus.checkedInToday ? 'Checked In' : checkinLoading ? 'Claiming...' : 'Daily Check-In'}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenDailyRewards}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Disc3 className="w-4 h-4 shrink-0" />
                <span className="truncate">{dailyStatus.spunToday ? 'View Rewards' : 'Spin & Win'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Super Offer & Mega Offer Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {superOffer && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white p-6 flex flex-col justify-between min-h-[210px]">
            <img
              src="/src/assets/images/offer_super_gaming_1795267684849.jpg"
              alt={superOffer.title}
              referrerPolicy="no-referrer"
              className="absolute right-0 bottom-0 w-44 h-36 object-cover opacity-35 rounded-tl-3xl pointer-events-none"
            />
            <div className="relative z-10 max-w-sm">
              <p className="text-xs font-semibold text-blue-200">
                Super Offer · {superOffer.partner_name}
              </p>
              <h3 className="font-display text-xl font-bold mt-1 leading-snug">
                {superOffer.title}
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-1.5 line-clamp-2">
                {superOffer.description}
              </p>
            </div>
            <div className="relative z-10 mt-6 flex items-center justify-between gap-3">
              <span className="font-mono text-lg font-bold text-amber-300 tabular-nums">
                +{superOffer.reward_coins.toLocaleString()} Coins
              </span>
              <button
                type="button"
                disabled={superOffer.completed}
                onClick={() => onLaunchTask(superOffer)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  superOffer.completed
                    ? 'bg-white/20 text-white cursor-default'
                    : 'bg-white text-indigo-700 hover:bg-blue-50'
                }`}
              >
                <span>{superOffer.completed ? 'Completed' : 'Claim Super Offer'}</span>
                {!superOffer.completed && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {megaOffer && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 text-white p-6 flex flex-col justify-between min-h-[210px]">
            <img
              src="/src/assets/images/offer_mega_vault_1795267684760.jpg"
              alt={megaOffer.title}
              referrerPolicy="no-referrer"
              className="absolute right-0 bottom-0 w-44 h-36 object-cover opacity-35 rounded-tl-3xl pointer-events-none"
            />
            <div className="relative z-10 max-w-sm">
              <p className="text-xs font-semibold text-amber-950/80">
                Mega Offer · {megaOffer.partner_name}
              </p>
              <h3 className="font-display text-xl font-bold mt-1 text-slate-950 leading-snug">
                {megaOffer.title}
              </h3>
              <p className="text-xs sm:text-sm text-amber-950/85 mt-1.5 line-clamp-2">
                {megaOffer.description}
              </p>
            </div>
            <div className="relative z-10 mt-6 flex items-center justify-between gap-3">
              <span className="font-mono text-lg font-bold text-slate-950 tabular-nums">
                +{megaOffer.reward_coins.toLocaleString()} Coins
              </span>
              <button
                type="button"
                disabled={megaOffer.completed}
                onClick={() => onLaunchTask(megaOffer)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  megaOffer.completed
                    ? 'bg-slate-900/20 text-slate-900 cursor-default'
                    : 'bg-slate-950 text-white hover:bg-slate-800'
                }`}
              >
                <span>{megaOffer.completed ? 'Completed' : 'Claim Mega Offer'}</span>
                {!megaOffer.completed && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Task Partners Section */}
      <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Task Partners</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified partner networks offering instant coin payouts
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('tasks')}
            className="min-h-[44px] px-3.5 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            View All Tasks
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {partners.map((partner) => (
            <button
              key={partner.name}
              type="button"
              onClick={() => onNavigateTab('tasks', partner.name)}
              className="text-left p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all flex items-center justify-between gap-3 min-h-[68px] cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Handshake className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-900 truncate">{partner.name}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {partner.activeOffers} {partner.activeOffers === 1 ? 'offer' : 'offers'} · Up to {partner.maxReward} Coins
                  </p>
                </div>
              </div>
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
