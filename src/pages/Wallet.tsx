import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet as WalletIcon, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  ChevronRight, 
  Plus, 
  CreditCard, 
  Smartphone, 
  History,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, runTransaction } from 'firebase/firestore';

interface Transaction {
  id: string;
  type: 'earning' | 'withdrawal' | 'credit' | 'debit';
  amount: number;
  status: string;
  title: string;
  timestamp: any;
}

import { useAppConfig } from '../hooks/useAppConfig';

export default function Wallet() {
  const config = useAppConfig();
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawType, setWithdrawType] = useState<'upi' | 'bank' | null>(null);
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankDetails, setBankDetails] = useState({ account: '', ifsc: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen to wallet
    const walletPath = `users/${auth.currentUser.uid}/wallet/balance`;
    const walletRef = doc(db, walletPath);
    const unsubWallet = onSnapshot(walletRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setBalance(data.balance || 0);
        setTotalEarned(data.totalEarned || 0);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, walletPath);
    });

    // Real-time transactions
    const transactionsPath = `users/${auth.currentUser.uid}/transactions`;
    const q = query(
      collection(db, transactionsPath),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubDocs = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setTransactions(docs);
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, transactionsPath);
    });

    return () => {
      unsubWallet();
      unsubDocs();
    };
  }, []);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !amount || parseFloat(amount) > balance) return;

    let isStillLoading = true;
    setLoading(true);
    
    const safetyTimeout = setTimeout(() => {
      if (isStillLoading) {
        setLoading(false);
        isStillLoading = false;
        alert("Withdrawal request is taking longer than expected. Please check your transaction history in a moment.");
      }
    }, 15000);

    const withdrawalPath = `users/${auth.currentUser.uid}/withdrawals`;
    try {
      const amountNum = parseFloat(amount);
      
      await runTransaction(db, async (transaction) => {
        const walletRef = doc(db, `users/${auth.currentUser!.uid}/wallet/balance`);
        const walletSnap = await transaction.get(walletRef);
        
        if (!walletSnap.exists() || walletSnap.data().balance < amountNum) {
          throw new Error("Insufficient funds");
        }

        const currentBalance = walletSnap.data().balance;
        const newBalance = currentBalance - amountNum;

        // 1. Deduct from wallet
        transaction.update(walletRef, { 
          balance: newBalance,
          updatedAt: serverTimestamp() 
        });

        // 2. Add to global withdrawals for Admin
        const withdrawalRef = doc(collection(db, 'withdrawals'));
        transaction.set(withdrawalRef, {
          id: withdrawalRef.id,
          creatorId: auth.currentUser!.uid,
          creatorEmail: auth.currentUser?.email,
          amount: amountNum,
          method: withdrawType,
          details: withdrawType === 'upi' ? { upiId } : bankDetails,
          status: 'pending',
          createdAt: serverTimestamp(),
          currentBalance: currentBalance // Store for refund if rejected
        });

        // 3. Add personal transaction record
        const transRef = doc(collection(db, `users/${auth.currentUser!.uid}/transactions`));
        transaction.set(transRef, {
          type: 'withdrawal',
          title: `Withdrawal via ${withdrawType?.toUpperCase()}`,
          amount: amountNum,
          status: 'Processing',
          timestamp: serverTimestamp()
        });

        // 4. Notify Admin
        const notifRef = doc(collection(db, 'notifications'));
        transaction.set(notifRef, {
            recipientId: 'admin',
            type: 'withdrawal_request',
            title: 'New Payout Request',
            message: `${auth.currentUser?.email} requested a withdrawal of ₹${amountNum.toLocaleString()}`,
            createdAt: serverTimestamp(),
            referenceId: withdrawalRef.id,
            read: false
        });
      });

      setSuccess(true);
      setTimeout(() => {
        setShowWithdrawModal(false);
        setSuccess(false);
        setWithdrawType(null);
        setAmount('');
      }, 2000);
    } catch (error: any) {
      console.error("Withdrawal error:", error);
      alert(error.message || "Failed to process withdrawal. Please check your connection.");
    } finally {
      isStillLoading = false;
      clearTimeout(safetyTimeout);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 px-6 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-display font-black tracking-tighter text-gray-900 dark:text-white">Wallet</h1>
        <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/60 dark:border-gray-700/60 flex items-center gap-2 shadow-sm skeuo-inner">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Active</span>
        </div>
      </header>

      {/* Balance Card - Elite Design */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="premium-card bg-gray-900 p-5 text-white border-0 overflow-hidden relative shadow-2xl rounded-[2rem] h-[150px] flex flex-col justify-between"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-brand-primary/20 blur-[60px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/20 blur-[40px] translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-0.5">Available Funds</p>
            <h2 className="text-3xl font-black tracking-tighter">₹{balance.toLocaleString('en-IN')}</h2>
        </div>
        
        <div className="relative z-10 flex gap-2">
            <button 
                onClick={() => setShowWithdrawModal(true)}
                disabled={balance < 100 || config.allow_withdrawals === false}
                className="flex-1 elite-button-primary rounded-xl text-[10px] font-black uppercase tracking-widest h-[40px] disabled:opacity-50"
            >
                {config.allow_withdrawals === false ? 'Service Suspended' : 'Redeem Now'}
            </button>
            <button className="w-[40px] h-[40px] bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10 active:scale-90 transition-all">
                <Plus className="w-5 h-5" />
            </button>
        </div>
      </motion.div>

      {/* Stats - Bento 2.0 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Earnings', value: `₹${totalEarned.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-emerald-500 dark:text-emerald-400' },
          { label: 'Withdrawals', value: `0`, icon: ArrowDownCircle, color: 'text-red-500 dark:text-red-400' }
        ].map((stat, i) => (
          <div key={i} className="bento-card p-4 rounded-2xl flex flex-col justify-between h-[100px] border border-white/60 dark:border-gray-800">
            <div className="flex justify-between items-start">
                <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <div>
                <div className="text-xl font-black text-gray-900 dark:text-white leading-none">{stat.value}</div>
                <div className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Activity History</h3>
            <History className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
        </div>
        <div className="space-y-3">
            {transactions.map(tx => (
                <div key={tx.id} className="premium-card p-4 flex items-center justify-between rounded-2xl group transition-all hover:scale-[1.02]">
                    <div className="flex gap-4 items-center">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center skeuo-inner",
                            (tx.type === 'earning' || tx.type === 'credit') ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400'
                        )}>
                            {(tx.type === 'earning' || tx.type === 'credit') ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                        </div>
                        <div>
                            <p className="text-[12px] font-black text-gray-900 dark:text-white leading-none mb-1.5 uppercase tracking-wide">{tx.title}</p>
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md",
                                    tx.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                )}>{tx.status}</span>
                                <span className="text-[8px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest">
                                    {tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Just now'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className={cn(
                        "text-sm font-black tracking-tight",
                        (tx.type === 'earning' || tx.type === 'credit') ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                    )}>
                        {(tx.type === 'earning' || tx.type === 'credit') ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                    </div>
                </div>
            ))}
            {transactions.length === 0 && (
                <div className="py-12 text-center skeuo-inner rounded-[2rem] border border-white/60 dark:border-gray-800">
                    <p className="text-gray-300 dark:text-gray-600 text-[9px] font-black uppercase tracking-[0.2em]">Safely processing...</p>
                </div>
            )}
        </div>
      </section>

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWithdrawModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-[2rem] p-6 shadow-2xl border border-gray-100 dark:border-gray-800"
            >
              <button 
                onClick={() => setShowWithdrawModal(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900"
              >
                <X className="w-5 h-5" />
              </button>

              {success ? (
                  <div className="text-center py-8">
                      <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h2 className="text-xl font-display font-bold mb-2">Request Submitted</h2>
                      <p className="text-gray-500 text-sm">Your withdrawal is being processed safely.</p>
                  </div>
              ) : (
                  <>
                    <h2 className="text-xl font-display font-bold mb-6">Withdraw Funds</h2>
                    
                    {!withdrawType ? (
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <button 
                                onClick={() => setWithdrawType('upi')}
                                className="flex flex-col items-center gap-3 p-4 border border-gray-100 rounded-2xl hover:border-brand-primary transition-all active:scale-95"
                            >
                                <Smartphone className="w-6 h-6 text-brand-accent" />
                                <span className="text-xs font-bold">UPI ID</span>
                            </button>
                            <button 
                                onClick={() => setWithdrawType('bank')}
                                className="flex flex-col items-center gap-3 p-4 border border-gray-100 rounded-2xl hover:border-brand-primary transition-all active:scale-95"
                            >
                                <CreditCard className="w-6 h-6 text-brand-primary" />
                                <span className="text-xs font-bold">Bank A/C</span>
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleWithdraw} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Amount to Withdraw</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">₹</span>
                                    <input 
                                        type="number"
                                        placeholder="0.00"
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 text-sm font-bold"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        max={balance}
                                        required
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Max available: ₹{balance.toLocaleString('en-IN')}
                                </p>
                            </div>

                            {withdrawType === 'upi' ? (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">UPI ID</label>
                                    <input 
                                        type="text"
                                        placeholder="username@bank"
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 text-sm font-medium"
                                        value={upiId}
                                        onChange={e => setUpiId(e.target.value)}
                                        required
                                    />
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Account Number</label>
                                        <input 
                                            type="text"
                                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 text-sm font-medium"
                                            value={bankDetails.account}
                                            onChange={e => setBankDetails({...bankDetails, account: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">IFSC Code</label>
                                        <input 
                                            type="text"
                                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 text-sm font-medium uppercase"
                                            value={bankDetails.ifsc}
                                            onChange={e => setBankDetails({...bankDetails, ifsc: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button"
                                    onClick={() => setWithdrawType(null)}
                                    className="px-4 py-3 border border-gray-200 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                                >
                                    Back
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-brand-primary text-white py-3 rounded-xl text-xs font-bold active:scale-95 transition-transform disabled:opacity-50"
                                >
                                    {loading ? 'Processing...' : 'Confirm Withdrawal'}
                                </button>
                            </div>
                        </form>
                    )}
                  </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
