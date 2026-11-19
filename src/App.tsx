import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MedicineNotificationManager } from './components/MedicineNotificationManager';
import { LoadingScreen } from './components/LoadingScreen';
import { Toast } from './components/Toast';
import { FamilyProvider } from './context/FamilyContext';
import { useFamily } from './hooks/useFamily';
import AIInsights from './pages/AIInsights';
import Dashboard from './pages/Dashboard';
import EmergencyQR from './pages/EmergencyQR';
import FamilySetup from './pages/FamilySetup';
import GroceryList from './pages/GroceryList';
import HealthVault from './pages/HealthVault';
import Login from './pages/Login';
import MealPlanner from './pages/MealPlanner';
import MedicineReminders from './pages/MedicineReminders';
import PublicEmergency from './pages/PublicEmergency';
import Settings from './pages/Settings';

function ProtectedRoute({
  children,
  requireFamily = true,
}: {
  children: React.ReactNode;
  requireFamily?: boolean;
}) {
  const { user, authReady, family, familyLoading } = useFamily();

  if (!authReady || (user && familyLoading)) {
    return (
      <LoadingScreen
        message={!authReady ? 'Initializing session...' : 'Loading your family workspace...'}
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireFamily && !family) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/emergency/:memberId" element={<PublicEmergency />} />

      <Route
        path="/setup"
        element={
          <ProtectedRoute requireFamily={false}>
            <FamilySetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vault"
        element={
          <ProtectedRoute>
            <HealthVault />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meals"
        element={
          <ProtectedRoute>
            <MealPlanner />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medicines"
        element={
          <ProtectedRoute>
            <MedicineReminders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/emergency-qr"
        element={
          <ProtectedRoute>
            <EmergencyQR />
          </ProtectedRoute>
        }
      />
      <Route
        path="/insights"
        element={
          <ProtectedRoute>
            <AIInsights />
          </ProtectedRoute>
        }
      />
      <Route
        path="/grocery"
        element={
          <ProtectedRoute>
            <GroceryList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FamilyProvider>
        <BrowserRouter>
          <Toast />
          <MedicineNotificationManager />
          <AppRoutes />
        </BrowserRouter>
      </FamilyProvider>
    </ErrorBoundary>
  );
}
