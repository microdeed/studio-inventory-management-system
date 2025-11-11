import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthWall } from './components/AuthWall.tsx';
import { Layout } from './components/Layout.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Equipment } from './pages/Equipment.tsx';
import { CheckInOut } from './pages/CheckInOut.tsx';
import { Users } from './pages/Users.tsx';
import { Reports } from './pages/Reports.tsx';
import { Settings } from './pages/Settings.tsx';
import { ReleaseNotes } from './pages/ReleaseNotes.tsx';
import { InactivityWarningModal } from './components/InactivityWarningModal.tsx';
import { useActivityTracker } from './hooks/useActivityTracker.ts';
import { useInactivityWarning } from './hooks/useInactivityWarning.ts';
import './App.css';

function App() {
  // Monitor for inactivity and show warning modal
  const { showWarning, secondsRemaining, handleStayLoggedIn, handleLogout } = useInactivityWarning();

  // Track user activity to keep session alive (pause when warning modal is open)
  useActivityTracker(showWarning);

  return (
    <Router>
      <AuthWall>
        <div className="App">
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/equipment" element={<Equipment />} />
              <Route path="/checkinout" element={<CheckInOut />} />
              <Route path="/users" element={<Users />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/release-notes" element={<ReleaseNotes />} />
            </Routes>
          </Layout>
        </div>

        {/* Inactivity Warning Modal */}
        <InactivityWarningModal
          isOpen={showWarning}
          secondsRemaining={secondsRemaining}
          onStayLoggedIn={handleStayLoggedIn}
          onLogout={handleLogout}
        />
      </AuthWall>
    </Router>
  );
}

export default App;