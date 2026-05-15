import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { Check, MessageCircle, MapPin, Mail, ChevronLeft, UserPlus, UserCheck, Image as ImageIcon, Link as LinkIcon, UserPlus2, ShieldCheck, BarChart3, Video } from 'lucide-react';
import { cn } from '../lib/utils';
import { isAdminEmail } from '../constants';

export default function PublicProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    // Fetch Profile
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) setProfile(snap.data());
      setLoading(false);
    });

    // Check Following Status
    if (auth.currentUser) {
      const followId = `${auth.currentUser.uid}_${userId}`;
      const unsub = onSnapshot(doc(db, 'follows', followId), (snap) => {
        setIsFollowing(snap.exists());
      });
      return () => unsub();
    }
  }, [userId]);

  const handleFollow = async () => {
    if (!auth.currentUser || !userId) return;
    const followId = `${auth.currentUser.uid}_${userId}`;

    try {
      if (isFollowing) {
        await deleteDoc(doc(db, 'follows', followId));
        await updateDoc(doc(db, 'users', userId), { followersCount: increment(-1) });
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { followingCount: increment(-1) });
      } else {
        await setDoc(doc(db, 'follows', followId), {
          followerId: auth.currentUser.uid,
          followingId: userId,
          createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'users', userId), { followersCount: increment(1) });
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { followingCount: increment(1) });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMessage = () => {
    if (!auth.currentUser || !userId) return;
    const chatId = [auth.currentUser.uid, userId].sort().join('_');
    navigate(`/dashboard/chat/${chatId}`);
  };

  const handleCall = () => {
    if (!auth.currentUser || !userId) return;
    const chatId = [auth.currentUser.uid, userId].sort().join('_');
    const recipientName = profile?.displayName || 'User';
    navigate(`/dashboard/video?channel=${chatId}&call=true&role=caller&recipientId=${userId}&recipientName=${encodeURIComponent(recipientName)}`);
  };

  const handleSocialInsights = () => {
    if (isAdminEmail(auth.currentUser?.email)) {
      navigate('/dashboard/insights');
    } else {
      alert("Social Insights Feature: Coming Soon for Public Users!");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#4f4a46] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#6d6862] via-[#5e5954] to-[#4f4a46] text-white pb-32">
       {/* Top Navigation */}
       <header className="px-4 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-sm bg-black/5">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-1.5 opacity-80">
             <span className="text-xs font-bold tracking-widest uppercase">{profile?.displayName || 'Creator'}</span>
             <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="w-10"></div>
       </header>

       <div className="px-6 pt-6">
          {/* Profile Header Row */}
          <div className="flex items-center justify-between mb-8">
             {/* Left: Profile Image */}
             <div className="relative shrink-0">
                <div className="w-[88px] h-[88px] rounded-full p-[3px] bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] shadow-xl">
                   <div className="w-full h-full rounded-full bg-[#1c1c1c] p-[2px]">
                      <img 
                        src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} 
                        className="w-full h-full rounded-full object-cover transition-transform hover:scale-105 duration-300" 
                        alt="Profile" 
                      />
                   </div>
                </div>
             </div>

             {/* Right: Stats */}
             <div className="flex gap-8 px-4 flex-1 justify-center">
                <div className="text-center group cursor-default">
                  <span className="block text-[17px] font-bold leading-tight">0</span>
                  <span className="text-[11px] font-medium text-white/50 tracking-wide uppercase">posts</span>
                </div>
                <div className="text-center group cursor-default">
                  <span className="block text-[17px] font-bold leading-tight">{profile?.followersCount || '0'}</span>
                  <span className="text-[11px] font-medium text-white/50 tracking-wide uppercase">followers</span>
                </div>
                <div className="text-center group cursor-default">
                  <span className="block text-[17px] font-bold leading-tight">{profile?.followingCount || '0'}</span>
                  <span className="text-[11px] font-medium text-white/50 tracking-wide uppercase">following</span>
                </div>
             </div>
          </div>

          {/* User Info Section */}
          <div className="mb-8 space-y-3">
             <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight">{profile?.displayName}</h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                   <span className="text-[11px] font-bold opacity-80 lowercase tracking-tight">
                     {profile?.displayName?.toLowerCase().replace(/\s+/g, '.') || 'user'}
                   </span>
                   <Check className="w-3 h-3 text-white fill-blue-500 stroke-[4px]" />
                </div>
             </div>

             <div className="space-y-1 max-w-[90%]">
                <p className="text-[14px] leading-relaxed text-white/90 font-medium">
                  {profile?.bio || `Sunshine seeker, art lover, and professional daydreamer. Catch me wandering through museums or trying new coffee spots...`}
                  <span className="text-white/40 ml-1 cursor-pointer">more</span>
                </p>
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-white/70 hover:text-white transition-colors cursor-pointer group">
                   <LinkIcon className="w-3.5 h-3.5 transform group-hover:rotate-12 transition-transform" />
                   <span>{profile?.displayName?.toLowerCase().replace(/\s+/g, '')}.co</span>
                </div>
             </div>
          </div>

          {/* Action Buttons Grid */}
          <div className="grid grid-cols-4 gap-2 mb-10">
             <button 
              onClick={handleFollow}
              className={cn(
                "col-span-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-all tap-active backdrop-blur-md border border-white/10",
                isFollowing ? "bg-white/20 text-white" : "bg-white/15 text-white hover:bg-white/25"
              )}
             >
               {isFollowing ? 'Following' : 'Follow'}
             </button>
             <button 
              onClick={handleMessage}
              className="col-span-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-md py-2.5 rounded-xl text-[13px] font-bold tap-active border border-white/10 text-white"
             >
               Message
             </button>
             <button 
               onClick={handleSocialInsights}
               className="col-span-1 bg-white/15 hover:bg-white/25 backdrop-blur-md py-2.5 rounded-xl text-[13px] font-bold tap-active border border-white/10 text-white flex items-center justify-center gap-1.5"
             >
               <BarChart3 className="w-4 h-4" />
               <span>Social</span>
             </button>
             <button 
               onClick={handleCall}
               className="col-span-1 bg-white/15 hover:bg-white/25 backdrop-blur-md py-2.5 rounded-xl tap-active border border-white/10 text-white flex items-center justify-center"
               title="Video Call"
             >
               <Video className="w-5 h-5 text-emerald-400" />
             </button>
          </div>
       </div>

       {/* Posts Navigation */}
       <div className="flex border-t border-white/5">
          <div className="flex-1 py-4 border-b border-white flex justify-center">
             <ImageIcon className="w-6 h-6" />
          </div>
       </div>

       {/* Grid of posts Placeholder */}
       <div className="mt-16 text-center px-10">
          <div className="w-16 h-16 border-2 border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-white/5 backdrop-blur-sm">
            <ImageIcon className="w-8 h-8 opacity-20" />
          </div>
          <h3 className="text-[13px] font-bold uppercase tracking-[0.2em] opacity-40">No Posts Content</h3>
          <p className="text-[11px] text-white/30 mt-2 font-medium">When they post, you'll see their photos and videos here.</p>
       </div>
    </div>
  )
}
