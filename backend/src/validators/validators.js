export const STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const CATEGORIES = ['Study', 'Programming', 'Work', 'Personal', 'Health', 'Family', 'Finance', 'Meeting', 'Exercise', 'Other'];
export const PHASES = ['Before', 'During', 'After', 'General'];
export const EVENT_STATUSES = ['Planned', 'In Progress', 'Completed', 'Cancelled'];
export const GOAL_STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isDate = (v) =>
  typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
  new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
export const isTime = (v) => typeof v === 'string' && TIME_RE.test(v);

const trimmed = (v) => (typeof v === 'string' ? v.trim() : v);
/** Optional text: returns '' when empty, null when invalid. */
const optText = (v, max = 5000) => (v == null || v === '' ? '' : typeof v === 'string' && v.length <= max ? v.trim() : null);

/** Every validator returns { value } or { errors: string[] }. */
export function validateTask(body) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};
  const title = trimmed(b.title);
  if (typeof title !== 'string' || !title || title.length > 200) errors.push('title is required (max 200 characters)');
  if (!isDate(b.date)) errors.push('date must be a valid YYYY-MM-DD date');
  if (b.startTime && !isTime(b.startTime)) errors.push('startTime must be HH:mm');
  if (b.endTime && !isTime(b.endTime)) errors.push('endTime must be HH:mm');
  if (b.endTime && !b.startTime) errors.push('endTime requires a startTime');
  if (isTime(b.startTime) && isTime(b.endTime) && b.endTime <= b.startTime) errors.push('endTime must be later than startTime');
  const category = b.category ?? 'Other';
  if (!CATEGORIES.includes(category)) errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
  const priority = b.priority ?? 'Medium';
  if (!PRIORITIES.includes(priority)) errors.push(`priority must be one of: ${PRIORITIES.join(', ')}`);
  const status = b.status ?? 'Pending';
  if (!STATUSES.includes(status)) errors.push(`status must be one of: ${STATUSES.join(', ')}`);
  const phase = b.phase ?? 'General';
  if (!PHASES.includes(phase)) errors.push(`phase must be one of: ${PHASES.join(', ')}`);
  const description = optText(b.description);
  const location = optText(b.location, 300);
  const notes = optText(b.notes);
  if (description === null) errors.push('description must be text');
  if (location === null) errors.push('location must be text (max 300 characters)');
  if (notes === null) errors.push('notes must be text');
  if (b.reminderAt && (typeof b.reminderAt !== 'string' || Number.isNaN(Date.parse(b.reminderAt)))) errors.push('reminderAt must be an ISO date-time');
  for (const k of ['eventId', 'goalId']) {
    if (b[k] != null && b[k] !== '' && typeof b[k] !== 'string') errors.push(`${k} must be a string`);
  }
  if (errors.length) return { errors };
  return {
    value: {
      title, description, date: b.date, startTime: b.startTime || '', endTime: b.endTime || '',
      category, priority, status, phase, eventId: b.eventId || null, goalId: b.goalId || null,
      location, reminderAt: b.reminderAt || null, notes,
    },
  };
}

export function validateEvent(body) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};
  const title = trimmed(b.title);
  if (typeof title !== 'string' || !title || title.length > 200) errors.push('title is required (max 200 characters)');
  if (!isDate(b.date)) errors.push('date must be a valid YYYY-MM-DD date');
  if (b.startTime && !isTime(b.startTime)) errors.push('startTime must be HH:mm');
  if (b.endTime && !isTime(b.endTime)) errors.push('endTime must be HH:mm');
  if (isTime(b.startTime) && isTime(b.endTime) && b.endTime <= b.startTime) errors.push('endTime must be later than startTime');
  const status = b.status ?? 'Planned';
  if (!EVENT_STATUSES.includes(status)) errors.push(`status must be one of: ${EVENT_STATUSES.join(', ')}`);
  const description = optText(b.description);
  const location = optText(b.location, 300);
  if (description === null) errors.push('description must be text');
  if (location === null) errors.push('location must be text');
  if (errors.length) return { errors };
  return { value: { title, description, date: b.date, startTime: b.startTime || '', endTime: b.endTime || '', location, status } };
}

export const JOURNAL_FIELDS = ['accomplished', 'wentWell', 'learned', 'improve', 'challenges', 'notes', 'tomorrow'];

export function validateJournal(body) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};
  if (!isDate(b.date)) errors.push('date must be a valid YYYY-MM-DD date');
  const value = { date: b.date };
  for (const f of JOURNAL_FIELDS) {
    const v = optText(b[f], 10000);
    if (v === null) errors.push(`${f} must be text`);
    value[f] = v ?? '';
  }
  if (!JOURNAL_FIELDS.some((f) => value[f])) errors.push('at least one journal field needs content');
  return errors.length ? { errors } : { value };
}

export function validateGoal(body) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};
  const title = trimmed(b.title);
  if (typeof title !== 'string' || !title || title.length > 200) errors.push('title is required (max 200 characters)');
  const category = b.category ?? 'Other';
  if (!CATEGORIES.includes(category)) errors.push('invalid category');
  const status = b.status ?? 'Not Started';
  if (!GOAL_STATUSES.includes(status)) errors.push(`status must be one of: ${GOAL_STATUSES.join(', ')}`);
  if (b.startDate && !isDate(b.startDate)) errors.push('startDate must be YYYY-MM-DD');
  if (b.targetDate && !isDate(b.targetDate)) errors.push('targetDate must be YYYY-MM-DD');
  if (b.startDate && b.targetDate && b.targetDate < b.startDate) errors.push('targetDate cannot be before startDate');
  const progress = b.progress ?? 0;
  if (typeof progress !== 'number' || Number.isNaN(progress) || progress < 0 || progress > 100) errors.push('progress must be a number from 0 to 100');
  const milestones = b.milestones ?? [];
  if (!Array.isArray(milestones) || milestones.some((m) => !m || typeof m.title !== 'string' || !m.title.trim())) {
    errors.push('milestones must be an array of { title, done }');
  }
  const description = optText(b.description);
  if (description === null) errors.push('description must be text');
  if (errors.length) return { errors };
  return {
    value: {
      title, description, category, status, startDate: b.startDate || '', targetDate: b.targetDate || '', progress,
      milestones: milestones.map((m, i) => ({
        id: typeof m.id === 'string' && m.id ? m.id : `m-${Date.now().toString(36)}-${i}`,
        title: m.title.trim(),
        done: !!m.done,
      })),
    },
  };
}
