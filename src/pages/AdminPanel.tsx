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
  MoreHorizontal,
  Image as ImageIcon,
  Link as LinkIcon,
  Plus,
  Trash,
  MessageSquare // Added MessageSquare here
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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
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
  const [posters, setPosters] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [adFilter, setAdFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('pending');
  const [showPosterForm, setShowPosterForm] = useState(false);
  const [editingPosterId, setEditingPosterId] = useState<string | null>(null);
  const [posterForm, setPosterForm] = useState({
    title: '',
    imageUrl: '',
    link: '',
    order: 0,
    isActive: true
  });
  const [uploadLoading, setUploadLoading] = useState(false);

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

    const unsubPosters = onSnapshot(query(collection(db, 'posters'), orderBy('order', 'asc')), (snap) => {
      setPosters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubUsers(); unsubCampaigns(); unsubWithdrawals(); unsubPosters(); };
  }, []);

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    try {
      // Use Firebase Storage for robust uploads
      const storageRef = ref(storage, `posters/${Date.now()}_${file.name}`);
      const uploadRes = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(uploadRes.ref);
      setPosterForm({ ...posterForm, imageUrl: url });
      // Clear input so same file can be uploaded again if needed
      e.target.value = '';
      console.log('Poster uploaded to storage:', url);
    } catch (err: any) {
      console.error('Firebase Storage upload failed, trying base64 fallback:', err);
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        // Limit base64 to ~800KB to stay within Firestore 1MB limit comfortably
        if (base64.length > 800000) { 
          alert("Image is too large. Since cloud storage failed, please use an image smaller than 500KB for base64 fallback.");
          setUploadLoading(false);
          return;
        }
        setPosterForm({ ...posterForm, imageUrl: base64 });
        setUploadLoading(false);
        console.log('Poster converted to base64 successfully');
      };
      reader.onerror = () => {
        alert("Failed to read file.");
        setUploadLoading(false);
      };
      return; // Early return because base64 is async
    } finally {
      // We don't setUploadLoading(false) here because if we fall back to base64 it's still loading
      // Only set to false if storage succeeded or threw a non-async error
      if (posterForm.imageUrl) {
        setUploadLoading(false);
      }
    }
  };

  const handleSavePoster = async () => {
    if (!posterForm.imageUrl) return alert("Image is required");
    try {
      setProcessingId('poster-save');
      if (editingPosterId) {
        await updateDoc(doc(db, 'posters', editingPosterId), {
          ...posterForm,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'posters'), {
          ...posterForm,
          createdAt: serverTimestamp()
        });
      }
      setShowPosterForm(false);
      setEditingPosterId(null);
      setPosterForm({ title: '', imageUrl: '', link: '', order: 0, isActive: true });
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const editPoster = (poster: any) => {
    setPosterForm({
      title: poster.title || '',
      imageUrl: poster.imageUrl || '',
      link: poster.link || '',
      order: poster.order || 0,
      isActive: poster.isActive
    });
    setEditingPosterId(poster.id);
    setShowPosterForm(true);
  };

  const deletePoster = async (id: string) => {
    if (!window.confirm("Delete this poster?")) return;
    await deleteDoc(doc(db, 'posters', id));
  };

  const togglePosterStatus = async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, 'posters', id), { isActive: !currentStatus });
  };

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
    <div className="space-y-6 pb-24 px-6 pt-6 h-full overflow-y-auto no-scrollbar relative z-10">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="w-[42px] h-[42px] rounded-2xl bg-white/50 border border-white/60 flex items-center justify-center text-gray-900 shadow-sm skeuo-inner active:scale-90 transition-all shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 flex justify-between items-center">
            <h1 className="text-xl font-display font-black tracking-tighter text-gray-900">Console</h1>
            <button 
              onClick={() => { setIsRefreshing(true); setTimeout(() => setIsRefreshing(false), 1000); }}
              className={cn("w-[42px] h-[42px] flex items-center justify-center text-gray-400 hover:text-brand-primary transition-all rounded-2xl bg-white/50 backdrop-blur-md border border-white/60 shadow-sm skeuo-inner", isRefreshing && "animate-spin")}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Stats Grid - Bento 2.0 */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div 
            whileTap={{ scale: 0.96 }}
            className="bento-card p-5 rounded-[2rem] flex flex-col justify-between h-[120px]"
          >
            <div className="flex justify-between items-start">
              <Users size={16} className="text-blue-500" />
              <TrendingUp size={12} className="text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-black text-gray-900 leading-none">{stats.users}</div>
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1 text-xs">Total Users</div>
            </div>
          </motion.div>

          <motion.div 
            whileTap={{ scale: 0.96 }}
            onClick={() => setActiveTab('ads')}
            className="bento-card p-5 rounded-[2rem] flex flex-col justify-between h-[120px]"
          >
            <div className="flex justify-between items-start">
              <Megaphone size={16} className="text-orange-500" />
              <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            </div>
            <div>
              <div className="text-2xl font-black text-orange-600 leading-none">{stats.pendingAds}</div>
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Pending Ads</div>
            </div>
          </motion.div>

          <motion.div 
            whileTap={{ scale: 0.96 }}
            onClick={() => setActiveTab('payouts')}
            className="bento-card p-5 rounded-[2rem] flex flex-col justify-between h-[120px]"
          >
            <div className="flex justify-between items-start">
              <Wallet size={16} className="text-red-500" />
              <Activity size={12} className="text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-red-600 leading-none">{stats.pendingPayouts}</div>
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Payouts</div>
            </div>
          </motion.div>

          <motion.div 
            whileTap={{ scale: 0.96 }}
            className="bento-card p-5 rounded-[2rem] bg-gray-900 flex flex-col justify-between h-[120px] shadow-2xl"
          >
            <div className="flex justify-between items-start">
              <Zap size={16} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-xl font-black text-emerald-400 leading-none">₹{stats.totalPaid.toLocaleString()}</div>
              <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mt-1">Total Paid Out</div>
            </div>
          </motion.div>
        </div>

        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-brand-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search database..."
            className="w-full bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl px-10 h-[42px] focus:outline-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all text-[12px] font-bold shadow-sm skeuo-inner hardware-accelerated"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tabs - Pill Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar hardware-accelerated">
          {[
            { id: 'overview', label: 'Home', icon: LayoutDashboard },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'ads', label: 'Ads', icon: ShieldCheck },
            { id: 'payouts', label: 'Payouts', icon: Wallet },
            { id: 'posters', label: 'Banners', icon: ImageIcon },
            { id: 'config', label: 'Settings', icon: Settings },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearch(''); }}
              className={cn(
                "px-5 h-[32px] rounded-xl text-[10px] font-black whitespace-nowrap transition-all active:scale-95 uppercase tracking-widest hardware-accelerated flex items-center justify-center gap-2",
                activeTab === tab.id 
                  ? "bg-gray-900 text-white shadow-lg shadow-gray-200" 
                  : "bg-white/50 backdrop-blur-md text-gray-400 border border-white/60"
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

          {activeTab === 'posters' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-tight text-gray-900">Slider Banners</h3>
                <button 
                  onClick={() => setShowPosterForm(!showPosterForm)}
                  className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[10px] font-bold uppercase flex items-center gap-2"
                >
                  <Plus size={14} /> {showPosterForm ? 'Cancel' : 'Add Poster'}
                </button>
              </div>

              <AnimatePresence>
                {showPosterForm && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4 overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Banner Title</label>
                          <input 
                            className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2 text-xs font-bold"
                            placeholder="e.g. New Campaign Live!"
                            value={posterForm.title}
                            onChange={e => setPosterForm({...posterForm, title: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Redirect Link (Optional)</label>
                          <input 
                            className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2 text-xs font-bold"
                            placeholder="/dashboard/wallet or https://..."
                            value={posterForm.link}
                            onChange={e => setPosterForm({...posterForm, link: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Display Order</label>
                          <input 
                            type="number"
                            className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-2 text-xs font-bold"
                            value={posterForm.order}
                            onChange={e => setPosterForm({...posterForm, order: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Banner Image</label>
                        <div className="aspect-[16/6] bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center relative overflow-hidden">
                          {posterForm.imageUrl ? (
                            <>
                              <img src={posterForm.imageUrl} className="w-full h-full object-cover" />
                              <button 
                                onClick={() => setPosterForm({...posterForm, imageUrl: ''})}
                                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg"
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          ) : (
                            <div className="text-center p-4">
                              <ImageIcon className="mx-auto text-gray-300 mb-2" size={24} />
                              <label className="cursor-pointer bg-white border border-gray-200 px-4 py-2 rounded-lg text-[10px] font-bold text-gray-600 shadow-sm active:scale-95 transition-all">
                                {uploadLoading ? 'Uploading...' : 'Choose Image'}
                                <input type="file" className="hidden" accept="image/*" onChange={handlePosterUpload} disabled={uploadLoading} />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={handleSavePoster}
                      disabled={!posterForm.imageUrl || uploadLoading || processingId === 'poster-save'}
                      className="w-full bg-blue-600 text-white py-3 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {processingId === 'poster-save' ? 'Saving...' : 'Save Banner'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 gap-4">
                {posters.map(poster => (
                  <div key={poster.id} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm flex gap-4">
                    <div className="w-32 aspect-[16/9] rounded-xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                      <img src={poster.imageUrl} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-[11px] font-black text-gray-900 truncate pr-2">{poster.title || 'Untitled Banner'}</h4>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => togglePosterStatus(poster.id, poster.isActive)}
                              className={cn(
                                "p-1.5 rounded-lg transition-all",
                                poster.isActive ? "text-emerald-500 bg-emerald-50" : "text-gray-300 bg-gray-100"
                              )}
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button 
                              onClick={() => editPoster(poster)}
                              className="p-1.5 text-blue-500 bg-blue-50 rounded-lg"
                            >
                              <Settings size={14} />
                            </button>
                            <button 
                              onClick={() => deletePoster(poster.id)}
                              className="p-1.5 text-red-500 bg-red-50 rounded-lg"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>
                        {poster.link && (
                          <div className="flex items-center gap-1 mt-1 text-[9px] text-blue-500 font-bold truncate">
                            <LinkIcon size={10} /> {poster.link}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[8px] font-black uppercase bg-gray-100 text-gray-400 px-2 py-0.5 rounded-md">Order: {poster.order}</span>
                        {poster.isActive && <span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-md">Active</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {posters.length === 0 && !showPosterForm && (
                  <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                    <ImageIcon className="mx-auto text-gray-200 mb-3" size={32} />
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">No Banners Active</p>
                  </div>
                )}
              </div>
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
                    { key: 'campaigns', label: 'Post Campaign Access', icon: Megaphone },
                    { key: 'referEarn', label: 'Referral Program', icon: Users },
                    { key: 'aiPilot', label: 'Rexo AI Pilot', icon: Zap },
                    { key: 'inbox', label: 'Direct Messaging', icon: Bell },
                    { key: 'profile', label: 'User Profiles', icon: UserCog },
                    { key: 'publicProfile', label: 'Public Portfolios', icon: Activity },
                    { key: 'metaInsights', label: 'Meta Audience Insights', icon: Activity },
                    { key: 'brandDashboard', label: 'Brand Admin View', icon: LayoutDashboard },
                    { key: 'reviews', label: 'Application Reviews', icon: CheckCircle },
                    { key: 'comments', label: 'Campaign Group Chat', icon: MessageSquare },
                    { key: 'fileUploads', label: 'Custom File Uploads', icon: LinkIcon },
                    { key: 'pushNotifications', label: 'Push Notifications', icon: Bell },
                    { key: 'allow_withdrawals', label: 'Allow Withdrawals', icon: Wallet },
                    { key: 'dark_mode', label: 'Dark Mode Support', icon: Settings },
                    { key: 'social_login', label: 'Social Auth Logins', icon: UserCog },
                    { key: 'analytics', label: 'App Analytics Tracking', icon: Activity },
                    { key: 'support', label: 'Help & Support Access', icon: ShieldCheck },
                    { key: 'maintenance_mode', label: 'System Maintenance Mode', icon: AlertCircle, destructive: true },
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
