import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  FileText,
  HelpCircle,
  Lock,
  LogOut,
  Mail,
  Phone,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { UserProfile } from '../types';

interface ProfileTabProps {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
}

type InfoModalType = 'privacy' | 'terms' | 'support' | null;

export function ProfileTab({
  user,
  onUserUpdated,
  onLogout,
  onOpenAdmin,
}: ProfileTabProps) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [notifications, setNotifications] = useState(user.notifications_enabled === 1);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [verifyChannel, setVerifyChannel] = useState<'email' | 'phone' | null>(null);
  const [verifyCodePreview, setVerifyCodePreview] = useState<string | null>(null);
  const [verifyInput, setVerifyInput] = useState('');
  const [infoModal, setInfoModal] = useState<InfoModalType>(null);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.updateProfile({
        name,
        phone,
        notificationsEnabled: notifications,
      });
      onUserUpdated(res.user);
      setMessage('Account settings saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStartVerify(channel: 'email' | 'phone') {
    setError(null);
    setMessage(null);
    try {
      const res = await api.requestVerification(channel);
      setVerifyChannel(channel);
      setVerifyCodePreview(res.verificationCodePreview);
      setVerifyInput('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send verification code.');
    }
  }

  async function handleConfirmVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!verifyChannel) return;
    setError(null);
    try {
      const res = await api.confirmVerification(verifyChannel, verifyInput);
      onUserUpdated(res.user);
      setMessage(`${verifyChannel === 'email' ? 'Email' : 'Phone'} verified successfully.`);
      setVerifyChannel(null);
      setVerifyCodePreview(null);
      setVerifyInput('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    }
  }

  function handleCopyReferral() {
    navigator.clipboard?.writeText(user.referral_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Profile & Account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage verification, preferences, legal policies, and support.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold flex items-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Profile Identity & Verification Card */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white rounded-3xl border border-slate-200 p-6 flex items-center gap-4">
            <img
              src={
                user.avatar_url || '/src/assets/images/avatar_default_member_1795267685073.jpg'
              }
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-slate-900 truncate">
                {user.name}
              </h2>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-indigo-700">
                  {user.referral_code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyReferral}
                  aria-label="Copy referral code"
                  className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  {copiedCode ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </section>

          {/* Email & Phone Verification */}
          <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">
              Identity Verification
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{user.email}</p>
                    <p className="text-xs text-slate-500">
                      {user.email_verified === 1 ? 'Verified email address' : 'Pending email verification'}
                    </p>
                  </div>
                </div>
                {user.email_verified === 1 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartVerify('email')}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer shrink-0"
                  >
                    Verify Email
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {user.phone || 'No phone number added'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {user.phone_verified === 1 ? 'Verified phone number' : 'Save & verify phone for payouts'}
                    </p>
                  </div>
                </div>
                {user.phone_verified === 1 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <button
                    type="button"
                    disabled={!user.phone}
                    onClick={() => handleStartVerify('phone')}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    Verify Phone
                  </button>
                )}
              </div>
            </div>

            {verifyChannel && (
              <form
                onSubmit={handleConfirmVerify}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
              >
                <p className="text-xs text-slate-600">
                  Enter the 6-digit {verifyChannel} verification code
                  {verifyCodePreview && (
                    <>
                      {' '}
                      (Code: <strong className="font-mono text-indigo-700">{verifyCodePreview}</strong>)
                    </>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={verifyInput}
                    onChange={(e) => setVerifyInput(e.target.value)}
                    placeholder="6-digit code"
                    className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Confirm
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        {/* Account Settings & Legal Links */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white rounded-3xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-indigo-600" />
              <h3 className="font-display text-base font-bold text-slate-900">Account Settings</h3>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label htmlFor="prof-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Display Name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label htmlFor="prof-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  id="prof-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-slate-900">Reward & Payout Alerts</span>
                  <p className="text-xs text-slate-500">
                    Notify on task completions and withdrawal status updates
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                  className="w-5 h-5 accent-indigo-600 cursor-pointer"
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Account Settings'}
              </button>
            </form>
          </section>

          {/* Policies, Support & Admin Console */}
          <section className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setInfoModal('privacy')}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-slate-500" />
                <span className="text-sm font-semibold text-slate-900">Privacy Policy</span>
              </div>
              <span className="text-xs text-indigo-600 font-medium">Read</span>
            </button>

            <button
              type="button"
              onClick={() => setInfoModal('terms')}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-slate-500" />
                <span className="text-sm font-semibold text-slate-900">Terms & Conditions</span>
              </div>
              <span className="text-xs text-indigo-600 font-medium">Read</span>
            </button>

            <button
              type="button"
              onClick={() => setInfoModal('support')}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-slate-500" />
                <span className="text-sm font-semibold text-slate-900">Help & Support</span>
              </div>
              <span className="text-xs text-indigo-600 font-medium">Open</span>
            </button>

            <button
              type="button"
              onClick={onOpenAdmin}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-indigo-50/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-indigo-600" />
                <div>
                  <span className="text-sm font-semibold text-slate-900 block">
                    Admin Console
                  </span>
                  <span className="text-xs text-slate-500">
                    Separate authenticated management dashboard
                  </span>
                </div>
              </div>
              <span className="text-xs text-indigo-600 font-semibold">Access</span>
            </button>
          </section>
        </div>
      </div>

      {/* Legal & Support Modal */}
      {infoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {infoModal === 'privacy'
                  ? 'RewardX Privacy Policy'
                  : infoModal === 'terms'
                  ? 'RewardX Terms & Conditions'
                  : 'Help & Support'}
              </h3>
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                aria-label="Close modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {infoModal === 'privacy' && (
              <div className="space-y-2.5 text-sm text-slate-600 leading-relaxed">
                <p>
                  RewardX collects only the account details required to authenticate your profile, validate task completions, prevent duplicate referral abuse, and process payout requests.
                </p>
                <p>
                  Passwords are salted and hashed with scrypt on the server. Network IP checks are used strictly for fraud prevention on referrals and withdrawals.
                </p>
              </div>
            )}

            {infoModal === 'terms' && (
              <div className="space-y-2.5 text-sm text-slate-600 leading-relaxed">
                <p>
                  Coins have no cash value outside verified redemptions at the active conversion rate displayed in your Wallet.
                </p>
                <p>
                  Attempting to tamper with task timers, create multiple accounts from the same network, or automate referrals results in reward forfeiture and account suspension.
                </p>
              </div>
            )}

            {infoModal === 'support' && (
              <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                <p>
                  <strong>How long do withdrawals take?</strong> All redemption requests are manually reviewed within 24–48 hours.
                </p>
                <p>
                  <strong>Why was my referral blocked?</strong> Multiple signups using the same referral code from the same IP within 24 hours are flagged to protect platform integrity.
                </p>
                <p>
                  <strong>Support Email:</strong> support@rewardx-app.example
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
