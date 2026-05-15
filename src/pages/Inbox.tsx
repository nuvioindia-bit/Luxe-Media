import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { triggerHaptic } from '../lib/haptics';
import { 
  Search, 
  MessageSquarePlus, 
  CheckCircle2, 
  X,
  ChevronLeft
} from 'lucide-react';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function Inbox() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      chatData.sort((a: any, b: any) => {
        const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
        const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
        return timeB - timeA;
      });

      setChats(chatData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'chats');
    });

    return () => unsubscribe();
  }, []);

  // Real-time user search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const q = query(
      collection(db, 'users')
    );

    const unsub = onSnapshot(q, (snap) => {
      const users = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() as any }))
        .filter(u => u.id !== auth.currentUser?.uid && u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()));
      setSearchResults(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return () => unsub();
  }, [searchQuery]);

  const startChat = async (user: any) => {
    if (!auth.currentUser) return;
    triggerHaptic();
    const chatId = [auth.currentUser.uid, user.id].sort().join('_');
    
    // Check if chat exists, if not create a placeholder
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        participants: [auth.currentUser.uid, user.id],
        otherUserName: user.displayName,
        updatedAt: serverTimestamp(),
        lastMessage: 'Started a new conversation',
        createdAt: serverTimestamp(),
      });
    }
    
    navigate(`/dashboard/chat/${chatId}`);
  };

  const filteredChats = chats.filter(chat => {
    if (activeTab === 'unread') return chat.unread === true;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-950 flex flex-col transition-colors duration-300 overscroll-none overflow-hidden">
      
      {/* Brand New Header with Search Integrated */}
      <div className="pt-12 px-6 pb-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-3xl sticky top-0 z-20 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            <ChevronLeft strokeWidth={2.5} size={24} />
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Inbox</h1>
          <button 
            onClick={() => { triggerHaptic(); setIsSearching(true); }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all font-medium border border-transparent shadow-sm bg-gray-50 dark:bg-gray-900"
          >
            <MessageSquarePlus strokeWidth={2} size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Find conversations..."
              className="w-full bg-gray-100/80 dark:bg-gray-900/80 border-none rounded-2xl px-11 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-[15px] font-medium placeholder:text-gray-500 dark:text-white"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearching(e.target.value.length > 0);
              }}
              onFocus={() => setIsSearching(true)}
            />
            <AnimatePresence>
              {isSearching && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => { setSearchQuery(''); setIsSearching(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 p-1 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {!isSearching && (
          <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar pb-1">
            {['all', 'unread'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-semibold capitalize transition-all active:scale-95 whitespace-nowrap",
                  activeTab === tab 
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" 
                    : "bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"
                )}
              >
                {tab} Messages
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modern List Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4 pb-24">
        {isSearching ? (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2 mb-3">Directory Search</h3>
            {searchResults.length === 0 && searchQuery.length >= 2 ? (
              <div className="py-16 text-center flex flex-col items-center">
                 <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 text-gray-400">
                    <Search size={24} />
                 </div>
                 <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No one found for "{searchQuery}"</p>
              </div>
            ) : (
              searchResults.map(user => (
                <motion.button 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={user.id}
                  onClick={() => startChat(user)}
                  className="w-full bg-transparent p-3 flex items-center gap-4 group rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900 active:scale-[0.98] transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                    <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left flex-1 min-w-0 border-b border-transparent group-hover:border-gray-100 dark:group-hover:border-gray-800 pb-2">
                    <h4 className="font-bold text-gray-900 dark:text-white text-base truncate mb-0.5">{user.displayName}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize truncate">{user.role || 'Member'}</p>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4 p-3 items-center">
                  <div className="w-14 h-14 bg-gray-100 dark:bg-gray-900 animate-pulse rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 dark:bg-gray-900 animate-pulse rounded max-w-[120px]" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-900 animate-pulse rounded max-w-[200px]" />
                  </div>
                </div>
              ))
            ) : filteredChats.length === 0 ? (
              <div className="flex flex-col flex-1 h-full items-center justify-center py-20 text-center px-8">
                <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6 text-blue-500">
                  <MessageSquarePlus size={32} />
                </div>
                <h3 className="text-xl font-bold dark:text-white mb-2">No Messages Yet</h3>
                <p className="text-gray-500 dark:text-gray-400 text-[15px] leading-relaxed">Start a conversation to collaborate with creators and brands on exciting new drops.</p>
                <button 
                  onClick={() => setIsSearching(true)}
                  className="mt-8 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-3.5 rounded-full font-bold shadow-xl shadow-gray-200 dark:shadow-none hover:opacity-90 active:scale-95 transition-all"
                >
                  Start New Chat
                </button>
              </div>
            ) : (
              <AnimatePresence>
                {filteredChats.map(chat => (
                  <motion.button
                    layout
                    key={chat.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => { triggerHaptic(); navigate(`/dashboard/chat/${chat.id}`); }}
                    className="w-full bg-transparent p-3 flex items-center gap-4 group rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900 active:scale-[0.98] transition-all"
                  >
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <img 
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.id}`} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      {chat.unread && (
                        <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-blue-500 border-2 border-white dark:border-gray-950 rounded-full z-10" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center border-b border-gray-100 dark:border-gray-900 py-3 group-last:border-transparent">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className={cn(
                          "font-bold text-gray-900 dark:text-white text-base truncate",
                          chat.unread && "text-blue-600 dark:text-blue-400"
                        )}>
                          {chat.otherUserName || 'User'}
                        </h4>
                        <span className={cn(
                          "text-[11px] font-medium whitespace-nowrap",
                          chat.unread ? "text-blue-600 dark:text-blue-400" : "text-gray-400"
                        )}>
                          {chat.updatedAt && formatDistanceToNow(new Date(chat.updatedAt.toDate()), { addSuffix: false })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!chat.unread && chat.senderId === auth.currentUser?.uid && (
                          <CheckCircle2 size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />
                        )}
                        <p className={cn(
                          "text-sm truncate",
                          chat.unread ? "text-gray-900 dark:text-gray-100 font-semibold" : "text-gray-500 dark:text-gray-500"
                        )}>
                          {chat.lastMessage || 'Sent a message'}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
