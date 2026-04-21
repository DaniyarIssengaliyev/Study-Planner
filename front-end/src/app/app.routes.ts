import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboards/dashboard-page';
import { TasksPage } from './pages/tasks/tasks-page';
import { SubjectsPage } from './pages/subjects/subjects-page';
import { LoginPage } from './pages/login/login-page';
import { RegisterPage } from './pages/register/register-page';
import { AdminSubjectsPage } from './pages/admin-subjects/admin-subjects-page';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { superadminGuard } from './guards/superadmin.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginPage,
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    component: RegisterPage,
    canActivate: [guestGuard],
  },
  {
    path: 'dashboard',
    component: DashboardPage,
    canActivate: [authGuard],
  },
  {
    path: 'tasks',
    component: TasksPage,
    canActivate: [authGuard],
  },
  {
    path: 'subjects',
    component: SubjectsPage,
    canActivate: [authGuard],
  },
  {
    path: 'admin/subjects',
    component: AdminSubjectsPage,
    canActivate: [superadminGuard],
  },
];
