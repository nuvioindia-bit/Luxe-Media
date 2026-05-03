import { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Users, 
  Megaphone, 
  ShieldAlert, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Search, 
  Bell, 
  UserCog, 
  Wallet, 
  Activity,
  Zap,
  Settings,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  LayoutDashboard,
  ShieldCheck,
  Ban,
  Clock,
  ExternalLink,
  RefreshCw,
  MoreHorizontal
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
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);

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
    const isTargetAdmin = isAdminEmail(user.email);
    const isCurrentlyBanned = user.isBanned;

    // Special logic: Admins can unban admins, but can't ban them.
    if (isTargetAdmin && !isCurrentlyBanned) {
      return alert("Security Protocol: You cannot restrict another Administrator.");
    }

    try {
      const newStatus = !isCurrentlyBanned;
      setProcessingId(user.id);
      await updateDoc(doc(db, 'users', user.id), { 
        isBanned: newStatus,
        updatedAt: serverTimestamp() 
      });
    } catch (e) {
      console.error(e);
      alert("Failed to update user status.");
    } finally {
      setProcessingId(null);
    }
  };

  const deleteUser = async (user: any) => {
    if (isAdminEmail(user.email)) return alert("Security Protocol: Administrators cannot be deleted via UI.");
    if (window.confirm(`DANGER: Permanently delete ${user.displayName || user.email}?`)) {
      await deleteDoc(doc(db, 'users', user.id));
    }
  };

  const updateCampaignStatus = async (id: string, status: string) => {
    try {
      setProcessingId(id);
      await updateDoc(doc(db, 'campaigns', id), { status, updatedAt: serverTimestamp() });
      const campaign = campaigns.find(c => c.id === id);
      if (campaign) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: campaign.creatorId || campaign.brandId,
          title: status === 'active' ? 'Ad Activated' : 'Ad Rejected',
          message: `Campaign "${campaign.title}" is now ${status === 'active' ? 'live' : 'rejected'}.`,
          type: 'system',
          createdAt: serverTimestamp(),
          read: false,
          referenceId: id
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  const updateWithdrawalStatus = async (id: string, status: string) => {
    try {
      setProcessingId(id);
      await updateDoc(doc(db, 'withdrawals', id), { status, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  const toggleConfig = async (key: string, value: boolean) => {
    await setDoc(doc(db, 'app_config', 'main'), { [key]: value }, { merge: true });
  };

  const filteredItems = useMemo(() => {
    const s = search.toLowerCase();
    if (activeTab === 'users') return users.filter(u => u.email?.toLowerCase().includes(s) || u.displayName?.toLowerCase().includes(s));
    if (activeTab === 'ads') return campaigns.filter(c => c.title?.toLowerCase().includes(s));
    return [];
  }, [activeTab, search, users, campaigns]);

  const stats = {
    users: users.length,
    pendingAds: campaigns.filter(c => c.status === 'pending').length,
    pendingPayouts: withdrawals.filter(w => w.status === 'pending').length,
    totalPaid: withdrawals.filter(w => w.status === 'completed').reduce((a, b) => a + (b.amount || 0), 0)
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#F1F5F9] flex flex-col font-sans select-none overflow-hidden text-slate-900">
      {/* Header - Sleeker & Minimal */}
      <header className="bg-[#0A192F] px-3 py-3 shrink-0 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate(-1)} 
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all active:scale-90"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div>
            <h1 className="text-white font-black text-sm tracking-tight leading-none uppercase">Rexo Console</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">System Secure</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
           <div className="flex -space-x-1.5">
             {users.slice(0, 3).map((u, i) => (
               <div key={i} className="w-6 h-6 rounded-full border border-[#0A192F] bg-gray-700 overflow-hidden shrink-0">
                 {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : null}
               </div>
             ))}
           </div>
           <div className="w-px h-5 bg-white/10 mx-0.5"></div>
           <button className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 active:scale-90 transition-all">
             <Bell className="w-4 h-4" />
           </button>
        </div>
      </header>

      {/* Primary Navigation - Compact Row */}
      <nav className="bg-white border-b border-gray-100 flex items-center px-3 overflow-x-auto hide-scrollbar py-1.5 gap-1 shadow-sm shrink-0">
        {[
          { id: 'overview', label: 'Monitor', icon: LayoutDashboard },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'payouts', label: 'Finance', icon: Wallet },
          { id: 'ads', label: 'Approvals', icon: ShieldCheck },
          { id: 'config', label: 'System', icon: Settings },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearch(''); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-blue-50 text-blue-600 font-bold text-[9px] uppercase tracking-wider shadow-sm" 
                : "text-gray-400 font-bold text-[9px] uppercase tracking-wider hover:text-gray-600"
            )}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Global Search Strip - Only for lists */}
      <AnimatePresence>
        {(activeTab === 'users' || activeTab === 'ads') && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border-b border-gray-100 px-4 py-3 shrink-0"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input 
                type="text" 
                placeholder={`Filter ${activeTab}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-lg py-2.5 pl-9 pr-4 text-xs font-bold text-gray-800 placeholder:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all shadow-inner"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto hide-scrollbar p-4 scroll-smooth">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="space-y-4"
            >
              {/* Quick High-Level Stats */}
              <div className="grid grid-cols-2 gap-2">
                 <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="text-xl font-black text-gray-900 leading-none">{stats.users}</div>
                      <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1.5">Active Entities</div>
                    </div>
                    <Users className="absolute -right-2 -bottom-2 w-10 h-10 text-gray-50 group-hover:text-blue-50 transition-colors" />
                 </div>
                 <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group active:scale-95 transition-all" onClick={() => setActiveTab('ads')}>
                    <div className="relative z-10">
                      <div className="text-xl font-black text-orange-600 leading-none">{stats.pendingAds}</div>
                      <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1.5">Review Required</div>
                    </div>
                    <Megaphone className="absolute -right-2 -bottom-2 w-10 h-10 text-gray-50 group-hover:text-orange-50 transition-colors" />
                 </div>
                 <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group active:scale-95 transition-all" onClick={() => setActiveTab('payouts')}>
                    <div className="relative z-10">
                      <div className="text-xl font-black text-red-600 leading-none">{stats.pendingPayouts}</div>
                      <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1.5">Pending Payouts</div>
                    </div>
                    <Wallet className="absolute -right-2 -bottom-2 w-10 h-10 text-gray-50 group-hover:text-red-50 transition-colors" />
                 </div>
                 <div className="bg-slate-900 p-3 rounded-xl border border-white/5 shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="text-xl font-black text-emerald-400 leading-none">₹{stats.totalPaid.toLocaleString()}</div>
                      <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1.5">Gross Outflow</div>
                    </div>
                    <TrendingUp className="absolute -right-2 -bottom-2 w-10 h-10 text-white/5 group-hover:text-white/10 transition-colors" />
                 </div>
              </div>

              {/* Logs / Recent Activity - Compact List */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mt-6 shadow-sm">
                <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-900 flex items-center gap-2">
                     <Activity size={14} className="text-blue-500" /> System Logs
                   </h3>
                   <span className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">Real-time Feed</span>
                </div>
                <div className="divide-y divide-gray-50">
                   {users.slice(0, 5).map(u => (
                     <div key={u.id} className="p-3 flex items-center gap-3 hover:bg-slate-50/10 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                          {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover rounded-lg" /> : <UserCog size={14} className="text-gray-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="text-[10px] font-black text-gray-800 truncate">{u.displayName || u.email}</div>
                           <div className="text-[8px] font-bold text-gray-400 uppercase">New account registered</div>
                        </div>
                        <div className="text-[8px] font-bold text-gray-300 uppercase shrink-0">Now</div>
                     </div>
                   ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div 
               key="users"
               initial={{ opacity: 0, x: -10 }}
               animate={{ opacity: 1, x: 0 }}
               className="space-y-1.5 pb-10"
            >
              {filteredItems.map((u: any) => (
                <div key={u.id} className="bg-white p-2.5 rounded-xl border border-gray-100 flex items-center gap-2.5 shadow-sm group hover:border-blue-100 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-gray-100 flex items-center justify-center shrink-0 relative overflow-hidden">
                    {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <UserCog className="w-4 h-4 text-slate-300" />}
                    {isAdminEmail(u.email) && (
                      <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                        <ShieldCheck className="w-3 h-3 text-blue-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                       <h4 className="text-[10px] font-black text-gray-900 truncate tracking-tight">{u.displayName || 'Unnamed Partner'}</h4>
                       {isAdminEmail(u.email) && <span className="text-[5px] font-black text-white bg-blue-600 px-1 py-0.5 rounded uppercase tracking-tighter shadow-sm">ROOT</span>}
                    </div>
                    <p className="text-[8px] font-bold text-gray-400 truncate opacity-60 tracking-tight">{u.email}</p>
                    <div className="flex items-center gap-1 mt-1">
                       <span className={cn(
                        "text-[6px] font-black uppercase px-1.5 py-0.5 rounded-md shadow-sm border", 
                        u.role === 'brand' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                       )}>
                         {u.role || 'creator'}
                       </span>
                       {u.isBanned && <span className="text-[6px] font-black uppercase px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100">SILENCED</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      disabled={processingId === u.id}
                      onClick={(e) => { e.stopPropagation(); toggleBan(u); }}
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-90",
                        u.isBanned ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-orange-50 text-orange-600 border border-orange-100",
                        processingId === u.id && "animate-pulse"
                      )}
                    >
                      {u.isBanned ? <ShieldCheck size={14}/> : <Ban size={14}/>}
                    </button>
                    {!isAdminEmail(u.email) && (
                      <button onClick={(e) => { e.stopPropagation(); deleteUser(u); }} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100 active:scale-90 shadow-sm transition-all">
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'ads' && (
             <motion.div 
               key="ads"
               initial={{ opacity: 0, x: -10 }}
               animate={{ opacity: 1, x: 0 }}
               className="space-y-2 pb-10"
             >
                {filteredItems.map((c: any) => (
                   <div key={c.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm active:scale-[0.98] transition-all" onClick={() => setSelectedCampaign(c)}>
                      <div className="p-2.5 flex gap-2.5">
                         <div className="w-11 h-11 rounded-lg bg-slate-50 border border-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
                            {c.image ? <img src={c.image} className="w-full h-full object-cover" /> : <Megaphone className="w-5 h-5 text-slate-200" />}
                         </div>
                         <div className="flex-1 min-w-0 py-0">
                            <div className="flex items-center justify-between">
                               <span className={cn(
                                 "text-[6px] font-black uppercase px-1.5 py-0.5 rounded-md",
                                 c.status === 'pending' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 
                                 c.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                               )}>
                                 {c.status}
                               </span>
                               <span className="text-[6px] font-black text-slate-300 uppercase tracking-widest">{c.platform || 'System'}</span>
                            </div>
                            <h4 className="text-[10px] font-black text-slate-900 mt-1 truncate tracking-tight">{c.title}</h4>
                            <div className="mt-0.5 text-blue-600 font-black text-[11px]">₹{c.reward || c.budget}</div>
                         </div>
                      </div>
                      {c.status === 'pending' && (
                        <div className="flex p-1 gap-1 bg-slate-50/50 border-t border-slate-50">
                           <button 
                             onClick={(e) => { e.stopPropagation(); updateCampaignStatus(c.id, 'active'); }}
                             className="flex-1 py-1.5 bg-emerald-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1"
                           >
                             <CheckCircle size={10} /> Activate
                           </button>
                           <button 
                             onClick={(e) => { e.stopPropagation(); updateCampaignStatus(c.id, 'rejected'); }}
                             className="flex-1 py-1.5 bg-red-50 text-red-600 rounded-lg text-[8px] font-black uppercase tracking-widest border border-red-100 active:scale-95 transition-all"
                           >
                             Reject
                           </button>
                        </div>
                      )}
                   </div>
                ))}
             </motion.div>
          )}

          {activeTab === 'payouts' && (
            <motion.div 
              key="payouts"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-3 pb-10"
            >
              {withdrawals.map(w => (
                 <div key={w.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm relative overflow-hidden hover:border-blue-100 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm border",
                            w.status === 'pending' ? 'bg-orange-50 text-orange-500 border-orange-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'
                          )}>
                             <Wallet size={14} />
                          </div>
                          <div>
                             <div className="text-lg font-black text-gray-900 leading-none">₹{w.amount}</div>
                             <div className="text-[7px] font-bold text-gray-400 uppercase mt-0.5 tracking-widest">Settlement Request</div>
                          </div>
                       </div>
                       <span className={cn(
                         "text-[6px] font-black uppercase px-1.5 py-0.5 rounded-md shadow-sm border",
                         w.status === 'pending' ? 'bg-orange-50 text-orange-600 border-orange-200' : 
                         w.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                       )}>
                         {w.status}
                       </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                       <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 shadow-inner">
                          <span className="text-[6px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">Provider</span>
                          <span className="text-[9px] font-black text-slate-800 tracking-tight">{w.method || 'Digital Wallet'}</span>
                       </div>
                       <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 shadow-inner overflow-hidden">
                          <span className="text-[6px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">Dest. Address</span>
                          <span className="text-[9px] font-black text-slate-800 truncate block tracking-tight">{w.target || 'System Node'}</span>
                       </div>
                    </div>

                    {w.status === 'pending' && (
                       <div className="flex gap-1.5">
                          <button 
                            onClick={() => updateWithdrawalStatus(w.id, 'completed')}
                            disabled={processingId === w.id}
                            className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                             <CheckCircle size={12} /> Release Funds
                          </button>
                          <button 
                            onClick={() => updateWithdrawalStatus(w.id, 'cancelled')}
                            disabled={processingId === w.id}
                            className="px-3 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                          >
                             Deny
                          </button>
                       </div>
                    )}
                 </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'config' && (
            <motion.div 
               key="config"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="space-y-3 pb-10"
            >
               <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden shadow-xl border border-white/5">
                  <div className="relative z-10">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
                       <ShieldCheck className="text-blue-400" size={14} /> Command Interface
                     </h3>
                     <p className="text-slate-400 text-[8px] mt-1.5 font-medium leading-relaxed max-w-[85%]">Global overrides for application infrastructure state.</p>
                  </div>
                  <Zap className="absolute -right-6 -bottom-6 w-16 h-16 text-white/5 -rotate-12 translate-x-3 translate-y-3" />
               </div>

               <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 scale-[0.98]">
                  <div className="space-y-0.5">
                    {[
                      { key: 'homePage', label: 'Feed Display System', icon: LayoutDashboard },
                      { key: 'wallet', label: 'Treasury & Wallet', icon: Wallet },
                      { key: 'campaigns', label: 'Ad Propagation Engine', icon: Megaphone },
                      { key: 'referEarn', label: 'Growth Ecosystem', icon: Users },
                      { key: 'aiPilot', label: 'Rexo Intelligence Hub', icon: Zap },
                      { key: 'maintenance_mode', label: 'Service Interruption', icon: AlertCircle, destructive: true },
                    ].map((item: any) => (
                      <div key={item.key} className="flex items-center justify-between py-2 px-1.5 rounded-lg transition-colors hover:bg-slate-50/50 group">
                         <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-7 h-7 rounded-md flex items-center justify-center transition-all shadow-sm border",
                              item.destructive ? "bg-red-50 text-red-500 border-red-100" : "bg-slate-50/50 text-slate-400 border-slate-100 group-hover:text-blue-500 group-hover:border-blue-100 group-hover:bg-blue-50"
                            )}>
                               <item.icon size={12} />
                            </div>
                            <span className={cn("text-[10px] font-black tracking-tight", item.destructive ? "text-red-700" : "text-slate-700")}>{item.label}</span>
                         </div>
                         <button 
                           onClick={() => toggleConfig(item.key, !((config as any)[item.key] !== false))}
                           className={cn(
                             "w-8 h-4.5 rounded-full transition-all relative border-2",
                             (config as any)[item.key] !== false ? "bg-blue-600 border-blue-600" : "bg-slate-200 border-slate-200"
                           )}
                         >
                           <div className={cn(
                             "absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-md transition-all",
                             (config as any)[item.key] !== false ? "right-0.5" : "left-0.5"
                           )}></div>
                         </button>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4 shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                     <CheckCircle size={14} />
                  </div>
                  <div>
                    <h5 className="text-[10px] font-black text-emerald-800 uppercase tracking-tight">System Integrity Normal</h5>
                    <p className="text-[8px] font-bold text-emerald-600/80 uppercase tracking-widest mt-0.5">all nodes reporting online</p>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Action Strip */}
      <div className="bg-white/80 backdrop-blur-xl border-t border-gray-100 p-1.5 flex justify-around shrink-0 relative z-50">
         <button onClick={() => { setIsRefreshing(true); setTimeout(() => setIsRefreshing(false), 800); }} className={cn("flex flex-col items-center gap-0.5 group transition-all active:scale-90 p-1.5", isRefreshing && "opacity-50")}>
            <div className={cn("w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center border border-gray-100 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all", isRefreshing && "animate-spin")}>
               <RefreshCw size={16} />
            </div>
            <span className="text-[6.5px] font-black text-gray-400 uppercase tracking-widest">Pulse</span>
         </button>
         <button onClick={() => setShowAnalytics(true)} className="flex flex-col items-center gap-0.5 group p-1.5 active:scale-90 transition-all">
            <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center border border-gray-100 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all">
               <TrendingUp size={16} />
            </div>
            <span className="text-[6.5px] font-black text-gray-400 uppercase tracking-widest">Analytics</span>
         </button>
         <button onClick={() => setShowSecurity(true)} className="flex flex-col items-center gap-0.5 group p-1.5 active:scale-90 transition-all">
            <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center border border-gray-100 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
               <ShieldCheck size={16} />
            </div>
            <span className="text-[6.5px] font-black text-gray-400 uppercase tracking-widest">Security</span>
         </button>
      </div>

      {/* Analytics Modal */}
      <AnimatePresence>
        {showAnalytics && (
          <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/20 backdrop-blur-sm p-0">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-lg rounded-t-3xl p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-indigo-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest">Growth Analytics</h3>
                </div>
                <button onClick={() => setShowAnalytics(false)} className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center"><XCircle size={14} className="text-gray-400" /></button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-gray-100">
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Conversion Velocity</span>
                    <span className="text-lg font-black text-slate-800">84.2%</span>
                    <div className="h-1 bg-gray-200 rounded-full mt-2 overflow-hidden"><div className="w-[84%] h-full bg-indigo-500 rounded-full"></div></div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-gray-100">
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Retention Index</span>
                    <span className="text-lg font-black text-slate-800">9.4/10</span>
                    <div className="h-1 bg-gray-200 rounded-full mt-2 overflow-hidden"><div className="w-[94%] h-full bg-emerald-500 rounded-full"></div></div>
                  </div>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl text-white">
                   <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Yield Curve</span>
                      <span className="text-[8px] text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-400/10 rounded tracking-tight">+12.4% MoM</span>
                   </div>
                   <div className="flex items-end gap-1.5 h-16">
                      {[30, 45, 25, 60, 40, 80, 55, 70, 45, 90].map((h, i) => (
                        <div key={i} className="flex-1 bg-blue-500/20 rounded-t-sm relative transition-all hover:bg-blue-500" style={{ height: `${h}%` }}></div>
                      ))}
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Security Modal */}
      <AnimatePresence>
        {showSecurity && (
          <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/20 backdrop-blur-sm p-0">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-lg rounded-t-3xl p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest">Protocol Guard</h3>
                </div>
                <button onClick={() => setShowSecurity(false)} className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center"><XCircle size={14} className="text-gray-400" /></button>
              </div>
              
              <div className="space-y-2">
                {[
                  { time: '09:42:15', type: 'SYS', msg: 'Kernel integrity confirmed', icon: CheckCircle, color: 'text-emerald-500' },
                  { time: '09:41:03', type: 'AUTH', msg: 'Admin login detected: ID_EX42', icon: UserCog, color: 'text-blue-500' },
                  { time: '09:40:55', type: 'NET', msg: 'Traffic nodes balanced', icon: Activity, color: 'text-slate-400' },
                  { time: '09:39:21', type: 'SEC', msg: 'Firewall status: ACTIVE', icon: ShieldCheck, color: 'text-emerald-500' },
                ].map((log, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-gray-100">
                    <log.icon size={14} className={log.color} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-slate-800 uppercase bg-white px-1 rounded shadow-sm border border-gray-100">{log.type}</span>
                        <span className="text-[10px] font-bold text-slate-600 truncate tracking-tight">{log.msg}</span>
                      </div>
                    </div>
                    <span className="text-[8px] font-black text-slate-300 font-mono tracking-tighter">{log.time}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-2">
                 <button className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 border border-red-100">
                    <Zap size={14} /> Full System Lockdown
                 </button>
                 <button className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                    <RefreshCw size={14} /> Rotate Access Keys
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ad Detail Modal - Super Compact */}
      <AnimatePresence>
        {selectedCampaign && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 backdrop-blur-md p-0 overflow-hidden">
             <motion.div 
               initial={{ y: "100%" }}
               animate={{ y: 0 }}
               exit={{ y: "100%" }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="bg-white w-full max-w-lg rounded-t-3xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl"
             >
                <div className="h-1 w-10 bg-slate-200 rounded-full mx-auto my-2 shrink-0" onClick={() => setSelectedCampaign(null)}></div>
                
                <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-20">
                   <div className="flex items-start gap-3 mt-1 mb-4">
                      <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 shrink-0 overflow-hidden shadow-sm">
                        {selectedCampaign.image ? <img src={selectedCampaign.image} className="w-full h-full object-cover" /> : <Megaphone className="w-6 h-6 text-slate-200" />}
                      </div>
                      <div className="flex-1 pt-0.5">
                         <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[6px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md uppercase border border-blue-100">{selectedCampaign.status}</span>
                            <span className="text-[6px] font-bold text-slate-300 uppercase tracking-widest">{selectedCampaign.platform}</span>
                         </div>
                         <h2 className="text-sm font-black text-slate-900 leading-tight tracking-tight">{selectedCampaign.title}</h2>
                         <p className="text-[8px] font-black text-indigo-500 uppercase mt-0.5 tracking-tighter">ID: {selectedCampaign.id.slice(0, 8)}...</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-3 gap-1.5 mb-4">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                         <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Reward</span>
                         <span className="text-sm font-black text-slate-900">₹{selectedCampaign.reward || selectedCampaign.budget}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                         <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Target</span>
                         <span className="text-[8px] font-black text-blue-600 uppercase mt-0.5 truncate w-full px-1">{selectedCampaign.category || 'GEN'}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                         <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Protocol</span>
                         <span className="text-[8px] font-black text-orange-600 uppercase mt-0.5 truncate w-full px-1">{selectedCampaign.campaignType || 'STD'}</span>
                      </div>
                   </div>

                   <div className="space-y-3">
                      <div>
                        <h4 className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                           <Activity size={8} /> Objective
                        </h4>
                        <div className="bg-slate-50 p-3 rounded-xl text-[10px] font-medium text-slate-600 leading-normal border border-slate-100 italic">
                          {selectedCampaign.description || 'No descriptive payload.'}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                         <div className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                            <h5 className="text-[6px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Execution</h5>
                            <p className="text-[9px] font-black text-indigo-900">{selectedCampaign.location || 'Distributed'}</p>
                         </div>
                         <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                            <h5 className="text-[6px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Horizon</h5>
                            <p className="text-[9px] font-black text-blue-900">{selectedCampaign.timeline || 'Immediate'}</p>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 flex gap-2 shadow-inner">
                   {selectedCampaign.status !== 'active' && (
                     <button 
                       onClick={() => { updateCampaignStatus(selectedCampaign.id, 'active'); setSelectedCampaign(null); }}
                       className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5"
                     >
                        <CheckCircle size={14} /> Deploy
                     </button>
                   )}
                   <button 
                     onClick={() => { updateCampaignStatus(selectedCampaign.id, 'rejected'); setSelectedCampaign(null); }}
                     className="px-4 py-3 bg-red-100 text-red-600 border border-red-100 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 flex items-center justify-center shrink-0"
                   >
                     <XCircle size={16} />
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
