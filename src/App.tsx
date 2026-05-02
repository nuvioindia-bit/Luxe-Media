import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, getDocFromServerWithRetry } from './lib/firebase';
import { doc } from 'firebase/firestore';
import { isAdminEmail } from './constants';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Pages
import DashboardLayout from './components/DashboardLayout';
import Discovery from './pages/creator/Discovery';
import BrandHome from './pages/brand/BrandHome';
import CreateCampaign from './pages/brand/CreateCampaign';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import Wallet from './pages/Wallet';
import CampaignDetail from './pages/CampaignDetail';
import AIPilot from './pages/AIPilot';
import AdminPanel from './pages/AdminPanel';
import ReferEarn from './pages/ReferEarn';

import RoleSelection from './components/RoleSelection';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety fallback: ensure loading is disabled eventually
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 5000);

    let unsubUserDoc: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        if (isAdminEmail(firebaseUser.email)) {
             setRole('admin');
             setLoading(false);
             clearTimeout(safetyTimer);
        } else {
             // Real-time listener for user document to handle bans and role updates
             import('firebase/firestore').then(({ onSnapshot, doc }) => {
                 unsubUserDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snap) => {
                     if (snap.exists()) {
                         const data = snap.data();
                         if (data?.isBanned) {
                             alert('Your account has been suspended by an administrator.');
                             await auth.signOut();
                             setUser(null);
                             setRole(null);
                         } else if (data?.role) {
                             setRole(data.role);
                         } else {
                             setRole('pending');
                         }
                     } else {
                         setRole('pending');
                     }
                     setLoading(false);
                     clearTimeout(safetyTimer);
                 }, (err) => {
                     console.warn("User doc listener error:", err);
                     setLoading(false);
                     clearTimeout(safetyTimer);
                 });
             });
        }
      } else {
        if (unsubUserDoc) unsubUserDoc();
        setUser(null);
        setRole(null);
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    });

    return () => {
        unsubscribe();
        if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  if (loading) {
    return null;
  }

  if (user && role === 'pending') {
    return <RoleSelection user={user} onComplete={() => {}} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={!user ? <Auth /> : <Navigate to="/dashboard" />} />
        <Route path="/auth" element={!user ? <Auth /> : <Navigate to="/dashboard" />} />
        
        <Route path="/dashboard" element={user ? <DashboardLayout user={user} role={role} /> : <Navigate to="/auth" />}>
          <Route index element={role === 'brand' ? <BrandHome /> : <Discovery />} />
          <Route path="campaign/:id" element={<CampaignDetail />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="create" element={(role === 'brand' || isAdminEmail(user?.email)) ? <CreateCampaign /> : <Navigate to="/dashboard" />} />
          <Route path="profile" element={<Profile />} />
          <Route path="refer-earn" element={<ReferEarn />} />
          <Route path="ai-pilot" element={<AIPilot />} />
          <Route path="admin" element={<AdminPanel />} />
        </Route>
      </Routes>
      <SpeedInsights />
    </BrowserRouter>
  );
}
