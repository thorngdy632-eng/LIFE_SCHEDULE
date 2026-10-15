import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  LucideAngularModule, LucideIconData,
  LayoutDashboard, CalendarDays, CalendarClock, ListTodo, CircleCheck, Clock, History, Target, ChartNoAxesCombined,
  BookOpen, Settings, Search, Plus, Pencil, Trash2, ListFilter, ChevronLeft, ChevronRight, Bell, Sun, Moon,
  PanelLeftClose, PanelLeftOpen, X, Menu, MapPin, Download, Upload, Flag, CircleAlert, TriangleAlert, RotateCcw,
  Repeat, CalendarCheck, Play, Ban, Info, Layers, Check, Circle, CircleDot, Inbox, LoaderCircle, ChevronDown,
  CircleUser, ArrowUpDown, Wrench,
} from 'lucide-angular';

const ICONS = {
  'layout-dashboard': LayoutDashboard, 'calendar-days': CalendarDays, 'calendar-clock': CalendarClock, 'list-todo': ListTodo,
  'circle-check': CircleCheck, clock: Clock, history: History, target: Target, chart: ChartNoAxesCombined, 'book-open': BookOpen,
  settings: Settings, search: Search, plus: Plus, pencil: Pencil, trash: Trash2, filter: ListFilter, 'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight, bell: Bell, sun: Sun, moon: Moon, 'panel-close': PanelLeftClose, 'panel-open': PanelLeftOpen,
  x: X, menu: Menu, 'map-pin': MapPin, download: Download, upload: Upload, flag: Flag, alert: CircleAlert, warning: TriangleAlert,
  rotate: RotateCcw, repeat: Repeat, 'calendar-check': CalendarCheck, play: Play, ban: Ban, info: Info, layers: Layers,
  check: Check, circle: Circle, 'circle-dot': CircleDot, inbox: Inbox, loader: LoaderCircle, 'chevron-down': ChevronDown,
  user: CircleUser, sort: ArrowUpDown, wrench: Wrench,
} satisfies Record<string, LucideIconData>;

export type IconName = keyof typeof ICONS;

/** Single place where every UI icon is chosen, so size and stroke stay consistent. */
@Component({
  selector: 'app-icon',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<lucide-icon [img]="data()" [size]="size()" [strokeWidth]="1.75" aria-hidden="true"></lucide-icon>`,
  styles: `:host { display: inline-flex; flex: none; line-height: 0; }`,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  protected readonly data = computed(() => ICONS[this.name()]);
}
