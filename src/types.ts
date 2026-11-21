export type AppTab = 'home' | 'tasks' | 'community' | 'wallet' | 'profile';

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  phone: string | null;
  email_verified: number;
  phone_verified: number;
  referral_code: string;
  referred_by: number | null;
  coin_balance: number;
  pending_coins: number;
  lifetime_coins: number;
  streak_days: number;
  last_checkin_date: string | null;
  last_spin_date: string | null;
  is_flagged: number;
  flag_reason: string | null;
  is_suspended: number;
  notifications_enabled: number;
  created_at: string;
}

export interface TaskItem {
  id: number;
  title: string;
  category:
    | 'sponsored_ad'
    | 'partner_offer'
    | 'daily_checkin'
    | 'partner_game'
    | 'daily_challenge'
    | 'super_offer'
    | 'mega_offer';
  partner_name: string;
  description: string;
  instructions: string;
  reward_coins: number;
  duration_seconds: number;
  cooldown_hours: number;
  is_featured: number;
  is_active?: number;
  completed?: boolean;
  completionCount?: number;
}

export interface PartnerSummary {
  name: string;
  activeOffers: number;
  maxReward: number;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  category: string;
  is_pinned: number;
  created_at: string;
}

export interface AppSettings {
  coinsPerInr: number;
  minWithdrawalCoins: number;
  referralRewardReferrer: number;
  referralRewardReferee: number;
  dailyCheckinBase: number;
  weeklyMilestoneBonus: number;
}

export interface DashboardData {
  user: UserProfile;
  tasks: TaskItem[];
  partners: PartnerSummary[];
  announcements: Announcement[];
  dailyStatus: {
    checkedInToday: boolean;
    spunToday: boolean;
    streakDays: number;
  };
  settings: AppSettings;
}

export interface SpinSegment {
  label: string;
  coins: number;
  probability: number;
  color: string;
}

export interface TransactionItem {
  id: number;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  reference_id: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export interface RewardsStatus {
  checkedInToday: boolean;
  spunToday: boolean;
  streakDays: number;
  dailyCheckinBase: number;
  weeklyMilestoneBonus: number;
  spinSegments: SpinSegment[];
  history: TransactionItem[];
}

export interface ReferralEntry {
  id: number;
  reward_coins: number;
  status: string;
  created_at: string;
  referred_name: string;
}

export interface ReferralsData {
  referralCode: string;
  rewardPerReferral: number;
  refereeBonus: number;
  successfulCount: number;
  totalEarned: number;
  referrals: ReferralEntry[];
}

export interface WithdrawalItem {
  id: number;
  user_id?: number;
  user_name?: string;
  user_email?: string;
  user_flagged?: number;
  coins_amount: number;
  inr_amount: number;
  method: string;
  account_details: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface WalletData {
  availableCoins: number;
  pendingCoins: number;
  lifetimeCoins: number;
  redeemableInr: number;
  coinsPerInr: number;
  minWithdrawalCoins: number;
  methods: string[];
  transactions: TransactionItem[];
  withdrawals: WithdrawalItem[];
}

export interface LeaderboardEntry {
  rank: number;
  id: number;
  name: string;
  avatarUrl: string | null;
  lifetimeCoins: number;
  streakDays: number;
  isCurrentUser: boolean;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: string;
}

export interface CommunityData {
  leaderboard: LeaderboardEntry[];
  achievements: AchievementItem[];
  announcements: Announcement[];
}

export interface FraudLogItem {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  event_type: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
  ip_address: string | null;
  created_at: string;
}

export interface AdminOverviewData {
  users: UserProfile[];
  tasks: TaskItem[];
  withdrawals: WithdrawalItem[];
  transactions: TransactionItem[];
  fraudLogs: FraudLogItem[];
  announcements: Announcement[];
  referrals: Array<{
    id: number;
    referrer_name: string;
    referred_name: string;
    referral_code: string;
    reward_coins: number;
    status: string;
    ip_address: string | null;
    created_at: string;
  }>;
  settings: {
    coins_per_inr: number;
    min_withdrawal_coins: number;
    referral_reward_referrer: number;
    referral_reward_referee: number;
    daily_checkin_base: number;
    weekly_milestone_bonus: number;
  };
}
