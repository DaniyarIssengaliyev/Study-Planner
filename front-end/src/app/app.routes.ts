import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboards/dashboard-page';
import { TasksPage } from './pages/tasks/tasks-page';
import { SubjectsPage } from './pages/subjects/subjects-page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    component: DashboardPage,
  },
  {
    path: 'tasks',
    component: TasksPage,
  },
  {
    path: 'subjects',
    component: SubjectsPage,
  },
];
