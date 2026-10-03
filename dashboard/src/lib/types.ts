export type EventType = "classified" | "hidden" | "revealed";
export type Platform = "facebook" | "twitter";
export type DataSource = "live" | "fixture" | "export";

export type PostEventInput = {
  eventType: EventType;
  platform: Platform;
  postId: string;
  isNegative?: boolean | null;
  occurredAt?: string;
  pairingToken?: string | null;
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
  score: number | null;
  remSeconds: number | null;
  deepSeconds: number | null;
  lightSeconds: number | null;
  efficiencyPercent: number | null;
};

export type Exercise = {
  polarId: string;
  startTime: string;
  durationSeconds: number;
  sport: string | null;
  calories: number | null;
  cardioLoad: number | null;
  cardioLoadLabel: string | null;
  hrAvg: number | null;
  hrMax: number | null;
  hrCap: number | null;
  distanceMeters: number | null;
  name: string | null;
  source: string;
  zoneLowSeconds: number;
  zoneMidSeconds: number;
  zoneHighSeconds: number;
};

export type DailyActivity = {
  date: string;
  stepCount: number;
  stepsDistance: number | null;
  calories: number | null;
  source: string;
};

export type RechargeNight = {
  date: string;
  ansCharge: number | null;
  status: string | null;
  source: string;
};

export type PhysicalHighlight = {
  label: string;
  value: string;
  detail: string;
};

export type PhysicalSportShare = {
  sport: string;
  count: number;
  minutes: number;
  distanceKm: number | null;
};

export type HeartZoneStats = {
  lowSeconds: number;
  highSeconds: number;
  midSeconds: number;
  lowSessions: number;
  highSessions: number;
  mixedSessions: number;
  verdict: string;
  verdictDetail: string;
};

export type PhysicalSummary = {
  periodLabel: string;
  dayCount: number;
  affirmation: string;
  pepTalks: string[];
  supporting: string;
  highlights: PhysicalHighlight[];
  sports: PhysicalSportShare[];
  heart: HeartZoneStats | null;
};

export type Insight = {
  headline: string;
  summary: string;
  disclaimer: string;
  affirmation: string;
  recoveryLabel: string;
  activityLabel: string;
  ruleId: string;
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
  summary: PhysicalSummary;
  recentSleepHours: number | null;
  baselineSleepHours: number | null;
  averageSteps: number | null;
  lastSleepScore: number | null;
  lastActivityDate: string | null;
};

export type MentalPlatformShare = {
  platform: Platform;
  label: string;
  counts: DigitalCounts;
};

export type MentalLoad = DigitalCounts & {
  verdict: string;
  verdictDetail: string;
};

export type MentalSummary = {
  periodLabel: string;
  asOf: string;
  pepTalks: string[];
  affirmation: string;
  supporting: string;
  load: MentalLoad;
  last3Days: DigitalCounts;
  last14Days: DigitalCounts;
  platforms: MentalPlatformShare[];
};

export type MentalPayload = {
  last3Days: DigitalCounts;
  last14Days: DigitalCounts;
  lastExtensionEvent: string | null;
  summary: MentalSummary;
  displayName: string;
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
  activityCount: number;
  displayName: string;
  pairingToken: string;
  userId: string;
};
