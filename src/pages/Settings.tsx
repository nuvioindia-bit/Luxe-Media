import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Bell, 
  Moon, 
  Sun,
  Shield, 
  FileText, 
  Lock, 
  LogOut, 
  ChevronRight,
  Trash2,
  HelpCircle
} from 'lucide-react';
import { auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

export default function Settings() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'main' | 'account' | 'notifications' | 'terms' | 'privacy' | 'support'>('main');

  const handlePasswordReset = async () => {
    if (!auth.currentUser?.email) return;
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      alert('Password reset email sent. Please check your inbox.');
    } catch (error) {
      console.error(error);
      alert('Failed to send password reset email.');
    }
  };

  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
  };

  const renderAccountSettings = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-bold mb-4 dark:text-white">Account Management</h3>
        <div className="space-y-3">
          <button onClick={handlePasswordReset} className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Lock size={16} />
              </div>
              <span className="font-medium text-sm dark:text-gray-200">Change Password</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>

          <button onClick={() => alert('Account deletion request initiated. Support will contact you shortly.')} className="w-full flex items-center justify-between p-3 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
                <Trash2 size={16} />
              </div>
              <span className="font-medium text-sm text-red-600 dark:text-red-400">Delete Account</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-bold mb-4 dark:text-white">Push Notifications</h3>
        
        <div className="space-y-4">
          {[
            { id: '1', title: 'Campaign Updates', desc: 'When your application is accepted or rejected' },
            { id: '2', title: 'New Messages', desc: 'When you receive a chat message' },
            { id: '3', title: 'Wallet Alerts', desc: 'Withdrawal processing updates' },
            { id: '4', title: 'Rexo Announcements', desc: 'New features and important updates' },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm dark:text-gray-200">{item.title}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-primary"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTermsAndPrivacy = (type: 'terms' | 'privacy') => (
    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 text-sm leading-relaxed dark:text-gray-300 max-h-[70vh] overflow-y-auto no-scrollbar">
        {type === 'terms' ? (
          <>
            <h3 className="text-xl font-black mb-4 dark:text-white text-gray-900 border-b pb-2 dark:border-gray-700">Rexo Terms & Conditions</h3>
            <p className="mb-4 text-gray-500 dark:text-gray-400 font-medium">Last Updated: May 2026</p>
            
            <p className="mb-4">Welcome to Rexo, the elite platform bridging the gap between innovative brands and dynamic digital creators. By accessing or using our application, you agree to comply with and be bound by these comprehensive Terms and Conditions. Please read them carefully to understand your rights, responsibilities, and the mechanics of our platform.</p>
            
            <h4 className="font-bold text-base mb-2 text-gray-900 dark:text-white mt-6">1. Acceptance of Terms</h4>
            <p className="mb-4">By creating an account, browsing campaigns, or submitting applications, you form a legally binding contract with Rexo. If you do not agree to all terms, you may not access our services.</p>
            
            <h4 className="font-bold text-base mb-2 text-gray-900 dark:text-white">2. Platform Functionality</h4>
            <p className="mb-4">Rexo serves as an advanced marketplace. Brands post campaigns outlining required deliverables (e.g., promotional reels, stories, memes, or tech reviews), budget parameters, and deadlines. Creators leverage their profiles, showcasing their niche, audience metrics, and engagement rates, to apply for these campaigns. Rexo facilitates the match, tracks the application status, and manages direct communication seamlessly via our secure Inbox feature.</p>
            
            <h4 className="font-bold text-base mb-2 text-gray-900 dark:text-white">3. User Commitments & Integrity</h4>
            <p className="mb-4"><strong>For Creators:</strong> You commit to delivering authentic, high-quality content that meets the brand's brief strictly within the stipulated timeline. Fraudulent engagement metrics (e.g., purchased followers, bot traffic) will result in immediate account termination.
            <br/><br/><strong>For Brands:</strong> You commit to paying the agreed compensation promptly upon the creator's successful fulfillment of the campaign requirements. Transparent communication and fair evaluation of the creator's work are mandatory.</p>
            
            <h4 className="font-bold text-base mb-2 text-gray-900 dark:text-white">4. Financial Transactions & Payouts</h4>
            <p className="mb-4">Rexo incorporates a secure internal wallet system. Brand payments are held safely until the creator submits the required deliverables and the brand approves them. Once approved, the funds are credited to the creator's Rexo Wallet, from where they can initiate secure withdrawal requests via UPI or Bank Transfer. Rexo may deduct a nominal, transparent service fee from the final payout to maintain our world-class infrastructure.</p>
            
            <h4 className="font-bold text-base mb-2 text-gray-900 dark:text-white">5. Intellectual Property</h4>
            <p className="mb-4">Creators retain ownership of the content they produce, but by participating in a campaign through Rexo, creators grant the respective brand and Rexo a non-exclusive, worldwide, royalty-free license to utilize, share, and promote the generated content across multiple media channels for marketing purposes.</p>
            
            <h4 className="font-bold text-base mb-2 text-gray-900 dark:text-white">6. Enforcements & Terminations</h4>
            <p>Rexo Administration possesses the exclusive right to review interactions and suspend or permanently ban accounts engaging in targeted harassment, spam, hate speech, or breach of these terms. Rexo prioritizes a safe, professional, and elite community environment.</p>
          </>
        ) : (
          <>
            <h3 className="text-xl font-black mb-4 dark:text-white text-gray-900 border-b pb-2 dark:border-gray-700">Rexo Privacy Policy & Data Security</h3>
            <p className="mb-4 text-gray-500 dark:text-gray-400 font-medium">Last Updated: May 2026</p>

            <p className="mb-4">At Rexo, your privacy is not an afterthought—it is the foundational pillar of our platform architecture. We recognize that trust drives the creator economy. This Privacy Policy details the uncompromising measures we employ to keep your data safe, encrypted, and resolutely secure.</p>
            
            <h4 className="font-bold text-base mb-2 text-gray-900 dark:text-white mt-6">1. Unbreakable Security Architecture</h4>
            <p className="mb-4">Rexo is engineered utilizing enterprise-grade Google Cloud and Firebase infrastructure. <br/><br/>
            • <strong>Encryption at Rest & In Transit:</strong> Every single byte of your data—from your profile information to your financial details and direct messages—is protected by 256-bit AES encryption. When data travels between your device and our servers, it is shielded by top-tier TLS/SSL cryptographic protocols.<br/>
            • <strong>Zero-Trust Database Rules:</strong> Our Firestore databases are configured with stringent, attribute-based access control (ABAC). This ensures that nobody, not even other users on the platform, can read or manipulate your private data unless strictly authorized (e.g., a brand viewing your public profile).</p>

            <h4 className="font-bold text-base mb-2 text-gray-900 dark:text-white">2. What Data We Collect & Why</h4>
            <p className="mb-4">We adhere strictly to the principle of <em>Data Minimization</em>. We collect only what is essential:
            <br/>• <strong>Identity Data:</strong> Name, Email, and authentication tokens (via Google OAuth). We do <strong>not</strong> have access to your passwords.
            <br/>• <strong>Profile & Metrics:</strong> Your social media handles, follower counts, niche categories, and portofolio links, to connect you with the right brands.
            <br/>• <strong>Financial Data:</strong> Bank details or UPI IDs for processing withdrawals. This information is cryptographically isolated and never shared publicly.
            <br/>• <strong>Communication Data:</strong> Chat logs inside the Rexo Inbox are stored to facilitate campaign collaboration securely, guarded by explicit read/write permission rules.</p>
            
            <h4 className="font-bold text-base mb-2 text-gray-900 dark:text-white">3. Absolute Commitment against Data Selling</h4>
            <p className="mb-4">Unlike conventional free platforms, <strong>Rexo does not, and will never, sell your personal information, communication metadata, or behavioral analytics to third-party data brokers or advertising agencies.</strong> Your data serves only one purpose: optimizing your experience and earnings on Rexo.</p>

            <h4 className="font-bold text-base mb-2 text-gray-900 dark:text-white">4. Your Absolute Rights & Control</h4>
            <p className="mb-4">You maintain sovereign control over your digital footprint on Rexo.
            <br/>• <strong>Right to Edit:</strong> You can modify your public profile and financial details at any moment.
            <br/>• <strong>Right to Erasure ("Right to be Forgotten"):</strong> Through our Account Settings pane, you can initiate a complete account deletion. Upon request, our automated systems scrub your personally identifiable information (PII) from our active databases, ensuring complete closure.</p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 px-6 pt-6 dark:bg-gray-900 transition-colors">
      <header className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => activeView === 'main' ? navigate(-1) : setActiveView('main')}
          className="w-[42px] h-[42px] rounded-2xl bg-white/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-900 dark:text-white shadow-sm active:scale-90 transition-all shrink-0"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-display font-black tracking-tighter dark:text-white">
          {activeView === 'main' ? 'Settings' : 
           activeView === 'account' ? 'Account' : 
           activeView === 'notifications' ? 'Notifications' : 
           activeView === 'terms' ? 'Terms & Conditions' : 
           activeView === 'privacy' ? 'Privacy Policy' : 'Support'}
        </h1>
      </header>

      {activeView === 'main' ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
            {[
              { id: 'account', icon: User, label: 'Account Settings', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
              { id: 'notifications', icon: Bell, label: 'Notifications', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30' },
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => setActiveView(item.id as any)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <span className="font-bold text-sm dark:text-gray-200">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            ))}

          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 pt-2 mb-1">Legal & Support</h3>
            {[
              { id: 'terms', icon: FileText, label: 'Terms & Conditions', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
              { id: 'privacy', icon: Shield, label: 'Privacy Policy', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30' },
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => setActiveView(item.id as any)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <span className="font-bold text-sm dark:text-gray-200">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            ))}
          </div>

          <button 
            onClick={handleLogout}
            className="w-full bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center gap-2 text-red-500 font-bold active:scale-95 transition-all mt-6"
          >
            <LogOut size={18} /> Logout Instead
          </button>
        </div>
      ) : activeView === 'account' ? (
        renderAccountSettings()
      ) : activeView === 'notifications' ? (
        renderNotificationSettings()
      ) : activeView === 'terms' || activeView === 'privacy' ? (
        renderTermsAndPrivacy(activeView)
      ) : null}
    </div>
  );
}
