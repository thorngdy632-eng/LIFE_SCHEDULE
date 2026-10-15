import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StatePanelComponent } from '../../shared/components/state-panel.component';

@Component({
  selector: 'app-coming-soon',
  imports: [StatePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-state-panel kind="empty" iconName="wrench" [title]="title + ' is not built yet'" message="This page is planned for a later milestone. Tasks, schedule, events and the dashboard are working now." />`,
})
export class ComingSoonComponent { protected title = inject(ActivatedRoute).snapshot.data['title'] as string; }
