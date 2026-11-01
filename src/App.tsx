import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { AppDataProvider } from './state/AppDataContext';
import { AttendancePage } from './pages/AttendancePage';
import { BeneficiariesPage } from './pages/BeneficiariesPage';
import { JanAndolanPage } from './pages/JanAndolanPage';
import { MonthPage } from './pages/MonthPage';
import { ReportsPage } from './pages/ReportsPage';
import { SavedPhotosPage } from './pages/SavedPhotosPage';
import { SavedReportsPage } from './pages/SavedReportsPage';
import { AccountSettingsPage } from './pages/settings/AccountSettingsPage';
import { ReportSettingsPage } from './pages/settings/ReportSettingsPage';

export function App() {
  return (
    <AppDataProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<AttendancePage />} />
            <Route path="month" element={<MonthPage />} />
            <Route path="people" element={<BeneficiariesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reports/saved" element={<SavedReportsPage />} />
            <Route path="jan-andolan" element={<JanAndolanPage />} />
            <Route path="jan-andolan/saved" element={<SavedPhotosPage />} />
            <Route path="settings" element={<Navigate to="/settings/account" replace />} />
            <Route path="settings/account" element={<AccountSettingsPage />} />
            <Route path="settings/reports" element={<ReportSettingsPage />} />
          </Route>
          {/* The signed-out login page is #/login; once signed in it lands on attendance. */}
          <Route path="login" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppDataProvider>
  );
}
