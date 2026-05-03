import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  User, 
  MapPin, 
  Instagram, 
  Youtube, 
  Link as LinkIcon,
  ShieldCheck,
  Clock,
  ExternalLink,
  Info
} from 'lucide-react';
import { doc, getDoc, collection, updateDoc, addDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';

export default function ApplicationReview() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!appId) return;
    const fetchApp = async () => {
      try {
        const snap = await getDoc(doc(db, 'applications', appId));
        if (snap.exists()) {
          setApp({ id: snap.id, ...snap.data() });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `applications/${appId}`);
      } finally {
        setLoading(false);
      }
    };
    fetchApp();
  }, [appId]);

  const handleStatusUpdate = async (status: 'accepted' | 'rejected') => {
    if (!app) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'applications', app.id), { status, updatedAt: serverTimestamp() });
      
      // Notify Creator
      await addDoc(collection(db, 'notifications'), {
        recipientId: app.creatorId,
        type: 'application_status',
        title: status === 'accepted' ? 'Badhai ho! 🎉' : 'Application Update',
        message: status === 'accepted' 
          ? `Badhai ho! Aapka application approve ho gaya hai. Ab aap content submit kar sakte hain.`
          : `Thank you for applying to "${app.title}". Unfortunately, the brand has decided not to move forward at this time.`,
        createdAt: serverTimestamp(),
        referenceId: app.campaignId,
        read: false
      });

      setApp({ ...app, status });
      alert(`Application ${status} successfully.`);
      navigate(-1);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `applications/${app.id}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Application Info</p>
        </div>
    </div>
  );

  if (!app) return (
    <div className="p-10 text-center">
        <h2 className="text-xl font-bold">Application not found</h2>
        <button onClick={() => navigate(-1)} className="mt-4 text-indigo-600 font-bold">Back to Dashboard</button>
    </div>
  );

  const details = app.creatorDetails || {};

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-32">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-4 flex items-center gap-4 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-black tracking-tight">Review Application</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">For Campaign: {app.title}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6 mt-4">
        {/* Profile Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 text-center relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-xl">
               <User className="w-10 h-10 text-indigo-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 leading-tight">{details.name || app.creatorEmail}</h2>
            <div className="flex items-center justify-center gap-2 mt-2">
               <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest">{details.contentCategory || 'Creator'}</span>
               <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <MapPin className="w-3 h-3" /> {details.location || 'Unknown'}
               </div>
            </div>
          </div>
          <div className="absolute top-0 left-0 w-full h-32 bg-indigo-600/5 -skew-y-6 origin-top-left -z-10" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                 <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                    <CheckCircle2 className="w-4 h-4" />
                 </div>
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Followers</span>
              </div>
              <p className="text-xl font-black text-gray-900">{details.followers || 'N/A'}</p>
              <p className="text-[10px] font-bold text-gray-400 mt-1">On {details.platform}</p>
           </div>
           <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                 <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                    <Clock className="w-4 h-4" />
                 </div>
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Age</span>
              </div>
              <p className="text-xl font-black text-gray-900">{details.age || 'N/A'}</p>
              <p className="text-[10px] font-bold text-gray-400 mt-1">Years Old</p>
           </div>
        </div>

        {/* Social Link */}
        {details.socialLink && (
           <a 
            href={details.socialLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full bg-indigo-600 hover:bg-indigo-700 p-6 rounded-[2rem] flex items-center justify-between text-white shadow-xl shadow-indigo-600/20 transition-all group active:scale-[0.98]"
           >
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                   {details.platform === 'YouTube' ? <Youtube className="w-5 h-5" /> : <Instagram className="w-5 h-5" />}
                </div>
                <div>
                   <h4 className="text-sm font-black uppercase tracking-widest">Visit Profile</h4>
                   <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Open in {details.platform}</p>
                </div>
             </div>
             <ExternalLink className="w-6 h-6 opacity-40 group-hover:opacity-100 transition-opacity" />
           </a>
        )}

        {/* Requirements Review */}
        <section className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm">
           <div className="flex items-center gap-3 mb-6">
              <Info className="w-5 h-5 text-indigo-500" />
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Quality Check</h3>
           </div>
           
           <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Creator Category</p>
                 <p className="text-sm font-black text-gray-900">{details.contentCategory || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Proposed Collaboration</p>
                 <p className="text-sm font-black text-gray-900">{app.title}</p>
              </div>
           </div>
        </section>

        {/* Submission Review if active */}
        {app.submissionLink && (
            <section className="bg-emerald-50 rounded-[2rem] p-8 border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-emerald-700">Content Proof Found</h3>
                </div>
                <a 
                    href={app.submissionLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between w-full p-4 bg-white rounded-2xl border border-emerald-100 text-emerald-600 font-bold text-sm"
                >
                    View Final Content
                    <ExternalLink className="w-4 h-4" />
                </a>
            </section>
        )}
      </main>

      {/* Action Footer */}
      {app.status === 'pending' && (
        <footer className="fixed bottom-0 left-0 right-0 p-6 bg-white/70 backdrop-blur-2xl border-t border-gray-100 flex gap-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
            <button 
                disabled={processing}
                onClick={() => handleStatusUpdate('rejected')}
                className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-red-100 active:scale-95 transition-all"
            >
                Reject Application
            </button>
            <button 
                disabled={processing}
                onClick={() => handleStatusUpdate('accepted')}
                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/30 active:scale-95 transition-all"
            >
                Approve Talent
            </button>
        </footer>
      )}

      {app.status !== 'pending' && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
              <div className={cn(
                  "px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest border shadow-xl backdrop-blur-lg",
                  app.status === 'accepted' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-red-500/10 border-red-500/20 text-red-600"
              )}>
                  Application {app.status}
              </div>
          </div>
      )}
    </div>
  );
}
