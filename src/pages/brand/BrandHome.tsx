import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Rocket, 
  Target, 
  Eye, 
  ArrowRight,
  PlusCircle,
  Search,
  Zap,
  MoreVertical,
  ChevronRight,
  Wallet as WalletIcon,
  TrendingUp,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { useAppConfig } from '../../hooks/useAppConfig';
import PosterSlider from '../../components/PosterSlider';

export default function BrandHome() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const [stats, setStats] = useState([
    { label: 'Budget Left', value: '₹0', icon: WalletIcon, color: 'text-brand-primary', bg: 'bg-blue-50' },
    { label: 'Total Spent', value: '₹0', icon: TrendingUp, color: 'text-brand-secondary', bg: 'bg-indigo-50' },
    { label: 'Active Deals', value: '0', icon: Rocket, color: 'text-brand-accent', bg: 'bg-rose-50' },
  ]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [pendingApps, setPendingApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this campaign? This action cannot be undone.")) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'campaigns', id));
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (error: any) {
       handleFirestoreError(error, OperationType.DELETE, `campaigns/${id}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    
    // Real-time wallet balance
    const walletPath = `users/${auth.currentUser.uid}/wallet/balance`;
    const walletRef = doc(db, walletPath);
    const unsubWallet = onSnapshot(walletRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setStats(prev => prev.map(s => {
          if (s.label === 'Budget Left') return { ...s, value: `₹${(data.balance || 0).toLocaleString('en-IN')}` };
          if (s.label === 'Total Spent') return { ...s, value: `₹${(data.totalSpent || 0).toLocaleString('en-IN')}` };
          return s;
        }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, walletPath);
    });

    // Real-time pending applications for this brand
    const appsQ = query(
      collection(db, 'applications'),
      where('brandId', '==', auth.currentUser.uid),
      where('status', 'in', ['pending', 'under_review'])
    );
    const unsubApps = onSnapshot(appsQ, (snap) => {
      setPendingApps(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    async function fetchBrandData() {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'campaigns'), 
          where('brandId', '==', auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCampaigns(data);

        setStats(prev => prev.map(s => {
            if (s.label === 'Active Deals') return { ...s, value: String(data.length) };
            return s;
        }));
      } catch (error) {
        console.error("Error fetching brand data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBrandData();

    return () => {
      unsubWallet();
      unsubApps();
    };
  }, []);

  return (
    <div className="space-y-4 pb-24 px-6 pt-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-display font-black tracking-tighter text-gray-900 dark:text-white">Brand Hub</h1>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{auth.currentUser?.displayName || 'Partner'}</p>
      </div>

      <div className="px-1">
        <PosterSlider />
      </div>

      {/* Stats - Bento 2.0 */}
      <div className="grid grid-cols-2 gap-4">
        {stats.slice(0, 2).map((stat, i) => (
          <motion.div 
            key={i}
            whileTap={{ scale: 0.96 }}
            className="bento-card p-5 rounded-[2rem] flex flex-col justify-between h-[120px]"
          >
            <div className="flex justify-between items-start">
              <stat.icon className={cn("w-4 h-4", stat.color)} />
              <TrendingUp size={12} className="text-emerald-500 opacity-50" />
            </div>
            <div>
              <div className="text-2xl font-black text-gray-900 dark:text-white leading-none">{stat.value}</div>
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">{stat.label}</div>
            </div>
          </motion.div>
        ))}
        <motion.div 
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate('/dashboard/create')}
          className="col-span-2 bento-card p-5 rounded-[2rem] bg-gray-900 flex items-center justify-between shadow-2xl relative overflow-hidden group"
        >
          <div className="relative z-10">
            <h3 className="text-xl font-black text-white leading-tight">Create<br/>Campaign</h3>
            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-1">Scale your vision</p>
          </div>
          <div className="relative z-10 w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10 group-hover:scale-110 transition-transform">
            <PlusCircle size={24} />
          </div>
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full translate-x-1/2 -translate-y-1/2" />
        </motion.div>
      </div>

      {/* Active Campaigns */}
      <div className="space-y-4 pt-2">
        <div className="flex justify-between items-end px-1">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Live Campaigns</h2>
          <button onClick={() => navigate('/dashboard/admin')} className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">View All</button>
        </div>
        
        <div className="space-y-4">
           {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="premium-card h-24 animate-pulse rounded-[2rem]" />
              ))
          ) : campaigns.length === 0 ? (
              <div className="premium-card py-12 text-center rounded-[2rem] border-dashed flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4 skeuo-inner border border-gray-100 dark:border-gray-800">
                      <Rocket className="w-6 h-6 text-gray-200 dark:text-gray-600" />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase">No active campaigns</h3>
                  <p className="text-gray-400 dark:text-gray-500 text-[10px] uppercase font-black tracking-[0.1em] mt-1">Start your first collaboration</p>
              </div>
          ) : (
              campaigns.map((item, i) => (
                  <motion.div 
                      key={item.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => navigate(`/dashboard/campaign/${item.id}`)}
                      className="bento-card p-4 rounded-[2rem] group cursor-pointer"
                  >
                      <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm skeuo-inner border border-white/60">
                                  <img src={item.image || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=100'} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex flex-col justify-center">
                                  <h3 className="font-black text-sm text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight">
                                      {item.title}
                                  </h3>
                                  <div className="flex items-center gap-2 mt-0.5">
                                      <div className="text-[8px] text-gray-400 font-black uppercase tracking-widest">
                                          {item.applicationsCount || 0} Apps
                                      </div>
                                      <div className="w-1 h-1 rounded-full bg-gray-200" />
                                      <div className="text-[8px] text-emerald-500 font-black uppercase tracking-widest">
                                          ₹{(item.reward || 0).toLocaleString()}
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <div className={cn(
                              "px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border",
                              item.status === 'pending' ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/50" :
                              item.status === 'active' ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/50" :
                              "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700"
                          )}>
                              {item.status || 'Active'}
                          </div>
                      </div>
                  </motion.div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
