export type EventType = "classified" | "hidden" | "revealed";
export type Platform = "facebook" | "twitter";
export type DataSource = "live" | "fixture";

export type PostEventInput = {
  eventType: EventType;
  platform: Platform;
  postId: string;
  isNegative?: boolean | null;
  occurredAt?: string;
};

export type DigitalCounts = {
  classified: number;
  negative: number;
  hidden: number;
  revealed: number;
  negativityRate: number | null;
  revealRate: number | null;
};

export type SleepNight = {
  date: string;
  durationSeconds: number;
  sleepStart: string | null;
  sleepEnd: string | null;
  source: string;
};

export type Exercise = {
  polarId: string;
  startTime: string;
  durationSeconds: number;
  sport: string | null;
  calories: number | null;
  cardioLoad: number | null;
  source: string;
};

export type RechargeNight = {
  date: string;
  ansCharge: number | null;
  status: string | null;
  source: string;
};

export type Insight = {
  headline: string;
  summary: string;
  disclaimer: string;
  affirmation: string;
  recoveryLabel: string;
  activityLabel: string;
  signals: Record<string, number | null>;
};

export type OverviewPayload = {
  dateLabel: string;
  blockedLast3Days: number;
  revealedLast3Days: number;
  dataSource: DataSource | null;
  lastExtensionEvent: string | null;
  lastPolarSync: string | null;
  insight: Insight;
};

export type PhysicalPayload = {
  dataSource: DataSource | null;
  lastPolarSync: string | null;
  hoursSinceWorkout: number | null;
  lastWorkout: Exercise | null;
  sleepNights: SleepNight[];
  exercises: Exercise[];
  rechargeNights: RechargeNight[];
  recentSleepHours: number | null;
  baselineSleepHours: number | null;
};

export type MentalPayload = {
  last3Days: DigitalCounts;
  last14Days: DigitalCounts;
  lastExtensionEvent: string | null;
};

export type SettingsPayload = {
  dataSource: DataSource | null;
  lastExtensionEvent: string | null;
  lastPolarSync: string | null;
  polarConnected: boolean;
  polarUserId: string | null;
  polarConfigured: boolean;
  eventCount: number;
  sleepCount: number;
  exerciseCount: number;
};
