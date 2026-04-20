import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboards/dashboard-page';
import { TasksPage } from './pages/tasks/tasks-page';
import { SubjectsPage } from './pages/subjects/subjects-page';
import { LoginPage } from './pages/login/login-page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginPage,
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
