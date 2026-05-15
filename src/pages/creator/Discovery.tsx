import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { triggerHaptic } from '../../lib/haptics';
import { 
  Search, 
  MapPin, 
  Calendar, 
  ChevronRight
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import PosterSlider from '../../components/PosterSlider';

export default function Discovery() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const categories = ['All', 'Meme', 'Tech', 'Comedy', 'Sports', 'Vlog'];

  const handleCardClick = useCallback((id: string) => {
    triggerHaptic();
    navigate(`/dashboard/campaign/${id}`);
  }, [navigate]);

  useEffect(() => {
    let active = true;
    const campaignsPath = 'campaigns';
    const q = query(collection(db, campaignsPath), where('status', '==', 'active'));
    
    const safetyTimeout = setTimeout(() => {
      if (active && loading) {
        setLoading(false);
      }
    }, 6000);

    const unsubscribeSnap = onSnapshot(q, (snapshot) => {
        if (!active) return;
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCampaigns(data);
        setLoading(false);
        clearTimeout(safetyTimeout);
    }, (error: any) => {
        if (active) {
            setLoading(false);
            if (!error.message?.includes('offline')) {
                handleFirestoreError(error, OperationType.LIST, campaignsPath);
            }
        }
    });

    return () => {
      active = false;
      unsubscribeSnap();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const filtered = campaigns.filter(c => 
    (activeTab === 'All' || c.category === activeTab) &&
    ((c.title?.toLowerCase().includes(search.toLowerCase())) || 
     (c.brandName?.toLowerCase().includes(search.toLowerCase())) ||
     (c.brand?.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div className="space-y-4 pb-20 h-full overflow-y-auto hide-scrollbar">
      <div className="flex flex-col gap-2 px-6 hardware-accelerated mt-2">
        <h1 className="text-xl font-display font-black tracking-tighter text-gray-900 dark:text-white">Explore</h1>
        
        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-brand-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search campaigns..."
            className="w-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border border-white/60 dark:border-gray-700/60 rounded-2xl px-10 h-[42px] focus:outline-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all text-[12px] font-bold shadow-sm skeuo-inner text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 hardware-accelerated"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="px-1">
        <PosterSlider />
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 px-6 no-scrollbar hardware-accelerated">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => {
              triggerHaptic();
              setActiveTab(cat);
            }}
            className={cn(
              "px-5 h-[32px] rounded-xl text-[10px] font-black whitespace-nowrap transition-all active:scale-95 uppercase tracking-widest hardware-accelerated flex items-center justify-center",
              activeTab === cat 
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg shadow-gray-200 dark:shadow-none" 
                : "bg-white/50 dark:bg-gray-800/50 backdrop-blur-md text-gray-400 dark:text-gray-500 border border-white/60 dark:border-gray-700/60"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Campaigns Grid */}
      <div className="px-6 space-y-4">
        {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="premium-card h-40 animate-pulse rounded-[2rem]" />
              ))}
            </div>
        ) : (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 gap-4">
                {filtered.map((campaign, i) => (
                  <motion.div 
                      key={campaign.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ 
                        duration: 0.5, 
                        delay: i * 0.05,
                        ease: [0.23, 1, 0.32, 1]
                      }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleCardClick(campaign.id)}
                      className="bento-card p-0 rounded-[2rem] overflow-hidden cursor-pointer dark:border-gray-800"
                  >
                    <div className="aspect-[21/9] overflow-hidden relative">
                        <img 
                            src={campaign.image || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600'} 
                            className="w-full h-full object-cover" 
                            alt={campaign.title}
                            referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-4 left-4">
                            <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl px-3 py-1 rounded-xl text-[9px] font-black text-gray-900 dark:text-white uppercase tracking-widest shadow-xl border border-white/50 dark:border-gray-800/50">
                                {campaign.category}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                                <h3 className="text-[15px] font-black tracking-tight text-gray-900 dark:text-white leading-[1.1]">{campaign.title}</h3>
                                <p className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em]">{campaign.brandName || campaign.brand || 'Brand Partner'}</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-100/50 dark:border-gray-800/50">
                            <div className="flex gap-4">
                                <div className="flex items-center gap-1.5 text-[8.5px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    <MapPin className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                                    {campaign.location || 'India'}
                                </div>
                                <div className="flex items-center gap-1.5 text-[8.5px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    <Calendar className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                                    {campaign.timeline || 'Active'}
                                </div>
                            </div>
                            <div className="w-7 h-7 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center shadow-lg shadow-gray-200 dark:shadow-none">
                              <ChevronRight className="w-3.5 h-3.5 text-white dark:text-gray-900" />
                            </div>
                        </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
        )}
      </div>
    </div>
  );
}
