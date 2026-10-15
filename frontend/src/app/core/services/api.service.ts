import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, catchError, throwError } from 'rxjs';
import { API_URL } from '../config';
import { EventInput, PlannerEvent, Stats, Task, TaskFilters, TaskInput, TaskStatus } from '../models/models';

interface Envelope<T> { success: boolean; data: T }

export class ApiError extends Error {
  constructor(message: string, readonly details: string[] = [], readonly status = 0) { super(message); }
  get full(): string { return this.details.length ? `${this.message}: ${this.details.join('; ')}` : this.message; }
}

function toApiError(e: unknown): Error {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return new ApiError('Cannot reach the server. Check that the backend is running on port 3000.', [], 0);
    const err = e.error?.error;
    return new ApiError(err?.message ?? 'Request failed', err?.details ?? [], e.status);
  }
  return e instanceof Error ? e : new Error('Unknown error');
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  private req<T>(o: Observable<Envelope<T>>): Observable<T> {
    return o.pipe(map((r) => r.data), catchError((e) => throwError(() => toApiError(e))));
  }

  listTasks(f: TaskFilters = {}) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(f)) if (v) params = params.set(k, v);
    return this.req(this.http.get<Envelope<Task[]>>(`${API_URL}/tasks`, { params }));
  }
  createTask(t: TaskInput) { return this.req(this.http.post<Envelope<Task>>(`${API_URL}/tasks`, t)); }
  updateTask(id: string, t: TaskInput) { return this.req(this.http.put<Envelope<Task>>(`${API_URL}/tasks/${id}`, t)); }
  setStatus(id: string, status: TaskStatus) { return this.req(this.http.patch<Envelope<Task>>(`${API_URL}/tasks/${id}/status`, { status })); }
  reschedule(id: string, body: { date: string; startTime?: string; endTime?: string }) {
    return this.req(this.http.patch<Envelope<Task>>(`${API_URL}/tasks/${id}/reschedule`, body));
  }
  deleteTask(id: string) { return this.req(this.http.delete<Envelope<{ deleted: boolean }>>(`${API_URL}/tasks/${id}`)); }

  listEvents() { return this.req(this.http.get<Envelope<PlannerEvent[]>>(`${API_URL}/events`)); }
  createEvent(e: EventInput) { return this.req(this.http.post<Envelope<PlannerEvent>>(`${API_URL}/events`, e)); }
  updateEvent(id: string, e: EventInput) { return this.req(this.http.put<Envelope<PlannerEvent>>(`${API_URL}/events/${id}`, e)); }
  deleteEvent(id: string, deleteTasks: boolean) {
    return this.req(this.http.delete<Envelope<{ tasksAffected: number }>>(`${API_URL}/events/${id}`, { params: { deleteTasks } }));
  }

  stats(date?: string) {
    const params = date ? new HttpParams().set('date', date) : undefined;
    return this.req(this.http.get<Envelope<Stats>>(`${API_URL}/stats`, { params }));
  }
}
