import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { isAdminEmail } from './constants';
import { AnimatePresence, motion } from 'motion/react';

// Capacitor Plugins
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';

// Components
import DashboardLayout from './components/DashboardLayout';
import RoleSelection from './components/RoleSelection';

// Lazy Loaded Pages
const Discovery = lazy(() => import('./pages/creator/Discovery'));
const BrandHome = lazy(() => import('./pages/brand/BrandHome'));
const CreateCampaign = lazy(() => import('./pages/brand/CreateCampaign'));
const Profile = lazy(() => import('./pages/Profile'));
const Auth = lazy(() => import('./pages/Auth'));
const Wallet = lazy(() => import('./pages/Wallet'));
const CampaignDetail = lazy(() => import('./pages/CampaignDetail'));
const AIPilot = lazy(() => import('./pages/AIPilot'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ReferEarn = lazy(() => import('./pages/ReferEarn'));
const ApplicationReview = lazy(() => import('./pages/ApplicationReview'));
const Inbox = lazy(() => import('./pages/Inbox'));
const ChatDetail = lazy(() => import('./pages/ChatDetail'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const MetaInsights = lazy(() => import('./pages/MetaInsights'));

const SupportMenu = lazy(() => import('./pages/Settings'));
const SettingsMenu = lazy(() => import('./pages/Settings'));

function AnimatedRoutes({ user, role }: { user: User | null, role: string | null }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={!user ? <Suspense fallback={null}><Auth /></Suspense> : <Navigate to="/dashboard" />} />
        <Route path="/auth" element={!user ? <Suspense fallback={null}><Auth /></Suspense> : <Navigate to="/dashboard" />} />
        
        <Route path="/dashboard" element={user ? <DashboardLayout user={user} role={role} /> : <Navigate to="/auth" />}>
          <Route index element={<Suspense fallback={null}>{role === 'brand' ? <BrandHome /> : <Discovery />}</Suspense>} />
          <Route path="campaign/:id" element={<Suspense fallback={null}><CampaignDetail /></Suspense>} />
          <Route path="wallet" element={<Suspense fallback={null}><Wallet /></Suspense>} />
          <Route path="create" element={(role === 'brand' || isAdminEmail(user?.email)) ? <Suspense fallback={null}><CreateCampaign /></Suspense> : <Navigate to="/dashboard" />} />
          <Route path="profile" element={<Suspense fallback={null}><Profile /></Suspense>} />
          <Route path="refer-earn" element={<Suspense fallback={null}><ReferEarn /></Suspense>} />
          <Route path="ai-pilot" element={<Suspense fallback={null}><AIPilot /></Suspense>} />
          <Route path="admin" element={<Suspense fallback={null}><AdminPanel /></Suspense>} />
          <Route path="review/:appId" element={<Suspense fallback={null}><ApplicationReview /></Suspense>} />
          <Route path="inbox" element={<Suspense fallback={null}><Inbox /></Suspense>} />
          <Route path="chat/:chatId" element={<Suspense fallback={null}><ChatDetail /></Suspense>} />
          <Route path="profile/:userId" element={<Suspense fallback={null}><PublicProfile /></Suspense>} />
          <Route path="insights" element={<Suspense fallback={null}><MetaInsights /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={null}><SettingsMenu /></Suspense>} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initCap = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        CapApp.addListener('backButton', ({ canGoBack }) => {
          if (!canGoBack) {
            CapApp.exitApp();
          } else {
            window.history.back();
          }
        });

        // Optimize Status Bar for iOS/Android
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#F2F2F7' });
        
        // Ensure keyboard doesn't overlap content
        await Keyboard.setScroll({ isDisabled: false });
      } catch (e) {
        console.warn('Capacitor plugins not available:', e);
      }
    };
    
    initCap();
  }, []);

  useEffect(() => {
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] dark:bg-[#0a0a0a]">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-16 h-16 bg-brand-primary rounded-3xl"
        />
      </div>
    );
  }

  if (user && role === 'pending') {
    return <RoleSelection user={user} onComplete={() => {}} />;
  }

  return (
    <BrowserRouter>
      <div className="relative min-h-screen">
        <div className="mesh-gradient" />
        <div className="mesh-sphere top-0 left-0 bg-blue-400" />
        <div className="mesh-sphere bottom-0 right-0 bg-purple-400" />
        <AnimatedRoutes user={user} role={role} />
      </div>
    </BrowserRouter>
  );
}
