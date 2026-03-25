import { lazy } from 'react';

export const BookingFormPage = lazy(() =>
  import('../pages/BookingFormPage').then((m) => ({ default: m.BookingFormPage }))
);
export const RecordsPage = lazy(() => import('../pages/RecordsPage').then((m) => ({ default: m.RecordsPage })));
export const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
export const AnalyticsPage = lazy(() =>
  import('../pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
);
export const LoginPage = lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })));
export const UsersPage = lazy(() => import('../pages/UsersPage').then((m) => ({ default: m.UsersPage })));
export const RolesPage = lazy(() => import('../pages/RolesPage').then((m) => ({ default: m.RolesPage })));
export const ExperimentersPage = lazy(() =>
  import('../pages/ExperimentersPage').then((m) => ({ default: m.ExperimentersPage }))
);
export const SeqTypesPage = lazy(() => import('../pages/SeqTypesPage').then((m) => ({ default: m.SeqTypesPage })));
export const PmOwnersPage = lazy(() => import('../pages/PmOwnersPage').then((m) => ({ default: m.PmOwnersPage })));
