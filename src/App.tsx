import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.isBanned) {
              alert('Your account has been suspended by an administrator.');
              await auth.signOut();
              setUser(null);
              setRole(null);
            } else {
              setUser(firebaseUser);
              setRole(data.role);
            }
          } else {
             setUser(firebaseUser);
          }
        } catch (error) {
          console.error("Failed to fetch user state:", error);
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
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
