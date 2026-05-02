import { motion } from 'motion/react';
import { Gift, Share2, Copy, Coins, Users } from 'lucide-react';
import { useState } from 'react';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { useAppConfig } from '../hooks/useAppConfig';

export default function ReferEarn() {
  const config = useAppConfig();
  const [copied, setCopied] = useState(false);
  
  const referralCode = auth.currentUser?.uid?.substring(0, 8).toUpperCase() || 'REXO123';
  const referralLink = `https://${window.location.hostname}/?ref=${referralCode}`;

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
    <div className="pb-24 max-w-lg mx-auto">
      {/* Header section with gradient */}
      <div className="px-5 pt-8 pb-12 bg-gradient-to-b from-brand-primary to-[#0A3D91] text-white rounded-b-[2rem] shadow-xl relative overflow-hidden">
         {/* Decorative elements */}
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10" />
         <div className="absolute bottom-0 left-0 w-40 h-40 bg-brand-accent/20 rounded-full blur-3xl -ml-20 -mb-10" />
         
         <div className="relative z-10 text-center">
            <h1 className="text-3xl font-display font-bold mb-3">Refer & Earn</h1>
            <p className="text-blue-100 px-4 text-sm leading-relaxed">
              Invite creators to Rexo. When they complete their first campaign, you <span className="font-bold text-brand-accent">earn ₹50</span>!
            </p>
         </div>

         {/* Share Card - Float up slightly over the next section */}
         <div className="absolute -bottom-6 left-0 right-0 px-5 translate-y-1/2 z-20">
            <div className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-3">Your Referral Link</p>
                <div className="flex gap-2">
                    <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center overflow-hidden">
                        <span className="text-gray-900 font-mono text-sm truncate">{referralLink}</span>
                    </div>
                    <button 
                        onClick={copyToClipboard}
                        className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center hover:bg-brand-primary hover:text-white transition-all"
                    >
                        {copied ? <span className="text-xs font-bold w-full text-center">Copied</span> : <Copy className="w-5 h-5" />}
                    </button>
                </div>
                <button onClick={handleShare} className="w-full mt-3 bg-brand-accent text-brand-primary py-3.5 rounded-xl font-bold flex flex-row items-center justify-center gap-2">
                    <Share2 className="w-4 h-4" /> Share with Friends
                </button>
            </div>
         </div>
      </div>

      {/* Spacer to account for floated card */}
      <div className="h-28" />

      {/* Stats Display */}
      <div className="px-5 mb-8">
          <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center">
                  <div className="w-10 h-10 bg-blue-50 text-brand-primary rounded-full flex items-center justify-center mb-2">
                      <Users className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-bold">0</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total Referrals</span>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center">
                  <div className="w-10 h-10 bg-amber-50 text-brand-accent rounded-full flex items-center justify-center mb-2">
                      <Coins className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-bold">₹0</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total Earned</span>
              </div>
          </div>
      </div>

      {/* How it works */}
      <div className="px-5">
         <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">How it works</h3>
         
         <div className="space-y-4">
            <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm shrink-0">1</div>
                <div>
                    <h4 className="font-bold text-gray-900 text-sm">Share your link</h4>
                    <p className="text-xs text-gray-500 mt-1">Send your unique referral link to creators who might be interested.</p>
                </div>
            </div>
            <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm shrink-0">2</div>
                <div>
                    <h4 className="font-bold text-gray-900 text-sm">Friends join & verify</h4>
                    <p className="text-xs text-gray-500 mt-1">When they create an account and complete their profile.</p>
                </div>
            </div>
            <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-accent/20 text-brand-accent flex items-center justify-center font-bold text-sm shrink-0">3</div>
                <div>
                    <h4 className="font-bold text-gray-900 text-sm">You both earn!</h4>
                    <p className="text-xs text-gray-500 mt-1">Once they complete their first campaign, you get ₹50 directly in your wallet.</p>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
}
