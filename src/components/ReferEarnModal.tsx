import React, { useEffect, useState } from 'react';
import { Check, Copy, Share2, ShieldAlert, Users, X } from 'lucide-react';
import { api } from '../api';
import type { ReferralsData } from '../types';

interface ReferEarnModalProps {
  open: boolean;
  onClose: () => void;
}

export function ReferEarnModal({ open, onClose }: ReferEarnModalProps) {
  const [data, setData] = useState<ReferralsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api
      .getReferrals()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Unable to load referral data.')
      )
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const referralLink = data
    ? `${window.location.origin}/?ref=${encodeURIComponent(data.referralCode)}`
    : '';

  function copyValue(val: string, kind: 'code' | 'link') {
    navigator.clipboard?.writeText(val);
    setCopiedType(kind);
    setTimeout(() => setCopiedType(null), 1800);
  }

  async function handleShare() {
    if (!data) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join RewardX',
          text: `Use my RewardX referral code ${data.referralCode} to get +${data.refereeBonus} bonus coins!`,
          url: referralLink,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    copyValue(referralLink, 'link');
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">Refer & Earn</h2>
              <p className="text-xs text-slate-500">
                Invite verified friends and track every referral reward
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Refer and Earn"
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

        {loading && !data ? (
          <div className="py-10 text-center text-sm text-slate-500">Loading referrals...</div>
        ) : (
          data && (
            <>
              <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-amber-100">Your Reward Per Friend</p>
                    <p className="font-display text-2xl font-bold tabular-nums">
                      +{data.rewardPerReferral} Coins
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-100">Friend Welcome Bonus</p>
                    <p className="font-mono text-lg font-bold tabular-nums">+{data.refereeBonus} Coins</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="tabular-nums">
                    Successful referrals: <strong>{data.successfulCount}</strong>
                  </span>
                  <span className="tabular-nums">
                    Total earned: <strong>{data.totalEarned.toLocaleString()} Coins</strong>
                  </span>
                </div>
              </div>

              {/* Code & Link */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Your Unique Referral Code
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 font-mono text-sm font-bold text-slate-900 flex items-center">
                      {data.referralCode}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyValue(data.referralCode, 'code')}
                      className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedType === 'code' ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span>{copiedType === 'code' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Shareable Referral Link
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-100 text-xs text-slate-700 truncate flex items-center">
                      {referralLink}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyValue(referralLink, 'link')}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedType === 'link' ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span>{copiedType === 'link' ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleShare}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 hover:bg-indigo-700 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Anti-fraud notice */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
                <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p>
                  Duplicate network signups, self-referrals, and automated accounts are automatically blocked and flagged by our server integrity engine.
                </p>
              </div>

              {/* Referral History */}
              <div className="space-y-2">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Tracked Referrals ({data.referrals.length})
                </h3>
                {data.referrals.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3">
                    No referrals tracked yet. Share your code or link to invite friends.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {data.referrals.map((ref) => (
                      <div
                        key={ref.id}
                        className="px-4 py-3 flex items-center justify-between gap-4 text-xs sm:text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{ref.referred_name}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(ref.created_at).toLocaleDateString()} ·{' '}
                            {ref.status === 'credited' ? 'Verified' : 'Blocked duplicate'}
                          </p>
                        </div>
                        <span
                          className={`font-mono font-bold tabular-nums ${
                            ref.status === 'credited' ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {ref.status === 'credited' ? `+${ref.reward_coins}` : '0'}
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
