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

    setLoading(true);
    const withdrawalPath = `users/${auth.currentUser.uid}/withdrawals`;
    const transactionPath = `users/${auth.currentUser.uid}/transactions`;
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, withdrawalPath);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-xl font-display font-bold tracking-tight">Financial Wallet</h1>
        <div className="bg-white px-3 py-1.5 rounded-xl border border-gray-100 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active</span>
        </div>
      </header>

      {/* Balance Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="premium-card bg-gradient-to-br from-brand-primary to-[#2D5BFF] p-6 text-white border-0 overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[40px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-accent/20 blur-[30px] translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-1">Available Balance</p>
                    <h2 className="text-4xl font-display font-bold tracking-tight">₹{balance.toLocaleString('en-IN')}</h2>
                </div>
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                    <WalletIcon className="w-5 h-5" />
                </div>
            </div>
            
            <div className="flex gap-3">
                <button 
                    onClick={() => setShowWithdrawModal(true)}
                    disabled={balance < 100 || config.allow_withdrawals === false}
                    className="flex-1 bg-white text-brand-primary py-3 rounded-xl text-xs font-bold shadow-lg shadow-black/10 active:scale-95 transition-transform disabled:opacity-50"
                >
                    {config.allow_withdrawals === false ? 'Service Suspended' : 'Withdraw Funds'}
                </button>
                <button className="px-4 bg-white/20 backdrop-blur-md text-white rounded-xl active:scale-95 transition-transform flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                </button>
            </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Earnings', value: `₹${totalEarned.toLocaleString('en-IN')}`, icon: ArrowUpCircle, color: 'text-green-500', bg: 'bg-green-50' }
        ].map((stat, i) => (
          <div key={i} className="premium-card p-4 flex flex-col items-center text-center col-span-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", stat.bg)}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <div className="text-lg font-display font-bold text-gray-900">{stat.value}</div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Methods */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">Withdrawal Methods</h3>
        <div className="grid grid-cols-1 gap-2">
            {[
                { id: 'upi', name: 'UPI Transfer', desc: 'Instant Payout', icon: Smartphone, color: 'text-brand-accent', bg: 'bg-amber-50' },
                { id: 'bank', name: 'Bank Transfer', desc: '2-3 Business Days', icon: CreditCard, color: 'text-brand-primary', bg: 'bg-blue-50' }
            ].map(method => (
                <div 
                    key={method.name} 
                    onClick={() => {
                        setWithdrawType(method.id as 'upi' | 'bank');
                        setShowWithdrawModal(true);
                    }}
                    className="premium-card p-3 flex items-center justify-between group hover:border-brand-primary/20 transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                    <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", method.bg)}>
                            <method.icon className={cn("w-5 h-5", method.color)} />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-900">{method.name}</div>
                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{method.desc}</div>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-primary" />
                </div>
            ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Recent Activity</h3>
        </div>
        <div className="space-y-2">
            {transactions.map(tx => (
                <div key={tx.id} className="premium-card p-3 flex items-center justify-between bg-white border-gray-50">
                    <div className="flex gap-3 items-center">
                        <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            (tx.type === 'earning' || tx.type === 'credit') ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'
                        )}>
                            {(tx.type === 'earning' || tx.type === 'credit') ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-900 leading-none mb-1">{tx.title}</p>
                            <div className="flex items-center gap-2">
                                <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-widest">{tx.status}</p>
                                {tx.timestamp && (
                                    <>
                                        <span className="w-1 h-1 bg-gray-200 rounded-full" />
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                                            {tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Recent'}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className={cn(
                        "text-xs font-display font-bold",
                        (tx.type === 'earning' || tx.type === 'credit') ? 'text-green-500' : 'text-gray-900'
                    )}>
                        {(tx.type === 'earning' || tx.type === 'credit') ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                    </div>
                </div>
            ))}
            {transactions.length === 0 && (
                <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">No Activity Yet</p>
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
              className="relative w-full max-w-sm bg-white rounded-[2rem] p-6 shadow-2xl"
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
