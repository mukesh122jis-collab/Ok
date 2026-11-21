import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  db,
  initDatabase,
  getSettingNumber,
  getSettingString,
  generateUniqueReferralCode,
} from './server/db.ts';
import {
  hashPassword,
  verifyPassword,
  constantTimeEqualString,
  issueAuthToken,
  issueTaskSessionToken,
  verifyTaskSessionToken,
  requireUser,
  requireAdmin,
  type AuthenticatedRequest,
} from './server/auth.ts';

dotenv.config();
initDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '256kb' }));

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayUtcDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim().slice(0, 64);
  }
  return (req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

interface SafeUserRow {
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
  last_weekly_milestone_streak: number;
  is_flagged: number;
  flag_reason: string | null;
  is_suspended: number;
  notifications_enabled: number;
  created_at: string;
}

function getSafeUserById(userId: number): SafeUserRow | null {
  const row = db
    .prepare(
      `SELECT id, name, email, role, avatar_url, phone, email_verified, phone_verified,
              referral_code, referred_by, coin_balance, pending_coins, lifetime_coins,
              streak_days, last_checkin_date, last_spin_date, last_weekly_milestone_streak,
              is_flagged, flag_reason, is_suspended, notifications_enabled, created_at
       FROM users WHERE id = ?`
    )
    .get(userId) as SafeUserRow | undefined;
  return row ?? null;
}

function logFraudEvent(
  userId: number | null,
  eventType: string,
  severity: 'low' | 'medium' | 'high',
  details: string,
  ipAddress: string
): void {
  db.prepare(
    `INSERT INTO fraud_logs (user_id, event_type, severity, details, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, eventType, severity, details, ipAddress, new Date().toISOString());
}

const SPIN_SEGMENTS = [
  { label: '25 Coins', coins: 25, probability: 35, color: '#6366F1' },
  { label: '50 Coins', coins: 50, probability: 25, color: '#3B82F6' },
  { label: '75 Coins', coins: 75, probability: 18, color: '#8B5CF6' },
  { label: '100 Coins', coins: 100, probability: 12, color: '#F59E0B' },
  { label: '200 Coins', coins: 200, probability: 7, color: '#F97316' },
  { label: '500 Coins', coins: 500, probability: 3, color: '#EA580C' },
];

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password, referralCode } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
    res.status(400).json({ error: 'Please provide a valid full name (2–60 characters).' });
    return;
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ error: 'Please provide a valid email address.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const ip = getClientIp(req);

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const trimmedRefCode =
    typeof referralCode === 'string' && referralCode.trim().length > 0
      ? referralCode.trim().toUpperCase()
      : null;

  const txResult = db.transaction(() => {
    let referrer: { id: number; email: string; referral_code: string } | undefined;
    let referralBlockedReason: string | null = null;

    if (trimmedRefCode) {
      referrer = db
        .prepare('SELECT id, email, referral_code FROM users WHERE referral_code = ? AND is_suspended = 0')
        .get(trimmedRefCode) as { id: number; email: string; referral_code: string } | undefined;

      if (!referrer) {
        throw new Error('INVALID_REFERRAL_CODE');
      }

      // Fraud check: same IP using the same referral code within 24 hours
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const sameIpCount = (
        db
          .prepare(
            `SELECT COUNT(*) as cnt FROM referrals
             WHERE referrer_id = ? AND ip_address = ? AND created_at > ?`
          )
          .get(referrer.id, ip, since24h) as { cnt: number }
      ).cnt;

      if (sameIpCount >= 2 && ip !== 'unknown') {
        referralBlockedReason = 'Multiple referrals from same network IP within 24 hours';
      }
    }

    const newReferralCode = generateUniqueReferralCode(cleanName);
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();
    const refereeBonus = referrer && !referralBlockedReason ? getSettingNumber('referral_reward_referee', 100) : 0;

    const insertUser = db.prepare(`
      INSERT INTO users (
        name, email, password_hash, role, avatar_url, referral_code, referred_by,
        coin_balance, pending_coins, lifetime_coins, is_flagged, flag_reason, created_at
      ) VALUES (?, ?, ?, 'user', ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `);

    const info = insertUser.run(
      cleanName,
      normalizedEmail,
      passwordHash,
      '/src/assets/images/avatar_default_member_1795267685073.jpg',
      newReferralCode,
      referrer ? referrer.id : null,
      refereeBonus,
      refereeBonus,
      referralBlockedReason ? 1 : 0,
      referralBlockedReason,
      now
    );

    const newUserId = Number(info.lastInsertRowid);

    if (refereeBonus > 0 && referrer) {
      db.prepare(
        `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id, created_at)
         VALUES (?, 'referral_bonus', ?, ?, ?, ?, ?)`
      ).run(
        newUserId,
        refereeBonus,
        refereeBonus,
        `Welcome referral bonus (code ${referrer.referral_code})`,
        `ref-${referrer.id}`,
        now
      );
    }

    if (referrer) {
      if (referralBlockedReason) {
        db.prepare(
          `INSERT INTO referrals (referrer_id, referred_user_id, referral_code, reward_coins, status, ip_address, created_at)
           VALUES (?, ?, ?, 0, 'blocked_duplicate', ?, ?)`
        ).run(referrer.id, newUserId, referrer.referral_code, ip, now);

        logFraudEvent(
          newUserId,
          'DUPLICATE_REFERRAL_IP',
          'high',
          `Blocked referral bonus for code ${referrer.referral_code}: ${referralBlockedReason}`,
          ip
        );
      } else {
        const referrerBonus = getSettingNumber('referral_reward_referrer', 250);
        const refUser = db
          .prepare('SELECT coin_balance, lifetime_coins FROM users WHERE id = ?')
          .get(referrer.id) as { coin_balance: number; lifetime_coins: number };

        const updatedBal = refUser.coin_balance + referrerBonus;
        db.prepare(
          'UPDATE users SET coin_balance = ?, lifetime_coins = ? WHERE id = ?'
        ).run(updatedBal, refUser.lifetime_coins + referrerBonus, referrer.id);

        db.prepare(
          `INSERT INTO referrals (referrer_id, referred_user_id, referral_code, reward_coins, status, ip_address, created_at)
           VALUES (?, ?, ?, ?, 'credited', ?, ?)`
        ).run(referrer.id, newUserId, referrer.referral_code, referrerBonus, ip, now);

        db.prepare(
          `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id, created_at)
           VALUES (?, 'referral_bonus', ?, ?, ?, ?, ?)`
        ).run(
          referrer.id,
          referrerBonus,
          updatedBal,
          `Referral reward for inviting ${cleanName}`,
          `user-${newUserId}`,
          now
        );
      }
    }

    return newUserId;
  });

  try {
    const newUserId = txResult();
    const user = getSafeUserById(newUserId);
    const token = issueAuthToken(newUserId, 'user');
    res.status(201).json({ token, user });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'INVALID_REFERRAL_CODE') {
      res.status(400).json({ error: 'The referral code entered does not exist.' });
      return;
    }
    res.status(500).json({ error: 'Unable to create account right now.' });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const row = db
    .prepare('SELECT id, password_hash, is_suspended FROM users WHERE email = ?')
    .get(normalizedEmail) as { id: number; password_hash: string; is_suspended: number } | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (row.is_suspended === 1) {
    res.status(403).json({ error: 'This account has been suspended by an administrator.' });
    return;
  }

  const user = getSafeUserById(row.id);
  const token = issueAuthToken(row.id, 'user');
  res.json({ token, user });
});

app.get('/api/auth/me', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const user = getSafeUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json({ user });
});

// ============================================================================
// PUBLIC / SHARED APP CONFIG & DASHBOARD
// ============================================================================

app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    coinsPerInr: getSettingNumber('coins_per_inr', 10),
    minWithdrawalCoins: getSettingNumber('min_withdrawal_coins', 2000),
    referralRewardReferrer: getSettingNumber('referral_reward_referrer', 250),
    referralRewardReferee: getSettingNumber('referral_reward_referee', 100),
    dailyCheckinBase: getSettingNumber('daily_checkin_base', 50),
    weeklyMilestoneBonus: getSettingNumber('weekly_milestone_bonus', 300),
    spinSegments: SPIN_SEGMENTS,
  });
});

app.get('/api/dashboard', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const user = getSafeUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const today = getTodayUtcDate();
  const tasks = db
    .prepare('SELECT * FROM tasks WHERE is_active = 1 ORDER BY is_featured DESC, reward_coins DESC')
    .all() as Array<{
    id: number;
    title: string;
    category: string;
    partner_name: string;
    description: string;
    instructions: string;
    reward_coins: number;
    duration_seconds: number;
    cooldown_hours: number;
    is_featured: number;
  }>;

  const completions = db
    .prepare('SELECT task_id, completed_date FROM task_completions WHERE user_id = ?')
    .all(userId) as Array<{ task_id: number; completed_date: string }>;

  const enrichedTasks = tasks.map((task) => {
    const taskCompletions = completions.filter((c) => c.task_id === task.id);
    const isCompletedToday =
      task.cooldown_hours === 0
        ? taskCompletions.length > 0
        : taskCompletions.some((c) => c.completed_date === today);

    return {
      ...task,
      completed: isCompletedToday,
      completionCount: taskCompletions.length,
    };
  });

  const announcements = db
    .prepare('SELECT * FROM announcements ORDER BY is_pinned DESC, id DESC LIMIT 5')
    .all();

  const partners = Array.from(new Set(tasks.map((t) => t.partner_name))).map((name) => {
    const partnerTasks = enrichedTasks.filter((t) => t.partner_name === name);
    const maxReward = Math.max(...partnerTasks.map((t) => t.reward_coins));
    return {
      name,
      activeOffers: partnerTasks.length,
      maxReward,
    };
  });

  res.json({
    user,
    tasks: enrichedTasks,
    partners,
    announcements,
    dailyStatus: {
      checkedInToday: user.last_checkin_date === today,
      spunToday: user.last_spin_date === today,
      streakDays: user.streak_days,
    },
    settings: {
      coinsPerInr: getSettingNumber('coins_per_inr', 10),
      minWithdrawalCoins: getSettingNumber('min_withdrawal_coins', 2000),
      referralRewardReferrer: getSettingNumber('referral_reward_referrer', 250),
      referralRewardReferee: getSettingNumber('referral_reward_referee', 100),
      dailyCheckinBase: getSettingNumber('daily_checkin_base', 50),
      weeklyMilestoneBonus: getSettingNumber('weekly_milestone_bonus', 300),
    },
  });
});

// ============================================================================
// TASKS & SERVER-VALIDATED COMPLETION
// ============================================================================

app.post('/api/tasks/:id/start', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    res.status(400).json({ error: 'Invalid task ID.' });
    return;
  }

  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND is_active = 1')
    .get(taskId) as
    | { id: number; cooldown_hours: number; duration_seconds: number; category: string }
    | undefined;

  if (!task) {
    res.status(404).json({ error: 'Task not found or inactive.' });
    return;
  }

  const today = getTodayUtcDate();
  if (task.cooldown_hours === 0) {
    const existing = db
      .prepare('SELECT id FROM task_completions WHERE user_id = ? AND task_id = ?')
      .get(userId, taskId);
    if (existing) {
      res.status(400).json({ error: 'This one-time offer has already been completed.' });
      return;
    }
  } else {
    const existingToday = db
      .prepare(
        'SELECT id FROM task_completions WHERE user_id = ? AND task_id = ? AND completed_date = ?'
      )
      .get(userId, taskId, today);
    if (existingToday) {
      res.status(400).json({ error: 'You have already completed this task today. Come back tomorrow!' });
      return;
    }
  }

  const sessionToken = issueTaskSessionToken(userId, taskId);
  res.json({
    sessionToken,
    requiredSeconds: task.duration_seconds,
  });
});

app.post('/api/tasks/:id/complete', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const taskId = Number(req.params.id);
  const { sessionToken } = req.body ?? {};
  const ip = getClientIp(req);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    res.status(400).json({ error: 'Invalid task ID.' });
    return;
  }
  if (typeof sessionToken !== 'string') {
    res.status(400).json({ error: 'Missing task verification session token.' });
    return;
  }

  const session = verifyTaskSessionToken(sessionToken);
  if (!session || session.userId !== userId || session.taskId !== taskId) {
    logFraudEvent(userId, 'INVALID_TASK_TOKEN', 'high', `Tampered or expired task session for task #${taskId}`, ip);
    res.status(400).json({ error: 'Invalid or expired task session. Please restart the task.' });
    return;
  }

  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND is_active = 1')
    .get(taskId) as
    | {
        id: number;
        title: string;
        reward_coins: number;
        duration_seconds: number;
        cooldown_hours: number;
      }
    | undefined;

  if (!task) {
    res.status(404).json({ error: 'Task no longer available.' });
    return;
  }

  const elapsedMs = Date.now() - session.startedAt;
  const minMs = Math.max(0, task.duration_seconds * 1000 - 500);
  if (elapsedMs < minMs) {
    logFraudEvent(
      userId,
      'PREMATURE_TASK_CLAIM',
      'medium',
      `Attempted claim after ${elapsedMs}ms for ${task.duration_seconds}s task #${taskId}`,
      ip
    );
    res.status(400).json({
      error: `Please keep the task active for the full ${task.duration_seconds} seconds before claiming.`,
    });
    return;
  }

  const today = getTodayUtcDate();
  const now = new Date().toISOString();

  const txComplete = db.transaction(() => {
    if (task.cooldown_hours === 0) {
      const existing = db
        .prepare('SELECT id FROM task_completions WHERE user_id = ? AND task_id = ?')
        .get(userId, taskId);
      if (existing) {
        throw new Error('ALREADY_COMPLETED');
      }
    } else {
      const existingToday = db
        .prepare(
          'SELECT id FROM task_completions WHERE user_id = ? AND task_id = ? AND completed_date = ?'
        )
        .get(userId, taskId, today);
      if (existingToday) {
        throw new Error('ALREADY_COMPLETED');
      }
    }

    const userRow = db
      .prepare('SELECT coin_balance, lifetime_coins FROM users WHERE id = ?')
      .get(userId) as { coin_balance: number; lifetime_coins: number };

    const newBalance = userRow.coin_balance + task.reward_coins;
    const newLifetime = userRow.lifetime_coins + task.reward_coins;

    db.prepare('UPDATE users SET coin_balance = ?, lifetime_coins = ? WHERE id = ?').run(
      newBalance,
      newLifetime,
      userId
    );

    db.prepare(
      `INSERT INTO task_completions (user_id, task_id, reward_coins, status, completed_at, completed_date)
       VALUES (?, ?, ?, 'completed', ?, ?)`
    ).run(userId, taskId, task.reward_coins, now, today);

    db.prepare(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id, created_at)
       VALUES (?, 'task_reward', ?, ?, ?, ?, ?)`
    ).run(userId, task.reward_coins, newBalance, `Completed task: ${task.title}`, `task-${taskId}`, now);

    return { rewardCoins: task.reward_coins, newBalance };
  });

  try {
    const result = txComplete();
    const user = getSafeUserById(userId);
    res.json({ ...result, user });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ALREADY_COMPLETED') {
      res.status(400).json({ error: 'Task reward already claimed for this period.' });
      return;
    }
    res.status(500).json({ error: 'Failed to record task completion.' });
  }
});

// ============================================================================
// DAILY REWARDS, STREAK MILESTONES & SPIN WHEEL
// ============================================================================

app.get('/api/rewards/status', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const user = getSafeUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const today = getTodayUtcDate();
  const history = db
    .prepare(
      `SELECT id, type, amount, balance_after, description, created_at
       FROM transactions
       WHERE user_id = ? AND type IN ('daily_checkin', 'spin_wheel', 'weekly_milestone', 'task_reward', 'referral_bonus')
       ORDER BY id DESC LIMIT 30`
    )
    .all(userId);

  const dailyCheckinBase = getSettingNumber('daily_checkin_base', 50);
  const weeklyMilestoneBonus = getSettingNumber('weekly_milestone_bonus', 300);

  res.json({
    checkedInToday: user.last_checkin_date === today,
    spunToday: user.last_spin_date === today,
    streakDays: user.streak_days,
    dailyCheckinBase,
    weeklyMilestoneBonus,
    spinSegments: SPIN_SEGMENTS,
    history,
  });
});

app.post('/api/rewards/checkin', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const today = getTodayUtcDate();
  const yesterday = getYesterdayUtcDate();
  const now = new Date().toISOString();

  const txCheckin = db.transaction(() => {
    const userRow = db
      .prepare(
        'SELECT coin_balance, lifetime_coins, streak_days, last_checkin_date FROM users WHERE id = ?'
      )
      .get(userId) as {
      coin_balance: number;
      lifetime_coins: number;
      streak_days: number;
      last_checkin_date: string | null;
    };

    if (userRow.last_checkin_date === today) {
      throw new Error('ALREADY_CHECKED_IN');
    }

    const nextStreak = userRow.last_checkin_date === yesterday ? userRow.streak_days + 1 : 1;
    const base = getSettingNumber('daily_checkin_base', 50);
    const streakBonus = Math.min(nextStreak - 1, 6) * 10;
    const checkinReward = base + streakBonus;

    let weeklyMilestoneAwarded = 0;
    const weeklyBonusSetting = getSettingNumber('weekly_milestone_bonus', 300);
    if (nextStreak > 0 && nextStreak % 7 === 0) {
      weeklyMilestoneAwarded = weeklyBonusSetting;
    }

    const totalAdded = checkinReward + weeklyMilestoneAwarded;
    const balanceAfterCheckin = userRow.coin_balance + checkinReward;
    const finalBalance = userRow.coin_balance + totalAdded;

    db.prepare(
      `UPDATE users
       SET coin_balance = ?, lifetime_coins = ?, streak_days = ?, last_checkin_date = ?
       WHERE id = ?`
    ).run(finalBalance, userRow.lifetime_coins + totalAdded, nextStreak, today, userId);

    db.prepare(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id, created_at)
       VALUES (?, 'daily_checkin', ?, ?, ?, ?, ?)`
    ).run(
      userId,
      checkinReward,
      balanceAfterCheckin,
      `Day ${nextStreak} Daily Check-In Bonus`,
      `checkin-${today}`,
      now
    );

    if (weeklyMilestoneAwarded > 0) {
      db.prepare(
        `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id, created_at)
         VALUES (?, 'weekly_milestone', ?, ?, ?, ?, ?)`
      ).run(
        userId,
        weeklyMilestoneAwarded,
        finalBalance,
        `7-Day Weekly Streak Milestone (${nextStreak} days)`,
        `milestone-${nextStreak}`,
        now
      );
    }

    return {
      checkinReward,
      weeklyMilestoneAwarded,
      streakDays: nextStreak,
      newBalance: finalBalance,
    };
  });

  try {
    const result = txCheckin();
    const user = getSafeUserById(userId);
    res.json({ ...result, user });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ALREADY_CHECKED_IN') {
      res.status(400).json({ error: 'You have already checked in today.' });
      return;
    }
    res.status(500).json({ error: 'Unable to process daily check-in.' });
  }
});

app.post('/api/rewards/spin', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const today = getTodayUtcDate();
  const now = new Date().toISOString();

  const txSpin = db.transaction(() => {
    const userRow = db
      .prepare('SELECT coin_balance, lifetime_coins, last_spin_date FROM users WHERE id = ?')
      .get(userId) as {
      coin_balance: number;
      lifetime_coins: number;
      last_spin_date: string | null;
    };

    if (userRow.last_spin_date === today) {
      throw new Error('ALREADY_SPUN');
    }

    // Weighted random selection using crypto.randomInt(100)
    const roll = crypto.randomInt(100);
    let cumulative = 0;
    let selectedIndex = 0;
    for (let i = 0; i < SPIN_SEGMENTS.length; i++) {
      cumulative += SPIN_SEGMENTS[i].probability;
      if (roll < cumulative) {
        selectedIndex = i;
        break;
      }
    }

    const segment = SPIN_SEGMENTS[selectedIndex];
    const newBalance = userRow.coin_balance + segment.coins;

    db.prepare(
      `UPDATE users
       SET coin_balance = ?, lifetime_coins = ?, last_spin_date = ?
       WHERE id = ?`
    ).run(newBalance, userRow.lifetime_coins + segment.coins, today, userId);

    db.prepare(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id, created_at)
       VALUES (?, 'spin_wheel', ?, ?, ?, ?, ?)`
    ).run(
      userId,
      segment.coins,
      newBalance,
      `Daily Spin Wheel win: ${segment.label}`,
      `spin-${today}`,
      now
    );

    return {
      segmentIndex: selectedIndex,
      segment,
      rewardCoins: segment.coins,
      newBalance,
    };
  });

  try {
    const result = txSpin();
    const user = getSafeUserById(userId);
    res.json({ ...result, user });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ALREADY_SPUN') {
      res.status(400).json({ error: 'Daily Spin Wheel already used today. Return tomorrow!' });
      return;
    }
    res.status(500).json({ error: 'Unable to spin the wheel right now.' });
  }
});

// ============================================================================
// REFERRALS
// ============================================================================

app.get('/api/referrals', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const user = getSafeUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const referrals = db
    .prepare(
      `SELECT r.id, r.reward_coins, r.status, r.created_at, u.name as referred_name
       FROM referrals r
       JOIN users u ON u.id = r.referred_user_id
       WHERE r.referrer_id = ?
       ORDER BY r.id DESC`
    )
    .all(userId) as Array<{
    id: number;
    reward_coins: number;
    status: string;
    created_at: string;
    referred_name: string;
  }>;

  const totalEarned = referrals
    .filter((r) => r.status === 'credited')
    .reduce((acc, r) => acc + r.reward_coins, 0);

  res.json({
    referralCode: user.referral_code,
    rewardPerReferral: getSettingNumber('referral_reward_referrer', 250),
    refereeBonus: getSettingNumber('referral_reward_referee', 100),
    successfulCount: referrals.filter((r) => r.status === 'credited').length,
    totalEarned,
    referrals,
  });
});

// ============================================================================
// WALLET & WITHDRAWALS
// ============================================================================

const ALLOWED_METHODS = [
  'UPI',
  'Paytm Wallet',
  'Bank Transfer (IMPS/NEFT)',
  'Amazon Pay Gift Card',
  'Google Play Gift Card',
];

app.get('/api/wallet', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const user = getSafeUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const transactions = db
    .prepare(
      `SELECT id, type, amount, balance_after, description, reference_id, created_at
       FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50`
    )
    .all(userId);

  const withdrawals = db
    .prepare(
      `SELECT id, coins_amount, inr_amount, method, account_details, status, admin_note, created_at, reviewed_at
       FROM withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 30`
    )
    .all(userId);

  const coinsPerInr = getSettingNumber('coins_per_inr', 10);
  const minWithdrawalCoins = getSettingNumber('min_withdrawal_coins', 2000);

  res.json({
    availableCoins: user.coin_balance,
    pendingCoins: user.pending_coins,
    lifetimeCoins: user.lifetime_coins,
    redeemableInr: Number((user.coin_balance / coinsPerInr).toFixed(2)),
    coinsPerInr,
    minWithdrawalCoins,
    methods: ALLOWED_METHODS,
    transactions,
    withdrawals,
  });
});

app.post('/api/withdrawals', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { coinsAmount, method, accountDetails } = req.body ?? {};
  const ip = getClientIp(req);

  const parsedCoins = Number(coinsAmount);
  if (!Number.isInteger(parsedCoins) || parsedCoins <= 0) {
    res.status(400).json({ error: 'Withdrawal amount must be a positive whole number of coins.' });
    return;
  }
  if (typeof method !== 'string' || !ALLOWED_METHODS.includes(method)) {
    res.status(400).json({ error: 'Please select a valid redemption method.' });
    return;
  }
  if (
    typeof accountDetails !== 'string' ||
    accountDetails.trim().length < 4 ||
    accountDetails.trim().length > 140
  ) {
    res.status(400).json({ error: 'Please provide valid payout destination details (4–140 chars).' });
    return;
  }

  const minLimit = getSettingNumber('min_withdrawal_coins', 2000);
  const coinsPerInr = getSettingNumber('coins_per_inr', 10);

  if (parsedCoins < minLimit) {
    res.status(400).json({ error: `Minimum withdrawal limit is ${minLimit.toLocaleString()} coins.` });
    return;
  }

  const cleanDetails = accountDetails.trim();
  const inrAmount = Number((parsedCoins / coinsPerInr).toFixed(2));
  const now = new Date().toISOString();

  const txWithdraw = db.transaction(() => {
    const userRow = db
      .prepare('SELECT coin_balance, pending_coins, is_flagged FROM users WHERE id = ?')
      .get(userId) as { coin_balance: number; pending_coins: number; is_flagged: number };

    if (userRow.coin_balance < parsedCoins) {
      throw new Error('INSUFFICIENT_COINS');
    }

    const pendingCount = (
      db
        .prepare("SELECT COUNT(*) as cnt FROM withdrawals WHERE user_id = ? AND status = 'pending'")
        .get(userId) as { cnt: number }
    ).cnt;

    if (pendingCount >= 3) {
      throw new Error('TOO_MANY_PENDING');
    }

    const newAvailable = userRow.coin_balance - parsedCoins;
    const newPending = userRow.pending_coins + parsedCoins;

    db.prepare('UPDATE users SET coin_balance = ?, pending_coins = ? WHERE id = ?').run(
      newAvailable,
      newPending,
      userId
    );

    const wInfo = db
      .prepare(
        `INSERT INTO withdrawals (user_id, coins_amount, inr_amount, method, account_details, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`
      )
      .run(userId, parsedCoins, inrAmount, method, cleanDetails, now);

    const withdrawalId = Number(wInfo.lastInsertRowid);

    db.prepare(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id, created_at)
       VALUES (?, 'withdrawal_debit', ?, ?, ?, ?, ?)`
    ).run(
      userId,
      -parsedCoins,
      newAvailable,
      `Withdrawal request via ${method} (₹${inrAmount.toFixed(2)} INR) — Pending review`,
      `wd-${withdrawalId}`,
      now
    );

    if (parsedCoins >= 20000) {
      logFraudEvent(
        userId,
        'HIGH_VALUE_WITHDRAWAL',
        'low',
        `High-value withdrawal requested: ${parsedCoins} coins (₹${inrAmount.toFixed(2)} INR) via ${method}`,
        ip
      );
    }

    return { withdrawalId, newAvailable, newPending };
  });

  try {
    const result = txWithdraw();
    const user = getSafeUserById(userId);
    res.status(201).json({ ...result, user });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_COINS') {
      res.status(400).json({ error: 'Insufficient available coin balance.' });
      return;
    }
    if (err instanceof Error && err.message === 'TOO_MANY_PENDING') {
      res.status(400).json({ error: 'Maximum of 3 pending withdrawal requests allowed at once.' });
      return;
    }
    res.status(500).json({ error: 'Failed to submit withdrawal request.' });
  }
});

// ============================================================================
// COMMUNITY SECTION
// ============================================================================

app.get('/api/community', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const leaderboard = db
    .prepare(
      `SELECT id, name, avatar_url, lifetime_coins, streak_days
       FROM users
       WHERE is_suspended = 0
       ORDER BY lifetime_coins DESC
       LIMIT 15`
    )
    .all() as Array<{
    id: number;
    name: string;
    avatar_url: string | null;
    lifetime_coins: number;
    streak_days: number;
  }>;

  const user = getSafeUserById(userId)!;
  const taskCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM task_completions WHERE user_id = ?').get(userId) as {
      cnt: number;
    }
  ).cnt;
  const refCount = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status = 'credited'")
      .get(userId) as { cnt: number }
  ).cnt;

  const achievements = [
    {
      id: 'first_task',
      title: 'First Verified Task',
      description: 'Complete at least 1 task from the Tasks hub.',
      unlocked: taskCount >= 1,
      progress: `${Math.min(taskCount, 1)}/1`,
    },
    {
      id: 'streak_7',
      title: '7-Day Consistent Earner',
      description: 'Maintain a 7-day consecutive check-in streak.',
      unlocked: user.streak_days >= 7,
      progress: `${Math.min(user.streak_days, 7)}/7 days`,
    },
    {
      id: 'coin_1000',
      title: '1,000 Lifetime Coins',
      description: `Reach 1,000 total earned coins (₹${(1000 / getSettingNumber('coins_per_inr', 10)).toFixed(2)} INR equivalent).`,
      unlocked: user.lifetime_coins >= 1000,
      progress: `${Math.min(user.lifetime_coins, 1000)}/1000`,
    },
    {
      id: 'ambassador',
      title: 'Community Ambassador',
      description: 'Successfully invite 1 verified friend using your referral code.',
      unlocked: refCount >= 1,
      progress: `${Math.min(refCount, 1)}/1`,
    },
  ];

  const announcements = db
    .prepare('SELECT * FROM announcements ORDER BY is_pinned DESC, id DESC LIMIT 20')
    .all();

  res.json({
    leaderboard: leaderboard.map((row, idx) => ({
      rank: idx + 1,
      id: row.id,
      name: row.name,
      avatarUrl: row.avatar_url,
      lifetimeCoins: row.lifetime_coins,
      streakDays: row.streak_days,
      isCurrentUser: row.id === userId,
    })),
    achievements,
    announcements,
  });
});

// ============================================================================
// PROFILE & VERIFICATION
// ============================================================================

app.patch('/api/profile', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { name, phone, notificationsEnabled } = req.body ?? {};

  const current = getSafeUserById(userId);
  if (!current) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const nextName =
    typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 60
      ? name.trim()
      : current.name;

  let nextPhone = current.phone;
  let nextPhoneVerified = current.phone_verified;
  if (typeof phone === 'string') {
    const cleaned = phone.trim();
    if (cleaned.length > 0 && (cleaned.length < 7 || cleaned.length > 20)) {
      res.status(400).json({ error: 'Please enter a valid phone number (7–20 digits).' });
      return;
    }
    if (cleaned !== (current.phone || '')) {
      nextPhone = cleaned || null;
      nextPhoneVerified = 0;
    }
  }

  const nextNotif =
    typeof notificationsEnabled === 'boolean'
      ? notificationsEnabled
        ? 1
        : 0
      : current.notifications_enabled;

  db.prepare(
    'UPDATE users SET name = ?, phone = ?, phone_verified = ?, notifications_enabled = ? WHERE id = ?'
  ).run(nextName, nextPhone, nextPhoneVerified, nextNotif, userId);

  res.json({ user: getSafeUserById(userId) });
});

app.post('/api/profile/verify-request', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { channel } = req.body ?? {};
  if (channel !== 'email' && channel !== 'phone') {
    res.status(400).json({ error: 'Channel must be email or phone.' });
    return;
  }

  const user = getSafeUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const target = channel === 'email' ? user.email : user.phone;
  if (!target) {
    res.status(400).json({ error: 'Please save your phone number first before verifying.' });
    return;
  }

  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = Date.now() + 10 * 60 * 1000;
  db.prepare('DELETE FROM verification_codes WHERE user_id = ? AND channel = ?').run(userId, channel);
  db.prepare(
    `INSERT INTO verification_codes (user_id, channel, target, code, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, channel, target, code, expiresAt, new Date().toISOString());

  res.json({
    message: `Verification code generated for ${target}.`,
    verificationCodePreview: code,
  });
});

app.post('/api/profile/verify-confirm', requireUser, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { channel, code } = req.body ?? {};
  if ((channel !== 'email' && channel !== 'phone') || typeof code !== 'string') {
    res.status(400).json({ error: 'Channel and 6-digit code are required.' });
    return;
  }

  const row = db
    .prepare(
      'SELECT id, code, expires_at FROM verification_codes WHERE user_id = ? AND channel = ? ORDER BY id DESC LIMIT 1'
    )
    .get(userId, channel) as { id: number; code: string; expires_at: number } | undefined;

  if (!row || Date.now() > row.expires_at || !constantTimeEqualString(row.code, code.trim())) {
    res.status(400).json({ error: 'Invalid or expired verification code.' });
    return;
  }

  if (channel === 'email') {
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
  } else {
    db.prepare('UPDATE users SET phone_verified = 1 WHERE id = ?').run(userId);
  }
  db.prepare('DELETE FROM verification_codes WHERE user_id = ? AND channel = ?').run(userId, channel);

  res.json({ user: getSafeUserById(userId) });
});

// ============================================================================
// SECURE ADMIN AUTHENTICATION & MANAGEMENT CONSOLE
// ============================================================================

app.get('/api/admin/auth-status', (_req: Request, res: Response) => {
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  const claimedHash = getSettingString('admin_password_hash');
  res.json({
    envPasscodeConfigured: envPasscode.length > 0,
    isClaimed: Boolean(claimedHash),
  });
});

app.post('/api/admin/claim', (req: Request, res: Response) => {
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  if (envPasscode.length > 0) {
    res.status(403).json({
      error: 'Admin passcode is configured via server environment. Use standard Admin Sign In.',
    });
    return;
  }

  const { password } = req.body ?? {};
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    res.status(400).json({ error: 'Admin password must be between 8 and 128 characters.' });
    return;
  }

  const txClaim = db.transaction(() => {
    const existing = getSettingString('admin_password_hash');
    if (existing) {
      throw new Error('ALREADY_CLAIMED');
    }
    const hashed = hashPassword(password);
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(
      'admin_password_hash',
      hashed
    );
  });

  try {
    txClaim();
    const token = issueAuthToken('admin', 'admin');
    res.status(201).json({ token });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ALREADY_CLAIMED') {
      res.status(409).json({ error: 'Admin access has already been claimed. Please sign in.' });
      return;
    }
    res.status(500).json({ error: 'Unable to set admin password.' });
  }
});

app.post('/api/admin/login', (req: Request, res: Response) => {
  const { password } = req.body ?? {};
  if (typeof password !== 'string' || password.length === 0) {
    res.status(400).json({ error: 'Admin password is required.' });
    return;
  }

  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  if (envPasscode.length > 0) {
    if (!constantTimeEqualString(password, envPasscode)) {
      res.status(401).json({ error: 'Invalid admin passcode.' });
      return;
    }
    res.json({ token: issueAuthToken('admin', 'admin') });
    return;
  }

  const claimedHash = getSettingString('admin_password_hash');
  if (!claimedHash) {
    res.status(400).json({ error: 'Admin password has not been claimed yet.' });
    return;
  }

  if (!verifyPassword(password, claimedHash)) {
    res.status(401).json({ error: 'Invalid admin password.' });
    return;
  }

  res.json({ token: issueAuthToken('admin', 'admin') });
});

app.get('/api/admin/overview', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const users = db
    .prepare(
      `SELECT id, name, email, phone, email_verified, phone_verified, referral_code,
              coin_balance, pending_coins, lifetime_coins, streak_days,
              is_flagged, flag_reason, is_suspended, created_at
       FROM users
       WHERE password_hash != 'COMMUNITY_LOCKED_PROFILE'
       ORDER BY id DESC`
    )
    .all();

  const tasks = db.prepare('SELECT * FROM tasks ORDER BY id DESC').all();

  const withdrawals = db
    .prepare(
      `SELECT w.*, u.name as user_name, u.email as user_email, u.is_flagged as user_flagged
       FROM withdrawals w
       JOIN users u ON u.id = w.user_id
       ORDER BY CASE WHEN w.status = 'pending' THEN 0 ELSE 1 END, w.id DESC`
    )
    .all();

  const transactions = db
    .prepare(
      `SELECT t.*, u.name as user_name, u.email as user_email
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.id DESC LIMIT 60`
    )
    .all();

  const fraudLogs = db
    .prepare(
      `SELECT f.*, u.name as user_name, u.email as user_email
       FROM fraud_logs f
       LEFT JOIN users u ON u.id = f.user_id
       ORDER BY f.id DESC LIMIT 50`
    )
    .all();

  const announcements = db.prepare('SELECT * FROM announcements ORDER BY id DESC').all();

  const referrals = db
    .prepare(
      `SELECT r.*, u1.name as referrer_name, u2.name as referred_name
       FROM referrals r
       JOIN users u1 ON u1.id = r.referrer_id
       JOIN users u2 ON u2.id = r.referred_user_id
       ORDER BY r.id DESC LIMIT 50`
    )
    .all();

  const settings = {
    coins_per_inr: getSettingNumber('coins_per_inr', 10),
    min_withdrawal_coins: getSettingNumber('min_withdrawal_coins', 2000),
    referral_reward_referrer: getSettingNumber('referral_reward_referrer', 250),
    referral_reward_referee: getSettingNumber('referral_reward_referee', 100),
    daily_checkin_base: getSettingNumber('daily_checkin_base', 50),
    weekly_milestone_bonus: getSettingNumber('weekly_milestone_bonus', 300),
  };

  res.json({
    users,
    tasks,
    withdrawals,
    transactions,
    fraudLogs,
    announcements,
    referrals,
    settings,
  });
});

app.patch('/api/admin/users/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const targetUserId = Number(req.params.id);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    res.status(400).json({ error: 'Invalid user ID.' });
    return;
  }

  const { isSuspended, clearFlag, coinAdjustment, adjustmentReason } = req.body ?? {};
  const user = getSafeUserById(targetUserId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const txAdminUser = db.transaction(() => {
    if (typeof isSuspended === 'boolean') {
      db.prepare('UPDATE users SET is_suspended = ? WHERE id = ?').run(
        isSuspended ? 1 : 0,
        targetUserId
      );
    }
    if (clearFlag === true) {
      db.prepare('UPDATE users SET is_flagged = 0, flag_reason = NULL WHERE id = ?').run(
        targetUserId
      );
    }
    if (typeof coinAdjustment === 'number' && Number.isInteger(coinAdjustment) && coinAdjustment !== 0) {
      const fresh = db
        .prepare('SELECT coin_balance, lifetime_coins FROM users WHERE id = ?')
        .get(targetUserId) as { coin_balance: number; lifetime_coins: number };

      const nextBalance = Math.max(0, fresh.coin_balance + coinAdjustment);
      const nextLifetime =
        coinAdjustment > 0 ? fresh.lifetime_coins + coinAdjustment : fresh.lifetime_coins;

      db.prepare('UPDATE users SET coin_balance = ?, lifetime_coins = ? WHERE id = ?').run(
        nextBalance,
        nextLifetime,
        targetUserId
      );

      const reason =
        typeof adjustmentReason === 'string' && adjustmentReason.trim().length > 0
          ? adjustmentReason.trim().slice(0, 120)
          : 'Administrator balance adjustment';

      db.prepare(
        `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id, created_at)
         VALUES (?, 'admin_adjustment', ?, ?, ?, 'admin', ?)`
      ).run(targetUserId, coinAdjustment, nextBalance, reason, new Date().toISOString());
    }
  });

  txAdminUser();
  res.json({ user: getSafeUserById(targetUserId) });
});

app.post('/api/admin/tasks', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const {
    title,
    category,
    partnerName,
    description,
    instructions,
    rewardCoins,
    durationSeconds,
    cooldownHours,
    isFeatured,
  } = req.body ?? {};

  if (typeof title !== 'string' || title.trim().length < 3) {
    res.status(400).json({ error: 'Task title is required (min 3 characters).' });
    return;
  }
  const reward = Number(rewardCoins);
  const duration = Number(durationSeconds) || 10;
  const cooldown = Number(cooldownHours) >= 0 ? Number(cooldownHours) : 24;
  if (!Number.isInteger(reward) || reward <= 0 || reward > 100000) {
    res.status(400).json({ error: 'Reward coins must be an integer between 1 and 100,000.' });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO tasks (
        title, category, partner_name, description, instructions,
        reward_coins, duration_seconds, cooldown_hours, is_featured, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .run(
      title.trim(),
      typeof category === 'string' ? category : 'partner_offer',
      typeof partnerName === 'string' && partnerName.trim() ? partnerName.trim() : 'RewardX Partner',
      typeof description === 'string' ? description.trim() : '',
      typeof instructions === 'string' ? instructions.trim() : 'Complete the verified partner session.',
      reward,
      Math.max(3, Math.min(120, Math.round(duration))),
      cooldown,
      isFeatured ? 1 : 0,
      new Date().toISOString()
    );

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ task });
});

app.patch('/api/admin/tasks/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const taskId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as
    | Record<string, unknown>
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }

  const { title, rewardCoins, isActive, isFeatured, partnerName, description, instructions } =
    req.body ?? {};

  const nextTitle = typeof title === 'string' && title.trim() ? title.trim() : String(existing.title);
  const nextReward =
    typeof rewardCoins === 'number' && Number.isInteger(rewardCoins) && rewardCoins > 0
      ? rewardCoins
      : Number(existing.reward_coins);
  const nextActive = typeof isActive === 'boolean' ? (isActive ? 1 : 0) : Number(existing.is_active);
  const nextFeatured =
    typeof isFeatured === 'boolean' ? (isFeatured ? 1 : 0) : Number(existing.is_featured);
  const nextPartner =
    typeof partnerName === 'string' && partnerName.trim()
      ? partnerName.trim()
      : String(existing.partner_name);
  const nextDesc =
    typeof description === 'string' ? description.trim() : String(existing.description);
  const nextInst =
    typeof instructions === 'string' ? instructions.trim() : String(existing.instructions);

  db.prepare(
    `UPDATE tasks
     SET title = ?, reward_coins = ?, is_active = ?, is_featured = ?,
         partner_name = ?, description = ?, instructions = ?
     WHERE id = ?`
  ).run(nextTitle, nextReward, nextActive, nextFeatured, nextPartner, nextDesc, nextInst, taskId);

  res.json({ task: db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) });
});

app.delete('/api/admin/tasks/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const taskId = Number(req.params.id);
  db.prepare('UPDATE tasks SET is_active = 0 WHERE id = ?').run(taskId);
  res.json({ deleted: true });
});

app.patch('/api/admin/settings', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const allowedKeys = [
    'coins_per_inr',
    'min_withdrawal_coins',
    'referral_reward_referrer',
    'referral_reward_referee',
    'daily_checkin_base',
    'weekly_milestone_bonus',
  ];

  const updateStmt = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)');
  for (const key of allowedKeys) {
    const val = req.body?.[key];
    if (val !== undefined) {
      const num = Number(val);
      if (!Number.isInteger(num) || num <= 0) {
        res.status(400).json({ error: `Setting ${key} must be a positive integer.` });
        return;
      }
      updateStmt.run(key, String(num));
    }
  }

  res.json({
    settings: {
      coins_per_inr: getSettingNumber('coins_per_inr', 10),
      min_withdrawal_coins: getSettingNumber('min_withdrawal_coins', 2000),
      referral_reward_referrer: getSettingNumber('referral_reward_referrer', 250),
      referral_reward_referee: getSettingNumber('referral_reward_referee', 100),
      daily_checkin_base: getSettingNumber('daily_checkin_base', 50),
      weekly_milestone_bonus: getSettingNumber('weekly_milestone_bonus', 300),
    },
  });
});

app.post(
  '/api/admin/withdrawals/:id/review',
  requireAdmin,
  (req: AuthenticatedRequest, res: Response) => {
    const withdrawalId = Number(req.params.id);
    const { decision, adminNote } = req.body ?? {};
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ error: 'Decision must be approved or rejected.' });
      return;
    }

    const note =
      typeof adminNote === 'string' && adminNote.trim()
        ? adminNote.trim().slice(0, 200)
        : decision === 'approved'
        ? 'Verified and queued for payout'
        : 'Rejected during compliance review; coins refunded';

    const now = new Date().toISOString();

    const txReview = db.transaction(() => {
      const w = db
        .prepare('SELECT * FROM withdrawals WHERE id = ?')
        .get(withdrawalId) as
        | {
            id: number;
            user_id: number;
            coins_amount: number;
            status: string;
            method: string;
          }
        | undefined;

      if (!w) {
        throw new Error('NOT_FOUND');
      }
      if (w.status !== 'pending') {
        throw new Error('ALREADY_REVIEWED');
      }

      const userRow = db
        .prepare('SELECT coin_balance, pending_coins FROM users WHERE id = ?')
        .get(w.user_id) as { coin_balance: number; pending_coins: number };

      const nextPending = Math.max(0, userRow.pending_coins - w.coins_amount);

      if (decision === 'approved') {
        db.prepare('UPDATE users SET pending_coins = ? WHERE id = ?').run(nextPending, w.user_id);
      } else {
        const refundedBalance = userRow.coin_balance + w.coins_amount;
        db.prepare('UPDATE users SET coin_balance = ?, pending_coins = ? WHERE id = ?').run(
          refundedBalance,
          nextPending,
          w.user_id
        );
        db.prepare(
          `INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id, created_at)
           VALUES (?, 'withdrawal_refund', ?, ?, ?, ?, ?)`
        ).run(
          w.user_id,
          w.coins_amount,
          refundedBalance,
          `Refund for rejected ${w.method} withdrawal: ${note}`,
          `wd-${w.id}`,
          now
        );
      }

      db.prepare(
        `UPDATE withdrawals
         SET status = ?, admin_note = ?, reviewed_by = 'Admin', reviewed_at = ?
         WHERE id = ?`
      ).run(decision, note, now, withdrawalId);
    });

    try {
      txReview();
      res.json({ updated: true });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Withdrawal request not found.' });
        return;
      }
      if (err instanceof Error && err.message === 'ALREADY_REVIEWED') {
        res.status(400).json({ error: 'Withdrawal has already been reviewed.' });
        return;
      }
      res.status(500).json({ error: 'Unable to review withdrawal.' });
    }
  }
);

app.post('/api/admin/announcements', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { title, body, category, isPinned } = req.body ?? {};
  if (typeof title !== 'string' || title.trim().length < 3) {
    res.status(400).json({ error: 'Announcement title is required.' });
    return;
  }
  if (typeof body !== 'string' || body.trim().length < 5) {
    res.status(400).json({ error: 'Announcement message is required.' });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO announcements (title, body, category, is_pinned, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      title.trim(),
      body.trim(),
      typeof category === 'string' && category.trim() ? category.trim() : 'Update',
      isPinned ? 1 : 0,
      new Date().toISOString()
    );

  res.status(201).json({
    announcement: db
      .prepare('SELECT * FROM announcements WHERE id = ?')
      .get(Number(info.lastInsertRowid)),
  });
});

app.delete(
  '/api/admin/announcements/:id',
  requireAdmin,
  (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
    res.json({ deleted: true });
  }
);

// ============================================================================
// VITE / STATIC SERVING
// ============================================================================

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RewardX server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
