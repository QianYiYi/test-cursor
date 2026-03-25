import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { can } from '../auth';
import { PageLoadingFallback } from '../components/page-loading-fallback';
import {
  AnalyticsPage,
  BookingFormPage,
  DashboardPage,
  ExperimentersPage,
  LoginPage,
  PmOwnersPage,
  RecordsPage,
  RolesPage,
  SeqTypesPage,
  UsersPage
} from './lazy-pages';

export interface AppRoutesProps {
  authed: boolean;
}

export function AppRoutes({ authed }: AppRoutesProps) {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to={authed ? '/records' : '/login'} replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/new" element={authed ? <BookingFormPage /> : <Navigate to="/login" replace />} />
        <Route path="/records" element={authed ? <RecordsPage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard" element={authed ? <DashboardPage /> : <Navigate to="/login" replace />} />
        <Route path="/analytics" element={authed ? <AnalyticsPage /> : <Navigate to="/login" replace />} />
        <Route
          path="/experimenters"
          element={authed && can('experimenter:manage') ? <ExperimentersPage /> : <Navigate to="/records" replace />}
        />
        <Route
          path="/pm-owners"
          element={authed && can('pm-owner:manage') ? <PmOwnersPage /> : <Navigate to="/records" replace />}
        />
        <Route
          path="/seq-types"
          element={authed && can('seq-type:manage') ? <SeqTypesPage /> : <Navigate to="/records" replace />}
        />
        <Route path="/users" element={authed && can('user:manage') ? <UsersPage /> : <Navigate to="/records" replace />} />
        <Route path="/roles" element={authed && can('role:manage') ? <RolesPage /> : <Navigate to="/records" replace />} />
        <Route path="*" element={<Navigate to="/records" replace />} />
      </Routes>
    </Suspense>
  );
}
