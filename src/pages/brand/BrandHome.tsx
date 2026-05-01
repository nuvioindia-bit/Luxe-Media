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
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { useAppConfig } from '../../hooks/useAppConfig';

export default function BrandHome() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const [stats, setStats] = useState([
    { label: 'Budget Left', value: '₹0', icon: WalletIcon, color: 'text-brand-primary', bg: 'bg-blue-50' },
    { label: 'Total Spent', value: '₹0', icon: TrendingUp, color: 'text-brand-secondary', bg: 'bg-indigo-50' },
    { label: 'Active Deals', value: '0', icon: Rocket, color: 'text-brand-accent', bg: 'bg-rose-50' },
  ]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

    return () => unsubWallet();
  }, []);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-display font-bold tracking-tight">Command Center</h1>
          <p className="text-[11px] font-medium text-gray-500 mt-0.5">Scale your vision with global creator talent.</p>
        </div>
        <button 
          onClick={() => navigate('/dashboard/create')}
          className="premium-button-primary flex items-center justify-center gap-1.5 px-3.5 py-2 group"
          id="new-campaign-button"
        >
          <PlusCircle className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" />
          Create Campaign
        </button>
      </div>

      {/* Stats - Grid Array */}
      {config.show_market_insights !== false && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {stats.map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="premium-card p-3 flex flex-col items-center text-center group"
            >
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", stat.bg)}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
              <div className="text-[22px] font-display font-bold tracking-tight mb-0.5">{stat.value}</div>
              <div className="text-[8px] font-bold uppercase text-gray-400 tracking-widest">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content: Campaigns */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-end px-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Live Campaigns</h2>
            <button className="text-[10px] font-bold text-brand-primary uppercase tracking-widest">Analytics Dashboard</button>
          </div>
          
          <div className="space-y-4">
             {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="premium-card h-32 animate-pulse bg-gray-50/50" />
                ))
            ) : campaigns.length === 0 ? (
                <div className="premium-card py-16 text-center border-dashed border-2 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mb-4">
                        <Rocket className="w-8 h-8 text-gray-200" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No active campaigns</h3>
                    <p className="text-gray-400 text-sm max-w-[200px] mt-1">Start your first collaboration to see performance data.</p>
                </div>
            ) : (
                campaigns.map((item, i) => (
                    <motion.div 
                        key={item.id} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => navigate(`/dashboard/campaign/${item.id}`)}
                        className="premium-card p-4 group hover:border-brand-primary/20 transition-all cursor-pointer"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex gap-3">
                                <div className="w-10 h-10 rounded-lg overflow-hidden shadow-inner">
                                    <img src={item.image || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=100'} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <h3 className="font-display font-bold text-[13px] mb-0.5 group-hover:text-brand-primary transition-colors flex items-center gap-1.5">
                                        {item.title}
                                    </h3>
                                    <div className="flex items-center gap-2.5 mt-1">
                                        <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                            <Users className="w-2.5 h-2.5" />
                                            {item.applicationsCount || 0} Applicants
                                        </div>
                                        {item.cpm > 0 && (
                                            <div className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1 border-l mx-1 pl-2 border-gray-100">
                                                <TrendingUp className="w-2.5 h-2.5" />
                                                CPM: ${item.cpm}
                                            </div>
                                        )}
                                        {item.platform && (
                                            <div className="text-[8px] text-indigo-500 font-bold uppercase tracking-widest flex items-center gap-1 border-l pl-2 border-gray-100">
                                                {item.platform}
                                            </div>
                                        )}
                                    </div>
                                        <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                            <Target className="w-2.5 h-2.5" />
                                            {item.budget}
                                        </div>
                                    </div>
                                </div>
                            <div className={cn(
                                "px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest border",
                                item.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                item.status === 'active' ? "bg-green-50 text-green-600 border-green-100" :
                                "bg-gray-50 text-gray-500 border-gray-100"
                            )}>
                                {item.status || 'Active'}
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: '45%' }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full" 
                            />
                        </div>
                    </motion.div>
                ))
            )}
          </div>
        </div>

        {/* Sidebar: Talent & Quick Actions */}
        <div className="space-y-8">
          {config.show_ai_pilot !== false && (
            <section className="premium-card bg-indigo-50/50 border-indigo-100 p-6 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-indigo-100 mb-6">
                  <Search className="w-6 h-6 text-indigo-500" />
              </div>
              <h3 className="text-lg font-display font-bold text-indigo-900 mb-2">Smart Discovery</h3>
              <p className="text-xs text-indigo-600/70 mb-6 font-medium leading-relaxed">Let Rexo AI find the perfect match for your campaign DNA.</p>
              <button 
                onClick={() => navigate('/dashboard/ai-pilot')}
                className="w-full premium-button-primary bg-indigo-500 shadow-indigo-200 py-3 text-xs uppercase tracking-widest font-bold"
              >
                Launch Rexo AI
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
