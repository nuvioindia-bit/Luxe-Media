import { motion } from 'motion/react';
import { Gift, Share2, Copy, Coins, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useAppConfig } from '../hooks/useAppConfig';

export default function ReferEarn() {
  const config = useAppConfig();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ referrals: 0, earnings: 0 });
  
  const referralCode = auth.currentUser?.uid || 'REXO123';
  const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen for referred users
    const q = query(collection(db, 'users'), where('referredBy', '==', auth.currentUser.uid));
    const unsubUsers = onSnapshot(q, (snap) => {
      setStats(prev => ({ ...prev, referrals: snap.size }));
    });

    // Listen for earnings from wallet
    const unsubWallet = onSnapshot(doc(db, `users/${auth.currentUser.uid}/wallet/balance`), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const totalRefEarnings = (data.referralBonuses || 0) + (data.referralCommission || 0);
        setStats(prev => ({ ...prev, earnings: totalRefEarnings }));
      }
    });

    return () => { unsubUsers(); unsubWallet(); };
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
      if (navigator.share) {
          navigator.share({
              title: 'Join Rexo',
              text: 'Use my code to join Rexo and start earning!',
              url: referralLink,
          }).catch(console.error);
      } else {
          copyToClipboard();
      }
  };

  if (config.referEarn === false) {
      return (
          <div className="flex flex-col items-center justify-center p-8 text-center h-[60vh]">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                  <Gift className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold mb-2">Referrals Disabled</h2>
              <p className="text-gray-500 text-sm">The referral program is currently suspended. Please check back later.</p>
          </div>
      );
  }

  return (
    <div className="pb-8 max-w-lg mx-auto">
      {/* Header section with gradient */}
      <div className="px-5 pt-8 pb-10 bg-gradient-to-br from-[#0A3D91] via-[#1E4D9C] to-[#0A3D91] text-white rounded-b-[2.5rem] shadow-2xl relative overflow-hidden">
         {/* Decorative elements */}
         <div className="absolute top-[-10%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-3xl" />
         <div className="absolute bottom-[-20%] left-[-10%] w-64 h-64 bg-brand-accent/20 rounded-full blur-3xl" />
         
         <div className="relative z-10 text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full mb-4 border border-white/10">
               <Gift className="w-3.5 h-3.5 text-brand-accent" />
               <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Rewards Program</span>
            </div>
            <h1 className="text-3xl font-display font-black mb-2 tracking-tight">Refer & Earn</h1>
            <p className="text-blue-100/80 px-8 text-xs font-medium leading-relaxed">
              Scale the Rexo network and earn <span className="font-bold text-brand-accent">₹5</span> on every sign-up + <span className="font-bold text-brand-accent">10% commission</span> on their lifestyle earnings!
            </p>
         </div>

         {/* Share Card */}
         <div className="relative z-20 mx-1">
            <div className="bg-white rounded-[2rem] p-6 shadow-2xl shadow-blue-950/20 border border-white">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Your Referral Link</span>
                  <div className={cn(
                    "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                    copied ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"
                  )}>
                    {copied ? 'Link Copied!' : 'Tap to Copy'}
                  </div>
                </div>
                
                <div className="flex gap-2 mb-3">
                    <button 
                        onClick={copyToClipboard}
                        className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 flex items-center overflow-hidden active:scale-[0.98] transition-all text-left"
                    >
                        <span className="text-gray-900 font-mono text-[11px] font-bold truncate opacity-60">{referralLink}</span>
                    </button>
                    <button 
                        onClick={copyToClipboard}
                        className="w-12 h-12 bg-[#0A3D91] text-white rounded-2xl flex items-center justify-center hover:bg-blue-800 active:scale-90 transition-all shadow-lg shadow-blue-900/20"
                    >
                        <Copy className="w-5 h-5" />
                    </button>
                </div>
                <button 
                  onClick={handleShare} 
                  className="w-full bg-brand-accent text-[#0A3D91] py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-amber-500/20"
                >
                    <Share2 size={16} /> Share Link
                </button>
            </div>
         </div>
      </div>

      {/* Stats Display - More Compact */}
      <div className="px-6 -mt-6 relative z-30 mb-8">
          <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 shadow-xl shadow-black/5 border border-white flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-[#0A3D91] rounded-2xl flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-lg font-black text-gray-900 block leading-none">{stats.referrals}</span>
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1 block">Referrals</span>
                  </div>
              </div>
              <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 shadow-xl shadow-black/5 border border-white flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 text-brand-accent rounded-2xl flex items-center justify-center shrink-0">
                      <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-lg font-black text-gray-900 block leading-none">₹{stats.earnings}</span>
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1 block">Earnings</span>
                  </div>
              </div>
          </div>
      </div>

      {/* How it works - Refined */}
      <div className="px-8 flex flex-col items-center">
         <div className="w-12 h-1 bg-gray-200 rounded-full mb-8"></div>
         
         <div className="w-full space-y-6">
            {[
              { step: '01', title: 'Share Link', desc: 'Spread your invite across your network.', icon: Share2, color: 'text-blue-500', bg: 'bg-blue-50' },
              { step: '02', title: 'Join & Build', desc: 'Friends create profiles and you get ₹5 immediately.', icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
              { step: '03', title: 'Lifetime 10%', desc: 'Earn 10% commission on every campaign they finish.', icon: Gift, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            ].map((item, i) => (
              <div key={i} className="flex gap-5 items-start">
                  <div className={cn("w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-sm border border-white", item.bg)}>
                      <item.icon className={cn("w-5 h-5", item.color)} />
                  </div>
                  <div className="pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{item.step}</span>
                        <h4 className="font-black text-gray-900 text-sm tracking-tight">{item.title}</h4>
                      </div>
                      <p className="text-[11px] font-medium text-gray-400 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
