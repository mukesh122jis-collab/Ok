import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'rewardx.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      avatar_url TEXT,
      phone TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      phone_verified INTEGER NOT NULL DEFAULT 0,
      referral_code TEXT UNIQUE NOT NULL,
      referred_by INTEGER REFERENCES users(id),
      coin_balance INTEGER NOT NULL DEFAULT 0,
      pending_coins INTEGER NOT NULL DEFAULT 0,
      lifetime_coins INTEGER NOT NULL DEFAULT 0,
      streak_days INTEGER NOT NULL DEFAULT 0,
      last_checkin_date TEXT,
      last_spin_date TEXT,
      last_weekly_milestone_streak INTEGER NOT NULL DEFAULT 0,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      flag_reason TEXT,
      is_suspended INTEGER NOT NULL DEFAULT 0,
      notifications_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      description TEXT NOT NULL,
      instructions TEXT NOT NULL,
      reward_coins INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 10,
      cooldown_hours INTEGER NOT NULL DEFAULT 24,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      reward_coins INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      completed_at TEXT NOT NULL,
      completed_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL REFERENCES users(id),
      referred_user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
      referral_code TEXT NOT NULL,
      reward_coins INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'credited',
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      description TEXT NOT NULL,
      reference_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      coins_amount INTEGER NOT NULL,
      inr_amount REAL NOT NULL,
      method TEXT NOT NULL,
      account_details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      reviewed_by TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Update',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fraud_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      details TEXT NOT NULL,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      channel TEXT NOT NULL,
      target TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  migrateUsdToInr();
  seedDefaults();
}

function migrateUsdToInr(): void {
  const columns = db.prepare('PRAGMA table_info(withdrawals)').all() as Array<{ name: string }>;
  const hasUsdAmount = columns.some((c) => c.name === 'usd_amount');
  const hasInrAmount = columns.some((c) => c.name === 'inr_amount');

  if (hasUsdAmount && !hasInrAmount) {
    db.exec('ALTER TABLE withdrawals RENAME COLUMN usd_amount TO inr_amount');
    db.exec('UPDATE withdrawals SET inr_amount = ROUND(coins_amount * 1.0 / 10, 2)');
  }

  const oldSetting = db
    .prepare("SELECT value FROM app_settings WHERE key = 'coins_per_usd'")
    .get() as { value: string } | undefined;
  if (oldSetting) {
    db.prepare("DELETE FROM app_settings WHERE key = 'coins_per_usd'").run();
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('coins_per_inr', '10')").run();
  }

  db.prepare(
    `UPDATE announcements
     SET title = 'Transparent Payout Schedule & INR Conversion Rate',
         body = '10 RewardX Coins equal ₹1.00 INR (1,000 Coins = ₹100). Minimum redemption starts at 2,000 Coins (₹200.00) via UPI, Paytm Wallet, or Bank Transfer within 24–48 hours with zero hidden platform fees.'
     WHERE title = 'Transparent Payout Schedule & Conversion Rate' AND body LIKE '%USD%'`
  ).run();
}

function seedDefaults(): void {
  const defaultSettings: Array<[string, string]> = [
    ['coins_per_inr', '10'],
    ['min_withdrawal_coins', '2000'],
    ['referral_reward_referrer', '250'],
    ['referral_reward_referee', '100'],
    ['daily_checkin_base', '50'],
    ['weekly_milestone_bonus', '300'],
  ];

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }

  const taskCount = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }).count;
  if (taskCount === 0) {
    const now = new Date().toISOString();
    const insertTask = db.prepare(`
      INSERT INTO tasks (
        title, category, partner_name, description, instructions,
        reward_coins, duration_seconds, cooldown_hours, is_featured, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const seedTasks = [
      [
        'Watch Brand Spotlight Video',
        'sponsored_ad',
        'AdPulse Media',
        'Watch a short verified partner spotlight clip to unlock instant coins.',
        'Keep the ad player open until the countdown reaches zero, then claim your verified reward.',
        60,
        8,
        24,
        0,
      ],
      [
        'Explore CloudNotes Productivity App',
        'partner_offer',
        'CloudNotes',
        'Review our featured productivity partner walkthrough and verify app highlights.',
        'Read the 3-step partner overview and confirm your session timer completes.',
        180,
        10,
        0,
        0,
      ],
      [
        'Daily Streak Check-In Bonus',
        'daily_checkin',
        'RewardX Core',
        'Check in once every 24 hours to build your streak multiplier and unlock weekly milestones.',
        'Click Check In on the Daily Rewards hub or via this card to collect today’s streak bonus.',
        50,
        3,
        24,
        0,
      ],
      [
        'Play Orbit Dash Arcade Trial',
        'partner_game',
        'PixelForge Games',
        'Test-play an approved partner mini-session and earn coins for active engagement.',
        'Launch the verified trial timer and stay active for 12 seconds to register gameplay.',
        150,
        12,
        24,
        0,
      ],
      [
        'Daily Accuracy Challenge: FinLit Quiz',
        'daily_challenge',
        'FinLit Labs',
        'Complete today’s short financial literacy challenge to earn bonus coins.',
        'Review the daily prompt and hold the active challenge session for 8 seconds to submit.',
        120,
        8,
        24,
        0,
      ],
      [
        'Super Offer: NovaPlay Gaming Pass',
        'super_offer',
        'NovaPlay',
        'Featured high-payout trial with our top gaming partner. Limited daily allocation.',
        'Start the Super Offer session and complete the 15-second verification timer.',
        450,
        15,
        0,
        1,
      ],
      [
        'Mega Offer: FinVault Cashback Onboarding',
        'mega_offer',
        'FinVault',
        'Complete the verified FinVault partner onboarding walkthrough for our highest single reward.',
        'Complete the 15-second partner verification walkthrough and confirm completion.',
        800,
        15,
        0,
        1,
      ],
      [
        'Watch Sponsored Tech Preview',
        'sponsored_ad',
        'StreamBox',
        'Watch an interactive hardware & app showcase clip.',
        'Watch the full 10-second partner showcase before claiming your reward.',
        75,
        10,
        24,
        0,
      ],
      [
        'Play Neon Brick Breaker Partner Challenge',
        'partner_game',
        'Arcadia Studio',
        'Play a verified partner game session to collect instant gaming coins.',
        'Keep the game verification session open for 12 seconds to unlock payout.',
        200,
        12,
        24,
        0,
      ],
    ];

    for (const t of seedTasks) {
      insertTask.run(...t, now);
    }
  }

  const announcementCount = (db.prepare('SELECT COUNT(*) as count FROM announcements').get() as { count: number }).count;
  if (announcementCount === 0) {
    const now = new Date().toISOString();
    const insertAnnouncement = db.prepare(`
      INSERT INTO announcements (title, body, category, is_pinned, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertAnnouncement.run(
      'Transparent Payout Schedule & INR Conversion Rate',
      '10 RewardX Coins equal ₹1.00 INR (1,000 Coins = ₹100). Minimum redemption starts at 2,000 Coins (₹200.00) via UPI, Paytm Wallet, or Bank Transfer within 24–48 hours with zero hidden platform fees.',
      'Policy',
      1,
      now
    );
    insertAnnouncement.run(
      'Weekly 7-Day Streak Bonus Active',
      'Check in for 7 consecutive days to automatically unlock an extra +300 Coins milestone reward on top of your daily spin wheel prizes.',
      'Event',
      0,
      now
    );
    insertAnnouncement.run(
      'New Partner: FinVault & NovaPlay Offers',
      'Two verified Super & Mega Offers are now live in the Tasks hub. One-time high-coin rewards are verified server-side upon completion.',
      'Partners',
      0,
      now
    );
  }

  // Seed community leaderboard profiles (read-only community profiles; non-login accounts with unreachable placeholder hash so leaderboard feels realistic without backdoor passwords)
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount === 0) {
    const now = new Date().toISOString();
    const insertCommunityMember = db.prepare(`
      INSERT INTO users (
        name, email, password_hash, role, avatar_url, email_verified, phone_verified,
        referral_code, coin_balance, pending_coins, lifetime_coins, streak_days, created_at
      ) VALUES (?, ?, ?, 'user', ?, 1, 1, ?, ?, 0, ?, ?, ?)
    `);

    const communityMembers = [
      ['Aarav Sharma', 'aarav.community@rewardx.local', 'COMMUNITY_LOCKED_PROFILE', '/src/assets/images/avatar_default_member_1795267685073.jpg', 'RXAARAV88', 4250, 18450, 14],
      ['Maya Lin', 'maya.community@rewardx.local', 'COMMUNITY_LOCKED_PROFILE', '/src/assets/images/avatar_default_member_1795267685073.jpg', 'RXMAYA204', 3100, 15200, 11],
      ['Daniel Okafor', 'daniel.community@rewardx.local', 'COMMUNITY_LOCKED_PROFILE', '/src/assets/images/avatar_default_member_1795267685073.jpg', 'RXDAN910', 2780, 12940, 9],
      ['Sofia Morales', 'sofia.community@rewardx.local', 'COMMUNITY_LOCKED_PROFILE', '/src/assets/images/avatar_default_member_1795267685073.jpg', 'RXSOFIA55', 1940, 9870, 7],
      ['Liam Patel', 'liam.community@rewardx.local', 'COMMUNITY_LOCKED_PROFILE', '/src/assets/images/avatar_default_member_1795267685073.jpg', 'RXLIAM312', 1420, 7450, 5],
    ];

    for (const m of communityMembers) {
      insertCommunityMember.run(...m, now);
    }
  }
}

export function getSettingNumber(key: string, fallback: number): number {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return fallback;
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getSettingString(key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function generateUniqueReferralCode(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'USER';
  for (let i = 0; i < 10; i++) {
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const candidate = `RX${clean}${suffix}`;
    const existing = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(candidate);
    if (!existing) return candidate;
  }
  return `RX${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}
