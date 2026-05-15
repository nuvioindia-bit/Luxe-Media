import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { LogIn, UserPlus, Mail, Lock, User, Sparkles, ArrowRight, ShieldCheck, Globe, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCodeFromUrl = searchParams.get('ref');
  
  useEffect(() => {
    if (referralCodeFromUrl) {
      localStorage.setItem('pending_referral', referralCodeFromUrl);
    }
  }, [referralCodeFromUrl]);

  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'creator' | 'brand'>('creator');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fullName, setFullName] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (password !== passwordConfirmation) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        const res = await createUserWithEmailAndPassword(auth, email, password);
        
        const pendingRef = localStorage.getItem('pending_referral');
        let referredBy = null;
        if (pendingRef) {
            referredBy = pendingRef;
            localStorage.removeItem('pending_referral');
        }

        await runTransaction(db, async (transaction) => {
          transaction.set(doc(db, `users/${res.user.uid}`), {
            uid: res.user.uid,
            email: res.user.email,
            role,
            fullName,
            userName,
            referredBy: referredBy,
            createdAt: new Date().toISOString(),
            displayName: fullName || userName || email.split('@')[0]
          });

          transaction.set(doc(db, `users/${res.user.uid}/wallet/balance`), {
            userId: res.user.uid,
            balance: 0,
            totalEarned: 0,
            totalSpent: 0,
            currency: 'INR',
            updatedAt: new Date().toISOString()
          });

          if (referredBy) {
            const referrerWalletRef = doc(db, `users/${referredBy}/wallet/balance`);
            const referrerWalletSnap = await transaction.get(referrerWalletRef);
            
            if (referrerWalletSnap.exists()) {
              const currentBalance = referrerWalletSnap.data().balance || 0;
              transaction.update(referrerWalletRef, {
                balance: currentBalance + 5,
                referralBonuses: (referrerWalletSnap.data().referralBonuses || 0) + 5,
                updatedAt: new Date().toISOString()
              });

              const activityRef = doc(collection(db, `users/${referredBy}/activities`));
              transaction.set(activityRef, {
                type: 'referral_bonus',
                amount: 5,
                message: `Referral bonus for ${fullName || email}`,
                timestamp: serverTimestamp()
              });
            }
          }
        });
      }
    } catch (err: any) {
      setError(err.message || 'Authentication Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter email address for recovery.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemFade = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-[340px] bg-white/70 dark:bg-gray-900/70 backdrop-blur-3xl border border-white/60 dark:border-gray-800/60 shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[2.5rem] p-8 relative z-10 hardware-accelerated"
        style={{ boxShadow: 'var(--shadow-skeuo)' }}
      >
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-10">
          <motion.div 
            whileHover={{ rotate: 10, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center overflow-hidden shadow-sm border border-white/60 dark:border-gray-700/60 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md mb-4 skeuo-inner"
          >
            <img 
              src="https://i.postimg.cc/DyJxL7mx/file-0000000008cc720b9d91dbcfd5fecf45.png" 
              alt="Logo" 
              className="w-12 h-12 object-contain"
              referrerPolicy="no-referrer"
            />
          </motion.div>
          <h1 className="font-display font-black text-3xl tracking-tighter text-gray-900">Rexo Tool</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-1.5">Creator Intelligence</p>
        </div>

        {/* Form Selection */}
        <div className="p-1 bg-gray-100/50 backdrop-blur-md rounded-2xl mb-8 flex gap-1">
          <button 
            type="button"
            onClick={() => setRole('creator')}
            className={`flex-1 h-[36px] rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${role === 'creator' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white border border-white/50 dark:border-gray-700/50' : 'text-gray-400 dark:text-gray-500'}`}
          >
            Creator
          </button>
          <button 
            type="button"
            onClick={() => setRole('brand')}
            className={`flex-1 h-[36px] rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${role === 'brand' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white border border-white/50 dark:border-gray-700/50' : 'text-gray-400 dark:text-gray-500'}`}
          >
            Brand
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div
                key="signup-fields"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-100/50 rounded-2xl pl-11 pr-4 h-[42px] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-[13px] font-bold placeholder:text-gray-300 skeuo-inner"
                      placeholder="Full Name"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="relative group">
                    <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />
                    <input 
                      type="text" 
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-100/50 rounded-2xl pl-11 pr-4 h-[42px] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-[13px] font-bold placeholder:text-gray-300 skeuo-inner"
                      placeholder="Username"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50/50 border border-gray-100/50 rounded-2xl pl-11 pr-4 h-[42px] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-[13px] font-bold placeholder:text-gray-300 skeuo-inner"
                placeholder="Email Address"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50/50 border border-gray-100/50 rounded-2xl pl-11 pr-4 h-[42px] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-[13px] font-bold placeholder:text-gray-300 skeuo-inner"
                placeholder="Password"
                required
              />
            </div>
            {isLogin && (
              <div className="text-right pr-2">
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>

          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div
                key="confirm-password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-1.5"
              >
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="password" 
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    className="w-full bg-gray-50/50 border border-gray-100/50 rounded-2xl pl-11 pr-4 h-[42px] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-[13px] font-bold placeholder:text-gray-300 skeuo-inner"
                    placeholder="Confirm Password"
                    required
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-3 bg-red-50/50 backdrop-blur-md text-red-600 text-[11px] rounded-xl border border-red-100/50 font-bold"
            >
              {error}
            </motion.div>
          )}

          <motion.button 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={loading}
            className="elite-button-primary w-full h-[42px] rounded-2xl text-[12px] shadow-xl shadow-gray-200/50"
            id="auth-submit-button"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isLogin ? (
              <>Sign In <ArrowRight className="w-4 h-4 ml-1" /></>
            ) : (
              <>Create Account <Sparkles className="w-4 h-4 ml-1" /></>
            )}
          </motion.button>
        </form>
        
        <div className="mt-8 text-center">
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors inline-flex items-center gap-2"
            id="auth-toggle-button"
          >
            {isLogin ? (
              <>New here? <span className="text-indigo-600 border-b-2 border-indigo-100 pb-0.5">Create Account</span></>
            ) : (
              <>Already member? <span className="text-indigo-600 border-b-2 border-indigo-100 pb-0.5">Sign In</span></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
