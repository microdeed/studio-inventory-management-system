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
import './App.css';

function App() {
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
            </Routes>
          </Layout>
        </div>
      </AuthWall>
    </Router>
  );
}

export default App;