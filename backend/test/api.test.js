import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageService } from '../src/services/storage.service.js';
import { createApp } from '../src/app.js';

let dir, storage, server, base;
const start = async () => {
  storage = new StorageService('text.txt', dir);
  await storage.init();
  server = createApp(storage).listen(0);
  base = `http://localhost:${server.address().port}/api`;
};
const stop = () => new Promise((r) => { server.close(r); server.closeAllConnections?.(); });
const call = async (method, url, body) => {
  const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
};
const task = (o = {}) => ({ title: 'Study Angular', date: '2026-10-14', startTime: '09:00', endTime: '10:00', category: 'Study', ...o });

before(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ls-')); await start(); });
after(async () => { await stop(); await fs.rm(dir, { recursive: true, force: true }); });

test('creating a task writes it to the text file', async () => {
  const r = await call('POST', '/tasks', task());
  assert.equal(r.status, 201);
  const onDisk = JSON.parse(await fs.readFile(path.join(dir, 'text.txt'), 'utf8'));
  assert.equal(onDisk.tasks.length, 1);
  assert.equal(onDisk.tasks[0].id, r.body.data.id);
});

test('update changes only the targeted record and preserves createdAt', async () => {
  const a = (await call('POST', '/tasks', task({ title: 'A' }))).body.data;
  const b = (await call('POST', '/tasks', task({ title: 'B' }))).body.data;
  await new Promise((r) => setTimeout(r, 5));
  const u = await call('PUT', `/tasks/${a.id}`, task({ title: 'A2' }));
  assert.equal(u.body.data.title, 'A2');
  assert.equal(u.body.data.createdAt, a.createdAt);
  assert.notEqual(u.body.data.updatedAt, a.updatedAt);
  assert.equal((await call('GET', `/tasks/${b.id}`)).body.data.title, 'B');
});

test('delete removes only the intended task', async () => {
  const a = (await call('POST', '/tasks', task({ title: 'del-me' }))).body.data;
  const b = (await call('POST', '/tasks', task({ title: 'keep-me' }))).body.data;
  assert.equal((await call('DELETE', `/tasks/${a.id}`)).status, 200);
  assert.equal((await call('GET', `/tasks/${a.id}`)).status, 404);
  assert.equal((await call('GET', `/tasks/${b.id}`)).status, 200);
});

test('invalid input is rejected', async () => {
  for (const bad of [
    task({ title: '' }), task({ date: '2026-02-31' }), task({ endTime: '08:00' }), task({ startTime: '25:00' }),
    task({ status: 'Done' }), task({ priority: 'Huge' }), task({ phase: 'Later' }), task({ eventId: 'nope' }),
  ]) {
    const r = await call('POST', '/tasks', bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(r.body.success, false);
  }
});

test('missing records and unknown routes return 404; malformed JSON returns 400', async () => {
  assert.equal((await call('GET', '/tasks/does-not-exist')).status, 404);
  assert.equal((await call('PUT', '/events/nope', { title: 'x', date: '2026-10-14' })).status, 404);
  assert.equal((await call('GET', '/nothing')).status, 404);
  const res = await fetch(`${base}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(res.status, 400);
});

test('status change sets and clears completedAt; overdue tasks are never auto-completed', async () => {
  const t = (await call('POST', '/tasks', task({ date: '2020-01-01' }))).body.data;
  assert.equal(t.status, 'Pending');
  assert.equal(t.completedAt, null);
  const done = (await call('PATCH', `/tasks/${t.id}/status`, { status: 'Completed' })).body.data;
  assert.ok(done.completedAt);
  const reopened = (await call('PATCH', `/tasks/${t.id}/status`, { status: 'Pending' })).body.data;
  assert.equal(reopened.completedAt, null);
  assert.equal((await call('PATCH', `/tasks/${t.id}/status`, { status: 'x' })).status, 400);
});

test('reschedule updates in place without creating a duplicate', async () => {
  const t = (await call('POST', '/tasks', task())).body.data;
  const countBefore = (await call('GET', '/tasks')).body.data.length;
  const r = await call('PATCH', `/tasks/${t.id}/reschedule`, { date: '2026-10-20', startTime: '13:00', endTime: '14:00' });
  assert.equal(r.body.data.date, '2026-10-20');
  assert.equal(r.body.data.id, t.id);
  assert.equal(r.body.data.createdAt, t.createdAt);
  assert.equal((await call('GET', '/tasks')).body.data.length, countBefore);
});

test('events keep their task relationships and report progress', async () => {
  const ev = (await call('POST', '/events', { title: 'Presentation', date: '2026-10-15' })).body.data;
  const t1 = (await call('POST', '/tasks', task({ eventId: ev.id, phase: 'Before' }))).body.data;
  await call('POST', '/tasks', task({ eventId: ev.id, phase: 'After' }));
  await call('PATCH', `/tasks/${t1.id}/status`, { status: 'Completed' });
  const got = (await call('GET', `/events/${ev.id}`)).body.data;
  assert.equal(got.taskCount, 2);
  assert.equal(got.progress, 50);
  assert.deepEqual(got.tasks.map((t) => t.phase).sort(), ['After', 'Before']);
});

test('journal entries and goals persist and validate', async () => {
  assert.equal((await call('POST', '/journal', { date: '2026-10-14' })).status, 400);
  assert.equal((await call('POST', '/journal', { date: '2026-10-14', accomplished: 'Built the API' })).status, 201);
  assert.equal((await call('POST', '/goals', { title: 'Learn Angular', milestones: [{ title: 'Signals' }], progress: 20 })).status, 201);
  assert.equal((await call('POST', '/goals', { title: 'x', progress: 140 })).status, 400);
});

test('data survives a backend restart', async () => {
  const count = (await call('GET', '/tasks')).body.data.length;
  await stop();
  await start();
  assert.equal((await call('GET', '/tasks')).body.data.length, count);
  assert.equal((await call('GET', '/journal')).body.data.length, 1);
  assert.equal((await call('GET', '/goals')).body.data.length, 1);
  assert.equal((await call('GET', '/events')).body.data[0].taskCount, 2);
});

test('concurrent writes do not lose updates', async () => {
  const countBefore = (await call('GET', '/tasks')).body.data.length;
  const results = await Promise.all(Array.from({ length: 60 }, (_, i) => call('POST', '/tasks', task({ title: `parallel ${i}` }))));
  assert.ok(results.every((r) => r.status === 201));
  assert.equal((await call('GET', '/tasks')).body.data.length, countBefore + 60);
});

test('stats are computed from records and empty days show zeros', async () => {
  const s = (await call('GET', '/stats?date=1999-01-01')).body.data;
  assert.equal(s.totalToday, 0);
  assert.equal(s.completionRate, 0);
  assert.equal(s.week.length, 7);
});

test('corrupted file is reported and never silently overwritten', async () => {
  await stop();
  const file = path.join(dir, 'text.txt');
  const good = await fs.readFile(file, 'utf8');
  await fs.writeFile(file, '{ this is not json');
  const s = new StorageService('text.txt', dir);
  await assert.rejects(() => s.init(), /not valid JSON/);
  assert.equal(await fs.readFile(file, 'utf8'), '{ this is not json');
  await fs.writeFile(file, good);
  await start();
});

test('import validates and creates a backup before replacing', async () => {
  assert.equal((await call('POST', '/data/import', { version: 1, tasks: 'no' })).status, 400);
  const r = await call('POST', '/data/import', { version: 1, tasks: [], events: [], journalEntries: [], goals: [] });
  assert.equal(r.status, 200);
  const backups = await fs.readdir(path.join(dir, 'backups'));
  assert.ok(backups.some((f) => f.includes('before-restore')));
});

test('data file name cannot escape the data directory', () => {
  const s = new StorageService('../../etc/passwd', dir);
  assert.equal(path.dirname(s.file), path.resolve(dir));
});
