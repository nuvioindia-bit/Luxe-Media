import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { 
  BarChart3, 
  Search, 
  PlusSquare, 
  PlusCircle, 
  MessageSquare, 
  User as UserIcon,
  LogOut,
  Bell,
  Sparkles,
  Zap,
  Wallet as WalletIcon,
  ShieldCheck,
  ShieldAlert,
  Send,
  LayoutGrid,
  Home
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, updateDoc, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useAppConfig } from '../hooks/useAppConfig';
import { isAdminEmail } from '../constants';

interface Props {
  user: User;
  role: string | null;
}

export default function DashboardLayout({ user, role }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const config = useAppConfig();
  const [isBanned, setIsBanned] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists() && snap.data().isBanned) {
            setIsBanned(true);
        } else {
            setIsBanned(false);
        }
    });
    
    // Check if user is admin based on email
    const isAdmin = isAdminEmail(user?.email);
    
    const unsubscribeFns: (() => void)[] = [];
    const notifsMap = new Map<string, any>();

    const updateNotifs = () => {
      const docs = Array.from(notifsMap.values());
      // Sort in-memory
      docs.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setNotifications(docs);
    };

    // Personal notifications
    const personalQuery = query(collection(db, 'notifications'), where('recipientId', '==', user.uid));
    unsubscribeFns.push(onSnapshot(personalQuery, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'removed') notifsMap.delete(change.doc.id);
        else notifsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
      });
      updateNotifs();
    }, (error) => console.error("Notifications Sync Error:", error)));

    // Admin notifications
    if (isAdmin) {
      const adminQuery = query(collection(db, 'notifications'), where('recipientId', '==', 'admin'));
      unsubscribeFns.push(onSnapshot(adminQuery, (snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === 'removed') notifsMap.delete(change.doc.id);
          else notifsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
        });
        updateNotifs();
      }, (error) => console.error("Admin Notifications Sync Error:", error)));
    }

    return () => {
      unsub();
      unsubscribeFns.forEach(fn => fn());
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
    }
  };

  if (isBanned) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 text-center text-sans">
            <div className="w-24 h-24 bg-red-50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-red-100 shadow-xl shadow-red-100/50">
                <ShieldAlert className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-4xl font-display font-bold text-gray-900 mb-4 tracking-tight">Account Restricted</h1>
            <p className="text-gray-500 max-w-sm mb-10 font-medium leading-relaxed">Your access to the Rexocollab platform has been suspended by administration.</p>
            <button 
                onClick={() => auth.signOut()}
                className="bg-gray-900 text-white px-10 py-4 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10 text-sm uppercase tracking-widest"
            >
                Log Out
            </button>
        </div>
    );
  }

  const handleLogout = () => {
    auth.signOut();
    navigate('/');
  };

  const navItems = [
    ...(config.homePage !== false ? [{ 
      path: '/dashboard', 
      label: 'Home', 
      icon: <LayoutGrid className="w-[18px] h-[18px]" />,
      exact: true 
    }] : []),
    ...(config.wallet !== false ? [{ 
      path: '/dashboard/wallet', 
      label: 'Wallet', 
      icon: <WalletIcon className="w-[18px] h-[18px]" /> 
    }] : []),
    ...(config.campaigns !== false && (role === 'brand' || isAdminEmail(user?.email)) ? [{ 
      path: '/dashboard/create', 
      label: 'Post', 
      icon: <PlusCircle className="w-[18px] h-[18px]" /> 
    }] : []),
    ...(config.aiPilot !== false ? [{ 
      path: '/dashboard/ai-pilot', 
      label: 'Rexo AI', 
      icon: <Sparkles className="w-[18px] h-[18px]" /> 
    }] : []),
    ...(config.profile !== false ? [{ 
      path: '/dashboard/profile', 
      label: 'Account', 
      icon: <UserIcon className="w-[18px] h-[18px]" /> 
    }] : []),
    ...(isAdminEmail(user?.email) ? [{
      path: '/dashboard/admin',
      label: 'Admin',
      icon: <ShieldCheck className="w-[18px] h-[18px]" />
    }] : [])
  ];

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Overview';
    if (path.includes('discovery')) return 'Ad Discovery';
    if (path.includes('wallet')) return 'My Wallet';
    if (path.includes('create')) return 'Post Ad';
    if (path.includes('ai-pilot')) return 'Rexo Tool';
    if (path.includes('admin')) return 'Admin Control House';
    if (path.includes('profile')) return 'Settings';
    return 'Dashboard';
  };

  const isFullScreenPage = location.pathname.includes('/chat/') || 
                           location.pathname.includes('/campaign/') || 
                           location.pathname === '/dashboard/admin' ||
                           location.pathname.includes('/review/');

  const hideHeader = isFullScreenPage;

  return (
    <div className="h-full flex flex-col font-sans overflow-hidden">
      {/* Top Header - Glass Effect */}
      {!hideHeader && (
        <header className="shrink-0 z-40 bg-white/40 dark:bg-gray-950/40 backdrop-blur-3xl border-b border-white/60 dark:border-gray-800/60 px-6 py-4 flex justify-between items-center shadow-[0_2px_20px_rgb(0,0,0,0.02)]">
          <div className="flex items-center gap-3 cursor-pointer transition-opacity" onClick={() => navigate('/dashboard')}>
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm bg-white dark:bg-gray-900 border border-white/60 dark:border-gray-800 skeuo-inner">
              <img 
                src="https://i.postimg.cc/DyJxL7mx/file-0000000008cc720b9d91dbcfd5fecf45.png" 
                alt="Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-[14px] font-display font-black leading-none mb-0.5 tracking-tighter text-[#1C1C1E] dark:text-white">Rexo Tool</h1>
              <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">{role} mode</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 relative">
            {/* Notifications and logout */}
            {config.notifications !== false && (
              <>
                <button 
                  onClick={() => {
                      setShowNotifs(!showNotifs);
                      if (!showNotifs && unreadCount > 0) markAllRead();
                  }}
                  className={cn(
                      "relative w-9 h-9 rounded-2xl flex items-center justify-center transition-all border shadow-sm skeuo-inner",
                      showNotifs ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white" : "bg-white/50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-500 border-white/60 dark:border-gray-800"
                  )}
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                      <span className="absolute top-2 right-2 flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-accent"></span>
                      </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotifs && (
                      <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-12 w-72 bg-white/80 dark:bg-gray-900/90 backdrop-blur-3xl rounded-[2rem] shadow-2xl border border-white/60 dark:border-gray-800 z-50 overflow-hidden"
                      >
                          <div className="p-5 border-b border-gray-100/50 dark:border-gray-800/50 flex justify-between items-center bg-gray-50/50 dark:bg-gray-950/50">
                              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">Notifications</h3>
                              <span className="text-[8px] font-black bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-2.5 py-1 rounded-full">{notifications.length}</span>
                          </div>
                          <div className="max-h-80 overflow-y-auto no-scrollbar">
                              {notifications.length > 0 ? notifications.map(notif => (
                                  <div 
                                      key={notif.id} 
                                      onClick={() => {
                                          if (notif.referenceId) {
                                            if (notif.type === 'campaign_post') navigate('/dashboard/admin');
                                            else if (notif.type === 'application') navigate(`/dashboard/review/${notif.referenceId}`);
                                            else navigate(`/dashboard/campaign/${notif.referenceId}`);
                                          }
                                          setShowNotifs(false);
                                      }}
                                      className={cn(
                                          "p-4 border-b border-gray-100/30 dark:border-gray-800/30 hover:bg-white/40 dark:hover:bg-gray-800/40 transition-colors cursor-pointer flex gap-3",
                                          !notif.read && "bg-blue-50/20 dark:bg-blue-900/20"
                                      )}
                                  >
                                      <div className={cn(
                                          "w-9 h-9 rounded-xl shrink-0 flex items-center justify-center shadow-sm",
                                          notif.type === 'payment' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                          notif.type === 'application' ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                                          "bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                                      )}>
                                          <Bell className="w-4 h-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <p className="text-[11px] font-black text-gray-900 dark:text-white truncate uppercase tracking-tight">{notif.title}</p>
                                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold line-clamp-2 mt-0.5 leading-tight">{notif.message}</p>
                                      </div>
                                  </div>
                              )) : (
                                  <div className="p-12 text-center">
                                      <p className="text-[10px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest">Quiet in here</p>
                                  </div>
                              )}
                          </div>
                      </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
            
            <button 
              onClick={handleLogout}
              className="w-9 h-9 rounded-2xl bg-white/50 dark:bg-gray-900/50 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors border border-white/60 dark:border-gray-800 shadow-sm skeuo-inner tap-active"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className={cn(
        "flex-1 w-full max-w-2xl mx-auto relative overflow-y-auto"
      )}>
        <div className="h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="h-full"
            >
              <Outlet context={{ user, role }} />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Navigation - Elite Flat Bottom Design */}
      {!isFullScreenPage && (
        <div className="shrink-0 z-50 bg-white/90 dark:bg-gray-950/90 backdrop-blur-3xl border-t border-gray-100 dark:border-gray-900 shadow-[0_-5px_30px_rgba(0,0,0,0.05)] pb-safe">
          <div className="max-w-full mx-auto">
            <nav className="flex items-center justify-between h-[60px] px-6">
              {navItems.map((item) => {
                const isHome = item.path === '/dashboard' && location.pathname === '/dashboard';
                const trulyActive = item.path === '/dashboard' ? isHome : location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive: navActive }) => cn(
                      "flex-1 relative flex flex-col items-center justify-center h-full transition-all duration-500 tap-active group",
                      trulyActive ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className={cn(
                        "transition-all duration-500 relative z-10",
                        trulyActive ? "scale-110" : "scale-100 opacity-60"
                      )}>
                        {item.icon}
                      </div>
                      
                      {trulyActive && (
                        <motion.div 
                          layoutId="nav-pill"
                          className="absolute inset-0 bg-white/50 dark:bg-gray-800/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                    </div>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
