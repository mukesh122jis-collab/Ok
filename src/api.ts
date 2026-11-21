import type {
  AdminOverviewData,
  CommunityData,
  DashboardData,
  ReferralsData,
  RewardsStatus,
  SpinSegment,
  UserProfile,
  WalletData,
} from './types';

// In-memory session tokens (never persisted in localStorage/sessionStorage)
let userToken: string | null = null;
let adminToken: string | null = null;

export function setUserToken(token: string | null): void {
  userToken = token;
}

export function getUserToken(): string | null {
  return userToken;
}

export function setAdminToken(token: string | null): void {
  adminToken = token;
}

export function getAdminToken(): string | null {
  return adminToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authMode: 'none' | 'user' | 'admin' = 'user'
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (authMode === 'user' && userToken) {
    headers.Authorization = `Bearer ${userToken}`;
  } else if (authMode === 'admin' && adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  // Public config
  getConfig: () =>
    request<{
      coinsPerInr: number;
      minWithdrawalCoins: number;
      referralRewardReferrer: number;
      referralRewardReferee: number;
      dailyCheckinBase: number;
      weeklyMilestoneBonus: number;
      spinSegments: SpinSegment[];
    }>('/api/config', {}, 'none'),

  // User Auth
  register: (payload: {
    name: string;
    email: string;
    password: string;
    referralCode?: string;
  }) =>
    request<{ token: string; user: UserProfile }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(payload) },
      'none'
    ),

  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: UserProfile }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
      'none'
    ),

  getMe: () => request<{ user: UserProfile }>('/api/auth/me'),

  // Dashboard & Tasks
  getDashboard: () => request<DashboardData>('/api/dashboard'),

  startTask: (taskId: number) =>
    request<{ sessionToken: string; requiredSeconds: number }>(
      `/api/tasks/${taskId}/start`,
      { method: 'POST' }
    ),

  completeTask: (taskId: number, sessionToken: string) =>
    request<{ rewardCoins: number; newBalance: number; user: UserProfile }>(
      `/api/tasks/${taskId}/complete`,
      { method: 'POST', body: JSON.stringify({ sessionToken }) }
    ),

  // Daily Rewards & Spin
  getRewardsStatus: () => request<RewardsStatus>('/api/rewards/status'),

  dailyCheckin: () =>
    request<{
      checkinReward: number;
      weeklyMilestoneAwarded: number;
      streakDays: number;
      newBalance: number;
      user: UserProfile;
    }>('/api/rewards/checkin', { method: 'POST' }),

  spinWheel: () =>
    request<{
      segmentIndex: number;
      segment: SpinSegment;
      rewardCoins: number;
      newBalance: number;
      user: UserProfile;
    }>('/api/rewards/spin', { method: 'POST' }),

  // Referrals
  getReferrals: () => request<ReferralsData>('/api/referrals'),

  // Wallet
  getWallet: () => request<WalletData>('/api/wallet'),

  submitWithdrawal: (payload: {
    coinsAmount: number;
    method: string;
    accountDetails: string;
  }) =>
    request<{ withdrawalId: number; newAvailable: number; newPending: number; user: UserProfile }>(
      '/api/withdrawals',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  // Community
  getCommunity: () => request<CommunityData>('/api/community'),

  // Profile & Verification
  updateProfile: (payload: {
    name?: string;
    phone?: string;
    notificationsEnabled?: boolean;
  }) =>
    request<{ user: UserProfile }>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  requestVerification: (channel: 'email' | 'phone') =>
    request<{ message: string; verificationCodePreview: string }>('/api/profile/verify-request', {
      method: 'POST',
      body: JSON.stringify({ channel }),
    }),

  confirmVerification: (channel: 'email' | 'phone', code: string) =>
    request<{ user: UserProfile }>('/api/profile/verify-confirm', {
      method: 'POST',
      body: JSON.stringify({ channel, code }),
    }),

  // Admin
  getAdminAuthStatus: () =>
    request<{ envPasscodeConfigured: boolean; isClaimed: boolean }>(
      '/api/admin/auth-status',
      {},
      'none'
    ),

  claimAdminPassword: (password: string) =>
    request<{ token: string }>(
      '/api/admin/claim',
      { method: 'POST', body: JSON.stringify({ password }) },
      'none'
    ),

  loginAdmin: (password: string) =>
    request<{ token: string }>(
      '/api/admin/login',
      { method: 'POST', body: JSON.stringify({ password }) },
      'none'
    ),

  getAdminOverview: () => request<AdminOverviewData>('/api/admin/overview', {}, 'admin'),

  adminUpdateUser: (
    userId: number,
    payload: {
      isSuspended?: boolean;
      clearFlag?: boolean;
      coinAdjustment?: number;
      adjustmentReason?: string;
    }
  ) =>
    request<{ user: UserProfile }>(
      `/api/admin/users/${userId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      'admin'
    ),

  adminCreateTask: (payload: {
    title: string;
    category: string;
    partnerName: string;
    description: string;
    instructions: string;
    rewardCoins: number;
    durationSeconds: number;
    cooldownHours: number;
    isFeatured: boolean;
  }) =>
    request<{ task: unknown }>(
      '/api/admin/tasks',
      { method: 'POST', body: JSON.stringify(payload) },
      'admin'
    ),

  adminUpdateTask: (
    taskId: number,
    payload: {
      title?: string;
      rewardCoins?: number;
      isActive?: boolean;
      isFeatured?: boolean;
      partnerName?: string;
      description?: string;
      instructions?: string;
    }
  ) =>
    request<{ task: unknown }>(
      `/api/admin/tasks/${taskId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      'admin'
    ),

  adminDeleteTask: (taskId: number) =>
    request<{ deleted: boolean }>(`/api/admin/tasks/${taskId}`, { method: 'DELETE' }, 'admin'),

  adminUpdateSettings: (payload: Record<string, number>) =>
    request<{ settings: AdminOverviewData['settings'] }>(
      '/api/admin/settings',
      { method: 'PATCH', body: JSON.stringify(payload) },
      'admin'
    ),

  adminReviewWithdrawal: (
    withdrawalId: number,
    decision: 'approved' | 'rejected',
    adminNote: string
  ) =>
    request<{ updated: boolean }>(
      `/api/admin/withdrawals/${withdrawalId}/review`,
      { method: 'POST', body: JSON.stringify({ decision, adminNote }) },
      'admin'
    ),

  adminCreateAnnouncement: (payload: {
    title: string;
    body: string;
    category: string;
    isPinned: boolean;
  }) =>
    request<{ announcement: unknown }>(
      '/api/admin/announcements',
      { method: 'POST', body: JSON.stringify(payload) },
      'admin'
    ),

  adminDeleteAnnouncement: (id: number) =>
    request<{ deleted: boolean }>(
      `/api/admin/announcements/${id}`,
      { method: 'DELETE' },
      'admin'
    ),
};
