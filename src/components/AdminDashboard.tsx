import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Coins,
  ListChecks,
  Lock,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { api, getAdminToken, setAdminToken } from '../api';
import type { AdminOverviewData, TaskItem } from '../types';

interface AdminDashboardProps {
  onExit: () => void;
}

type AdminSection =
  | 'withdrawals'
  | 'users'
  | 'tasks'
  | 'settings'
  | 'transactions'
  | 'announcements';

export function AdminDashboard({ onExit }: AdminDashboardProps) {
  const [authStatus, setAuthStatus] = useState<{
    envPasscodeConfigured: boolean;
    isClaimed: boolean;
  } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(getAdminToken()));
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [section, setSection] = useState<AdminSection>('withdrawals');
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Task creation form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('partner_offer');
  const [newTaskPartner, setNewTaskPartner] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskInst, setNewTaskInst] = useState('');
  const [newTaskReward, setNewTaskReward] = useState('150');
  const [newTaskDuration, setNewTaskDuration] = useState('10');
  const [newTaskCooldown, setNewTaskCooldown] = useState('24');
  const [newTaskFeatured, setNewTaskFeatured] = useState(false);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});

  // Announcement form state
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annCategory, setAnnCategory] = useState('Update');
  const [annPinned, setAnnPinned] = useState(false);

  // Review note per withdrawal
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  // User coin adjustment state
  const [adjustTargetUser, setAdjustTargetUser] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  useEffect(() => {
    api
      .getAdminAuthStatus()
      .then(setAuthStatus)
      .catch(() => {});
  }, []);

  async function loadOverview() {
    setLoadingOverview(true);
    setActionError(null);
    try {
      const data = await api.getAdminOverview();
      setOverview(data);
      setSettingsForm({
        coins_per_inr: String(data.settings.coins_per_inr),
        min_withdrawal_coins: String(data.settings.min_withdrawal_coins),
        referral_reward_referrer: String(data.settings.referral_reward_referrer),
        referral_reward_referee: String(data.settings.referral_reward_referee),
        daily_checkin_base: String(data.settings.daily_checkin_base),
        weekly_milestone_bonus: String(data.settings.weekly_milestone_bonus),
      });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unable to load admin overview.');
      if (err instanceof Error && err.message.toLowerCase().includes('admin')) {
        setAdminToken(null);
        setIsAuthenticated(false);
      }
    } finally {
      setLoadingOverview(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadOverview();
    }
  }, [isAuthenticated]);

  async function handleAdminClaim(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    if (passwordInput !== confirmPasswordInput) {
      setAuthError('Passwords do not match.');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await api.claimAdminPassword(passwordInput);
      setAdminToken(res.token);
      setIsAuthenticated(true);
      setPasswordInput('');
      setConfirmPasswordInput('');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Unable to claim admin access.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await api.loginAdmin(passwordInput);
      setAdminToken(res.token);
      setIsAuthenticated(true);
      setPasswordInput('');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Invalid admin credentials.');
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLockAdmin() {
    setAdminToken(null);
    setIsAuthenticated(false);
    setOverview(null);
  }

  async function handleWithdrawalDecision(id: number, decision: 'approved' | 'rejected') {
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.adminReviewWithdrawal(id, decision, reviewNotes[id] || '');
      setActionSuccess(
        `Withdrawal #${id} ${decision === 'approved' ? 'approved' : 'rejected and coins refunded'}.`
      );
      await loadOverview();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to review withdrawal.');
    }
  }

  async function handleToggleSuspend(userId: number, currentlySuspended: number) {
    setActionError(null);
    try {
      await api.adminUpdateUser(userId, { isSuspended: currentlySuspended === 0 });
      setActionSuccess(currentlySuspended === 0 ? 'User suspended.' : 'User unsuspended.');
      await loadOverview();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update user.');
    }
  }

  async function handleClearFlag(userId: number) {
    setActionError(null);
    try {
      await api.adminUpdateUser(userId, { clearFlag: true });
      setActionSuccess('User fraud flag cleared.');
      await loadOverview();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to clear flag.');
    }
  }

  async function handleSubmitCoinAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustTargetUser) return;
    const amt = Number(adjustAmount);
    if (!Number.isInteger(amt) || amt === 0) {
      setActionError('Coin adjustment must be a non-zero integer.');
      return;
    }
    try {
      await api.adminUpdateUser(adjustTargetUser, {
        coinAdjustment: amt,
        adjustmentReason: adjustReason,
      });
      setAdjustTargetUser(null);
      setAdjustAmount('');
      setAdjustReason('');
      setActionSuccess('Coin adjustment recorded.');
      await loadOverview();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Coin adjustment failed.');
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.adminCreateTask({
        title: newTaskTitle,
        category: newTaskCategory,
        partnerName: newTaskPartner || 'RewardX Partner',
        description: newTaskDesc,
        instructions: newTaskInst || 'Complete the verification timer to claim coins.',
        rewardCoins: Number(newTaskReward),
        durationSeconds: Number(newTaskDuration),
        cooldownHours: Number(newTaskCooldown),
        isFeatured: newTaskFeatured,
      });
      setNewTaskTitle('');
      setNewTaskPartner('');
      setNewTaskDesc('');
      setNewTaskInst('');
      setActionSuccess('New task published to user catalog.');
      await loadOverview();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to create task.');
    }
  }

  async function handleUpdateTaskReward(task: TaskItem, nextCoins: number) {
    if (!Number.isInteger(nextCoins) || nextCoins <= 0) return;
    try {
      await api.adminUpdateTask(task.id, { rewardCoins: nextCoins });
      setActionSuccess(`Updated reward for "${task.title}" to ${nextCoins} Coins.`);
      await loadOverview();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update task.');
    }
  }

  async function handleToggleTaskActive(task: TaskItem) {
    try {
      await api.adminUpdateTask(task.id, { isActive: task.is_active !== 1 });
      await loadOverview();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to toggle task status.');
    }
  }

  async function handleDeleteTask(taskId: number) {
    try {
      await api.adminDeleteTask(taskId);
      setActionSuccess('Task deactivated.');
      await loadOverview();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove task.');
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    const payload: Record<string, number> = {};
    for (const [k, v] of Object.entries(settingsForm)) {
      payload[k] = Number(v);
    }
    try {
      await api.adminUpdateSettings(payload);
      setActionSuccess('Economy & reward rates updated.');
      await loadOverview();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to save settings.');
    }
  }

  async function handleCreateAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.adminCreateAnnouncement({
        title: annTitle,
        body: annBody,
        category: annCategory,
        isPinned: annPinned,
      });
      setAnnTitle('');
      setAnnBody('');
      setAnnPinned(false);
      setActionSuccess('Announcement published.');
      await loadOverview();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to publish announcement.');
    }
  }

  async function handleDeleteAnnouncement(id: number) {
    try {
      await api.adminDeleteAnnouncement(id);
      await loadOverview();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete announcement.');
    }
  }

  if (!isAuthenticated) {
    const needsFirstRunClaim =
      authStatus !== null && !authStatus.envPasscodeConfigured && !authStatus.isClaimed;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onExit}
            className="min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-200/70 flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to RewardX</span>
          </button>
          <span className="font-display text-sm font-bold text-slate-900">Admin Security Gate</span>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>

            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">
                {needsFirstRunClaim ? 'Claim Admin Access' : 'Admin Console Sign In'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {needsFirstRunClaim
                  ? 'No ADMIN_PASSCODE secret is set. Create your first-run admin password (stored hashed on the server) to lock and manage RewardX.'
                  : 'Enter your server admin passcode to manage withdrawals, tasks, users, and fraud logs.'}
              </p>
            </div>

            {authError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {authError}
              </div>
            )}

            <form
              onSubmit={needsFirstRunClaim ? handleAdminClaim : handleAdminLogin}
              className="space-y-4"
            >
              <div>
                <label htmlFor="admin-pw" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {needsFirstRunClaim ? 'Choose Admin Password' : 'Admin Passcode / Password'}
                </label>
                <input
                  id="admin-pw"
                  type="password"
                  required
                  minLength={needsFirstRunClaim ? 8 : 1}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={needsFirstRunClaim ? 'Minimum 8 characters' : 'Enter admin passcode'}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              {needsFirstRunClaim && (
                <div>
                  <label
                    htmlFor="admin-pw-confirm"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Confirm Admin Password
                  </label>
                  <input
                    id="admin-pw-confirm"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="Re-enter admin password"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full min-h-[48px] px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {authLoading
                  ? 'Verifying...'
                  : needsFirstRunClaim
                  ? 'Set Admin Password & Enter'
                  : 'Unlock Admin Console'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const pendingWithdrawals =
    overview?.withdrawals.filter((w) => w.status === 'pending').length ?? 0;
  const flaggedUsers = overview?.users.filter((u) => u.is_flagged === 1).length ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={onExit}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>App</span>
            </button>
            <span className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
              RewardX Admin Console
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadOverview}
              aria-label="Refresh admin data"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingOverview ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleLockAdmin}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              Lock Console
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Summary Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Registered Users</p>
            <p className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {overview?.users.length ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Pending Withdrawals</p>
            <p className="font-display text-2xl font-bold text-amber-600 tabular-nums mt-1">
              {pendingWithdrawals}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Active Tasks</p>
            <p className="font-display text-2xl font-bold text-indigo-600 tabular-nums mt-1">
              {overview?.tasks.filter((t) => t.is_active === 1).length ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Flagged / Fraud Events</p>
            <p className="font-display text-2xl font-bold text-red-600 tabular-nums mt-1">
              {flaggedUsers} · {overview?.fraudLogs.length ?? 0} logs
            </p>
          </div>
        </section>

        {/* Section Tabs */}
        <nav className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'withdrawals', label: `Withdrawals (${pendingWithdrawals})`, icon: Wallet },
            { id: 'users', label: 'Users & Fraud', icon: Users },
            { id: 'tasks', label: 'Tasks & Rewards', icon: ListChecks },
            { id: 'settings', label: 'Economy Settings', icon: Sliders },
            { id: 'transactions', label: 'Transactions', icon: Coins },
            { id: 'announcements', label: 'Announcements', icon: Megaphone },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id as AdminSection)}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  section === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {actionError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
            {actionSuccess}
          </div>
        )}

        {/* Section Content */}
        {overview && section === 'withdrawals' && (
          <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-display text-base font-bold text-slate-900">
                Withdrawal Requests Queue
              </h2>
            </div>
            {overview.withdrawals.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No withdrawal requests recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {overview.withdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <span>
                          #{w.id} · {w.user_name} ({w.user_email})
                        </span>
                        {w.user_flagged === 1 && (
                          <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Flagged Account
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 tabular-nums">
                        {w.method} ·{' '}
                        <strong>
                          ₹
                          {w.inr_amount.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          INR
                        </strong>{' '}
                        ({w.coins_amount.toLocaleString('en-IN')} Coins) · Destination:{' '}
                        {w.account_details}
                      </p>
                      <p className="text-xs text-slate-400">
                        Requested {new Date(w.created_at).toLocaleString()} · Status:{' '}
                        <strong
                          className={
                            w.status === 'approved'
                              ? 'text-emerald-700'
                              : w.status === 'rejected'
                              ? 'text-red-600'
                              : 'text-amber-600'
                          }
                        >
                          {w.status}
                        </strong>
                        {w.admin_note && ` · Note: ${w.admin_note}`}
                      </p>
                    </div>

                    {w.status === 'pending' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={reviewNotes[w.id] || ''}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({ ...prev, [w.id]: e.target.value }))
                          }
                          placeholder="Optional review note"
                          className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs w-48"
                        />
                        <button
                          type="button"
                          onClick={() => handleWithdrawalDecision(w.id, 'approved')}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleWithdrawalDecision(w.id, 'rejected')}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject & Refund</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {overview && section === 'users' && (
          <div className="space-y-6">
            <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Registered Users ({overview.users.length})
                </h2>
              </div>
              {overview.users.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No user accounts registered yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="py-3 px-4 font-semibold">User</th>
                        <th className="py-3 px-4 font-semibold text-right">Available</th>
                        <th className="py-3 px-4 font-semibold text-right">Pending</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {overview.users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-500">
                              {u.email} · Code: <span className="font-mono">{u.referral_code}</span>
                            </p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                            {u.coin_balance.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums">
                            {u.pending_coins.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {u.is_suspended === 1 ? (
                              <span className="text-red-600 font-semibold">Suspended</span>
                            ) : u.is_flagged === 1 ? (
                              <span className="text-amber-600 font-semibold">
                                Flagged: {u.flag_reason}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">Active</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setAdjustTargetUser(u.id)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                            >
                              Adjust Coins
                            </button>
                            {u.is_flagged === 1 && (
                              <button
                                type="button"
                                onClick={() => handleClearFlag(u.id)}
                                className="px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-50 cursor-pointer"
                              >
                                Clear Flag
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleToggleSuspend(u.id, u.is_suspended)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                                u.is_suspended === 1
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {u.is_suspended === 1 ? 'Unsuspend' : 'Suspend'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Coin Adjustment Inline Modal */}
            {adjustTargetUser && (
              <form
                onSubmit={handleSubmitCoinAdjustment}
                className="bg-white rounded-3xl border border-indigo-200 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Audited Coin Adjustment for User #{adjustTargetUser}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setAdjustTargetUser(null)}
                    className="text-xs text-slate-500 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="number"
                    required
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="Coins (e.g. 200 or -100)"
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                  />
                  <input
                    type="text"
                    required
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Audit reason"
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm sm:col-span-2"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Apply Adjustment
                </button>
              </form>
            )}

            {/* Suspicious Activity & Fraud Logs */}
            <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  Suspicious Activity & Integrity Logs
                </h2>
              </div>
              {overview.fraudLogs.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">
                  No suspicious activity detected. Server integrity guards are active.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {overview.fraudLogs.map((log) => (
                    <div key={log.id} className="px-6 py-3.5 flex items-start justify-between gap-4 text-xs sm:text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {log.event_type} · {log.user_name || `User #${log.user_id}`}
                        </p>
                        <p className="text-slate-600 mt-0.5">{log.details}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          IP: {log.ip_address} · {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold uppercase shrink-0 ${
                          log.severity === 'high'
                            ? 'text-red-600'
                            : log.severity === 'medium'
                            ? 'text-amber-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {log.severity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {overview && section === 'tasks' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Add Task Form */}
            <form
              onSubmit={handleCreateTask}
              className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 space-y-3.5"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <h2 className="font-display text-base font-bold text-slate-900">Add New Task</h2>
              </div>

              <input
                type="text"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Task title"
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value)}
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="sponsored_ad">Sponsored Ad</option>
                  <option value="partner_offer">Partner Offer</option>
                  <option value="partner_game">Partner Game</option>
                  <option value="daily_challenge">Daily Challenge</option>
                  <option value="super_offer">Super Offer</option>
                  <option value="mega_offer">Mega Offer</option>
                </select>
                <input
                  type="text"
                  required
                  value={newTaskPartner}
                  onChange={(e) => setNewTaskPartner(e.target.value)}
                  placeholder="Partner name"
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <textarea
                rows={2}
                required
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                placeholder="Short description"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
              <textarea
                rows={2}
                required
                value={newTaskInst}
                onChange={(e) => setNewTaskInst(e.target.value)}
                placeholder="Verification instructions"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Reward Coins</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newTaskReward}
                    onChange={(e) => setNewTaskReward(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-300 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Duration (s)</label>
                  <input
                    type="number"
                    required
                    min={3}
                    value={newTaskDuration}
                    onChange={(e) => setNewTaskDuration(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-300 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Cooldown (h)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newTaskCooldown}
                    onChange={(e) => setNewTaskCooldown(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-300 font-mono text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTaskFeatured}
                  onChange={(e) => setNewTaskFeatured(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
                <span>Feature prominently on Home & Tasks</span>
              </label>

              <button
                type="submit"
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 cursor-pointer"
              >
                Publish Task
              </button>
            </form>

            {/* Existing Tasks Table */}
            <section className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Manage Tasks ({overview.tasks.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {overview.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {task.title}{' '}
                        {task.is_active !== 1 && (
                          <span className="text-xs text-red-600">(Inactive)</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {task.category} · {task.partner_name} · {task.duration_seconds}s
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        defaultValue={task.reward_coins}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== task.reward_coins && v > 0) {
                            handleUpdateTaskReward(task, v);
                          }
                        }}
                        aria-label={`Reward coins for ${task.title}`}
                        className="w-20 min-h-[38px] px-2.5 py-1 rounded-xl border border-slate-300 font-mono text-xs text-right"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleTaskActive(task)}
                        className="min-h-[38px] px-3 py-1 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                      >
                        {task.is_active === 1 ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        aria-label={`Remove ${task.title}`}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {overview && section === 'settings' && (
          <form
            onSubmit={handleSaveSettings}
            className="max-w-2xl bg-white rounded-3xl border border-slate-200 p-6 space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-slate-900">
              Reward Rates, Referrals & Withdrawal Rules
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'coins_per_inr', label: 'Coins per ₹1.00 INR' },
                { key: 'min_withdrawal_coins', label: 'Minimum Withdrawal (Coins)' },
                { key: 'referral_reward_referrer', label: 'Referrer Bonus (Coins)' },
                { key: 'referral_reward_referee', label: 'Friend Signup Bonus (Coins)' },
                { key: 'daily_checkin_base', label: 'Daily Check-In Base (Coins)' },
                { key: 'weekly_milestone_bonus', label: '7-Day Weekly Milestone Bonus' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {field.label}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={settingsForm[field.key] || ''}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm"
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 cursor-pointer"
            >
              Save Economy Settings
            </button>
          </form>
        )}

        {overview && section === 'transactions' && (
          <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-display text-base font-bold text-slate-900">
                Audited Server Transactions ({overview.transactions.length})
              </h2>
            </div>
            {overview.transactions.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No transactions logged yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {overview.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="px-6 py-3.5 flex items-center justify-between gap-4 text-xs sm:text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {tx.user_name} · {tx.description}
                      </p>
                      <p className="text-xs text-slate-400">
                        {tx.type} · {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          tx.amount >= 0 ? 'text-emerald-600' : 'text-orange-600'
                        }`}
                      >
                        {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                      </span>
                      <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                        Bal: {tx.balance_after.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {overview && section === 'announcements' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={handleCreateAnnouncement}
              className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 space-y-4"
            >
              <h2 className="font-display text-base font-bold text-slate-900">
                Post Community Announcement
              </h2>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Announcement headline"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
              <select
                value={annCategory}
                onChange={(e) => setAnnCategory(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="Update">Update</option>
                <option value="Policy">Policy</option>
                <option value="Event">Event</option>
                <option value="Partners">Partners</option>
              </select>
              <textarea
                rows={4}
                required
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Announcement details..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={annPinned}
                  onChange={(e) => setAnnPinned(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
                <span>Pin to top of Community feed</span>
              </label>
              <button
                type="submit"
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 cursor-pointer"
              >
                Publish Announcement
              </button>
            </form>

            <section className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              <div className="px-6 py-4">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Published Announcements ({overview.announcements.length})
                </h2>
              </div>
              {overview.announcements.map((ann) => (
                <div key={ann.id} className="p-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-indigo-600 font-semibold">
                      {ann.category} {ann.is_pinned === 1 ? '· Pinned' : ''}
                    </p>
                    <h3 className="font-display text-sm font-bold text-slate-900 mt-0.5">
                      {ann.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1">{ann.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAnnouncement(ann.id)}
                    aria-label="Delete announcement"
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
