export const TASK_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'] as const;
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export const CATEGORIES = ['Study', 'Programming', 'Work', 'Personal', 'Health', 'Family', 'Finance', 'Meeting', 'Exercise', 'Other'] as const;
export const PHASES = ['Before', 'During', 'After', 'General'] as const;
export const EVENT_STATUSES = ['Planned', 'In Progress', 'Completed', 'Cancelled'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Phase = (typeof PHASES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm or ''
  endTime: string;
  category: Category;
  priority: Priority;
  status: TaskStatus;
  phase: Phase;
  eventId: string | null;
  goalId: string | null;
  location: string;
  reminderAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>;

export interface PlannerEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  completedCount: number;
  progress: number;
  tasks: Task[];
}

export type EventInput = Pick<PlannerEvent, 'title' | 'description' | 'date' | 'startTime' | 'endTime' | 'location' | 'status'>;

export interface DayStat { date: string; total: number; completed: number; rate: number }
export interface Stats {
  date: string;
  today: string;
  totalToday: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  completionRate: number;
  week: DayStat[];
  byCategory: Record<string, number>;
  totals: { tasks: number; events: number; journalEntries: number; goals: number };
}

export interface TaskFilters {
  q?: string; status?: string; category?: string; priority?: string; phase?: string;
  date?: string; from?: string; to?: string; sort?: string; order?: 'asc' | 'desc';
}
