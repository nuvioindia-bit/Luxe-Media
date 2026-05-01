import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Zap, 
  Search, 
  Target, 
  BarChart3, 
  Lightbulb,
  ArrowRight,
  MoreVertical,
  X
} from 'lucide-react';
import { streamAIPilot } from '../services/gemini';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { useAppConfig } from '../hooks/useAppConfig';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIPilot() {
  const config = useAppConfig();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your **Rexo AI** assistant. How can I help you accelerate your growth today?\n\nI can help with:\n* Optimizing your brand brief\n* Suggesting content ideas for creators\n* Analyzing market trends\n* Talent matching strategy",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    let assistantMessageContent = "";
    const assistantMessageId = (Date.now() + 1).toString();
    
    setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: "",
        timestamp: new Date()
    }]);

    try {
      const stream = streamAIPilot(input);
      
      for await (const chunk of stream) {
        assistantMessageContent += chunk;
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: assistantMessageContent }
            : msg
        ));
      }
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestions = [
    { icon: Lightbulb, text: "Content ideas for a tech brand", color: "text-amber-500" },
    { icon: Target, text: "Best budget for fashion niche", color: "text-indigo-500" },
    { icon: BarChart3, text: "Analyze current creator trends", color: "text-emerald-500" },
    { icon: Search, text: "How to find high-ROI talent", color: "text-rose-500" }
  ];

  if (config.show_ai_pilot === false) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <Bot className="w-20 h-20 text-indigo-100 mb-6" />
        <h1 className="text-3xl font-display font-bold text-gray-900">Rexo AI is Offline</h1>
        <p className="text-gray-500 mt-2">The administrator has temporarily disabled the AI assistant. Please check back later.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] -mx-4 -mt-4 bg-gray-50/30 overflow-hidden relative">
      {/* Header Area */}
      <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-none">Rexo AI</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <MoreVertical className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth hide-scrollbar"
      >
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex gap-3 max-w-[90%]",
                message.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                message.role === 'assistant' ? "bg-indigo-600 text-white" : "bg-white text-gray-400 border border-gray-100"
              )}>
                {message.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              
              <div className={cn(
                "px-4 py-3 rounded-2xl text-[13px] leading-relaxed",
                message.role === 'assistant' 
                  ? "bg-white border border-gray-100 text-gray-800 shadow-sm rounded-tl-none" 
                  : "bg-indigo-600 text-white shadow-md shadow-indigo-100 rounded-tr-none"
              )}>
                <div className="markdown-body">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isTyping && messages[messages.length-1].content === "" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3 max-w-[80%]"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
                <Bot className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl shadow-sm rounded-tl-none">
                <div className="flex gap-1">
                    <span className="w-1 h-1 bg-indigo-200 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-1 bg-indigo-200 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-1 bg-indigo-200 rounded-full animate-bounce" />
                </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Section */}
      <div className="p-4 bg-white border-t border-gray-100 pb-8">
        {messages.length < 3 && (
            <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar -mx-4 px-4">
                {suggestions.map((s, i) => (
                    <button 
                        key={i}
                        onClick={() => setInput(s.text)}
                        className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-left hover:border-indigo-200 transition-all flex items-center gap-2 whitespace-nowrap active:scale-95"
                    >
                        <s.icon className={cn("w-3.5 h-3.5", s.color)} />
                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{s.text}</span>
                    </button>
                ))}
            </div>
        )}

        <div className="relative">
          <input 
            type="text" 
            placeholder="Ask Rexo AI..."
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-100 transition-all text-xs font-bold shadow-inner"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            disabled={isTyping}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-90 shadow-lg shadow-indigo-100"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
