import type { ScheduleRule } from "./types";

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * First rule (in array order) whose day and time window covers `now`, or
 * null if none apply -- callers fall back to the screen's normal
 * configuration in that case. Order is the only priority mechanism: if two
 * rules could overlap, whichever comes first in the list wins.
 */
export function getActiveScheduleRule(rules: ScheduleRule[], now: Date): ScheduleRule | null {
  const day = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const rule of rules) {
    if (rule.days.length > 0 && !rule.days.includes(day)) continue;

    const start = timeToMinutes(rule.startTime);
    const end = timeToMinutes(rule.endTime);
    if (start === end) continue; // zero-length window

    const inWindow = start < end ? nowMinutes >= start && nowMinutes < end : nowMinutes >= start || nowMinutes < end;
    if (inWindow) return rule;
  }
  return null;
}
