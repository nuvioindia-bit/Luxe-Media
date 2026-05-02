import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Zap } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function RoleSelection({ user, onComplete }: { user: any, onComplete: () => void }) {
  const [role, setRole] = useState<'creator' | 'brand'>('creator');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    try {
      const userPath = `users/${user.uid}`;
      const walletPath = `users/${user.uid}/wallet/balance`;
      
      await setDoc(doc(db, userPath), {
        uid: user.uid,
        email: user.email,
        role: role,
        displayName: user.displayName || user.email?.split('@')[0],
        photoURL: user.photoURL,
        createdAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, walletPath), {
        userId: user.uid,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        currency: 'INR',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      onComplete();
    } catch (error) {
      console.error(error);
      alert("Failed to set role. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl border border-gray-100"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold text-gray-900 mb-2">Welcome to Rexo</h1>
          <p className="text-gray-500 text-sm">How would you like to use the platform?</p>
        </div>

        <div className="space-y-4 mb-8">
          <button 
            onClick={() => setRole('creator')}
            className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${role === 'creator' ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${role === 'creator' ? 'bg-brand-primary text-white' : 'bg-gray-50 text-gray-400'}`}>
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className={`font-bold ${role === 'creator' ? 'text-brand-primary' : 'text-gray-900'}`}>I am a Creator</h3>
              <p className="text-xs text-gray-500 mt-1">Find campaigns and earn</p>
            </div>
          </button>

          <button 
            onClick={() => setRole('brand')}
            className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${role === 'brand' ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${role === 'brand' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-400'}`}>
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className={`font-bold ${role === 'brand' ? 'text-blue-600' : 'text-gray-900'}`}>I am a Brand</h3>
              <p className="text-xs text-gray-500 mt-1">Post campaigns and hire</p>
            </div>
          </button>
        </div>

        <button 
          onClick={handleContinue}
          disabled={loading}
          className="w-full py-4 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Setting up...' : 'Continue'}
        </button>
      </motion.div>
    </div>
  );
}
