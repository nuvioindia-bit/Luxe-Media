import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, storage, handleFirestoreError, OperationType, getDocFromServerWithRetry } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User, sendPasswordResetEmail } from 'firebase/auth';
import { 
  Camera, 
  MapPin, 
  Settings,
  Shield,
  CreditCard,
  ChevronRight,
  User as UserIcon,
  LogOut,
  Check,
  AlertCircle,
  Mail,
  MessageCircle,
  Send,
  Linkedin,
  Instagram,
  MessagesSquare,
  BarChart3,
  Gift,
  X,
  Users,
  UserPlus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { isAdminEmail } from '../constants';

import { useAppConfig } from '../hooks/useAppConfig';

export default function Profile() {
  const config = useAppConfig();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '',
    location: '',
    bio: ''
  });

  useEffect(() => {
    if (profile) {
      setEditForm({
        displayName: profile.displayName || '',
        location: profile.location || '',
        bio: profile.bio || ''
      });
    }
  }, [profile]);

  useEffect(() => {
    let active = true;
    const safetyTimeout = setTimeout(() => {
        if (active && loading) {
            setLoading(false);
        }
    }, 6000);

    const fetchProfile = async () => {
      if (!auth.currentUser) {
        if (active) setLoading(false);
        return;
      }

      const fallbackProfile = {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        displayName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'User',
        photoURL: auth.currentUser.photoURL || '',
        role: 'creator',
        createdAt: new Date().toISOString()
      };
      
      if (active) setProfile(fallbackProfile);

      const path = `users/${auth.currentUser.uid}`;
      try {
        const userDoc = await getDocFromServerWithRetry(doc(db, path));
        if (!active) return;
        if (userDoc.exists()) {
            setProfile(userDoc.data());
        } else {
            await updateDoc(doc(db, path), fallbackProfile).catch(async () => {
                const { setDoc } = await import('firebase/firestore');
                await setDoc(doc(db, path), fallbackProfile, { merge: true });
            });
        }
      } catch (error: any) {
        console.warn("Profile fetch failed:", error.message);
      } finally {
        if (active) {
            setLoading(false);
            clearTimeout(safetyTimeout);
        }
      }
    };
    fetchProfile();
    return () => {
        active = false;
        clearTimeout(safetyTimeout);
    };
  }, []);

  const handleUpdate = async () => {
    if (!auth.currentUser || !profile) return;
    setSaving(true);
    const path = `users/${auth.currentUser.uid}`;
    try {
      const updatedData = {
        ...profile,
        ...editForm,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, path), updatedData);
      setProfile(updatedData);
      setSuccess(true);
      setIsEditModalOpen(false);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!auth.currentUser?.email) return;
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      alert('Password reset email sent!');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    navigate('/');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;
    
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > 500) {
            height = Math.round((height * 500) / width);
            width = 500;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const base64Url = canvas.toDataURL('image/jpeg', 0.7);
          setProfile({ ...profile, photoURL: base64Url });
          setUploading(false);
          // Auto update after image set
          updateDoc(doc(db, `users/${auth.currentUser?.uid}`), { photoURL: base64Url });
        };
      };
    } catch (error) {
      setUploading(false);
    }
  };

  const handleSocialInsights = () => {
    if (isAdminEmail(auth.currentUser?.email)) {
      navigate('/dashboard/insights');
    } else {
      alert("Social Insights Feature: Coming Soon for Public Users!");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile?.displayName,
          url: window.location.href,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (loading && !profile) return (
      <div className="min-h-screen bg-[#4f4a46] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
  );

  return (
    <div className="pb-24 space-y-4 px-6 pt-6">
      {/* Profile Header */}
      <div className="relative">
        <div className="premium-card p-6 rounded-[2.5rem] flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-[2rem] p-1.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md shadow-xl border border-white/60 dark:border-gray-700/60 skeuo-inner relative z-10">
              <div className="w-full h-full rounded-[1.75rem] overflow-hidden bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-indigo-100 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
                ) : profile.photoURL ? (
                  <img src={profile.photoURL} className="w-full h-full object-cover" alt="Profile" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                )}
              </div>
            </div>
            <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-all z-20 border-2 border-white dark:border-gray-800">
              <Camera className="w-4 h-4" />
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <h2 className="text-xl font-display font-black tracking-tighter text-gray-900 dark:text-white">{profile.displayName || 'User'}</h2>
              <div className="flex items-center justify-center w-4 h-4 bg-blue-500 rounded-full">
                <Check className="w-2.5 h-2.5 text-white stroke-[4px]" />
              </div>
            </div>
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              @{profile?.displayName?.toLowerCase().replace(/\s+/g, '') || 'user'} • <span className="text-indigo-500 dark:text-indigo-400">{profile.role || 'Creator'}</span>
            </p>
          </div>

          <div className="flex gap-2 w-full mt-2">
            <button 
              onClick={() => setIsEditModalOpen(true)}
              className="flex-1 elite-button-primary dark:bg-white dark:text-gray-900 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Settings className="w-3.5 h-3.5" /> Edit Profile
            </button>
            <button 
               onClick={handleShare}
               className="w-[42px] h-[42px] bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border border-white/60 dark:border-gray-700/60 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 shadow-sm skeuo-inner active:scale-90 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ads', value: profile.postsCount || 0, color: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Fans', value: profile.followersCount || 0, color: 'text-purple-600 dark:text-purple-400' },
          { label: 'Trust', value: profile.followingCount || 0, color: 'text-pink-600 dark:text-pink-400' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="premium-card p-3 rounded-2xl text-center space-y-0.5"
          >
            <span className="block text-lg font-black text-gray-900 dark:text-white leading-tight">{stat.value}</span>
            <span className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">{stat.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Account Settings */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1 mb-2">Account Control</h3>
        <button 
          onClick={() => navigate('/dashboard/settings')}
          className="w-full premium-card h-[48px] rounded-2xl flex items-center justify-between px-5 group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 skeuo-inner">
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-widest">Settings</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:translate-x-1 transition-transform" />
        </button>

        <button 
          onClick={handleLogout}
          className="w-full bg-red-50/50 dark:bg-red-900/20 backdrop-blur-md border border-red-100 dark:border-red-900/50 h-[48px] rounded-2xl flex items-center justify-between px-5 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/80 dark:bg-gray-800/80 flex items-center justify-center text-red-500 dark:text-red-400 skeuo-inner shadow-sm">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Log Out</span>
          </div>
          <ChevronRight className="w-4 h-4 text-red-300 dark:text-red-800 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="pt-4 text-center">
        <p className="text-[9px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-[0.3em]">REXOC OLLA B v1.2.4</p>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] p-5 pb-10 z-[101] shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-gray-900 tracking-tighter">Edit Profile</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1 ml-1.5">Display Name</label>
                  <input 
                    type="text"
                    className="w-full bg-gray-50 rounded-xl px-4 py-3.5 text-[13px] font-bold text-gray-900 outline-none border border-gray-100 focus:border-brand-primary"
                    value={editForm.displayName}
                    onChange={e => setEditForm({ ...editForm, displayName: e.target.value })}
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1 ml-1.5">Location</label>
                  <input 
                    type="text"
                    className="w-full bg-gray-50 rounded-xl px-4 py-3.5 text-[13px] font-bold text-gray-900 outline-none border border-gray-100 focus:border-brand-primary"
                    value={editForm.location}
                    onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                    placeholder="e.g. Mumbai, India"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1 ml-1.5">About Me</label>
                  <textarea 
                    rows={3}
                    className="w-full bg-gray-50 rounded-xl px-4 py-3.5 text-[13px] font-medium text-gray-700 outline-none border border-gray-100 focus:border-brand-primary resize-none"
                    value={editForm.bio}
                    onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                    placeholder="Bio..."
                  />
                </div>
              </div>

              <button 
                onClick={handleUpdate}
                disabled={saving}
                className="w-full bg-gray-900 text-white py-3.5 rounded-xl text-[12px] font-black uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

