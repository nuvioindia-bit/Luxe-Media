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
  MessagesSquare
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) {
        setLoading(false);
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
      
      setProfile(fallbackProfile);

      const path = `users/${auth.currentUser.uid}`;
      try {
        // Use the robust fetch helper
        const userDoc = await getDocFromServerWithRetry(doc(db, path));
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
        setLoading(false);
      }
    };
    fetchProfile();
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
    <div className="max-w-2xl mx-auto space-y-8 pb-32">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-xl font-display font-bold tracking-tight">Settings</h1>
        <button 
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Profile Card */}
      <section className="premium-card p-6 flex flex-col items-center text-center">
        <div className="relative group/avatar mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gray-50 border-2 border-white shadow-xl flex items-center justify-center text-2xl font-display font-bold text-brand-primary overflow-hidden">
            {uploading ? (
             <div className="w-6 h-6 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
            ) : profile.photoURL ? (
             <img src={profile.photoURL} className="w-full h-full object-cover" alt="Profile" />
            ) : (
             profile.displayName?.[0] || 'U'
            )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer">
                <Camera className="w-3.5 h-3.5" />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
        </div>
        
        <div>
            <h2 className="text-base font-bold text-gray-900">{profile.displayName || 'Unnamed User'}</h2>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                Verified {profile.role} • {profile.email}
            </div>
        </div>
      </section>

      {/* Edit Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] ml-1">Display Name</label>
                <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input 
                        className="w-full bg-white border border-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none"
                        value={profile.displayName || ''}
                        onChange={e => setProfile({...profile, displayName: e.target.value})}
                    />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] ml-1">Location</label>
                <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input 
                        className="w-full bg-white border border-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none"
                        value={profile.location || ''}
                        onChange={e => setProfile({...profile, location: e.target.value})}
                        placeholder="City, Country"
                    />
                </div>
            </div>
        </div>

        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] ml-1">About / Bio</label>
            <textarea 
                rows={3}
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none resize-none"
                value={profile.bio || ''}
                onChange={e => setProfile({...profile, bio: e.target.value})}
                placeholder="Briefly describe what you do..."
            />
        </div>
      </div>

      {/* Menu / Links */}
      <section className="space-y-2 pt-2">
        <button 
          onClick={handlePasswordReset}
          className="w-full premium-card p-4 flex items-center justify-between group bg-white border-gray-50 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-brand-primary transition-colors">
              <Shield className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-gray-900">Security & Password</div>
              <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Send reset email</div>
            </div>
          </div>
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
        </button>
      </section>

      {/* Support & Contact */}
      <section className="space-y-2 pt-2">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2 mt-4 flex items-center gap-2">
          <span>Support & Contact</span>
        </h3>
        
        <a 
          href="mailto:rexoagency.in@gmail.com"
          className="w-full premium-card p-4 flex items-center justify-between group bg-white border-gray-50 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-brand-primary transition-colors">
              <Mail className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-gray-900">Email Support</div>
              <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">rexoagency.in@gmail.com</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-primary" />
        </a>

        <a 
          href="https://wa.me/919116965626"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full premium-card p-4 flex items-center justify-between group bg-white border-gray-50 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-emerald-500 transition-colors">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-gray-900">WhatsApp</div>
              <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">+91 9116965626</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500" />
        </a>

        <a 
          href="https://t.me/rexoagencyofficial"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full premium-card p-4 flex items-center justify-between group bg-white border-gray-50 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
              <Send className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-gray-900">Telegram</div>
              <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">@rexoagencyofficial</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
        </a>

        {/* Social Links */}
        <div className="flex justify-center items-center gap-8 pt-8 px-4">
            <a href="https://www.instagram.com/rexoagency.in?igsh=bmlvbThyaGJseDFn" target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-400 hover:text-pink-600 transition-all hover:scale-110 active:scale-95">
                <Instagram className="w-6 h-6" />
            </a>
            <a href="https://www.linkedin.com/in/mukhtiyar-khan-7a61261b1?utm_source=share_via&utm_content=profile&utm_medium=member_android" target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-400 hover:text-blue-700 transition-all hover:scale-110 active:scale-95">
                <Linkedin className="w-6 h-6" />
            </a>
            <a href="https://discord.gg/9at8Hryvy" target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-400 hover:text-indigo-600 transition-all hover:scale-110 active:scale-95">
                <MessagesSquare className="w-6 h-6" />
            </a>
        </div>
      </section>

      {/* Save Button */}
      <div className="pt-4">
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
    </div>
  );
}

