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

export function formatDayHeading(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short"
  }).format(date);
}

export function formatShortDate(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short"
  }).format(date);
}

export function formatClock(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
