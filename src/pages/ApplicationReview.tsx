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
  Info,
  Trash2
} from 'lucide-react';
import { doc, getDoc, collection, updateDoc, addDoc, serverTimestamp, runTransaction, deleteDoc } from 'firebase/firestore';
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
      const path = `applications/${app.id}`;
      await updateDoc(doc(db, path), { status, updatedAt: serverTimestamp() });
      
      // Notify Creator
      await addDoc(collection(db, 'notifications'), {
        recipientId: app.creatorId,
        type: 'application_status',
        title: status === 'accepted' ? 'Badhai ho! 🎉' : 'Application Update',
        message: status === 'accepted' 
          ? `Badhai ho! Aapka application approved ho gaya hai. Ab aap content submit kar sakte hain.`
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
    <div className="min-h-screen bg-[#F2F2F7] pb-24">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-sm font-black tracking-tight">Review Application</h1>
          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-[200px]">For: {app.title}</p>
        </div>
      </header>

      <main className="max-w-md mx-auto p-3 space-y-4 mt-2">
        {/* Profile Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 text-center relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border-2 border-white shadow-lg">
               <User className="w-7 h-7 text-indigo-500" />
            </div>
            <h2 className="text-lg font-black text-gray-900 leading-tight">{details.name || app.creatorEmail}</h2>
            <div className="flex items-center justify-center gap-1.5 mt-1.5">
               <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md uppercase tracking-widest">{details.contentCategory || 'Creator'}</span>
               <div className="flex items-center gap-1 text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                  <MapPin className="w-2.5 h-2.5" /> {details.location || 'Unknown'}
               </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                 <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
                    <Instagram className="w-3.5 h-3.5" />
                 </div>
                 <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Reach</span>
              </div>
              <p className="text-base font-black text-gray-900">{details.followers || 'N/A'}</p>
              <p className="text-[8px] font-bold text-gray-400">On {details.platform}</p>
           </div>
           <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                 <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                    <Clock className="w-3.5 h-3.5" />
                 </div>
                 <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Age</span>
              </div>
              <p className="text-base font-black text-gray-900">{details.age || 'N/A'}</p>
              <p className="text-[8px] font-bold text-gray-400">Years Old</p>
           </div>
        </div>

        {/* Social Link */}
        {details.socialLink && (
           <a 
            href={details.socialLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full bg-slate-900 hover:bg-black p-4 rounded-2xl flex items-center justify-between text-white shadow-lg active:scale-[0.98] transition-all"
           >
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                   {details.platform === 'YouTube' ? <Youtube className="w-4 h-4" /> : <Instagram className="w-4 h-4" />}
                </div>
                <div>
                   <h4 className="text-[10px] font-black uppercase tracking-widest">Visit Profile</h4>
                   <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">Live Link</p>
                </div>
             </div>
             <ExternalLink className="w-4 h-4 opacity-50" />
           </a>
        )}

        {/* Requirements Review */}
        <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
           <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-900">Application Meta</h3>
           </div>
           
           <div className="space-y-2">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                 <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Category</p>
                 <p className="text-[11px] font-black text-gray-900">{details.contentCategory || 'N/A'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                 <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Application Date</p>
                 <p className="text-[11px] font-black text-gray-900">
                    {app.createdAt?.seconds ? new Date(app.createdAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                 </p>
              </div>
           </div>
        </section>

        {/* Content Proof if exists */}
        {app.submissionLink && (
            <section className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Submission Proof</h3>
                </div>
                <a 
                    href={app.submissionLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between w-full p-3 bg-white rounded-xl border border-emerald-100 text-emerald-600 font-black text-[11px]"
                >
                    View Submitted Work
                    <ExternalLink className="w-3.5 h-3.5" />
                </a>
            </section>
        )}
      </main>

      {/* Action Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-3 bg-white/80 backdrop-blur-xl border-t border-gray-100 flex gap-2 z-50">
          {app.status === 'pending' ? (
            <>
              <button 
                  disabled={processing}
                  onClick={() => handleStatusUpdate('rejected')}
                  className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-100 active:scale-95 transition-all"
              >
                  Reject
              </button>
              <button 
                  disabled={processing}
                  onClick={() => handleStatusUpdate('accepted')}
                  className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
              >
                  Approve Talent
              </button>
            </>
          ) : (
            <div className="flex w-full gap-2">
                 <div className={cn(
                    "flex-1 py-3 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest text-center flex items-center justify-center border",
                    app.status === 'accepted' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                 )}>
                    Status: {app.status}
                 </div>
                 {/* Re-action buttons */}
                 <button 
                    disabled={processing}
                    onClick={() => handleStatusUpdate(app.status === 'accepted' ? 'rejected' : 'accepted')}
                    className="aspect-square w-11 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-xl text-gray-400 active:scale-90 transition-all font-bold"
                    title={app.status === 'accepted' ? 'Switch to Reject' : 'Switch to Approve'}
                 >
                    {app.status === 'accepted' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                 </button>
                 <button 
                  disabled={processing}
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to delete this application permanently?')) {
                      setProcessing(true);
                      try {
                        await deleteDoc(doc(db, 'applications', app.id));
                        alert('Application deleted.');
                        navigate(-1);
                      } catch (e) {
                         console.error(e);
                      } finally { setProcessing(false); }
                    }
                  }}
                  className="aspect-square w-11 flex items-center justify-center bg-white border border-red-100 text-red-500 rounded-xl active:scale-90 transition-all hover:bg-red-50"
                  title="Delete Application"
                 >
                    <Trash2 size={16} />
                 </button>
            </div>
          )}
      </footer>
    </div>
  );
}
