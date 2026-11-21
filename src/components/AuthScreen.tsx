import React, { useEffect, useState } from 'react';
import { ArrowRight, Coins, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { api, setUserToken } from '../api';
import type { UserProfile } from '../types';

interface AuthScreenProps {
  onAuthenticated: (user: UserProfile) => void;
  onOpenAdmin: () => void;
}

export function AuthScreen({ onAuthenticated, onOpenAdmin }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<{
    coinsPerInr: number;
    minWithdrawalCoins: number;
    referralRewardReferrer: number;
    referralRewardReferee: number;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref.toUpperCase());
      setMode('register');
    }
    api
      .getConfig()
      .then((c) => setConfig(c))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await api.register({
          name,
          email,
          password,
          referralCode: referralCode.trim() || undefined,
        });
        setUserToken(res.token);
        onAuthenticated(res.user);
      } else {
        const res = await api.login({ email, password });
        setUserToken(res.token);
        onAuthenticated(res.user);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-8">
        <span className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          RewardX
        </span>
        <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <span className="hidden sm:inline whitespace-nowrap shrink-0">
            Verified Tasks · Transparent Redemptions
          </span>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Admin Console
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Left Hero Showcase */}
          <div className="lg:col-span-6 relative rounded-3xl overflow-hidden bg-gradient-to-br from-violet-900 via-indigo-900 to-blue-900 text-white p-6 sm:p-8 flex flex-col justify-between min-h-[340px]">
            <img
              src="/src/assets/images/rewardx_hero_coins_1795267685472.jpg"
              alt="RewardX Metallic Gold Coins"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-45 mix-blend-lighten pointer-events-none"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-indigo-950/55 to-violet-950/40 pointer-events-none" />

            <div className="relative z-10">
              <p className="text-xs font-medium tracking-wide text-amber-300 mb-3">
                RewardX Member Platform
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight text-balance max-w-md">
                Earn real coins through verified tasks and daily streaks.
              </h1>
              <p className="mt-3 text-sm sm:text-base text-slate-200 max-w-md leading-relaxed">
                Complete partner offers, play trial games, spin the daily wheel, and redeem your balance with transparent conversion rules.
              </p>
            </div>

            <div className="relative z-10 mt-8 pt-6 border-t border-white/15 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-300">Conversion Rate</p>
                <p className="font-mono text-base sm:text-lg font-semibold tabular-nums mt-0.5">
                  {config ? `${config.coinsPerInr.toLocaleString('en-IN')} = ₹1` : '10 = ₹1'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-300">Minimum Payout</p>
                <p className="font-mono text-base sm:text-lg font-semibold tabular-nums mt-0.5">
                  {config
                    ? `₹${(config.minWithdrawalCoins / config.coinsPerInr).toLocaleString('en-IN')}`
                    : '₹200'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-300">Referral Bonus</p>
                <p className="font-mono text-base sm:text-lg font-semibold tabular-nums mt-0.5">
                  {config ? `+${config.referralRewardReferrer} Coins` : '+250 Coins'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Auth Form */}
          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {mode === 'login'
                    ? 'Sign in to access your RewardX wallet and daily tasks.'
                    : 'Start with a verified account. Balances are tracked server-side.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`min-h-[44px] py-2 px-4 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`min-h-[44px] py-2 px-4 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-referral" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Referral Code <span className="text-slate-400 font-normal">(Optional · +{config?.referralRewardReferee ?? 100} Coins)</span>
                  </label>
                  <input
                    id="auth-referral"
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="e.g. RXAARAV88"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-slate-900 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] mt-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
              >
                <span>{loading ? 'Please wait...' : mode === 'login' ? 'Sign In to RewardX' : 'Create Verified Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Server-validated coins</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Duplicate referral guard</span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Zero fake payouts</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
        <span>RewardX · Verified Earning & Rewards Platform</span>
        <span className="flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
          All coin transactions audited server-side
        </span>
      </footer>
    </div>
  );
}
