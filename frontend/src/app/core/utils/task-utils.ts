import { Task } from '../models/models';
import { nowTime, todayIso } from './date';

/** A task is overdue only if it is still open and its time has passed. It is never auto-completed. */
export function isOverdue(t: Task, today = todayIso(), now = nowTime()): boolean {
  if (t.status !== 'Pending' && t.status !== 'In Progress') return false;
  if (t.date < today) return true;
  return t.date === today && !!t.endTime && t.endTime < now;
}

export const byTime = (a: Task, b: Task) =>
  (a.date + (a.startTime || '99:99')).localeCompare(b.date + (b.startTime || '99:99')) || a.title.localeCompare(b.title);
