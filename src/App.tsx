import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Home,
  ListChecks,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { api, setUserToken } from './api';
import { AuthScreen } from './components/AuthScreen';
import { HomeTab } from './components/HomeTab';
import { TasksTab } from './components/TasksTab';
import { CommunityTab } from './components/CommunityTab';
import { WalletTab } from './components/WalletTab';
import { ProfileTab } from './components/ProfileTab';
import { DailyRewardsModal } from './components/DailyRewardsModal';
import { ReferEarnModal } from './components/ReferEarnModal';
import { AdminDashboard } from './components/AdminDashboard';
import type { AppTab, DashboardData, TaskItem, UserProfile } from './types';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [partnerFilter, setPartnerFilter] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [referModalOpen, setReferModalOpen] = useState(false);
  const [activeTaskModal, setActiveTaskModal] = useState<TaskItem | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  }

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.getDashboard();
      setDashboard(data);
      setUser(data.user);
    } catch {
      // Token may have expired
    }
  }, []);

  useEffect(() => {
    if (user && !showAdmin) {
      loadDashboard();
    }
  }, [user?.id, showAdmin, loadDashboard]);

  function handleNavigateTab(tab: AppTab, nextPartnerFilter?: string) {
    setActiveTab(tab);
    if (nextPartnerFilter) {
      setPartnerFilter(nextPartnerFilter);
    } else if (tab !== 'tasks') {
      setPartnerFilter(null);
    }
  }

  function handleLaunchTask(task: TaskItem) {
    setActiveTab('tasks');
    setActiveTaskModal(task);
  }

  async function handleQuickCheckin() {
    setCheckinLoading(true);
    try {
      const res = await api.dailyCheckin();
      setUser(res.user);
      const bonusNote =
        res.weeklyMilestoneAwarded > 0
          ? ` + ${res.weeklyMilestoneAwarded} Weekly Milestone!`
          : '';
      showToast(`Day ${res.streakDays} Check-In: +${res.checkinReward} Coins${bonusNote}`);
      await loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Check-in unavailable.');
    } finally {
      setCheckinLoading(false);
    }
  }

  function handleLogout() {
    setUserToken(null);
    setUser(null);
    setDashboard(null);
    setActiveTab('home');
  }

  if (showAdmin) {
    return (
      <AdminDashboard
        onExit={() => {
          setShowAdmin(false);
          if (user) loadDashboard();
        }}
      />
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={(loggedInUser) => setUser(loggedInUser)}
        onOpenAdmin={() => setShowAdmin(true)}
      />
    );
  }

  const navItems: Array<{ id: AppTab; label: string; icon: typeof Home }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'tasks', label: 'Tasks', icon: ListChecks },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10">
      {/* Desktop Top Bar (3-zone contract) */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => handleNavigateTab('home')}
            className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            RewardX
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigateTab(item.id)}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600'
                    : 'hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => handleNavigateTab('wallet')}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-mono font-semibold flex items-center gap-2 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer"
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{user.coin_balance.toLocaleString()}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {!dashboard ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            Loading your RewardX dashboard...
          </div>
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeTab
                dashboard={dashboard}
                onNavigateTab={handleNavigateTab}
                onOpenDailyRewards={() => setDailyModalOpen(true)}
                onOpenReferrals={() => setReferModalOpen(true)}
                onLaunchTask={handleLaunchTask}
                onQuickCheckin={handleQuickCheckin}
                checkinLoading={checkinLoading}
              />
            )}

            {activeTab === 'tasks' && (
              <TasksTab
                tasks={dashboard.tasks}
                initialPartnerFilter={partnerFilter}
                onClearPartnerFilter={() => setPartnerFilter(null)}
                onTaskCompleted={(updatedUser, rewardCoins, taskTitle) => {
                  setUser(updatedUser);
                  showToast(`+${rewardCoins} Coins credited for "${taskTitle}"`);
                  loadDashboard();
                }}
                activeTaskModal={activeTaskModal}
                onSetActiveTaskModal={setActiveTaskModal}
              />
            )}

            {activeTab === 'community' && <CommunityTab />}

            {activeTab === 'wallet' && (
              <WalletTab
                onBalanceUpdated={(updatedUser, msg) => {
                  setUser(updatedUser);
                  showToast(msg);
                  loadDashboard();
                }}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileTab
                user={user}
                onUserUpdated={(updatedUser) => {
                  setUser(updatedUser);
                  loadDashboard();
                }}
                onLogout={handleLogout}
                onOpenAdmin={() => setShowAdmin(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Fixed 5-Tab Bottom Navigation Bar (Mobile & Touch-First) */}
      <nav
        aria-label="Primary Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200"
      >
        <div className="grid grid-cols-5 items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigateTab(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  active ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                <span className="text-[11px] font-medium tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      <DailyRewardsModal
        open={dailyModalOpen}
        onClose={() => setDailyModalOpen(false)}
        onBalanceUpdated={(updatedUser, msg) => {
          setUser(updatedUser);
          showToast(msg);
          loadDashboard();
        }}
      />

      <ReferEarnModal
        open={referModalOpen}
        onClose={() => setReferModalOpen(false)}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2.5 text-xs sm:text-sm font-medium max-w-sm"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
