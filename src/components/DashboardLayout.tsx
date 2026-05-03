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
  ShieldAlert
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
    const notifRecipient = isAdmin ? 'admin' : user?.uid;
    
    // Index Error Fix: We remove the orderBy cloud-side to avoid needing a composite index.
    // We will sort the results in memory (JS side) instead.
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', notifRecipient)
    );

    const unsubNotifs = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in-memory to resolve the Firebase "Index Required" crash
      docs.sort((a: any, b: any) => {
        const dateA = (a as any).createdAt?.toDate ? (a as any).createdAt.toDate() : new Date(0);
        const dateB = (b as any).createdAt?.toDate ? (b as any).createdAt.toDate() : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setNotifications(docs);
    }, (error) => {
        console.error("Notifications Sync Error:", error);
    });

    return () => {
      unsub();
      unsubNotifs();
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
      icon: <Search className="w-5 h-5" />,
      exact: true 
    }] : []),
    ...(config.wallet !== false ? [{ 
      path: '/dashboard/wallet', 
      label: 'Wallet', 
      icon: <WalletIcon className="w-5 h-5" /> 
    }] : []),
    ...(config.campaigns !== false && (role === 'brand' || isAdminEmail(user?.email)) ? [{ 
      path: '/dashboard/create', 
      label: 'Post Ad', 
      icon: <PlusCircle className="w-5 h-5" /> 
    }] : []),
    ...(config.aiPilot !== false ? [{ 
      path: '/dashboard/ai-pilot', 
      label: 'AI', 
      icon: <Sparkles className="w-5 h-5 flex-shrink-0" /> 
    }] : []),
    ...(config.profile !== false ? [{ 
      path: '/dashboard/profile', 
      label: 'Profile', 
      icon: <UserIcon className="w-5 h-5" /> 
    }] : []),
    ...(isAdminEmail(user?.email) ? [{
      path: '/dashboard/admin',
      label: 'Admin',
      icon: <ShieldCheck className="w-5 h-5 text-indigo-600" />
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

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col font-sans">
      {/* Top Header - Glass Effect */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-2xl border-b border-white/50 px-3 py-2.5 flex justify-between items-center transition-all duration-300 shadow-[0_2px_20px_rgb(0,0,0,0.04)]">
        <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/dashboard')}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden shadow-sm bg-white">
            <img 
              src="https://i.postimg.cc/DyJxL7mx/file-0000000008cc720b9d91dbcfd5fecf45.png" 
              alt="Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-[12px] font-display font-bold leading-none mb-0.5 tracking-tight text-[#1C1C1E]">Rexo Tool</h1>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{role} account</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 relative">
          {config.notifications !== false && (
            <>
              <button 
                onClick={() => {
                    setShowNotifs(!showNotifs);
                    if (!showNotifs && unreadCount > 0) markAllRead();
                }}
                className={cn(
                    "relative w-7 h-7 rounded-lg flex items-center justify-center transition-all border",
                    showNotifs ? "bg-brand-primary text-white border-brand-primary" : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                )}
              >
                <Bell className="w-3.5 h-3.5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent border-2 border-white"></span>
                    </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              <AnimatePresence>
                {showNotifs && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-10 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
                    >
                        <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-900">Alert Center</h3>
                            <span className="text-[8px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">{notifications.length} Total</span>
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
                                        "p-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer flex gap-3",
                                        !notif.read && "bg-indigo-50/20"
                                    )}
                                >
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center shadow-sm",
                                        notif.type === 'payment' ? "bg-emerald-50 text-emerald-600" :
                                        notif.type === 'application' ? "bg-blue-50 text-blue-600" :
                                        "bg-indigo-50 text-indigo-600"
                                    )}>
                                        <Bell className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold text-gray-900 truncate uppercase tracking-tighter">{notif.title}</p>
                                        <p className="text-[9px] text-gray-500 font-medium line-clamp-2 mt-0.5 leading-relaxed">{notif.message}</p>
                                        <p className="text-[7px] font-bold text-gray-400 mt-2 uppercase tracking-widest">
                                            {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                        </p>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-10 text-center">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No alerts to show</p>
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
            className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors border border-gray-100"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto w-full max-w-2xl mx-auto px-4 pt-6 pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet context={{ user, role }} />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation - Glass Effect */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav px-3 pb-3 pt-1.5 max-w-2xl mx-auto rounded-t-2xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex justify-between items-center max-w-md mx-auto">
          {navItems.map((item) => {
            const isActive = item.exact 
              ? location.pathname === item.path 
              : location.pathname.startsWith(item.path) && location.pathname !== '/dashboard/profile';
            
            // Special case for home because dashboard/discovery starts with dashboard
            const isHome = item.path === '/dashboard' && location.pathname === '/dashboard';
            const trulyActive = item.path === '/dashboard' ? isHome : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive: navActive }) => cn(
                  "relative flex flex-col items-center gap-1 transition-all duration-300 py-1 min-w-[48px]",
                  trulyActive ? "text-brand-primary" : "text-gray-400 hover:text-gray-600"
                )}
              >
                {trulyActive && (
                  <motion.div 
                    layoutId="nav-indicator"
                    className="absolute -top-1.5 w-1 h-1 rounded-full bg-brand-primary shadow-[0_0_8px_rgb(59,130,246,0.6)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className={cn(
                    "transition-transform duration-300",
                    trulyActive ? "scale-105" : "scale-100"
                )}>
                  {item.icon}
                </div>
                <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
