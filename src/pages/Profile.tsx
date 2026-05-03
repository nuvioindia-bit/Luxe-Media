import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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
  Gift
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

import { useAppConfig } from '../hooks/useAppConfig';

export default function Profile() {
  const config = useAppConfig();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    const safetyTimeout = setTimeout(() => {
        if (active && loading) {
            console.warn("Profile fetch safety timeout triggered");
            setLoading(false);
        }
    }, 6000);

    const fetchProfile = async () => {
      if (!auth.currentUser) {
        if (active) setLoading(false);
        return;
      }

      // Pre-populate with auth data so the UI isn't empty if fetch hangs or fails
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
        // Use the robust fetch helper
        const userDoc = await getDocFromServerWithRetry(doc(db, path));
        if (!active) return;
        if (userDoc.exists()) {
            setProfile(userDoc.data());
        } else {
            console.warn("Profile document missing, automatically initializing...");
            // Automatically initialize the document if it doesn't exist
            await updateDoc(doc(db, path), fallbackProfile).catch(async () => {
                const { setDoc } = await import('firebase/firestore');
                await setDoc(doc(db, path), fallbackProfile, { merge: true });
            });
        }
      } catch (error: any) {
        console.warn("Profile fetch failed (using auth data):", error.message);
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
      await updateDoc(doc(db, path), {
        ...profile,
        updatedAt: new Date().toISOString()
      });
      setSuccess(true);
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
      alert('Password reset email sent! Check your inbox.');
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
        };
        img.onerror = () => {
          console.error("Image load error");
          setUploading(false);
          alert("Failed to process image.");
        }
      };
      reader.onerror = () => {
        console.error("File read error");
        setUploading(false);
        alert("Failed to read file.");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      setUploading(false);
    }
  };

  if (loading && !profile) return (
      <div className="py-20 text-center flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-gray-100 border-t-brand-primary rounded-full animate-spin mb-4" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Accessing Identity</p>
      </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-6">
      <header className="flex items-center justify-between px-2 pt-4">
        <h1 className="text-xl font-display font-bold tracking-tight">Settings</h1>
        <button 
          onClick={handleLogout}
          className="p-2 text-brand-accent hover:text-brand-accent/80 transition-colors font-medium text-sm flex items-center gap-1"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </header>

      {/* Profile Card */}
      <section className="premium-card p-5 flex items-center gap-4">
        <div className="relative group/avatar shrink-0">
            <div className="w-16 h-16 rounded-full bg-[#E5E5EA] shadow-inner flex items-center justify-center text-xl font-display font-bold text-gray-500 overflow-hidden">
            {uploading ? (
             <div className="w-5 h-5 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
            ) : profile.photoURL ? (
             <img src={profile.photoURL} className="w-full h-full object-cover" alt="Profile" />
            ) : (
             profile.displayName?.[0] || 'U'
            )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer">
                <Camera className="w-3 h-3" />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
        </div>
        
        <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">{profile.displayName || 'Unnamed User'}</h2>
            <div className="text-[11px] font-medium text-brand-primary mt-0.5">
                Verified {profile.role === 'brand' ? 'Brand' : 'Creator'}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">{profile.email}</div>
        </div>
      </section>

      {/* Edit Form */}
      <section className="premium-card p-2 space-y-1">
        <div className="px-3 pt-3 pb-1">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Public Profile</h3>
        </div>
        <div className="bg-white/50 rounded-xl">
            <div className="flex items-center px-3 py-3 border-b border-gray-100">
                <div className="w-1/3">
                    <label className="text-[13px] font-semibold text-gray-900">Name</label>
                </div>
                <div className="w-2/3">
                    <input 
                        className="w-full bg-transparent text-[13px] text-gray-600 outline-none placeholder-gray-300"
                        value={profile.displayName || ''}
                        onChange={e => setProfile({...profile, displayName: e.target.value})}
                        placeholder="Your display name"
                    />
                </div>
            </div>
            <div className="flex items-center px-3 py-3 border-b border-gray-100">
                <div className="w-1/3">
                    <label className="text-[13px] font-semibold text-gray-900">Location</label>
                </div>
                <div className="w-2/3">
                    <input 
                        className="w-full bg-transparent text-[13px] text-gray-600 outline-none placeholder-gray-300"
                        value={profile.location || ''}
                        onChange={e => setProfile({...profile, location: e.target.value})}
                        placeholder="City, Country"
                    />
                </div>
            </div>
            <div className="flex items-start px-3 py-3">
                <div className="w-1/3 pt-1">
                    <label className="text-[13px] font-semibold text-gray-900">Bio</label>
                </div>
                <div className="w-2/3">
                    <textarea 
                        rows={2}
                        className="w-full bg-transparent text-[13px] text-gray-600 outline-none resize-none placeholder-gray-300"
                        value={profile.bio || ''}
                        onChange={e => setProfile({...profile, bio: e.target.value})}
                        placeholder="Briefly describe what you do..."
                    />
                </div>
            </div>
        </div>
        <div className="px-2 pb-2 mt-2">
            <button 
              onClick={handleUpdate}
              disabled={saving}
              className={cn(
                "premium-button-primary w-full flex items-center justify-center gap-2",
                success ? "bg-green-500 shadow-green-100" : ""
              )}
            >
              {saving ? 'Saving...' : success ? <><Check className="w-4 h-4" /> Changes Applied</> : 'Update Profile'}
            </button>
        </div>
      </section>

      {/* Menu / Links */}
      <section className="premium-card p-2 space-y-1">
        <div className="px-3 pt-3 pb-1">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Account Features</h3>
        </div>
        <div className="bg-white/50 rounded-xl overflow-hidden divide-y divide-gray-100 border border-gray-50">
        {config.referEarn !== false && (
            <button 
              onClick={() => navigate('/dashboard/refer-earn')}
              className="w-full p-4 flex items-center justify-between group bg-white hover:bg-gray-50 active:bg-gray-100 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center text-orange-500">
                  <Gift className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[14px] font-medium text-gray-900">Refer & Earn</div>
                  <div className="text-[10px] text-gray-500 inline-block mt-0.5">Invite friends and earn ₹50</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
        )}
        <button 
          onClick={handlePasswordReset}
          className="w-full p-4 flex items-center justify-between group bg-white hover:bg-gray-50 active:bg-gray-100 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-500">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[14px] font-medium text-gray-900">Password & Security</div>
              <div className="text-[10px] text-gray-500 inline-block mt-0.5">Send reset email</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </button>
        </div>
      </section>

      {/* Support & Contact */}
      {config.support !== false && (
      <section className="premium-card p-2 space-y-1">
        <div className="px-3 pt-3 pb-1">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Support</h3>
        </div>
        <div className="bg-white/50 rounded-xl overflow-hidden divide-y divide-gray-100 border border-gray-50">
            <a 
              href="mailto:rexoagency.in@gmail.com"
              className="w-full p-4 flex items-center justify-between group bg-white hover:bg-gray-50 active:bg-gray-100 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div className="text-[14px] font-medium text-gray-900">Email Option</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </a>

            <a 
              href="https://wa.me/919116965626"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full p-4 flex items-center justify-between group bg-white hover:bg-gray-50 active:bg-gray-100 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-500">
                  <MessageCircle className="w-3.5 h-3.5" />
                </div>
                <div className="text-[14px] font-medium text-gray-900">WhatsApp Team</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </a>

            <a 
              href="https://t.me/rexoagencyofficial"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full p-4 flex items-center justify-between group bg-white hover:bg-gray-50 active:bg-gray-100 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-500">
                  <Send className="w-3.5 h-3.5" />
                </div>
                <div className="text-[14px] font-medium text-gray-900">Telegram Channel</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </a>
        </div>
      </section>
      )}

      <div className="flex justify-center items-center gap-6 pt-2">
            <a href="https://www.instagram.com/rexoagency.in?igsh=bmlvbThyaGJseDFn" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#E1306C] transition-all">
                <Instagram className="w-5 h-5" />
            </a>
            <a href="https://www.linkedin.com/in/mukhtiyar-khan-7a61261b1?utm_source=share_via&utm_content=profile&utm_medium=member_android" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#0077B5] transition-all">
                <Linkedin className="w-5 h-5" />
            </a>
            <a href="https://discord.gg/9at8Hryvy" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#5865F2] transition-all">
                <MessagesSquare className="w-5 h-5" />
            </a>
      </div>

      {/* Made in India */}
      <div className="flex flex-col items-center justify-center py-4 text-gray-400 gap-1 opacity-60">
          <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest">
              <span>Made with</span>
              <span className="text-red-500">❤️</span>
              <span>in India</span>
          </div>
          <span className="text-[9px] font-medium tracking-wider">v1.1.0 • REXO AGENCY</span>
      </div>
    </div>
  );
}

