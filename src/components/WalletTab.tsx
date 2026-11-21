import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Coins,
  Info,
  Wallet,
} from 'lucide-react';
import { api } from '../api';
import type { UserProfile, WalletData } from '../types';

interface WalletTabProps {
  onBalanceUpdated: (user: UserProfile, toastMessage: string) => void;
}

export function WalletTab({ onBalanceUpdated }: WalletTabProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('UPI');
  const [coinsAmount, setCoinsAmount] = useState('');
  const [accountDetails, setAccountDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadWallet() {
    setLoading(true);
    try {
      const data = await api.getWallet();
      setWallet(data);
      if (data.methods.length > 0 && !data.methods.includes(method)) {
        setMethod(data.methods[0]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load wallet.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWallet();
  }, []);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet) return;
    setError(null);
    setSuccessMsg(null);

    const parsed = Number(coinsAmount);
    if (!Number.isInteger(parsed) || parsed < wallet.minWithdrawalCoins) {
      setError(
        `Minimum withdrawal is ${wallet.minWithdrawalCoins.toLocaleString()} coins.`
      );
      return;
    }
    if (parsed > wallet.availableCoins) {
      setError('Requested amount exceeds your available coin balance.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitWithdrawal({
        coinsAmount: parsed,
        method,
        accountDetails,
      });
      setCoinsAmount('');
      setAccountDetails('');
      setSuccessMsg(
        `Withdrawal #${res.withdrawalId} submitted for review. Coins moved to Pending Review until verified by an administrator.`
      );
      onBalanceUpdated(res.user, 'Withdrawal request submitted for verification');
      await loadWallet();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !wallet) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Loading wallet & ledger...
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="bg-red-50 rounded-3xl border border-red-200 p-6 text-sm text-red-700">
        {error || 'Unable to load wallet.'}
      </div>
    );
  }

  const parsedPreviewCoins = Number(coinsAmount) || 0;
  const previewInr = (parsedPreviewCoins / wallet.coinsPerInr).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const redeemableInrFormatted = wallet.redeemableInr.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const minWithdrawalInrFormatted = (
    wallet.minWithdrawalCoins / wallet.coinsPerInr
  ).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">RewardX Wallet (INR)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Transparent INR conversion rates, audited coin ledger, and tracked Indian Rupee payouts.
        </p>
      </div>

      {/* Balance Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-3xl bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-600 text-white p-5">
          <div className="flex items-center justify-between text-indigo-100 text-xs font-medium">
            <span>Total Available Coins</span>
            <Coins className="w-4 h-4 text-amber-300" />
          </div>
          <p className="font-display text-3xl font-extrabold tabular-nums mt-2">
            {wallet.availableCoins.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-indigo-100 mt-1 tabular-nums">
            Redeemable balance: <strong>₹{redeemableInrFormatted} INR</strong>
          </p>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Pending Review Coins</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="font-display text-3xl font-bold text-slate-900 tabular-nums mt-2">
            {wallet.pendingCoins.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            In manual withdrawal verification
          </p>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Conversion & Minimum</span>
            <Wallet className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="font-mono text-xl font-bold text-slate-900 tabular-nums mt-2">
            {wallet.coinsPerInr.toLocaleString('en-IN')} Coins = ₹1.00
          </p>
          <p className="text-xs text-slate-500 mt-2 tabular-nums">
            Minimum withdrawal: {wallet.minWithdrawalCoins.toLocaleString('en-IN')} Coins (₹
            {minWithdrawalInrFormatted})
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Withdrawal Request Form */}
        <section className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Request Withdrawal</h2>
            <p className="text-xs text-slate-500 mt-1">
              All redemptions enter Pending Review and are verified within 24–48 hours. Rejected requests automatically refund coins.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-700">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs sm:text-sm text-indigo-900">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label htmlFor="wd-method" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Redemption Method
              </label>
              <select
                id="wd-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                {wallet.methods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="wd-coins" className="text-xs font-semibold text-slate-700">
                  Coins to Redeem
                </label>
                <button
                  type="button"
                  onClick={() => setCoinsAmount(String(wallet.availableCoins))}
                  className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                >
                  Use Max ({wallet.availableCoins.toLocaleString()})
                </button>
              </div>
              <input
                id="wd-coins"
                type="number"
                required
                min={wallet.minWithdrawalCoins}
                step={1}
                value={coinsAmount}
                onChange={(e) => setCoinsAmount(e.target.value)}
                placeholder={`Min ${wallet.minWithdrawalCoins}`}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              {parsedPreviewCoins > 0 && (
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  Estimated payout: <strong className="text-slate-900">₹{previewInr} INR</strong>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="wd-details" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {method === 'UPI'
                  ? 'UPI ID (GPay / PhonePe / Paytm)'
                  : method === 'Paytm Wallet'
                  ? 'Paytm Registered Mobile Number'
                  : method.includes('Bank Transfer')
                  ? 'Bank Account Number & IFSC Code'
                  : 'Delivery Email for INR Voucher'}
              </label>
              <input
                id="wd-details"
                type="text"
                required
                minLength={4}
                maxLength={140}
                value={accountDetails}
                onChange={(e) => setAccountDetails(e.target.value)}
                placeholder={
                  method === 'UPI'
                    ? 'yourname@upi (e.g. name@okaxis, 9876543210@ybl)'
                    : method === 'Paytm Wallet'
                    ? '10-digit Paytm mobile number'
                    : method.includes('Bank Transfer')
                    ? 'Account No., IFSC & Account Holder Name'
                    : 'Email for INR digital voucher delivery'
                }
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || wallet.availableCoins < wallet.minWithdrawalCoins}
              className="w-full min-h-[48px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm disabled:opacity-50 cursor-pointer"
            >
              {submitting
                ? 'Submitting Request...'
                : wallet.availableCoins < wallet.minWithdrawalCoins
                ? `Need ${wallet.minWithdrawalCoins.toLocaleString()} Coins Minimum`
                : 'Submit Withdrawal Request'}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p>
              Redemption Rules: Zero platform fees. Maximum 3 concurrent pending requests. Fraudulent activity voids pending redemptions.
            </p>
          </div>
        </section>

        {/* Withdrawal Status & Transaction History */}
        <div className="lg:col-span-7 space-y-6">
          {/* Withdrawal Tracking */}
          <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-display text-base font-bold text-slate-900">
                Withdrawal Status Tracking
              </h2>
            </div>
            {wallet.withdrawals.length === 0 ? (
              <p className="p-5 text-xs sm:text-sm text-slate-500">
                No withdrawal requests submitted yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {wallet.withdrawals.map((w) => (
                  <div key={w.id} className="px-5 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {w.method} · ₹
                        {w.inr_amount.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        INR
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {w.account_details} · {new Date(w.created_at).toLocaleString()}
                      </p>
                      {w.admin_note && (
                        <p className="text-xs text-slate-600 mt-1">Note: {w.admin_note}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-semibold ${
                          w.status === 'approved'
                            ? 'text-emerald-700'
                            : w.status === 'rejected'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {w.status === 'pending'
                          ? 'Pending Review'
                          : w.status === 'approved'
                          ? 'Approved'
                          : 'Rejected (Refunded)'}
                      </span>
                      <p className="font-mono text-xs text-slate-500 tabular-nums mt-0.5">
                        {w.coins_amount.toLocaleString()} Coins
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Transaction History */}
          <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-display text-base font-bold text-slate-900">
                Transaction History
              </h2>
            </div>
            {wallet.transactions.length === 0 ? (
              <p className="p-5 text-xs sm:text-sm text-slate-500">
                No coin transactions yet. Complete a task or daily check-in to start earning!
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {wallet.transactions.map((tx) => {
                  const isCredit = tx.amount >= 0;
                  return (
                    <div key={tx.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isCredit
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-orange-50 text-orange-600'
                          }`}
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {tx.description}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(tx.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono text-sm font-bold tabular-nums ${
                            isCredit ? 'text-emerald-600' : 'text-orange-600'
                          }`}
                        >
                          {isCredit ? `+${tx.amount}` : tx.amount}
                        </span>
                        <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                          Bal: {tx.balance_after.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
