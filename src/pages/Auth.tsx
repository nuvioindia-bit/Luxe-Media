import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { LogIn, UserPlus, Zap, ArrowLeft, Mail, Lock, User } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firebase';

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
        
        // Handle Referral Logic
        const pendingRef = localStorage.getItem('pending_referral');
        let referredBy = null;
        if (pendingRef) {
            referredBy = pendingRef;
            localStorage.removeItem('pending_referral'); // Clear after use
        }

        // Fast-track profile and wallet creation in background to avoid blocking user
        const userPath = `users/${res.user.uid}`;
        const walletPath = `users/${res.user.uid}/wallet/balance`;
        
        await runTransaction(db, async (transaction) => {
          // Create User Profile
          transaction.set(doc(db, userPath), {
            uid: res.user.uid,
            email: res.user.email,
            role,
            fullName,
            userName,
            referredBy: referredBy,
            createdAt: new Date().toISOString(),
            displayName: fullName || userName || email.split('@')[0]
          });

          // Create Wallet
          transaction.set(doc(db, walletPath), {
            userId: res.user.uid,
            balance: 0,
            totalEarned: 0,
            totalSpent: 0,
            currency: 'INR',
            updatedAt: new Date().toISOString()
          });

          // Apply Referral Bonus if applicable
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

              // Add activity record for referrer
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
      console.error("Auth Error:", err);
      let message = err.message || 'Authentication Failed';
      
      if (message.includes('unauthorized-domain')) {
        message = "DOMAIN ERROR: Please add 'aistudio.google.com' to your Firebase Console -> Authentication -> Settings -> Authorized Domains.";
      } else if (message.includes('network-request-failed')) {
        message = "Network error. Please check your internet connection or try again later.";
      } else if (message.includes('invalid-credential') || message.includes('auth/invalid-credential')) {
        message = isLogin 
          ? "Invalid email or password. Please check your credentials or click 'Sign Up' to create a new account."
          : "Invalid registration data. Please try another email.";
      } else if (message.includes('email-already-in-use')) {
        message = "This email is already registered. Please sign in instead.";
      } else if (message.includes('weak-password')) {
        message = "Password is too weak. Please use at least 6 characters.";
      }
      
      try {
        const parsed = JSON.parse(err.message);
        setError(parsed.error || message);
      } catch {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
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

  const signInWithGoogle = async () => {
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const res = await signInWithPopup(auth, provider);
      // Let App.tsx handle new user onboarding if document doesn't exist
    } catch (err: any) {
      setLoading(false);
      console.error("Google Auth Error:", err);
      let message = err.message || 'Authentication Failed';
      
      if (message.includes('popup-closed-by-user')) return;
      
      if (message.includes('unauthorized-domain')) {
        message = "DOMAIN ERROR: Please add 'aistudio.google.com' to your Firebase Console -> Authentication -> Settings -> Authorized Domains.";
      } else if (message.includes('network-request-failed')) {
        message = "Network error. Please check your internet connection.";
      }
      
      setError(message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6 font-sans">
      {/* Right Pane - Form */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden shadow-md border border-gray-100 bg-white">
            <img 
              src="https://i.postimg.cc/DyJxL7mx/file-0000000008cc720b9d91dbcfd5fecf45.png" 
              alt="Logo" 
              className="w-full h-full object-contain p-1"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-display font-bold text-2xl tracking-tighter text-gray-900">Rexo Tool</span>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-display font-bold tracking-tight mb-1.5">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-gray-500 text-sm">
            {isLogin ? 'Log in to your dashboard to manage campaigns.' : 'Sign up to start collaborating with brands globally.'}
          </p>
        </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
                <button 
                  onClick={() => setRole('creator')}
                  className={`p-3 rounded-2xl border transition-all text-center group ${role === 'creator' ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary' : 'border-gray-200 text-gray-400 opacity-60'}`}
                >
                  <div className={`font-bold ${role === 'creator' ? 'text-brand-primary' : ''}`}>Creator</div>
                </button>
                <button 
                  onClick={() => setRole('brand')}
                  className={`p-3 rounded-2xl border transition-all text-center group ${role === 'brand' ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary' : 'border-gray-200 text-gray-400 opacity-60'}`}
                >
                  <div className={`font-bold ${role === 'brand' ? 'text-brand-primary' : ''}`}>Brand</div>
                </button>
              </div>

          <form onSubmit={handleAuth} className="space-y-3">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-sm text-sm"
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest ml-1">Username</label>
                  <input 
                    type="text" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-sm text-sm"
                    placeholder="Enter username"
                    required
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-primary transition-colors" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-sm text-sm"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Password</label>
                {isLogin && (
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[9px] font-bold text-brand-primary uppercase tracking-widest hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-primary transition-colors" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-sm text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            {!isLogin && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest ml-1">Confirm Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-primary transition-colors" />
                    <input 
                      type="password" 
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-sm text-sm"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
            )}

            {error && (
              <div className="p-2.5 bg-red-50 text-red-500 text-[10px] rounded-lg border border-red-100 font-medium">
                {error}
              </div>
            )}

            {resetSent && (
              <div className="p-2.5 bg-green-50 text-green-600 text-[10px] rounded-lg border border-green-100 font-medium">
                Password reset email sent! Check your inbox.
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="premium-button-primary w-full py-3 flex items-center justify-center gap-2"
              id="auth-submit-button"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isLogin ? (
                <><LogIn className="w-4 h-4" /> Sign In</>
              ) : (
                <><UserPlus className="w-4 h-4" /> Create Account</>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
              <span className="relative px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest bg-[#F8F9FA]">Or continue with</span>
            </div>

            <button 
              onClick={signInWithGoogle}
              className="premium-button-secondary w-full py-3 flex items-center justify-center gap-2.5"
              id="google-auth-button"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>

            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="mt-8 text-sm font-semibold text-gray-500 hover:text-brand-primary transition-colors inline-flex items-center gap-2"
              id="auth-toggle-button"
            >
              {isLogin ? (
                <>Don't have an account? <span className="text-brand-primary">Sign Up</span></>
              ) : (
                <>Already have an account? <span className="text-brand-primary">Sign In</span></>
              )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
