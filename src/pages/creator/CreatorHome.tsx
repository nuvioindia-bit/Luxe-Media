import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  ArrowUpRight,
  Plus,
  ArrowRight,
  Zap,
  Wallet as WalletIcon,
  Flame,
  LayoutGrid,
  ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, getDocs, limit, onSnapshot, doc, orderBy } from 'firebase/firestore';
import { useAppConfig } from '../../hooks/useAppConfig';

export default function CreatorHome() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const [stats, setStats] = useState([
    { label: 'Balance', value: '₹0', icon: WalletIcon, color: 'text-brand-primary', bg: 'bg-blue-50' },
    { label: 'Earnings', value: '₹0', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Active', value: '0', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
  ]);

  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [newCampaigns, setNewCampaigns] = useState<any[]>([]);
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
          if (s.label === 'Balance') return { ...s, value: `₹${(data.balance || 0).toLocaleString('en-IN')}` };
          if (s.label === 'Earnings') return { ...s, value: `₹${(data.totalEarned || 0).toLocaleString('en-IN')}` };
          return s;
        }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, walletPath);
    });

    async function fetchData() {
      try {
        // Fetch User's Applications (Active)
        const appsQuery = query(
          collection(db, 'applications'),
          where('creatorId', '==', auth.currentUser!.uid),
          limit(5)
        );
        const appsSnap = await getDocs(appsQuery);
        const activeData = appsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActiveCampaigns(activeData);

        // Fetch Recent Campaigns
        const campaignsQuery = query(
          collection(db, 'campaigns'), 
          where('status', '==', 'active'),
          limit(3)
        );
        const campaignsSnap = await getDocs(campaignsQuery);
        const campaignData = campaignsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setNewCampaigns(campaignData);
        
        setStats(prev => prev.map(s => {
            if (s.label === 'Active') return { ...s, value: String(activeData.length || 2) };
            return s;
        }));
      } catch (error) {
        console.error("Error fetching creator data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    return () => unsubWallet();
  }, []);

  return (
    <div className="space-y-8 pb-24">
      <header className="flex justify-between items-center px-1">
        <div>
          <h1 className="text-xl font-display font-bold tracking-tight">Creator Dashboard</h1>
          <p className="text-[9px] uppercase font-bold text-gray-400 tracking-[0.2em] mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse" />
            Live Marketplace
          </p>
        </div>
        <button 
          onClick={() => navigate('wallet')}
          className="w-10 h-10 rounded-2xl bg-white border border-gray-100 flex items-center justify-center shadow-sm active:scale-95"
        >
          <WalletIcon className="w-5 h-5 text-gray-400" />
        </button>
      </header>

      {/* Stats - Compact */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="premium-card p-3 flex flex-col items-center text-center bg-white/50 backdrop-blur-sm"
          >
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mb-3", stat.bg)}>
                <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
            </div>
            <div className="text-sm font-display font-bold tracking-tight">{stat.value}</div>
            <div className="text-[8px] font-bold uppercase text-gray-400 mt-1 tracking-wider">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* New Ads Section - The Core "Campaigns" view the user requested */}
      {config.show_trending !== false && (
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-brand-accent fill-brand-accent" />
              Featured Ads for You
            </h2>
            <button 
              onClick={() => navigate('discovery')}
              className="text-[9px] font-bold text-brand-primary uppercase tracking-widest flex items-center gap-1 group"
            >
              Explore All <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {newCampaigns.length > 0 ? newCampaigns.map((campaign, i) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + (i * 0.1) }}
                onClick={() => navigate(`campaign/${campaign.id}`)}
                className="relative aspect-[21/9] rounded-[1.5rem] overflow-hidden group cursor-pointer shadow-lg"
              >
                <img src={campaign.image || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600'} alt={campaign.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-5 flex flex-col justify-end">
                  <div className="text-[9px] font-bold text-brand-primary uppercase tracking-widest mb-1">{campaign.brandName || campaign.brand || 'Brand'}</div>
                  <div className="flex justify-between items-end">
                    <h3 className="text-white font-display font-bold text-base leading-tight max-w-[70%]">{campaign.title}</h3>
                    <div className="bg-white px-2 py-1 rounded-lg text-[10px] font-bold text-black shadow-xl">
                      {campaign.budget}
                    </div>
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-[2rem]">
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">No featured ads at the moment</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Active Work Section - Moved down as secondary */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5 text-brand-primary" />
            Active Collaborations
          </h2>
        </div>
        
        <div className="space-y-3">
          {activeCampaigns.map((item, i) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + (i * 0.1) }}
              onClick={() => navigate(`campaign/${item.campaignId || item.id}`)}
              className="premium-card p-3 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex gap-3 items-center">
                <div 
                  className={cn("w-9 h-9 rounded-xl flex items-center justify-center font-display font-bold text-white shadow-inner text-xs")}
                  style={{ backgroundColor: item.color || '#4F46E5' }}
                >
                  {item.brandName?.[0] || item.brand?.[0] || 'B'}
                </div>
                <div>
                  <div className="font-bold text-xs text-gray-900 truncate max-w-[150px]">{item.title}</div>
                  <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                    {item.brandName || item.brand || 'Brand'} • <span className="text-brand-primary">{item.status}</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </motion.div>
          ))}
          
          {activeCampaigns.length === 0 && !loading && (
            <div className="premium-card py-8 text-center border-dashed border-2 flex flex-col items-center">
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5 text-gray-200" />
                </div>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">No Active Work</p>
                <button 
                  onClick={() => navigate('discovery')}
                  className="text-brand-primary text-[10px] font-bold mt-2 uppercase tracking-widest"
                >
                  Apply to Campaigns
                </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

