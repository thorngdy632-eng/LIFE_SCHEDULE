const localDate = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const localTime = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function isOverdue(task, today = localDate(), nowTime = localTime()) {
  if (task.status !== 'Pending' && task.status !== 'In Progress') return false;
  if (task.date < today) return true;
  return task.date === today && !!task.endTime && task.endTime < nowTime;
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** All numbers are derived from stored records; nothing is invented. */
export function computeStats(data, date) {
  const today = localDate();
  const day = date || today;
  const dayTasks = data.tasks.filter((t) => t.date === day && t.status !== 'Cancelled');
  const count = (s) => dayTasks.filter((t) => t.status === s).length;
  const completed = count('Completed');
  const overdue = data.tasks.filter((t) => isOverdue(t, today)).length;

  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(day, -i);
    const list = data.tasks.filter((t) => t.date === d && t.status !== 'Cancelled');
    const done = list.filter((t) => t.status === 'Completed').length;
    week.push({ date: d, total: list.length, completed: done, rate: list.length ? Math.round((done / list.length) * 100) : 0 });
  }

  const byCategory = {};
  for (const t of data.tasks) byCategory[t.category] = (byCategory[t.category] || 0) + 1;

  return {
    date: day,
    today,
    totalToday: dayTasks.length,
    completed,
    pending: count('Pending'),
    inProgress: count('In Progress'),
    overdue,
    completionRate: dayTasks.length ? Math.round((completed / dayTasks.length) * 100) : 0,
    week,
    byCategory,
    totals: { tasks: data.tasks.length, events: data.events.length, journalEntries: data.journalEntries.length, goals: data.goals.length },
  };
}
