import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, getDocFromServerWithRetry } from './lib/firebase';
import { doc } from 'firebase/firestore';

// Pages
import DashboardLayout from './components/DashboardLayout';
import Discovery from './pages/creator/Discovery';
import CreateCampaign from './pages/brand/CreateCampaign';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import Wallet from './pages/Wallet';
import CampaignDetail from './pages/CampaignDetail';
import AIPilot from './pages/AIPilot';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety fallback: ensure loading is disabled eventually
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Step 1: Set user immediately to remove login screen delay
        setUser(firebaseUser);
        
        // Initial optimistic role based on email or default
        const optimisticRole = firebaseUser.email === 'job.rexoagency@gmail.com' ? 'admin' : 'creator';
        setRole(optimisticRole);
        
        // Stop the initial loading spinner so the user sees the dashboard
        setLoading(false);
        clearTimeout(safetyTimer);

        // Step 2: Fetch full profile/banned status in the background
        try {
          const userDoc = await getDocFromServerWithRetry(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const data = userDoc.data() as any;
            
            // Check if banned
            if (data?.isBanned) {
              alert('Your account has been suspended by an administrator.');
              await auth.signOut();
              setUser(null);
              setRole(null);
              return;
            }
            
            // Update role if different from optimistic role
            if (data?.role && data.role !== optimisticRole && firebaseUser.email !== 'job.rexoagency@gmail.com') {
              setRole(data.role);
            }
          }
        } catch (error) {
          console.warn("Background profile fetch failed (using fallback state):", error);
        }
      } else {
        setUser(null);
        setRole(null);
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return null;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={!user ? <Auth /> : <Navigate to="/dashboard" />} />
        <Route path="/auth" element={!user ? <Auth /> : <Navigate to="/dashboard" />} />
        
        <Route path="/dashboard" element={user ? <DashboardLayout user={user} role={role} /> : <Navigate to="/auth" />}>
          <Route index element={<Discovery />} />
          <Route path="campaign/:id" element={<CampaignDetail />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="create" element={(role === 'brand' || user?.email === 'job.rexoagency@gmail.com') ? <CreateCampaign /> : <Navigate to="/dashboard" />} />
          <Route path="profile" element={<Profile />} />
          <Route path="ai-pilot" element={<AIPilot />} />
          <Route path="admin" element={<AdminPanel />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
