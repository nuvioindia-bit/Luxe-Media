import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  doc,
  getDoc,
  deleteDoc,
  arrayUnion
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Send, 
  Plus,
  Paperclip,
  MoreHorizontal,
  Phone,
  Video,
  Info,
  Pencil,
  Trash2,
  X,
  RotateCcw,
  Smile,
  Volume2,
  VolumeX,
  ShieldAlert,
  ShieldCheck,
  EyeOff,
  Eye,
  Keyboard,
  Palette
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { agoraChatService } from '../services/agoraChatService';
import { triggerHaptic } from '../lib/haptics';

const CHAT_THEMES = [
  { id: 'default', name: 'iMessage Blue', bg: 'bg-blue-500', from: 'from-blue-500', to: 'to-blue-600' },
  { id: 'instagram', name: 'Instagram', bg: 'bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400', from: 'from-purple-500', to: 'to-orange-400' },
  { id: 'midnight', name: 'Midnight', bg: 'bg-indigo-600', from: 'from-indigo-600', to: 'to-indigo-800' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500', from: 'from-emerald-400', to: 'to-emerald-600' },
  { id: 'sunset', name: 'Sunset', bg: 'bg-orange-500', from: 'from-orange-400', to: 'to-rose-500' }
];

export default function ChatDetail() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [chat, setChat] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeReactionId, setActiveReactionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  
  // Settings States
  const [isMuted, setIsMuted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [hideTyping, setHideTyping] = useState(false);
  const [hideActive, setHideActive] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(CHAT_THEMES[0]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const reactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  useEffect(() => {
    const initAgoraChat = async () => {
      if (!auth.currentUser) return;
      try {
        const userId = auth.currentUser.uid;
        const response = await fetch(`/api/agora/chat-token?userId=${userId}`);
        if (!response.ok) throw new Error('Token fetch failed');
        const { token } = await response.json();
        await agoraChatService.login(userId, token);
      } catch (err: any) {
        console.error('Agora Chat init failed:', err.message || err);
      }
    };
    initAgoraChat();
  }, []);

  useEffect(() => {
    if (!chatId || !auth.currentUser) return;

    getDoc(doc(db, 'chats', chatId)).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChat({ id: docSnap.id, ...data });
        if (data.theme) {
            const foundTheme = CHAT_THEMES.find(t => t.id === data.theme);
            if (foundTheme) setCurrentTheme(foundTheme);
        }
        if (data.mutedBy?.includes(auth.currentUser?.uid)) setIsMuted(true);
        if (data.blockedBy?.includes(auth.currentUser?.uid)) setIsBlocked(true);
        if (data.hideTyping?.includes(auth.currentUser?.uid)) setHideTyping(true);
        if (data.hideActive?.includes(auth.currentUser?.uid)) setHideActive(true);
      }
    });

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(messagesData);
      setLoading(false);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });

    return () => unsubscribe();
  }, [chatId]);

  const updateChatSetting = async (field: string, value: boolean) => {
      if (!chatId || !auth.currentUser) return;
      const uid = auth.currentUser.uid;
      let newArray = [];
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists()) {
          const currentArray = chatDoc.data()[field] || [];
          if (value) {
              newArray = [...new Set([...currentArray, uid])];
          } else {
              newArray = currentArray.filter((id: string) => id !== uid);
          }
          await updateDoc(doc(db, 'chats', chatId), { [field]: newArray });
      }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !auth.currentUser || isBlocked) return;

    const content = newMessage;
    setNewMessage('');
    const currentEditing = editingMessage;
    setEditingMessage(null);

    try {
      if (currentEditing) {
        await updateDoc(doc(db, 'chats', chatId, 'messages', currentEditing.id), {
          content,
          isEdited: true,
          updatedAt: serverTimestamp()
        });
        return;
      }

      if (chatId) {
        const otherId = chatId.split('_').find(id => id !== auth.currentUser?.uid);
        if (otherId) {
          agoraChatService.sendMessage(otherId, content).catch(err => console.error(err));
        }
      }

      const messagePath = `chats/${chatId}/messages`;
      try {
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: auth.currentUser.uid,
          content,
          type: 'text',
          createdAt: serverTimestamp()
        });

        await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: content,
          lastSenderId: auth.currentUser.uid,
          updatedAt: serverTimestamp(),
          unread: false
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, messagePath);
      }
    } catch (error) {
      setNewMessage(content);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!chatId || isBlocked) return;
    setActiveReactionId(null);
    try {
      await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
        [`reactions.${auth.currentUser?.uid}`]: emoji
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
    }
  };

  const handleUnsend = async (messageId: string) => {
    if (!chatId) return;
    setActiveMenuId(null);
    if (!window.confirm('Remove message?')) return;
    try {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chats/${chatId}/messages/${messageId}`);
    }
  };

  const handleDeleteForMe = async (messageId: string) => {
    if (!chatId) return;
    setActiveMenuId(null);
    try {
      await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
        hiddenFor: arrayUnion(auth.currentUser?.uid)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
    }
  };

  const startEdit = (msg: any) => {
    setEditingMessage(msg);
    setNewMessage(msg.content);
    setActiveMenuId(null);
  };

  const handlePointerDown = (msgId: string) => {
    activeReactionId && setActiveReactionId(null);
    longPressTimer.current = setTimeout(() => {
      triggerHaptic();
      setActiveMenuId(msgId);
    }, 400); 
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  if (loading) return (
    <div className="absolute inset-0 bg-white dark:bg-gray-950 flex flex-col pt-[100px] items-center">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors duration-300 z-30 overscroll-none overflow-hidden">
      
      {/* Sleek Contextual Header */}
      <header className="shrink-0 bg-white/80 dark:bg-gray-950/80 backdrop-blur-2xl border-b border-gray-200/50 dark:border-gray-800 absolute top-0 left-0 right-0 z-40 transition-colors">
        <div className="h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)} 
              className={cn("p-2 -ml-2 rounded-full transition-colors", currentTheme.id === 'default' ? 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10' : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800')}
            >
              <ArrowLeft size={22} className="stroke-[2.5px]" />
            </button>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowSettings(true)}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-gray-200 to-gray-100 dark:from-gray-800 dark:to-gray-700 overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${chatId}`} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                  {chat?.otherUserName || 'Contact'}
                </h2>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {hideActive ? 'Offline' : 'Online'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={cn("p-2 rounded-full transition-colors", showSettings || currentTheme.id === 'default' ? 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10' : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800')}
            >
              <MoreHorizontal size={22} className="stroke-[2.5px]" />
            </button>
          </div>
        </div>
      </header>

      {/* Messages View */}
      <div 
        className="flex-1 overflow-y-auto px-4 pt-20 pb-6 space-y-6 no-scrollbar bg-gray-50 dark:bg-gray-950" 
        onClick={() => { setActiveMenuId(null); setActiveReactionId(null); setShowInfo(false); setShowSettings(false); }}
      >
        <div className="text-center pb-6">
           <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-gray-200 to-gray-100 dark:from-gray-800 dark:to-gray-700 overflow-hidden shadow-md mb-4 mt-8 border border-gray-200 dark:border-gray-800">
             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${chatId}`} className="w-full h-full object-cover" />
           </div>
           <h3 className="text-xl font-bold dark:text-white">{chat?.otherUserName || 'Contact'}</h3>
           <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Direct Message</p>
        </div>

        {messages.filter(m => !m.hiddenFor?.includes(auth.currentUser?.uid)).map((msg, i) => {
          const isMe = msg.senderId === auth.currentUser?.uid;
          const showAvatar = !isMe && (i === 0 || messages[i-1].senderId !== msg.senderId);
          const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;
          const showTime = i === 0 || msg.createdAt?.toMillis() - messages[i-1].createdAt?.toMillis() > 3600000;

          return (
            <React.Fragment key={msg.id}>
              {showTime && (
                <div className="text-center my-4">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-gray-900/50 px-3 py-1 rounded-full">
                    {msg.createdAt 
                      ? format(msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(), 'MMM d, h:mm a') 
                      : 'Recently'}
                  </span>
                </div>
              )}
              <div className={cn("flex flex-col relative group", isMe ? "items-end" : "items-start")}>
                
                {/* Bubble Container */}
                <div className="relative max-w-[78%]">
                  {/* Reactions Popover */}
                  <AnimatePresence>
                    {activeReactionId === msg.id && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        className={cn(
                          "absolute -top-14 p-2 bg-white dark:bg-gray-800 rounded-full shadow-2xl border border-gray-100 dark:border-gray-700 flex gap-2 z-50",
                          isMe ? "right-0" : "left-0"
                        )}
                      >
                        {reactions.map(emoji => (
                          <button 
                            key={emoji} 
                            onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji); }}
                            className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full transition-colors text-2xl active:scale-125 select-none touch-manipulation"
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Actions Popover */}
                  <AnimatePresence>
                    {activeMenuId === msg.id && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={cn(
                          "absolute top-0 p-2 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col gap-1 min-w-[180px] z-50 overflow-hidden",
                          isMe ? "right-full mr-3" : "left-full ml-3"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isMe && (
                          <>
                            <button onClick={() => startEdit(msg)} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/80 rounded-2xl transition-colors text-sm font-bold text-gray-700 dark:text-gray-200">
                              <Pencil className="w-4 h-4 text-blue-500" /> Edit Message
                            </button>
                            <button onClick={() => handleUnsend(msg.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-colors text-sm font-bold text-red-600">
                              <X className="w-4 h-4 text-red-500" /> Unsend
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDeleteForMe(msg.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/80 rounded-2xl transition-colors text-sm font-bold text-gray-700 dark:text-gray-200">
                          <Trash2 className="w-4 h-4 text-gray-400" /> Remove for me
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* The Bubble */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic();
                      if (!activeMenuId) setActiveReactionId(activeReactionId === msg.id ? null : msg.id);
                      setActiveMenuId(null);
                    }}
                    onPointerDown={() => handlePointerDown(msg.id)}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onContextMenu={(e) => e.preventDefault()}
                    className={cn(
                      "px-4 py-3 text-[15px] leading-relaxed font-medium transition-all active:scale-[0.98] cursor-pointer touch-none select-none relative",
                      isMe 
                        ? cn(currentTheme.bg, "text-white rounded-[20px] rounded-br-sm shadow-sm") 
                        : "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-[20px] rounded-bl-sm border border-gray-100 dark:border-gray-800 shadow-sm"
                    )}
                  >
                    {msg.content}
                    
                    {/* Reactions Display */}
                    {hasReactions && (
                      <div className={cn(
                        "absolute -bottom-4 flex -space-x-1 outline outline-[4px] outline-gray-50 dark:outline-gray-950 rounded-full bg-white dark:bg-gray-800 shadow-sm overflow-hidden",
                        isMe ? "right-2" : "left-2"
                      )}>
                        {Array.from(new Set(Object.values(msg.reactions))).slice(0, 3).map((emoji: any, idx) => (
                          <div key={idx} className="px-1.5 py-0.5 text-sm bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            {emoji}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          )
        })}
        <div ref={scrollRef} className="h-6" />
      </div>

      {/* Settings Modal / Menu */}
      <AnimatePresence>
          {showSettings && (
              <>
                  <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowSettings(false)}
                      className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                  />
                  <motion.div 
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 rounded-t-[32px] p-6 pb-12 z-[61] shadow-2xl flex flex-col gap-6"
                  >
                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-2" />
                        
                        <div className="grid grid-cols-2 gap-4">
                            {/* Mute Toggle */}
                            <button 
                                onClick={() => {
                                    setIsMuted(!isMuted);
                                    updateChatSetting('mutedBy', !isMuted);
                                    triggerHaptic();
                                }}
                                className={cn("flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border transition-all", isMuted ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10" : "border-gray-200 dark:border-gray-800")}
                            >
                                {isMuted ? <VolumeX className="w-6 h-6 text-amber-500" /> : <Volume2 className="w-6 h-6 text-gray-400 dark:text-gray-500" />}
                                <span className={cn("text-xs font-bold", isMuted ? "text-amber-600 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>{isMuted ? 'Unmute' : 'Mute Chat'}</span>
                            </button>
                            
                            {/* Block Toggle */}
                            <button 
                                onClick={() => {
                                    setIsBlocked(!isBlocked);
                                    updateChatSetting('blockedBy', !isBlocked);
                                    triggerHaptic();
                                }}
                                className={cn("flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border transition-all", isBlocked ? "border-red-500 bg-red-50 dark:bg-red-500/10" : "border-gray-200 dark:border-gray-800")}
                            >
                                {isBlocked ? <ShieldAlert className="w-6 h-6 text-red-500" /> : <ShieldCheck className="w-6 h-6 text-gray-400 dark:text-gray-500" />}
                                <span className={cn("text-xs font-bold", isBlocked ? "text-red-600 dark:text-red-500" : "text-gray-600 dark:text-gray-400")}>{isBlocked ? 'Unblock' : 'Block User'}</span>
                            </button>

                            {/* Hide Typing Toggle */}
                            <button 
                                onClick={() => {
                                    setHideTyping(!hideTyping);
                                    updateChatSetting('hideTyping', !hideTyping);
                                    triggerHaptic();
                                }}
                                className={cn("flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border transition-all", hideTyping ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-gray-200 dark:border-gray-800")}
                            >
                                <Keyboard className={cn("w-6 h-6", hideTyping ? "text-blue-500" : "text-gray-400 dark:text-gray-500")} />
                                <span className={cn("text-xs font-bold", hideTyping ? "text-blue-600 dark:text-blue-500" : "text-gray-600 dark:text-gray-400")}>{hideTyping ? 'Typing Hidden' : 'Hide Typing'}</span>
                            </button>

                            {/* Hide Active Toggle */}
                            <button 
                                onClick={() => {
                                    setHideActive(!hideActive);
                                    updateChatSetting('hideActive', !hideActive);
                                    triggerHaptic();
                                }}
                                className={cn("flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border transition-all", hideActive ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-gray-200 dark:border-gray-800")}
                            >
                                {hideActive ? <EyeOff className="w-6 h-6 text-purple-500" /> : <Eye className="w-6 h-6 text-gray-400 dark:text-gray-500" />}
                                <span className={cn("text-xs font-bold", hideActive ? "text-purple-600 dark:text-purple-500" : "text-gray-600 dark:text-gray-400")}>{hideActive ? 'Status Hidden' : 'Hide Status'}</span>
                            </button>
                        </div>

                        {/* Themes Section */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 px-1">
                                <Palette className="w-4 h-4" /> Change Chat Theme
                            </h4>
                            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
                                {CHAT_THEMES.map(theme => (
                                    <button
                                        key={theme.id}
                                        onClick={async () => {
                                            setCurrentTheme(theme);
                                            triggerHaptic();
                                            if (chatId) {
                                                await updateDoc(doc(db, 'chats', chatId), { theme: theme.id });
                                            }
                                        }}
                                        className={cn(
                                            "flex flex-col gap-2 shrink-0 group items-center",
                                        )}
                                    >
                                        <div className={cn(
                                            "w-14 h-14 rounded-full border-4 transition-all flex items-center justify-center shadow-lg",
                                            currentTheme.id === theme.id ? "border-gray-900 dark:border-white scale-110" : "border-transparent scale-100",
                                            theme.bg
                                        )}>
                                            {currentTheme.id === theme.id && <div className="w-3 h-3 bg-white dark:bg-gray-900 rounded-full" />}
                                        </div>
                                        <span className={cn("text-[10px] font-bold mt-1", currentTheme.id === theme.id ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400")}>{theme.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                  </motion.div>
              </>
          )}
      </AnimatePresence>

      {/* Elegant Bottom Input Area */}
      {isBlocked ? (
        <footer className="shrink-0 pt-2 pb-8 px-4 bg-gray-50 dark:bg-gray-950 z-40 relative border-t border-gray-200 dark:border-gray-900 flex justify-center">
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 px-6 py-3 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm">You blocked this contact.</p>
        </footer>
      ) : (
      <footer className="shrink-0 pt-2 pb-5 px-4 bg-white/90 dark:bg-gray-950/90 backdrop-blur-3xl z-40 relative border-t border-gray-100 dark:border-gray-900">
        <AnimatePresence>
          {editingMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-gray-900 mb-3 rounded-2xl text-sm font-semibold text-blue-900 dark:text-blue-200 mx-auto max-w-3xl border border-blue-100 dark:border-gray-800"
            >
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-500" /> Editing Message
              </div>
              <button 
                onClick={() => { setEditingMessage(null); setNewMessage(''); }} 
                className="p-1.5 hover:bg-blue-100 dark:hover:bg-gray-800 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-900 mb-3 rounded-2xl overflow-x-auto no-scrollbar mx-auto max-w-3xl border border-gray-200/50 dark:border-gray-800"
            >
              {['😀','😂','❤️','😍','🥺','🙏','👍','🔥','✨','🎉'].map(emoji => (
                <button 
                  key={emoji}
                  type="button"
                  onClick={() => setNewMessage(prev => prev + emoji)}
                  className="w-10 h-10 shrink-0 flex items-center justify-center text-2xl hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-colors shadow-sm bg-white/50 dark:bg-transparent"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
          {showAttachmentMenu && (
             <motion.div
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 10 }}
               className="flex items-center gap-4 p-6 bg-gray-100 dark:bg-gray-900 mb-3 rounded-3xl mx-auto max-w-3xl border border-gray-200/50 dark:border-gray-800 shadow-sm"
             >
               <button className="flex flex-col items-center gap-3 flex-1 hover:opacity-70 transition-opacity">
                 <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-500 flex items-center justify-center">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                 </div>
                 <span className="text-xs font-bold dark:text-gray-300">Photos</span>
               </button>
               <button className="flex flex-col items-center gap-3 flex-1 hover:opacity-70 transition-opacity">
                 <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center">
                   <Paperclip size={24} className="stroke-[2.5px]" />
                 </div>
                 <span className="text-xs font-bold dark:text-gray-300">File</span>
               </button>
               <button className="flex flex-col items-center gap-3 flex-1 hover:opacity-70 transition-opacity">
                 <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 22a10 10 0 0 1-10-10"/><path d="M12 2v20"/></svg>
                 </div>
                 <span className="text-xs font-bold dark:text-gray-300">Location</span>
               </button>
             </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="flex items-end gap-3 max-w-3xl mx-auto">
          <button 
            type="button" 
            onClick={() => { setShowAttachmentMenu(!showAttachmentMenu); setShowEmojiPicker(false); triggerHaptic(); }}
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0 mb-1 active:scale-95",
              showAttachmentMenu ? "text-white bg-gray-900 dark:bg-white dark:text-gray-900" : "text-gray-400 bg-gray-100 dark:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
            )}
          >
            <Plus size={24} className={cn("stroke-[2.5px] transition-transform", showAttachmentMenu && "rotate-45")} />
          </button>
          
          <div className="flex-1 relative flex items-end bg-transparent">
            <div className="w-full relative flex items-end ring-1 ring-gray-200 dark:ring-gray-800 rounded-3xl bg-white dark:bg-gray-900 focus-within:ring-2 focus-within:ring-blue-500 focus-within:shadow-sm transition-all overflow-hidden p-1 shadow-sm">
              <textarea 
                rows={1}
                placeholder="iMessage"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onFocus={() => { setShowEmojiPicker(false); setShowAttachmentMenu(false); }}
                className="w-full bg-transparent pl-4 pr-11 py-3 max-h-[120px] text-[15px] outline-none text-gray-900 dark:text-white font-medium placeholder:text-gray-400 resize-none no-scrollbar leading-tight min-h-[44px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (newMessage.trim()) handleSend(e);
                  }
                }}
              />
              <button 
                type="button"
                onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachmentMenu(false); triggerHaptic(); }}
                className={cn(
                  "absolute right-3 bottom-2.5 p-1.5 rounded-full transition-colors",
                  showEmojiPicker ? "text-blue-500 bg-blue-50 dark:bg-blue-500/10" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <Smile size={22} className="stroke-[2.5px]" />
              </button>
            </div>
            
            <AnimatePresence>
              {newMessage.trim() ? (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.5, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.5, x: 20 }}
                  type="submit"
                  className={cn("absolute right-2 bottom-2 w-9 h-9 rounded-full text-white flex items-center justify-center shadow-md active:scale-90 transition-all shrink-0 z-10", currentTheme.bg)}
                >
                  <ArrowLeft size={18} className="rotate-90 stroke-[3px]" />
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>
        </form>
      </footer>
      )}
    </div>
  )
}
