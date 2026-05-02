import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  Calendar, 
  DollarSign,
  ArrowRight,
  TrendingUp,
  X,
  Zap,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { cn } from '../../lib/utils';

export default function Discovery() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const categories = ['All', 'Meme', 'Tech', 'Comedy', 'Sports', 'Vlog'];

  useEffect(() => {
    let active = true;
    const safetyTimeout = setTimeout(() => {
      if (active && loading) {
        console.warn("Discovery fetch safety timeout triggered");
        setLoading(false);
      }
    }, 6000); // 6s safety timeout

    async function fetchCampaigns() {
      setLoading(true);
      const campaignsPath = 'campaigns';
      try {
        const q = query(collection(db, campaignsPath), where('status', '==', 'active'));
        const snapshot = await getDocs(q);
        if (!active) return;
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCampaigns(data);
      } catch (error: any) {
        if (active) {
          if (!error.message?.includes('offline')) {
              handleFirestoreError(error, OperationType.LIST, campaignsPath);
          } else {
              console.warn("Discovery fetch failed (offline)");
          }
        }
      } finally {
        if (active) {
          setLoading(false);
          clearTimeout(safetyTimeout);
        }
      }
    }
    fetchCampaigns();
    return () => {
      active = false;
      clearTimeout(safetyTimeout);
    };
  }, []);

  const filtered = campaigns.filter(c => 
    (activeTab === 'All' || c.category === activeTab) &&
    ((c.title?.toLowerCase().includes(search.toLowerCase())) || 
     (c.brand?.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-col gap-3">
        <h1 className="text-lg font-display font-bold tracking-tight px-1">Discover</h1>
        
        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-brand-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search campaigns or brands..."
            className="w-full bg-white border border-gray-200 rounded-lg px-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all text-xs font-medium shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 hide-scrollbar">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[10px] font-bold whitespace-nowrap border transition-all active:scale-95",
              activeTab === cat 
                ? "bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20" 
                : "bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Campaigns Grid */}
      <div className="space-y-6">
        {loading ? (
            <div className="py-20 text-center flex flex-col items-center">
                <div className="w-10 h-10 border-4 border-gray-100 border-t-brand-primary rounded-full animate-spin mb-4" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Global Discovery Engine</p>
            </div>
        ) : (
            filtered.map((campaign, i) => (
            <motion.div 
                key={campaign.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/dashboard/campaign/${campaign.id}`)}
                className="premium-card p-0 overflow-hidden group cursor-pointer"
            >
                <div className="aspect-[16/9] overflow-hidden relative">
                    <img 
                        src={campaign.image || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600'} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        alt={campaign.title}
                    />
                    <div className="absolute top-3 left-3">
                        <div className="bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-bold text-brand-primary uppercase tracking-widest shadow-lg">
                            {campaign.category}
                        </div>
                    </div>
                    {campaign.platform && (
                        <div className="absolute top-3 right-3">
                            <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-bold text-white uppercase tracking-widest shadow-lg border border-white/10">
                                {campaign.platform}
                            </div>
                        </div>
                    )}
                    {campaign.cpm > 0 && (
                        <div className="absolute bottom-3 left-3">
                            <div className="bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white tracking-wide shadow-lg flex items-center gap-1 border border-white/10">
                                <span className="text-emerald-400">₹</span>
                                {(campaign.campaignType === 'Music' || campaign.campaignType === 'UGC') ? 'Per Post' : 'CPM'}: {campaign.cpm}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-3">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="text-base font-display font-bold leading-tight group-hover:text-brand-primary transition-colors">{campaign.title}</h3>
                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{campaign.brand || 'Brand'}</p>
                        </div>
                        <div className="text-[11px] font-bold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                            {campaign.budget}
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
                        <div className="flex gap-2.5">
                            <div className="flex items-center gap-1 text-[8px] font-bold text-gray-400">
                                <MapPin className="w-2.5 h-2.5 text-gray-300" />
                                {campaign.location}
                            </div>
                            <div className="flex items-center gap-1 text-[8px] font-bold text-gray-400">
                                <Calendar className="w-2.5 h-2.5 text-gray-300" />
                                {campaign.timeline}
                            </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                    </div>
                </div>
            </motion.div>
            ))
        )}
        
        {!loading && filtered.length === 0 && (
            <div className="py-20 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Search className="w-8 h-8 text-gray-200" />
                </div>
                <h3 className="text-lg font-bold mb-1">No campaigns found</h3>
                <p className="text-gray-400 text-sm">Try adjusting your filters or search terms.</p>
            </div>
        )}
      </div>
    </div>
  );
}
