export function toIso(date = new Date()): string {
  return date.toISOString();
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysAgo(days: number, from = new Date()): Date {
  const next = new Date(from);
  next.setDate(next.getDate() - days);
  return next;
}

export function startOfLocalDay(daysBack = 0, from = new Date()): Date {
  const next = new Date(from);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - daysBack);
  return next;
}

export function isoDaysAgo(days: number, from = new Date()): string {
  return startOfLocalDay(days, from).toISOString();
}

export function formatLongDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

export function hoursBetween(fromIso: string, to = new Date()): number {
  return Math.max(0, (to.getTime() - new Date(fromIso).getTime()) / 36e5);
}

export function secondsToHours(seconds: number): number {
  return seconds / 3600;
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
