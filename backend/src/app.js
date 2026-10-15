import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { StorageError, COLLECTIONS } from './services/storage.service.js';
import {
  validateTask, validateEvent, validateJournal, validateGoal, isDate, isTime, STATUSES,
} from './validators/validators.js';
import { computeStats } from './services/stats.service.js';

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validated(validator, body) {
  const r = validator(body);
  if (r.errors) throw new HttpError(400, 'Validation failed', r.errors);
  return r.value;
}

function assertLinks(data, task) {
  if (task.eventId && !data.events.some((e) => e.id === task.eventId)) throw new HttpError(400, 'Validation failed', ['eventId does not match an existing event']);
  if (task.goalId && !data.goals.some((g) => g.id === task.goalId)) throw new HttpError(400, 'Validation failed', ['goalId does not match an existing goal']);
}

/** Keeps completedAt consistent with status. */
function applyStatus(task, status) {
  task.status = status;
  if (status === 'Completed') task.completedAt = task.completedAt || now();
  else task.completedAt = null;
}

function eventWithProgress(event, tasks) {
  const related = tasks.filter((t) => t.eventId === event.id);
  const active = related.filter((t) => t.status !== 'Cancelled');
  const done = active.filter((t) => t.status === 'Completed').length;
  return {
    ...event,
    taskCount: active.length,
    completedCount: done,
    progress: active.length ? Math.round((done / active.length) * 100) : 0,
    tasks: related,
  };
}

export function createApp(storage, { corsOrigin = 'http://localhost:4200' } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '5mb' }));

  const api = express.Router();

  api.get('/health', wrap(async (_req, res) => {
    const data = await storage.read();
    ok(res, { status: 'ok', time: now(), counts: Object.fromEntries(COLLECTIONS.map((c) => [c, data[c].length])) });
  }));

  // ---------- Tasks ----------
  api.get('/tasks', wrap(async (req, res) => {
    const { from, to, date, status, category, priority, phase, eventId, goalId, q, sort = 'date', order = 'asc' } = req.query;
    for (const [k, v] of Object.entries({ from, to, date })) if (v && !isDate(v)) throw new HttpError(400, `${k} must be YYYY-MM-DD`);
    const data = await storage.read();
    let list = data.tasks;
    if (date) list = list.filter((t) => t.date === date);
    if (from) list = list.filter((t) => t.date >= from);
    if (to) list = list.filter((t) => t.date <= to);
    for (const [k, v] of Object.entries({ status, category, priority, phase, eventId, goalId })) if (v) list = list.filter((t) => t[k] === v);
    if (q) {
      const needle = String(q).toLowerCase();
      list = list.filter((t) => [t.title, t.description, t.notes, t.location].some((s) => (s || '').toLowerCase().includes(needle)));
    }
    const keyFn = {
      date: (t) => `${t.date} ${t.startTime || '99:99'}`,
      priority: (t) => ['Low', 'Medium', 'High', 'Urgent'].indexOf(t.priority),
      title: (t) => t.title.toLowerCase(),
      status: (t) => t.status,
    }[sort] || ((t) => `${t.date} ${t.startTime || '99:99'}`);
    list = [...list].sort((a, b) => (keyFn(a) < keyFn(b) ? -1 : keyFn(a) > keyFn(b) ? 1 : 0));
    if (order === 'desc') list.reverse();
    ok(res, list);
  }));

  api.get('/tasks/:id', wrap(async (req, res) => {
    const t = (await storage.read()).tasks.find((x) => x.id === req.params.id);
    if (!t) throw new HttpError(404, 'Task not found');
    ok(res, t);
  }));

  api.post('/tasks', wrap(async (req, res) => {
    const value = validated(validateTask, req.body);
    const task = await storage.mutate((data) => {
      assertLinks(data, value);
      const t = { id: newId(), ...value, createdAt: now(), updatedAt: now(), completedAt: null };
      if (value.status === 'Completed') t.completedAt = now();
      data.tasks.push(t);
      return t;
    });
    ok(res, task, 201);
  }));

  api.put('/tasks/:id', wrap(async (req, res) => {
    const value = validated(validateTask, req.body);
    const task = await storage.mutate((data) => {
      const t = data.tasks.find((x) => x.id === req.params.id);
      if (!t) throw new HttpError(404, 'Task not found');
      assertLinks(data, value);
      const { status, ...rest } = value;
      Object.assign(t, rest); // id, createdAt preserved
      applyStatus(t, status);
      t.updatedAt = now();
      return t;
    });
    ok(res, task);
  }));

  api.patch('/tasks/:id/status', wrap(async (req, res) => {
    const status = req.body?.status;
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Validation failed', [`status must be one of: ${STATUSES.join(', ')}`]);
    const task = await storage.mutate((data) => {
      const t = data.tasks.find((x) => x.id === req.params.id);
      if (!t) throw new HttpError(404, 'Task not found');
      applyStatus(t, status);
      t.updatedAt = now();
      return t;
    });
    ok(res, task);
  }));

  // Reschedule updates the existing record in place (no duplicate, createdAt preserved).
  api.patch('/tasks/:id/reschedule', wrap(async (req, res) => {
    const { date, startTime, endTime } = req.body ?? {};
    const errors = [];
    if (!isDate(date)) errors.push('date must be YYYY-MM-DD');
    if (startTime && !isTime(startTime)) errors.push('startTime must be HH:mm');
    if (endTime && !isTime(endTime)) errors.push('endTime must be HH:mm');
    if (endTime && !startTime) errors.push('endTime requires startTime');
    if (startTime && endTime && endTime <= startTime) errors.push('endTime must be later than startTime');
    if (errors.length) throw new HttpError(400, 'Validation failed', errors);
    const task = await storage.mutate((data) => {
      const t = data.tasks.find((x) => x.id === req.params.id);
      if (!t) throw new HttpError(404, 'Task not found');
      t.date = date;
      if (startTime !== undefined) { t.startTime = startTime || ''; t.endTime = endTime || ''; }
      if (t.status === 'Cancelled' || t.status === 'Completed') { /* keep status as is */ }
      t.updatedAt = now();
      return t;
    });
    ok(res, task);
  }));

  api.delete('/tasks/:id', wrap(async (req, res) => {
    await storage.mutate((data) => {
      const i = data.tasks.findIndex((x) => x.id === req.params.id);
      if (i === -1) throw new HttpError(404, 'Task not found');
      data.tasks.splice(i, 1);
    });
    ok(res, { deleted: true });
  }));

  // ---------- Events ----------
  api.get('/events', wrap(async (_req, res) => {
    const data = await storage.read();
    ok(res, data.events.map((e) => eventWithProgress(e, data.tasks)).sort((a, b) => (a.date < b.date ? -1 : 1)));
  }));

  api.get('/events/:id', wrap(async (req, res) => {
    const data = await storage.read();
    const e = data.events.find((x) => x.id === req.params.id);
    if (!e) throw new HttpError(404, 'Event not found');
    ok(res, eventWithProgress(e, data.tasks));
  }));

  api.post('/events', wrap(async (req, res) => {
    const value = validated(validateEvent, req.body);
    const ev = await storage.mutate((data) => {
      const e = { id: newId(), ...value, createdAt: now(), updatedAt: now() };
      data.events.push(e);
      return e;
    });
    ok(res, ev, 201);
  }));

  api.put('/events/:id', wrap(async (req, res) => {
    const value = validated(validateEvent, req.body);
    const ev = await storage.mutate((data) => {
      const e = data.events.find((x) => x.id === req.params.id);
      if (!e) throw new HttpError(404, 'Event not found');
      Object.assign(e, value, { updatedAt: now() });
      return e;
    });
    ok(res, ev);
  }));

  // Without ?deleteTasks=true the linked tasks are kept and simply detached.
  api.delete('/events/:id', wrap(async (req, res) => {
    const deleteTasks = req.query.deleteTasks === 'true';
    const result = await storage.mutate((data) => {
      const i = data.events.findIndex((x) => x.id === req.params.id);
      if (i === -1) throw new HttpError(404, 'Event not found');
      data.events.splice(i, 1);
      let affected = 0;
      if (deleteTasks) {
        const before = data.tasks.length;
        data.tasks = data.tasks.filter((t) => t.eventId !== req.params.id);
        affected = before - data.tasks.length;
      } else {
        for (const t of data.tasks) if (t.eventId === req.params.id) { t.eventId = null; t.updatedAt = now(); affected++; }
      }
      return { deleted: true, tasksAffected: affected, tasksDeleted: deleteTasks };
    });
    ok(res, result);
  }));

  // ---------- Journal ----------
  api.get('/journal', wrap(async (req, res) => {
    const { q, from, to } = req.query;
    let list = (await storage.read()).journalEntries;
    if (from) list = list.filter((j) => j.date >= from);
    if (to) list = list.filter((j) => j.date <= to);
    if (q) {
      const n = String(q).toLowerCase();
      list = list.filter((j) => Object.values(j).some((v) => typeof v === 'string' && v.toLowerCase().includes(n)));
    }
    ok(res, [...list].sort((a, b) => (a.date < b.date ? 1 : -1)));
  }));

  api.post('/journal', wrap(async (req, res) => {
    const value = validated(validateJournal, req.body);
    const j = await storage.mutate((data) => {
      const e = { id: newId(), ...value, createdAt: now(), updatedAt: now() };
      data.journalEntries.push(e);
      return e;
    });
    ok(res, j, 201);
  }));

  api.put('/journal/:id', wrap(async (req, res) => {
    const value = validated(validateJournal, req.body);
    const j = await storage.mutate((data) => {
      const e = data.journalEntries.find((x) => x.id === req.params.id);
      if (!e) throw new HttpError(404, 'Journal entry not found');
      Object.assign(e, value, { updatedAt: now() });
      return e;
    });
    ok(res, j);
  }));

  api.delete('/journal/:id', wrap(async (req, res) => {
    await storage.mutate((data) => {
      const i = data.journalEntries.findIndex((x) => x.id === req.params.id);
      if (i === -1) throw new HttpError(404, 'Journal entry not found');
      data.journalEntries.splice(i, 1);
    });
    ok(res, { deleted: true });
  }));

  // ---------- Goals ----------
  api.get('/goals', wrap(async (_req, res) => {
    const data = await storage.read();
    ok(res, data.goals.map((g) => {
      const linked = data.tasks.filter((t) => t.goalId === g.id && t.status !== 'Cancelled');
      const done = linked.filter((t) => t.status === 'Completed').length;
      return { ...g, linkedTaskCount: linked.length, linkedTasksCompleted: done };
    }));
  }));

  api.post('/goals', wrap(async (req, res) => {
    const value = validated(validateGoal, req.body);
    const g = await storage.mutate((data) => {
      const e = { id: newId(), ...value, createdAt: now(), updatedAt: now() };
      data.goals.push(e);
      return e;
    });
    ok(res, g, 201);
  }));

  api.put('/goals/:id', wrap(async (req, res) => {
    const value = validated(validateGoal, req.body);
    const g = await storage.mutate((data) => {
      const e = data.goals.find((x) => x.id === req.params.id);
      if (!e) throw new HttpError(404, 'Goal not found');
      Object.assign(e, value, { updatedAt: now() });
      return e;
    });
    ok(res, g);
  }));

  api.delete('/goals/:id', wrap(async (req, res) => {
    await storage.mutate((data) => {
      const i = data.goals.findIndex((x) => x.id === req.params.id);
      if (i === -1) throw new HttpError(404, 'Goal not found');
      data.goals.splice(i, 1);
      for (const t of data.tasks) if (t.goalId === req.params.id) { t.goalId = null; t.updatedAt = now(); }
    });
    ok(res, { deleted: true });
  }));

  // ---------- Statistics ----------
  api.get('/stats', wrap(async (req, res) => {
    const date = req.query.date;
    if (date && !isDate(date)) throw new HttpError(400, 'date must be YYYY-MM-DD');
    ok(res, computeStats(await storage.read(), date));
  }));

  // ---------- Data management ----------
  api.get('/data/export', wrap(async (_req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="life-schedule-export.json"');
    ok(res, await storage.read());
  }));

  api.post('/data/import', wrap(async (req, res) => {
    await storage.replaceAll(req.body);
    ok(res, { imported: true });
  }));

  api.post('/data/backup', wrap(async (_req, res) => {
    ok(res, { file: await storage.backup('manual') }, 201);
  }));

  api.use((_req, _res, next) => next(new HttpError(404, 'Endpoint not found')));
  app.use('/api', api);

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ success: false, error: { message: err.message, details: err.details ?? [] } });
    if (err instanceof StorageError) return res.status(err.status).json({ success: false, error: { message: err.message, code: err.code, details: [] } });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, error: { message: 'Malformed JSON body', details: [] } });
    if (err.type === 'entity.too.large') return res.status(413).json({ success: false, error: { message: 'Request body too large', details: [] } });
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Unexpected server error', details: [] } });
  });

  return app;
}
