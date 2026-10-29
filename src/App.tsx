import { HashRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { AppDataProvider } from './state/AppDataContext';
import { AttendancePage } from './pages/AttendancePage';
import { BeneficiariesPage } from './pages/BeneficiariesPage';
import { MonthPage } from './pages/MonthPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

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
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppDataProvider>
  );
}
