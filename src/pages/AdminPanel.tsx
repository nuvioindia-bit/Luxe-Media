import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Rocket, 
  Settings, 
  Trash2, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ShieldAlert,
  TrendingUp,
  Search,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Activity,
  CreditCard,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Bell,
  Wallet,
  LayoutDashboard,
  ExternalLink,
  Pencil,
  Link as LinkIcon
} from 'lucide-react';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, onSnapshot, setDoc, orderBy, addDoc, serverTimestamp, where, increment } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'campaigns' | 'applications' | 'content-review' | 'payments' | 'withdrawals' | 'notifications' | 'config'>('overview');
  const [users, setUsers] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [appConfig, setAppConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmPrompt, setConfirmPrompt] = useState<{ message: string, onConfirm: () => void } | null>(null);

  useEffect(() => {
    if (auth.currentUser?.email !== 'job.rexoagency@gmail.com') return;

    const unsubConfig = onSnapshot(doc(db, 'app_config', 'main'), (doc) => {
      if (doc.exists()) setAppConfig(doc.data());
    });

    const unsubNotifs = onSnapshot(query(collection(db, 'notifications'), where('recipientId', '==', 'admin'), orderBy('createdAt', 'desc')), (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const unsubCampaigns = onSnapshot(query(collection(db, 'campaigns'), orderBy('createdAt', 'desc')), (snap) => {
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubApps = onSnapshot(query(collection(db, 'applications'), orderBy('createdAt', 'desc')), (snap) => {
      setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubWithdrawals = onSnapshot(query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc')), (snap) => {
      setWithdrawals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubConfig();
      unsubNotifs();
      unsubUsers();
      unsubCampaigns();
      unsubApps();
      unsubWithdrawals();
    };
  }, []);

  const toggleSection = async (sectionId: string, currentVal: boolean) => {
    const isActive = currentVal === undefined ? true : currentVal;
    try {
      await setDoc(doc(db, 'app_config', 'main'), {
        [sectionId]: !isActive
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'app_config');
    }
  };

  const handleDelete = (coll: string, id: string) => {
    setConfirmPrompt({
      message: `Are you sure you want to permanently delete this ${coll.slice(0, -1)}?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, coll, id));
          if (coll === 'users') setUsers(prev => prev.filter(u => u.id !== id));
          if (coll === 'campaigns') setCampaigns(prev => prev.filter(c => c.id !== id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, coll);
        }
        setConfirmPrompt(null);
      }
    });
  };

  const toggleBan = (user: any) => {
    const newVal = !user.isBanned;
    setConfirmPrompt({
      message: `${newVal ? 'BAN' : 'UNBAN'} user ${user.displayName}?`,
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', user.id), { isBanned: newVal });
          setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isBanned: newVal } : u));
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'users');
        }
        setConfirmPrompt(null);
      }
    });
  };

  const updateCampaignStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'campaigns', id), { status });
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status } : c));
      
      const campaign = campaigns.find(c => c.id === id);
      if (campaign && campaign.brandId) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: campaign.brandId,
          type: 'status_update',
          title: `Campaign ${status === 'active' ? 'Approved' : status.toUpperCase()}`,
          message: `Your campaign "${campaign.title}" is now ${status}.`,
          createdAt: serverTimestamp(),
          read: false
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'campaigns');
    }
  };

  const handleApplicationAction = async (app: any, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'applications', app.id), { status, updatedAt: serverTimestamp() });
      
      await addDoc(collection(db, 'notifications'), {
        recipientId: app.creatorId,
        type: 'application_status',
        title: `Application ${status.toUpperCase()}`,
        message: `Your application to "${app.campaignTitle}" has been ${status}.`,
        createdAt: serverTimestamp(),
        read: false
      });

      // If approved, notify the brand
      if (status === 'approved') {
          await addDoc(collection(db, 'notifications'), {
              recipientId: app.brandId,
              type: 'creator_joined',
              title: 'Creator Joined Campaign',
              message: `A new creator has been approved for "${app.campaignTitle}".`,
              createdAt: serverTimestamp(),
              read: false
          });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'applications');
    }
  };

  const handleWithdrawalAction = (withdrawal: any, status: 'approved' | 'rejected') => {
    setConfirmPrompt({
      message: `Perform ${status.toUpperCase()} for withdrawal of ₹${withdrawal.amount}?`,
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'withdrawals', withdrawal.id), { status, updatedAt: serverTimestamp() });
          setWithdrawals(prev => prev.map(w => w.id === withdrawal.id ? { ...w, status } : w));

          await addDoc(collection(db, 'notifications'), {
            recipientId: withdrawal.creatorId,
            type: 'payment',
            title: `Withdrawal ${status.toUpperCase()}`,
            message: `Your withdrawal request for ${withdrawal.amount.toLocaleString()} has been ${status}.`,
            createdAt: serverTimestamp(),
            read: false
          });

          if (status === 'rejected') {
            const userRef = doc(db, 'users', withdrawal.creatorId, 'wallet', 'balance');
            await updateDoc(userRef, { 
                balance: increment(withdrawal.amount),
                updatedAt: serverTimestamp()
            });
          }
        } catch (error) {
           handleFirestoreError(error, OperationType.UPDATE, 'withdrawals');
        }
        setConfirmPrompt(null);
      }
    });
  };

  const markNotificationRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  if (auth.currentUser?.email !== 'job.rexoagency@gmail.com') {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <XCircle className="w-20 h-20 text-red-100 mb-6" />
        <h1 className="text-3xl font-display font-bold text-gray-900 uppercase tracking-tighter">ACCESS DENIED</h1>
        <p className="text-gray-500 mt-2 font-medium">Restricted Terminal. Unauthorized access logged.</p>
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCampaignsCount = campaigns.filter(c => c.status === 'pending').length;
  const pendingWithdrawalsCount = withdrawals.filter(w => w.status === 'pending').length;
  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)] bg-gray-950 rounded-2xl overflow-hidden mb-4 border border-gray-800 shadow-sm">
      {/* Sidebar */}
      <div className="w-full md:w-48 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-800 flex flex-col items-center text-center">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 mb-1">
                <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-base font-display font-black text-white tracking-tighter">
                RexoCollab
            </h2>
            <p className="text-[7px] text-indigo-400 font-black uppercase tracking-[0.2em]">Admin Centre</p>
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible px-1 py-1 gap-0.5 no-scrollbar shrink-0">
            {[
                { id: 'overview', icon: LayoutDashboard, label: 'Dashboard' },
                { id: 'users', icon: Users, label: 'Users', badge: users.length },
                { id: 'campaigns', icon: Rocket, label: 'Campaigns', badge: pendingCampaignsCount, badgeColor: 'bg-amber-500 text-white' },
                { id: 'applications', icon: ShieldCheck, label: 'Applicants', badge: applications.filter(a => a.status === 'pending').length },
                { id: 'content-review', icon: Eye, label: 'Content' },
                { id: 'payments', icon: Wallet, label: 'Payments' },
                { id: 'withdrawals', icon: CreditCard, label: 'Payouts', badge: pendingWithdrawalsCount, badgeColor: 'bg-indigo-500 text-white' },
                { id: 'notifications', icon: Bell, label: 'Alerts', badge: unreadNotifsCount, badgeColor: 'bg-red-500 text-white' },
                { id: 'config', icon: Settings, label: 'Settings' }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded-md transition-all whitespace-nowrap md:whitespace-normal shrink-0",
                        activeTab === tab.id 
                            ? "bg-indigo-900/50 text-indigo-300 shadow-sm border border-indigo-800/50" 
                            : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    )}
                >
                    <div className="flex items-center gap-1.5 relative">
                      <tab.icon className={cn("w-3.5 h-3.5", activeTab === tab.id ? "text-indigo-400" : "text-gray-500")} />
                      <span className={cn("text-[10px] uppercase tracking-wider", activeTab === tab.id ? "font-black" : "font-bold")}>{tab.label}</span>
                    </div>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={cn(
                        "px-1 py-0 rounded text-[7px] font-black tracking-widest",
                        tab.badgeColor ? tab.badgeColor : "bg-gray-700 text-gray-300"
                      )}>
                        {tab.badge}
                      </span>
                    )}
                </button>
            ))}
        </nav>
      </div>

      {/* Main Panel Area */}
      <div className="flex-1 overflow-y-auto w-full relative bg-gray-950 p-3 md:p-4">
        
        <AnimatePresence>
          {confirmPrompt && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
               <motion.div 
                 initial={{ scale: 0.95, y: 20 }}
                 animate={{ scale: 1, y: 0 }}
                 className="bg-gray-900 rounded-[2rem] p-8 w-full max-w-sm text-center relative shadow-2xl border border-gray-800"
               >
                 <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
                     <AlertTriangle className="w-10 h-10" />
                 </div>
                 <h2 className="text-2xl font-black tracking-tight text-white mb-2">Confirm Action</h2>
                 <p className="text-gray-400 text-sm font-medium mb-8 leading-relaxed">{confirmPrompt.message}</p>
                 <div className="flex gap-4">
                     <button onClick={() => setConfirmPrompt(null)} className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-2xl transition-colors">Cancel</button>
                     <button onClick={confirmPrompt.onConfirm} className="flex-1 py-4 bg-red-600 hover:bg-red-700 shadow-xl shadow-red-900/20 text-white font-bold rounded-2xl transition-colors">Confirm</button>
                 </div>
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'overview' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="mb-1">
               <h1 className="text-lg font-display font-black text-white tracking-tight">System Overview</h1>
               <p className="text-gray-400 text-[10px] font-medium mt-0">Real-time metrics and platform health.</p>
             </div>

             <div className="grid grid-cols-2 lg:grid-cols-4 gap-1">
                 {[
                   { title: 'Users', value: users.length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-950/30' },
                   { title: 'Campaigns', value: campaigns.filter(c => c.status === 'active').length, icon: Rocket, color: 'text-indigo-400', bg: 'bg-indigo-950/30' },
                   { title: 'Approvals', value: pendingCampaignsCount, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-950/30' },
                   { title: 'Payouts', value: pendingWithdrawalsCount, icon: Wallet, color: 'text-emerald-400', bg: 'bg-emerald-950/30' }
                 ].map(stat => (
                   <div key={stat.title} className="bg-gray-900 p-2 rounded-lg border border-gray-800 shadow-sm hover:border-gray-700 transition-all flex items-center gap-2">
                     <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", stat.bg, stat.color)}>
                       <stat.icon className="w-3 h-3" />
                     </div>
                     <div>
                       <p className="text-[6px] font-black text-gray-500 uppercase tracking-widest">{stat.title}</p>
                       <p className="text-sm font-display font-black text-white">{stat.value}</p>
                     </div>
                   </div>
                 ))}
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-1">
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-2 shadow-sm col-span-2">
                   <div className="flex items-center justify-between mb-1">
                     <h3 className="font-display font-black text-white text-xs">Recent Joins</h3>
                     <button onClick={() => setActiveTab('users')} className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest hover:underline">View All</button>
                   </div>
                   <div className="space-y-0.5">
                     {users.slice(0, 4).map(u => (
                       <div key={u.id} className="flex items-center gap-1.5 p-1 rounded-md hover:bg-gray-800 transition-colors">
                          <div className="w-5 h-5 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 font-bold uppercase text-[8px]">
                            {u.displayName?.[0] || '?'}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-[9px] text-white line-clamp-1">{u.displayName || 'Unknown'}</p>
                            <p className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">{u.role}</p>
                          </div>
                       </div>
                     ))}
                   </div>
                </div>

                <div className="bg-gray-900 rounded-lg border border-gray-800 p-2 shadow-sm">
                   <h3 className="font-display font-black text-xs text-white mb-1">Platform</h3>
                     <div className="space-y-0.5">
                       <button onClick={() => setActiveTab('campaigns')} className="w-full flex items-center justify-between p-1.5 bg-gray-950 hover:bg-gray-800 rounded-md transition-colors border border-gray-800">
                           <span className="font-bold text-[9px] text-left text-gray-300">Review Campaigns</span>
                           <ArrowUpRight className="w-2.5 h-2.5 text-indigo-400" />
                       </button>
                       <button onClick={() => setActiveTab('payments')} className="w-full flex items-center justify-between p-1.5 bg-gray-950 hover:bg-gray-800 rounded-md transition-colors border border-gray-800">
                           <span className="font-bold text-[9px] text-left text-gray-300">Process Payouts</span>
                           <ArrowUpRight className="w-2.5 h-2.5 text-indigo-400" />
                       </button>
                     </div>
                </div>
             </div>
          </div>
        )}
               {activeTab === 'users' && (
          <div className="space-y-2 animate-in fade-in duration-500">
             <div className="mb-1">
                <h1 className="text-lg font-display font-black text-white tracking-tight">Users</h1>
                <p className="text-gray-400 text-[10px] mt-0">Manage brands and creators.</p>
             </div>

             <div className="relative">
                 <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                 <input 
                     type="text" 
                     placeholder="Search..."
                     className="w-full bg-gray-900 border border-gray-800 rounded-md pl-7 pr-3 py-1.5 focus:outline-none focus:border-indigo-600 transition-all font-medium text-[10px] text-white placeholder:text-gray-600"
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                 />
             </div>

             <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden shadow-sm">
               <table className="w-full text-left text-[9px]">
                 <thead className="bg-gray-800/50 border-b border-gray-800">
                   <tr className="text-[7px] font-black text-gray-500 uppercase tracking-widest">
                     <th className="px-2 py-1.5">User</th>
                     <th className="px-2 py-1.5">Role</th>
                     <th className="px-2 py-1.5">Active</th>
                     <th className="px-2 py-1.5 text-right">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-800">
                   {filteredUsers.map(user => (
                     <tr key={user.id} className="group hover:bg-gray-800/50 transition-colors">
                       <td className="px-2 py-1">
                         <div className="flex items-center gap-1.5">
                           <div className="w-5 h-5 rounded-sm bg-indigo-900/20 text-indigo-400 flex items-center justify-center font-bold text-[8px]">
                             {user.displayName?.[0] || '?'}
                           </div>
                           <div>
                             <p className="font-bold text-[10px] text-white tracking-tight">{user.displayName || 'Unnamed'}</p>
                             <p className="text-[8px] text-gray-500">{user.email}</p>
                           </div>
                         </div>
                       </td>
                       <td className="px-2 py-1"><span className={cn("px-1 py-0.5 rounded text-[7px] font-black uppercase tracking-wider", user.role === 'brand' ? "bg-purple-950/30 text-purple-400" : "bg-blue-950/30 text-blue-400")}>{user.role}</span></td>
                       <td className="px-2 py-1 text-[8px] font-bold text-emerald-400">{user.isBanned ? 'No' : 'Yes'}</td>
                       <td className="px-2 py-1 text-right">
                         <button onClick={() => toggleBan(user)} className="text-[8px] font-bold text-gray-400 hover:text-white">Toggle</button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="space-y-2 animate-in fade-in duration-500">
            <div className="mb-1">
               <h1 className="text-lg font-display font-black text-white tracking-tight">Campaigns</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {campaigns.map(campaign => (
                  <div key={campaign.id} className="bg-gray-900 rounded-md overflow-hidden border border-gray-800 flex items-center gap-2 p-1.5">
                      <img src={campaign.image} className="w-12 h-12 object-cover rounded-sm" />
                      <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-[10px] text-white truncate">{campaign.title}</h3>
                          <p className="text-[7px] text-gray-500 uppercase tracking-widest">{campaign.brandName}</p>
                          <div className="flex justify-between items-center mt-0.5">
                              <span className={cn("px-1 py-0 rounded text-[6px] font-black uppercase tracking-wider", campaign.status === 'pending' ? "bg-amber-950/30 text-amber-500" : "bg-emerald-950/30 text-emerald-500")}>{campaign.status}</span>
                              <p className="font-bold text-[9px] text-white">${campaign.budget}</p>
                          </div>
                      </div>
                  </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="mb-6 flex justify-between items-end">
               <div>
                <h1 className="text-2xl font-display font-black text-white tracking-tight">Applications</h1>
                <p className="text-gray-400 text-sm mt-1">Creators requesting to join campaigns.</p>
               </div>
               <div className="flex gap-2">
                 {['pending', 'approved', 'rejected'].map(stat => (
                   <button 
                    key={stat}
                    onClick={() => setSearchTerm(stat)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                      searchTerm === stat ? "bg-indigo-600 text-white" : "bg-gray-900 border border-gray-800 text-gray-500 hover:bg-gray-800"
                    )}
                   >
                     {stat}
                   </button>
                 ))}
                 <button onClick={() => setSearchTerm('')} className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-gray-800 text-gray-500">All</button>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {applications.filter(a => !searchTerm || a.status === searchTerm).map(app => (
                <div key={app.id} className="bg-gray-900 p-6 rounded-[2rem] border border-gray-800 shadow-sm hover:shadow-xl transition-all group">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-400 font-black text-xl">
                      {app.creatorName?.[0] || 'C'}
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">{app.creatorName}</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Applied for {app.campaignTitle}</p>
                      <p className="text-[9px] text-indigo-500 font-medium mt-0.5">{app.createdAt?.toDate?.() ? new Intl.RelativeTimeFormat('en').format(Math.round((app.createdAt.toDate().getTime() - new Date().getTime()) / 60000), 'minute') : 'Recently'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-6 border-t border-gray-800">
                    <span className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
                      app.status === 'pending' ? "bg-amber-950/30 text-amber-500" :
                      app.status === 'approved' ? "bg-emerald-950/30 text-emerald-500" :
                      "bg-red-950/30 text-red-500"
                    )}>{app.status}</span>
                    
                    {app.status === 'pending' && (
                      <div className="flex gap-2">
                         <button onClick={() => handleApplicationAction(app, 'approved')} className="w-10 h-10 bg-emerald-900/20 text-emerald-500 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all">
                            <CheckCircle2 className="w-5 h-5" />
                         </button>
                         <button onClick={() => handleApplicationAction(app, 'rejected')} className="w-10 h-10 bg-red-900/20 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all">
                            <XCircle className="w-5 h-5" />
                         </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'content-review' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="mb-6">
               <h1 className="text-2xl font-display font-black text-white tracking-tight">Content Review</h1>
               <p className="text-gray-400 text-sm mt-1">Review and approve submitted content from creators.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {applications.filter(a => a.status === 'under_review').map(app => (
                <div key={app.id} className="bg-gray-900 rounded-[2rem] border border-gray-800 overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col">
                  <div className="aspect-[4/5] bg-gray-800 relative group/link">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <LinkIcon className="w-12 h-12 text-gray-700" />
                    </div>
                    <a href={app.submissionLink} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/60 opacity-0 group-hover/link:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-6 py-3 bg-white rounded-2xl font-black text-[10px] uppercase tracking-widest text-indigo-950">Open Content</span>
                    </a>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-indigo-900/20 text-indigo-400 rounded-xl flex items-center justify-center font-black">
                            {app.creatorName?.[0] || 'C'}
                        </div>
                        <div>
                            <p className="text-xs font-black text-white">{app.creatorName}</p>
                            <p className="text-[10px] text-gray-500 font-bold tracking-widest">for {app.campaignTitle}</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={async () => {
                            await updateDoc(doc(db, 'applications', app.id), { status: 'approved_content' });
                        }}
                        className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all"
                    >
                        Approve Content
                    </button>
                  </div>
                </div>
              ))}
              {applications.filter(a => a.status === 'under_review').length === 0 && (
                <div className="col-span-full py-24 text-center bg-gray-900 rounded-[2rem] border border-dashed border-gray-800">
                    <Eye className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest">No content waiting for review</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'withdrawals' && (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="mb-6">
                   <h1 className="text-2xl font-display font-black text-white tracking-tight">Withdrawal Requests</h1>
                   <p className="text-gray-400 text-sm mt-1">Approve or reject creator payout requests.</p>
                </div>
                
                <div className="space-y-3">
                    {withdrawals.map(w => (
                        <div key={w.id} className="bg-gray-900 border border-gray-800 p-6 rounded-[2rem] flex items-center justify-between group hover:shadow-md transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-900/20 text-indigo-400 rounded-2xl flex items-center justify-center">
                                    <Wallet className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-white">₹{w.amount?.toLocaleString()} Request</p>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{w.creatorName || w.creatorEmail}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={cn(
                                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
                                    w.status === 'pending' ? "bg-amber-950/30 text-amber-500" :
                                    w.status === 'approved' ? "bg-emerald-950/30 text-emerald-500" :
                                    "bg-red-950/30 text-red-500"
                                )}>{w.status}</span>
                                {w.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button onClick={() => handleWithdrawalAction(w, 'approved')} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">Approve</button>
                                        <button onClick={() => handleWithdrawalAction(w, 'rejected')} className="px-4 py-2 bg-gray-800 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-950/30 transition-all">Reject</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
        {activeTab === 'payments' && (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="mb-6">
                   <h1 className="text-2xl font-display font-black text-white tracking-tight">Ledger & Payouts</h1>
                   <p className="text-gray-400 text-sm mt-1">Manage creator withdrawals and platform revenue.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                        { label: 'Platform Volume', val: '₹12.4L', icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-950/30' },
                        { label: 'Pending Payouts', val: `₹${withdrawals.filter(w => w.status === 'pending').reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}`, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-950/30' },
                        { label: 'Successful', val: withdrawals.filter(w => w.status === 'approved').length.toString(), icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950/30' },
                        { label: 'Platform Fee', val: '10%', icon: Settings, color: 'text-blue-400', bg: 'bg-blue-950/30' }
                    ].map(stat => (
                        <div key={stat.label} className="bg-gray-900 border border-gray-800 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow">
                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", stat.bg, stat.color)}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{stat.label}</p>
                            <p className="text-2xl font-display font-black text-white uppercase tracking-tighter mt-1">{stat.val}</p>
                        </div>
                    ))}
                </div>

                <div className="bg-gray-900 rounded-[2rem] border border-gray-800 p-8 shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-indigo-400" />
                        Payout Queue
                    </h3>
                    
                    <div className="space-y-4">
                        {withdrawals.length > 0 ? withdrawals.map(w => (
                            <div key={w.id} className="bg-gray-950 p-5 rounded-2xl border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center text-gray-500 shadow-sm border border-gray-800">
                                        <Wallet className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-base font-black text-white tracking-tight">₹{w.amount?.toLocaleString()} Withdrawal</p>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-xs font-medium text-gray-400">{w.creatorEmail}</span>
                                            <span className="w-1.5 h-1.5 bg-gray-700 rounded-full" />
                                            <span className={cn(
                                                "text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-widest",
                                                w.status === 'pending' ? "bg-amber-950/30 text-amber-500" :
                                                w.status === 'approved' ? "bg-emerald-950/30 text-emerald-500" :
                                                "bg-red-950/30 text-red-500"
                                            )}>{w.status}</span>
                                        </div>
                                    </div>
                                </div>

                                {w.status === 'pending' && (
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => handleWithdrawalAction(w, 'approved')}
                                            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-900/20"
                                        >
                                            Confirm Transfer
                                        </button>
                                        <button 
                                            onClick={() => handleWithdrawalAction(w, 'rejected')}
                                            className="px-6 py-3 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-950/30 hover:text-red-500 hover:border-red-900 active:scale-95 transition-all"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        )) : (
                            <div className="py-20 text-center bg-gray-950 rounded-[2rem] border border-dashed border-gray-800">
                                <Wallet className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">No payout history found</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'notifications' && (
          <div className="animate-in fade-in duration-500 max-w-4xl">
            <div className="mb-6">
               <h1 className="text-2xl font-display font-black text-gray-900 tracking-tight">System Alerts</h1>
               <p className="text-gray-500 text-sm mt-1">Platform incidents and notifications.</p>
            </div>
            
            <div className="space-y-3">
              {notifications.map(notif => (
                <div 
                  key={notif.id} 
                  className={cn(
                    "p-6 rounded-[2rem] border transition-all flex items-start gap-5 cursor-pointer",
                    notif.read ? "bg-white border-gray-100 opacity-70 hover:opacity-100" : "bg-white border-indigo-200 shadow-md shadow-indigo-50"
                  )}
                  onClick={() => !notif.read && markNotificationRead(notif.id)}
                >
                  <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                      notif.type === 'campaign_post' ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                  )}>
                    {notif.type === 'campaign_post' ? <Rocket className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 mt-1">
                    <div className="flex items-center justify-between gap-4 mb-2">
                        <p className="text-sm font-black text-gray-900 tracking-tight">{notif.title}</p>
                        {!notif.read ? (
                            <span className="bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">New</span>
                        ) : (
                            <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
                                {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleString() : ''}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 font-medium leading-relaxed">{notif.message}</p>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="py-24 text-center bg-white rounded-[2rem] border border-gray-100 shadow-sm">
                  <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">No alerts recorded</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-10 animate-in fade-in duration-500 max-w-5xl">
            <div className="mb-8">
               <h1 className="text-2xl font-display font-black text-gray-900 tracking-tight">System Settings</h1>
               <p className="text-gray-500 text-sm mt-1">Global platform toggles and overrides.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { id: 'show_trending', label: 'Trending Feed', desc: 'Toggle the featured horizontal campaign list.' },
                { id: 'show_ai_pilot', label: 'Rexo AI Portal', desc: 'Platform-wide AI assistant visibility.' },
                { id: 'show_market_insights', label: 'Market Analytics', desc: 'Show detailed dashboards to premium brands.' },
                { id: 'allow_payments', label: 'Direct Payments', desc: 'Allow brands to fund wallets via platform.' },
                { id: 'allow_withdrawals', label: 'Creator Withdrawals', desc: 'Enable withdrawal service for creators.' },
                { id: 'maintenance_mode', label: 'Admin Safe Mode', desc: 'Restrict all platform writes for maintenance.' },
                { id: 'brand_approval_notifs', label: 'Brand Review Stream', desc: 'Allow brands to see pending application approvals.' },
                { id: 'strict_verification', label: 'Strict Verification', desc: 'Force all campaigns to undergo manual admin review.' }
              ].map(item => (
                <div key={item.id} className="p-6 bg-white border border-gray-100 rounded-3xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-sm font-black text-gray-900 mb-1">{item.label}</p>
                        <p className="text-[11px] text-gray-500 font-medium leading-relaxed max-w-[85%]">{item.desc}</p>
                      </div>
                      <button 
                        onClick={() => toggleSection(item.id, appConfig[item.id])}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-all duration-300 shrink-0",
                          (appConfig[item.id] !== false) ? "bg-emerald-500" : "bg-gray-200"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                          (appConfig[item.id] !== false) ? "right-1" : "left-1"
                        )} />
                      </button>
                  </div>
                  <div className="pt-4 border-t border-gray-50">
                      <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest",
                          (appConfig[item.id] !== false) ? "text-emerald-500" : "text-gray-400"
                      )}>
                          Status: {(appConfig[item.id] !== false) ? 'Enabled' : 'Disabled'}
                      </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-8 bg-gray-900 rounded-[2.5rem] relative overflow-hidden flex items-center justify-between group">
                <div className="relative z-10 max-w-lg">
                    <h3 className="text-white font-display font-black text-2xl mb-2 tracking-tight">GLOBAL RESET & RESYNC</h3>
                    <p className="text-gray-400 text-sm font-medium leading-relaxed">Emergency override system. This bypasses all validation layers for system recovery.</p>
                </div>
                <button className="z-10 px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-red-500/20 active:scale-95">
                    Initiate Override
                </button>
                <div className="absolute top-1/2 -translate-y-1/2 right-10 w-64 h-64 bg-red-500/20 rounded-full blur-[100px] -z-0 group-hover:bg-red-500/30 transition-colors duration-500" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
