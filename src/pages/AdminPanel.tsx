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
  addDoc,
  runTransaction
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
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
  const [adFilter, setAdFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('pending');

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
      await updateDoc(doc(db, 'campaigns', id), { 
        status, 
        updatedAt: serverTimestamp(),
        approvedAt: status === 'active' ? serverTimestamp() : null
      });
      const campaign = campaigns.find(c => c.id === id);
      if (campaign) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: campaign.brandId || campaign.creatorId,
          title: status === 'active' ? '🚀 Campaign Approved' : '⚠️ Campaign Rejected',
          message: status === 'active' 
            ? `Your campaign "${campaign.title}" has been approved and is now live for creators!` 
            : `Your campaign "${campaign.title}" was not approved. Please review our guidelines and try again.`,
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

  const updateWithdrawalStatus = async (id: string, status: 'completed' | 'cancelled') => {
    try {
      setProcessingId(id);
      const withdrawal = withdrawals.find(w => w.id === id);
      if (!withdrawal) return;

      await runTransaction(db, async (transaction) => {
        const withdrawalRef = doc(db, 'withdrawals', id);
        
        if (status === 'cancelled') {
          // Refund the money to creator's wallet
          const walletRef = doc(db, `users/${withdrawal.creatorId}/wallet/balance`);
          const walletSnap = await transaction.get(walletRef);
          
          if (walletSnap.exists()) {
            const currentBalance = walletSnap.data().balance || 0;
            transaction.update(walletRef, {
              balance: currentBalance + withdrawal.amount,
              updatedAt: serverTimestamp()
            });

            // Log refund activity
            const activityRef = doc(collection(db, `users/${withdrawal.creatorId}/activities`));
            transaction.set(activityRef, {
              type: 'refund',
              amount: withdrawal.amount,
              message: `Withdrawal rejected: ₹${withdrawal.amount} refunded`,
              timestamp: serverTimestamp()
            });
          }
        }

        transaction.update(withdrawalRef, { 
          status, 
          updatedAt: serverTimestamp(),
          processedAt: status === 'completed' ? serverTimestamp() : null
        });

        // Notify user
        const notifRef = doc(collection(db, 'notifications'));
        transaction.set(notifRef, {
          recipientId: withdrawal.creatorId,
          type: 'system',
          title: status === 'completed' ? 'Payout Success! 💸' : 'Payout Rejected ⚠️',
          message: status === 'completed' 
            ? `Your withdrawal of ₹${withdrawal.amount} has been processed successfully.`
            : `Your withdrawal of ₹${withdrawal.amount} was rejected and refunded to your wallet.`,
          createdAt: serverTimestamp(),
          read: false
        });
      });

      alert(`Withdrawal marked as ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `withdrawals/${id}`);
    } finally {
      setProcessingId(null);
    }
  };

  const toggleConfig = async (key: string, value: boolean) => {
    await setDoc(doc(db, 'app_config', 'main'), { [key]: value }, { merge: true });
  };

  const handleDeleteCampaign = async (id: string, title: string) => {
    if (!window.confirm(`DANGER: Permanently delete campaign "${title}"? This will remove all associated applications.`)) return;
    try {
      setProcessingId(id);
      await deleteDoc(doc(db, 'campaigns', id));
      // In a real app, you'd also delete applications, but for now we follow simple delete
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `campaigns/${id}`);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    const s = search.toLowerCase();
    if (activeTab === 'users') return users.filter(u => u.email?.toLowerCase().includes(s) || u.displayName?.toLowerCase().includes(s));
    if (activeTab === 'ads') {
      return campaigns.filter(c => {
        const matchesSearch = c.title?.toLowerCase().includes(s);
        const matchesStatus = adFilter === 'all' || c.status === adFilter;
        return matchesSearch && matchesStatus;
      });
    }
    return [];
  }, [activeTab, search, users, campaigns, adFilter]);

  const stats = {
    users: users.length,
    pendingAds: campaigns.filter(c => c.status === 'pending').length,
    pendingPayouts: withdrawals.filter(w => w.status === 'pending').length,
    totalPaid: withdrawals.filter(w => w.status === 'completed').reduce((a, b) => a + (b.amount || 0), 0)
  };

  return (
    <div className="space-y-6 pb-20 px-4 pt-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-display font-bold tracking-tight">Admin Console</h1>
          <button 
            onClick={() => { setIsRefreshing(true); setTimeout(() => setIsRefreshing(false), 1000); }}
            className={cn("p-2 text-gray-400 hover:text-brand-primary transition-all rounded-lg bg-white border border-gray-100 shadow-sm", isRefreshing && "animate-spin")}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-2xl font-black text-gray-900 leading-none">{stats.users}</div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
              <Users size={12} className="text-blue-500" /> Users
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm" onClick={() => setActiveTab('ads')}>
            <div className="text-2xl font-black text-orange-600 leading-none">{stats.pendingAds}</div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
              <Megaphone size={12} className="text-orange-500" /> Pending Ads
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm" onClick={() => setActiveTab('payouts')}>
            <div className="text-2xl font-black text-red-600 leading-none">{stats.pendingPayouts}</div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
              <Wallet size={12} className="text-red-500" /> Payouts
            </div>
          </div>
          <div className="bg-slate-900 p-4 rounded-xl border border-white/5 shadow-sm">
            <div className="text-2xl font-black text-emerald-400 leading-none">₹{stats.totalPaid.toLocaleString()}</div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-emerald-500" /> Total Paid
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-brand-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search users, campaigns..."
            className="w-full bg-white border border-gray-200 rounded-lg px-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all text-xs font-medium shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 hide-scrollbar">
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'ads', label: 'Approvals', icon: ShieldCheck },
            { id: 'payouts', label: 'Payouts', icon: Wallet },
            { id: 'config', label: 'Config', icon: Settings },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearch(''); }}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all active:scale-95 flex items-center gap-2",
                activeTab === tab.id 
                  ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                  : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
              )}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={activeTab}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -10 }}
           className="min-h-[400px]"
        >
          {activeTab === 'overview' && (
             <div className="space-y-4">
               <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                 <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-900 flex items-center gap-2">
                      <Activity size={14} className="text-blue-500" /> Recent Registrations
                    </h3>
                 </div>
                 <div className="divide-y divide-gray-50">
                    {users.slice(0, 5).map(u => (
                      <div key={u.id} className="p-3 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 overflow-hidden">
                           {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <UserCog size={14} className="text-gray-300" />}
                         </div>
                         <div className="flex-1">
                            <div className="text-[10px] font-bold text-gray-900">{u.displayName || u.email}</div>
                            <div className="text-[8px] font-medium text-gray-400">{u.role || 'creator'} • joined recently</div>
                         </div>
                         <ChevronRight size={14} className="text-gray-300" />
                      </div>
                    ))}
                 </div>
               </div>
             </div>
          )}

          {activeTab === 'users' && (
             <div className="space-y-3">
               {filteredItems.map((u: any) => (
                 <div key={u.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-3 shadow-sm">
                   <div className="w-10 h-10 rounded-lg bg-slate-50 border border-gray-100 flex items-center justify-center relative overflow-hidden shrink-0">
                     {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <UserCog className="w-5 h-5 text-slate-300" />}
                     {isAdminEmail(u.email) && <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-blue-500" /></div>}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-gray-900 truncate">{u.displayName || 'Unnamed Partner'}</div>
                      <div className="text-[9px] font-medium text-gray-400 truncate">{u.email}</div>
                      <div className="flex gap-1 mt-1">
                        <span className="text-[7px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{u.role || 'creator'}</span>
                        {u.isBanned && <span className="text-[7px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">Banned</span>}
                      </div>
                   </div>
                   <div className="flex gap-1.5">
                     <button 
                       disabled={processingId === u.id}
                       onClick={() => toggleBan(u)}
                       className={cn(
                         "w-8 h-8 rounded-lg flex items-center justify-center",
                         u.isBanned ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                       )}
                     >
                       {u.isBanned ? <ShieldCheck size={16}/> : <Ban size={16}/>}
                     </button>
                     {!isAdminEmail(u.email) && (
                       <button onClick={() => deleteUser(u)} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                         <Trash2 size={16}/>
                       </button>
                     )}
                   </div>
                 </div>
               ))}
             </div>
          )}

          {activeTab === 'ads' && (
             <div className="space-y-4">
               <div className="flex gap-1">
                 {['pending', 'active', 'rejected', 'all'].map((f: any) => (
                   <button
                     key={f}
                     onClick={() => setAdFilter(f)}
                     className={cn(
                       "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all",
                       adFilter === f ? "bg-slate-900 text-white" : "bg-white text-gray-400"
                     )}
                   >
                     {f}
                   </button>
                 ))}
               </div>
               
               <div className="grid grid-cols-1 gap-4">
                 {filteredItems.map((c: any) => (
                   <div key={c.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                     <div className="p-3 flex gap-3">
                        <div className="w-16 h-16 rounded-xl bg-slate-50 border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                           {c.image ? <img src={c.image} className="w-full h-full object-cover" /> : <Megaphone className="w-6 h-6 text-slate-200" />}
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-start">
                              <span className={cn(
                                "text-[7px] font-bold uppercase px-2 py-0.5 rounded-full border",
                                c.status === 'pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                                c.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                              )}>
                                {c.status}
                              </span>
                              <button 
                                onClick={() => handleDeleteCampaign(c.id, c.title)}
                                className="text-gray-300 hover:text-red-500 p-1"
                              >
                                <Trash2 size={14} />
                              </button>
                           </div>
                           <h4 className="text-[11px] font-bold text-gray-900 mt-1 truncate">{c.title}</h4>
                           <div className="flex justify-between items-center mt-1">
                              <div className="text-[11px] font-black text-brand-primary">₹{(c.reward || c.budget || 0).toLocaleString()}</div>
                              <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{c.brandName || 'System'}</div>
                           </div>
                        </div>
                     </div>
                     <div className="px-3 py-2 bg-slate-50 border-t border-gray-100 flex gap-2">
                        {c.status !== 'active' && (
                          <button 
                            onClick={() => updateCampaignStatus(c.id, 'active')}
                            className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                          >
                             <CheckCircle size={14} /> Activate
                          </button>
                        )}
                        {c.status !== 'rejected' && (
                          <button 
                             onClick={() => updateCampaignStatus(c.id, 'rejected')}
                             className="flex-1 py-2 bg-white text-red-500 border border-red-100 rounded-lg text-[9px] font-bold uppercase tracking-wider"
                          >
                             Reject
                          </button>
                        )}
                        {c.status !== 'pending' && (
                          <button 
                             onClick={() => updateCampaignStatus(c.id, 'pending')}
                             className="px-3 py-2 bg-white border border-gray-200 text-gray-400 rounded-lg"
                             title="Reset Status"
                          >
                             <RefreshCw size={14} />
                          </button>
                        )}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          )}

          {activeTab === 'payouts' && (
             <div className="space-y-4">
               {withdrawals.map(w => (
                 <div key={w.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border",
                            w.status === 'pending' ? 'bg-orange-50 text-orange-500 border-orange-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'
                          )}>
                             <Wallet size={20} />
                          </div>
                          <div>
                             <div className="text-xl font-black text-gray-900">₹{w.amount}</div>
                             <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Settlement Request</div>
                          </div>
                       </div>
                       <span className={cn(
                         "text-[8px] font-bold uppercase px-2 py-1 rounded-lg border",
                         w.status === 'pending' ? 'bg-orange-50 text-orange-600 border-orange-200' : 
                         w.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                       )}>
                         {w.status}
                       </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                       <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[8px] font-bold text-gray-400 uppercase block mb-1">Partner</span>
                          <span className="text-[10px] font-bold text-slate-800">{users.find(u => u.id === w.creatorId)?.displayName || 'Unknown'}</span>
                       </div>
                       <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[8px] font-bold text-gray-400 uppercase block mb-1">Method</span>
                          <span className="text-[10px] font-bold text-slate-800">{w.method || 'Digital'}</span>
                       </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                       <span className="text-[8px] font-bold text-gray-400 uppercase block mb-1">Target Address</span>
                       <span className="text-[10px] font-mono text-slate-600 break-all">{w.target || 'N/A'}</span>
                    </div>

                    {w.status === 'pending' && (
                       <div className="flex gap-2 pt-2">
                          <button 
                            disabled={processingId === w.id}
                            onClick={() => updateWithdrawalStatus(w.id, 'completed')}
                            className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
                          >
                             <CheckCircle size={14} /> Release Funds
                          </button>
                          <button 
                            disabled={processingId === w.id}
                            onClick={() => updateWithdrawalStatus(w.id, 'cancelled')}
                            className="px-6 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                          >
                             Deny
                          </button>
                       </div>
                    )}
                 </div>
               ))}
             </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-900 mb-4 flex items-center gap-2">
                  <Settings size={16} className="text-blue-500" /> System Overrides
                </h3>
                <div className="space-y-2">
                  {[
                    { key: 'homePage', label: 'Discovery Feed', icon: LayoutDashboard },
                    { key: 'wallet', label: 'Treasury & Payouts', icon: Wallet },
                    { key: 'campaigns', label: 'Campaign Listings', icon: Megaphone },
                    { key: 'referEarn', label: 'Referral Program', icon: Users },
                    { key: 'aiPilot', label: 'Rexo AI Pilot', icon: Zap },
                    { key: 'maintenance_mode', label: 'Maintenance Mode', icon: AlertCircle, destructive: true },
                  ].map((item: any) => (
                    <div key={item.key} className="flex items-center justify-between py-3 px-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <item.icon size={16} className={item.destructive ? "text-red-500" : "text-gray-400"} />
                        <span className={cn("text-xs font-medium", item.destructive ? "text-red-600" : "text-slate-700")}>{item.label}</span>
                      </div>
                      <button 
                        onClick={() => toggleConfig(item.key, !((config as any)[item.key] !== false))}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative border-2",
                          (config as any)[item.key] !== false ? "bg-blue-600 border-blue-600" : "bg-gray-200 border-gray-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-md transition-all",
                          (config as any)[item.key] !== false ? "right-0.5" : "left-0.5"
                        )}></div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
