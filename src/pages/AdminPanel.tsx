import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Users, 
  Megaphone, 
  ShieldAlert, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Search, 
  Filter, 
  Bell, 
  UserCog, 
  Wallet, 
  Activity,
  Settings,
  Plus,
  MoreVertical,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  setDoc,
  serverTimestamp,
  addDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isAdminEmail } from '../constants';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAppConfig } from '../hooks/useAppConfig';

export default function AdminPanel() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const [users, setUsers] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc')), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubCampaigns = onSnapshot(query(collection(db, 'campaigns'), orderBy('createdAt', 'desc')), (snap) => {
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubWithdrawals = onSnapshot(query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc')), (snap) => {
      setWithdrawals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubUsers(); unsubCampaigns(); unsubWithdrawals(); };
  }, []);

  const toggleBan = async (user: any) => {
    if (isAdminEmail(user.email)) return alert("Access Denied: Cannot restrict an Administrator.");
    try {
      const newStatus = !user.isBanned;
      await updateDoc(doc(db, 'users', user.id), { isBanned: newStatus });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteUser = async (user: any) => {
    if (isAdminEmail(user.email)) return alert("Access Denied: Cannot delete an Administrator.");
    if (window.confirm(`PERMANENT ACTION: Delete user ${user.displayName || user.email}?`)) {
      await deleteDoc(doc(db, 'users', user.id));
    }
  };

  const updateCampaignStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'campaigns', id), { status, updatedAt: serverTimestamp() });
      const campaign = campaigns.find(c => c.id === id);
      if (campaign) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: campaign.creatorId,
          title: `Ad ${status === 'approved' ? 'Live' : 'Rejected'}`,
          message: `Your campaign "${campaign.title}" has been ${status}.`,
          type: 'system',
          createdAt: serverTimestamp(),
          read: false
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateWithdrawalStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'withdrawals', id), { status, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleConfig = async (key: string, value: boolean) => {
    await setDoc(doc(db, 'app_config', 'main'), { [key]: value }, { merge: true });
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(search.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCampaigns = campaigns.filter(c => 
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.status?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCampaigns = campaigns.filter(c => c.status === 'pending');
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const totalEarnings = withdrawals.filter(w => w.status === 'completed').reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // System activities for "Notifications" bell
  const systemActivities = [
    ...users.slice(0, 5).map(u => ({ id: u.id, text: `New User: ${u.displayName || u.email}`, type: 'user', time: u.createdAt })),
    ...campaigns.slice(0, 5).map(c => ({ id: c.id, text: `New Ad: ${c.title}`, type: 'campaign', time: c.createdAt })),
    ...withdrawals.slice(0, 5).map(w => ({ id: w.id, text: `Payout Req: ₹${w.amount}`, type: 'payout', time: w.createdAt }))
  ].sort((a, b) => (b.time?.seconds || 0) - (a.time?.seconds || 0)).slice(0, 8);

  const StatCard = ({ title, value, icon: Icon, color, onClick }: any) => (
    <motion.div 
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn("p-4 rounded-3xl shadow-sm border border-white/50 flex flex-col gap-2 relative overflow-hidden bg-white cursor-pointer", color)}
    >
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
          <Icon className="w-5 h-5 text-gray-700" />
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
      <div>
        <div className="text-2xl font-black text-gray-900 leading-none">{value}</div>
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{title}</div>
      </div>
      <div className="absolute -right-4 -bottom-4 opacity-[0.03]">
        <Icon className="w-24 h-24" />
      </div>
    </motion.div>
  );

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button 
      onClick={() => { setActiveTab(id); setSearch(''); setShowNotifications(false); }} 
      className={cn(
        "flex items-center gap-2 px-5 py-2.5 rounded-full transition-all text-[10px] font-black uppercase tracking-[0.1em] shrink-0 whitespace-nowrap",
        activeTab === id ? "bg-[#0A3D91] text-white shadow-xl shadow-blue-900/20" : "bg-white text-gray-400 border border-gray-100"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col font-sans select-none overflow-hidden">
      {/* Header */}
      <header className="bg-[#0A3D91] px-5 py-6 shrink-0 shadow-2xl z-50 flex items-center justify-between rounded-b-[2.5rem] border-b border-white/10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all active:scale-90"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-white font-black text-xl tracking-tight leading-none">Admin Hub</h1>
            <p className="text-blue-200 text-[10px] font-bold uppercase tracking-[0.2em] mt-1.5 opacity-60">Control Center</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => setShowNotifications(!showNotifications)}
             className={cn(
               "w-12 h-12 rounded-2xl flex items-center justify-center relative transition-all active:scale-95",
               showNotifications ? "bg-white text-[#0A3D91]" : "bg-white/10 text-white"
             )}
           >
             <Bell className="w-5 h-5" />
             {(pendingCampaigns.length > 0 || pendingWithdrawals.length > 0) && (
               <span className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0A3D91] animate-pulse"></span>
             )}
           </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="px-5 pt-6 pb-2 shrink-0 flex gap-2.5 overflow-x-auto no-scrollbar mask-fade-right">
        <TabButton id="dashboard" label="Overview" icon={Activity} />
        <TabButton id="users" label="Users" icon={Users} />
        <TabButton id="withdrawals" label="Payouts" icon={Wallet} />
        <TabButton id="campaigns" label="Ad Approvals" icon={Megaphone} />
        <TabButton id="config" label="Visibility" icon={Settings} />
      </nav>

      {/* Search Bar */}
      <AnimatePresence>
        {activeTab !== 'dashboard' && activeTab !== 'config' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-5 pb-2 shrink-0"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-[1.5rem] py-4 pl-12 pr-4 text-sm font-bold text-gray-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none shadow-sm"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-5 pb-12 pt-4 scroll-smooth">
        <AnimatePresence mode="wait">
          {showNotifications ? (
            <motion.div
              key="notifs"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 px-2">Recent Logs</h3>
                <button onClick={() => setShowNotifications(false)} className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Close</button>
              </div>
              {systemActivities.map((act, i) => (
                <div key={`${act.id}-${i}`} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3 shadow-sm">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    act.type === 'user' ? 'bg-blue-50 text-blue-500' : 
                    act.type === 'campaign' ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-500'
                  )}>
                    {act.type === 'user' ? <Users size={14}/> : act.type === 'campaign' ? <Megaphone size={14}/> : <Wallet size={14}/>}
                  </div>
                  <p className="text-[11px] font-bold text-gray-700 flex-1">{act.text}</p>
                </div>
              ))}
            </motion.div>
          ) : activeTab === 'dashboard' ? (
            <motion.div 
              key="dash"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <StatCard title="All Users" value={users.length} icon={Users} color="bg-blue-50/30" onClick={() => setActiveTab('users')} />
                <StatCard title="Review Ads" value={pendingCampaigns.length} icon={Megaphone} color="bg-orange-50/30" onClick={() => setActiveTab('campaigns')} />
                <StatCard title="Due Payouts" value={pendingWithdrawals.length} icon={Wallet} color="bg-red-50/30" onClick={() => setActiveTab('withdrawals')} />
                <StatCard title="Gross Paid" value={`₹${totalEarnings.toLocaleString()}`} icon={TrendingUp} color="bg-emerald-50/30" />
              </div>
              
              <div className="mt-8 flex flex-col items-center">
                 <div className="w-20 h-1 bg-gray-200 rounded-full mb-6"></div>
                 <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Operational Readiness 100%</p>
              </div>
            </motion.div>
          ) : activeTab === 'users' ? (
            <motion.div 
               key="users"
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               className="space-y-3"
            >
              {filteredUsers.map(u => (
                <div key={u.id} className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-50 border border-indigo-50 flex items-center justify-center shrink-0">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt="" className="w-full h-full rounded-[1.25rem] object-cover" />
                    ) : (
                      <UserCog className="w-6 h-6 text-indigo-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-gray-900 truncate">{u.displayName || 'Unnamed User'}</h4>
                    <p className="text-[10px] text-gray-400 font-bold truncate">{u.email}</p>
                    <div className="mt-1 flex gap-2">
                       <span className={cn("text-[8px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-widest", u.role === 'brand' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600')}>
                         {u.role || 'creator'}
                       </span>
                       {u.isBanned && (
                         <span className="text-[8px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-widest bg-red-100 text-red-600">Restricted</span>
                       )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleBan(u)} 
                      className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-all", u.isBanned ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600")}
                    >
                      {u.isBanned ? <CheckCircle className="w-4.5 h-4.5" /> : <ShieldAlert className="w-4.5 h-4.5" />}
                    </button>
                    <button 
                      onClick={() => deleteUser(u)} 
                      className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          ) : activeTab === 'campaigns' ? (
            <motion.div 
               key="campaigns"
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               className="space-y-4"
            >
              {filteredCampaigns.map(c => (
                <div key={c.id} className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-gray-100">
                  <div className="p-5 flex gap-4">
                     <div className="w-20 h-20 rounded-[1.5rem] bg-gray-50 flex items-center justify-center overflow-hidden shrink-0 border border-gray-100">
                       {c.image ? <img src={c.image} className="w-full h-full object-cover" /> : <Megaphone className="w-8 h-8 text-gray-200" />}
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                           <span className={cn(
                             "text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest",
                             c.status === 'pending' ? 'bg-orange-100 text-orange-600' : 
                             c.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                           )}>
                             {c.status}
                           </span>
                           <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{c.type || 'Campaign'}</p>
                        </div>
                        <h4 className="text-sm font-black text-gray-900 line-clamp-1">{c.title}</h4>
                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-lg font-black text-[#0A3D91]">₹{c.reward}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Payout</span>
                        </div>
                     </div>
                  </div>
                  {c.status === 'pending' && (
                    <div className="flex p-2 gap-2 bg-gray-50/50 border-t border-gray-50">
                      <button 
                        onClick={() => updateCampaignStatus(c.id, 'approved')}
                        className="flex-1 py-3.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20"
                      >
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button 
                        onClick={() => updateCampaignStatus(c.id, 'rejected')}
                        className="flex-1 py-3.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] bg-red-100 text-red-600 rounded-2xl"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          ) : activeTab === 'withdrawals' ? (
             <motion.div 
               key="withdrawals"
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               className="space-y-4"
             >
                {withdrawals.map(w => (
                   <div key={w.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-5">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-[#0A3D91]/5 flex items-center justify-center">
                               <Wallet className="w-6 h-6 text-[#0A3D91]" />
                            </div>
                            <div>
                               <h4 className="text-lg font-black text-gray-900">₹{w.amount}</h4>
                               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Payout Claim</p>
                            </div>
                         </div>
                         <span className={cn(
                           "text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest",
                           w.status === 'pending' ? 'bg-orange-100 text-orange-600' : 
                           w.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                         )}>
                           {w.status}
                         </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-5">
                         <div className="p-3 bg-gray-50 rounded-2xl">
                            <span className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Method</span>
                            <span className="text-[11px] font-black text-gray-800">{w.method || 'UPI'}</span>
                         </div>
                         <div className="p-3 bg-gray-50 rounded-2xl overflow-hidden">
                            <span className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Target</span>
                            <span className="text-[11px] font-black text-gray-800 truncate block">{w.target || 'N/A'}</span>
                         </div>
                      </div>

                      {w.status === 'pending' && (
                        <div className="flex gap-2.5">
                           <button 
                             onClick={() => updateWithdrawalStatus(w.id, 'completed')}
                             className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                           >
                              Complete Payment
                           </button>
                           <button 
                             onClick={() => updateWithdrawalStatus(w.id, 'cancelled')}
                             className="px-6 py-4 bg-red-100 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                           >
                             Reject
                           </button>
                        </div>
                      )}
                   </div>
                ))}
             </motion.div>
          ) : activeTab === 'config' && (
            <motion.div 
              key="config"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6 pb-20"
            >
              <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-gray-50">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 leading-none">Access Control</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">Manage Page Visibility</p>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <ShieldAlert className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                
                <div className="grid gap-6">
                  {[
                    { key: 'homePage', label: 'Feed', icon: Activity },
                    { key: 'wallet', label: 'Wallet', icon: Wallet },
                    { key: 'notifications', label: 'Notifs', icon: Bell },
                    { key: 'campaigns', label: 'Post Ads', icon: Megaphone },
                    { key: 'referEarn', label: 'Referral', icon: Users },
                    { key: 'profile', label: 'Profile', icon: UserCog },
                    { key: 'aiPilot', label: 'AI Pilot', icon: Activity },
                    { key: 'leaderboard', label: 'Ranking', icon: TrendingUp },
                    { key: 'maintenance_mode', label: 'Safe Mode', icon: ShieldAlert },
                  ].map((item: any) => (
                    <div key={item.key} className="flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                            <item.icon className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                         </div>
                         <span className="text-sm font-black text-gray-700">{item.label}</span>
                      </div>
                      <button 
                        onClick={() => toggleConfig(item.key, !((config as any)[item.key] !== false))}
                        className={cn(
                          "w-12 h-6.5 rounded-full transition-all relative border-2",
                          (config as any)[item.key] !== false ? "bg-[#0A3D91] border-[#0A3D91]" : "bg-gray-200 border-gray-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                          (config as any)[item.key] !== false ? "right-1" : "left-1"
                        )}></div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-[#0A3D91] rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                 <div className="relative z-10">
                    <h4 className="text-white font-black text-sm uppercase tracking-tight">Real-time Deployment</h4>
                    <p className="text-blue-200/80 text-[11px] font-medium mt-2 leading-relaxed">
                      Visibility changes are broadcast instantly. "By Default" all new features are enabled for users.
                    </p>
                 </div>
                 <Activity className="absolute -right-8 -bottom-8 w-40 h-40 text-white/5" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="shrink-0 py-3 bg-white border-t border-gray-100 flex justify-center items-center gap-2">
         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Admin Center Secure • v2.0.1</span>
      </footer>

      {/* Floating Refresh */}
      <button 
        onClick={() => { setIsRefreshing(true); setTimeout(() => setIsRefreshing(false), 800); }}
        className={cn(
          "fixed bottom-8 right-6 w-14 h-14 bg-[#0A3D91] text-white rounded-[2rem] shadow-2xl shadow-blue-900/30 flex items-center justify-center z-[100] active:scale-90 transition-all",
          isRefreshing && "animate-spin"
        )}
      >
        <Activity className="w-6 h-6" />
      </button>
    </div>
  );
}

