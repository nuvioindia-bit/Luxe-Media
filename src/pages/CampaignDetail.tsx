import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Zap, 
  CheckCircle2, 
  Clock, 
  Upload,
  Link as LinkIcon,
  MessageCircle,
  AlertCircle,
  AlertTriangle,
  X,
  Pencil,
  Trash2
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, onSnapshot, runTransaction, deleteDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, getDocFromServerWithRetry } from '../lib/firebase';
import { cn } from '../lib/utils';
import { isAdminEmail } from '../constants';

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [brandApplications, setBrandApplications] = useState<any[]>([]);
  const [submissionLink, setSubmissionLink] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  // Apply Form State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    name: '',
    location: '',
    age: '',
    contentCategory: '',
    followers: '',
    platform: 'Instagram',
    socialLink: ''
  });

  // Edit Form State
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    budget: '',
    timeline: '',
    location: '',
    category: '',
    driveLink: '',
    campaignType: '',
    platform: 'Instagram',
    cpm: '0'
  });

  const handleDelete = async () => {
    if (!campaign || !campaign.id) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'campaigns', campaign.id));
      navigate(role === 'admin' ? '/admin' : '/dashboard/brand');
    } catch (error) {
      setLoading(false);
      handleFirestoreError(error, OperationType.DELETE, 'campaigns');
    }
  };

  const handleEditOpen = () => {
    setEditForm({
      title: campaign.title || '',
      description: campaign.description || '',
      budget: campaign.budget || '',
      timeline: campaign.timeline || '',
      location: campaign.location || '',
      category: campaign.category || '',
      driveLink: campaign.driveLink || '',
      campaignType: campaign.campaignType || 'Logo',
      platform: campaign.platform || 'Instagram',
      cpm: campaign.cpm?.toString() || '0'
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalForm = {
        ...editForm,
        cpm: parseFloat(editForm.cpm)
      };
      await updateDoc(doc(db, 'campaigns', campaign.id), finalForm);
      setCampaign({ ...campaign, ...finalForm });
      setShowEditModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'campaigns');
    }
  };

  useEffect(() => {
    if (!id || !auth.currentUser) return;

    let unsubApps: (() => void) | null = null;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch User Role - Fix for Admin detection
        const isAdminUser = isAdminEmail(auth.currentUser?.email);
        
        let userRole = isAdminUser ? 'admin' : null;
        
        try {
          const userDoc = await getDocFromServerWithRetry(doc(db, 'users', auth.currentUser!.uid));
          if (userDoc.exists() && !userRole) {
            userRole = (userDoc.data() as any)?.role;
          }
        } catch (err: any) {
          console.warn("Failed to fetch user role (offline fallback):", err.message);
        }
        
        setRole(userRole || 'creator');

        // Fetch Campaign
        try {
          const campaignDoc = await getDocFromServerWithRetry(doc(db, 'campaigns', id));
          if (campaignDoc.exists()) {
            const data = campaignDoc.data() as any;
            setCampaign({ id: campaignDoc.id, ...data });
          } else {
            setCampaign(null);
          }
        } catch (err: any) {
          console.warn("Failed to fetch campaign details (offline fallback):", err.message);
          setCampaign(null);
        }

        // Perspective-based fetching
        if (userRole === 'creator') {
          const q = query(
            collection(db, 'applications'),
            where('campaignId', '==', id),
            where('creatorId', '==', auth.currentUser!.uid)
          );
          const appSnapshot = await getDocs(q);
          if (!appSnapshot.empty) {
            setApplication({ id: appSnapshot.docs[0].id, ...appSnapshot.docs[0].data() });
          }
        } else if (userRole === 'brand') {
          // Fetch all applications for this campaign
          const q = query(
            collection(db, 'applications'),
            where('campaignId', '==', id)
          );
          unsubApps = onSnapshot(q, (snapshot) => {
            const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBrandApplications(apps);
          }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'applications');
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `campaigns/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      if (unsubApps) unsubApps();
    };
  }, [id]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !campaign) return;
    setApplying(true);
    const path = 'applications';
    try {
      const docRef = await addDoc(collection(db, path), {
        campaignId: campaign.id,
        creatorId: auth.currentUser.uid,
        creatorEmail: auth.currentUser?.email,
        status: 'pending',
        appliedAt: serverTimestamp(),
        brand: campaign.brandName,
        title: campaign.title,
        budget: campaign.budget,
        brandId: campaign.brandId,
        creatorDetails: applyForm // Add creator details from form
      });

      // Notify Brand
      await addDoc(collection(db, 'notifications'), {
        recipientId: campaign.brandId,
        type: 'application',
        title: 'New Talent Application',
        message: `${applyForm.name || auth.currentUser?.email} has applied to your campaign "${campaign.title}"`,
        createdAt: serverTimestamp(),
        referenceId: docRef.id,
        read: false
      });

      setApplication({ id: docRef.id, status: 'pending', creatorDetails: applyForm });
      setShowApplyModal(false);
      setShowSuccess(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setApplying(false);
    }
  };

  const handleSubmitContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!application || !submissionLink) return;
    setSubmitting(true);
    const path = `applications/${application.id}`;
    try {
      await updateDoc(doc(db, path), {
        submissionLink,
        status: 'under_review',
        submittedAt: serverTimestamp()
      });

      // Notify Brand
      if (campaign && campaign.brandId) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: campaign.brandId,
          type: 'submission',
          title: 'Content Submitted',
          message: `A creator has submitted content for "${campaign.title}". Please review and release payment.`,
          createdAt: serverTimestamp(),
          referenceId: application.id,
          read: false
        });
      }

      setApplication({ ...application, status: 'under_review', submissionLink });
      setSubmissionLink('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-100 border-t-brand-primary rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading Experience</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-20 text-center">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Campaign not found</h2>
        <button onClick={() => navigate(-1)} className="mt-4 text-brand-primary font-bold">Go Back</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-4">
            <button 
            onClick={() => navigate(-1)}
            className="p-2 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95"
            >
            <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
            <h1 className="text-lg font-display font-bold truncate max-w-[200px]">{campaign.title}</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{campaign.brandName || campaign.brand || 'Brand'}</p>
            </div>
        </div>
        {(role === 'admin' || (role === 'brand' && campaign.brandId === auth.currentUser?.uid)) && (
          <div className="flex gap-2 shrink-0">
             <button onClick={handleEditOpen} className="p-2 bg-white rounded-xl border border-gray-100 shadow-sm text-gray-500 hover:text-brand-primary active:scale-95" title="Edit Campaign">
                <Pencil className="w-4 h-4" />
             </button>
             <button onClick={() => setShowDeleteConfirm(true)} className="p-2 bg-white rounded-xl border border-red-100 shadow-sm text-red-500 hover:bg-red-50 active:scale-95" title="Delete Campaign">
                <Trash2 className="w-4 h-4" />
             </button>
          </div>
        )}
      </header>

      {/* Hero Image */}
      <div className="aspect-[16/9] rounded-[2rem] overflow-hidden shadow-xl relative">
        <img src={campaign.image} alt={campaign.title} className="w-full h-full object-cover" />
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-bold text-brand-primary shadow-lg uppercase tracking-widest">
            {campaign.category}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: DollarSign, label: 'Total Budget', value: campaign.budget, color: 'text-brand-primary', bg: 'bg-blue-50' },
          { 
            icon: (props: any) => (
              <img 
                {...props}
                src="https://i.postimg.cc/DyJxL7mx/file-0000000008cc720b9d91dbcfd5fecf45.png" 
                alt="Logo" 
                className={cn("object-contain", props.className)}
                referrerPolicy="no-referrer"
              />
            ), 
            label: (campaign.campaignType === 'Music' || campaign.campaignType === 'UGC') ? 'Per Post' : 'CPM', 
            value: `₹${campaign.cpm || 0}`, 
            color: 'text-brand-accent', 
            bg: 'bg-white' 
          },
          { icon: Calendar, label: 'Timeline', value: campaign.timeline, color: 'text-amber-500', bg: 'bg-amber-50' },
          { icon: MapPin, label: 'Location', value: campaign.location, color: 'text-green-500', bg: 'bg-green-50' }
        ].map((stat, i) => (
          <div key={i} className="premium-card p-3 flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", stat.bg)}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-900 leading-tight">{stat.value}</div>
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Description */}
      <section className="premium-card p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-brand-primary">Project Overview</h3>
        <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-wrap">
          {campaign.description}
        </p>

        {campaign.driveLink && (
          <div className="mt-6 p-4 bg-gray-50 border border-gray-100 rounded-xl">
             <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <LinkIcon className="w-3 h-3" /> Sample Brief / Assets
             </div>
             <a href={campaign.driveLink} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-primary hover:underline flex items-center w-fit">
                Open in Google Drive
             </a>
          </div>
        )}
      </section>

      {/* Admin View: Campaign Controls */}
      {role === 'admin' && campaign.status === 'pending' && (
        <section className="premium-card p-6 border-amber-100 bg-amber-50/20">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600">Administrative Verification</h3>
          </div>
          <p className="text-[10px] text-gray-500 font-bold uppercase mb-4 leading-relaxed">
            As an administrator, please verify the legitimacy of this campaign before it goes live to our creator network.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={async () => {
                await updateDoc(doc(db, 'campaigns', campaign.id), { status: 'active' });
                // Notify Brand
                await addDoc(collection(db, 'notifications'), {
                  recipientId: campaign.brandId,
                  type: 'status_update',
                  title: 'Campaign Approved!',
                  message: `Your campaign "${campaign.title}" has been approved and is now live.`,
                  createdAt: serverTimestamp(),
                  read: false
                });
                setCampaign({...campaign, status: 'active'});
              }}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100"
            >
              Approve Campaign
            </button>
            <button 
               onClick={async () => {
                await updateDoc(doc(db, 'campaigns', campaign.id), { status: 'rejected' });
                // Notify Brand
                await addDoc(collection(db, 'notifications'), {
                  recipientId: campaign.brandId,
                  type: 'status_update',
                  title: 'Campaign Rejected',
                  message: `Your campaign "${campaign.title}" was not approved. Please review our guidelines.`,
                  createdAt: serverTimestamp(),
                  read: false
                });
                setCampaign({...campaign, status: 'rejected'});
              }}
              className="flex-1 py-3 bg-white border border-red-100 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              Reject
            </button>
          </div>
        </section>
      )}

      {/* Brand View: Applications List */}
      {role === 'brand' && (
        <section className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 px-1">Applicants ({brandApplications.length})</h3>
          <div className="space-y-3">
            {brandApplications.map(app => (
              <div key={app.id} className="premium-card p-4 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center font-bold text-brand-primary shrink-0">
                      {(app.creatorDetails?.name || app.creatorEmail)?.[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">{app.creatorDetails?.name || app.creatorEmail}</div>
                      <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{app.creatorDetails?.contentCategory || 'Creator'}</div>
                    </div>
                  </div>
                  <div className={cn(
                    "text-[8px] font-bold uppercase px-2 py-0.5 rounded-md border shrink-0",
                    app.status === 'pending' ? "bg-amber-50 border-amber-100 text-amber-600" :
                    app.status === 'accepted' ? "bg-green-50 border-green-100 text-green-600" :
                    "bg-gray-50 border-gray-100 text-gray-500"
                  )}>
                    {app.status}
                  </div>
                </div>

                {app.creatorDetails && (
                  <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl mb-2">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Followers</span>
                      <span className="text-[10px] font-bold text-gray-900">{app.creatorDetails.followers} on {app.creatorDetails.platform}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Location</span>
                      <span className="text-[10px] font-bold text-gray-900">{app.creatorDetails.location}</span>
                    </div>
                    {app.creatorDetails.socialLink && (
                        <div className="col-span-2">
                            <a href={app.creatorDetails.socialLink} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1">
                                <LinkIcon className="w-3 h-3" /> View Profile
                            </a>
                        </div>
                    )}
                  </div>
                )}

                {app.submissionLink && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-600">Proof submitted</span>
                    <a 
                      href={app.submissionLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-white bg-blue-600 px-3 py-1 rounded-lg"
                    >
                      View Work
                    </a>
                  </div>
                )}

                {app.status === 'pending' && (
                  <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        await updateDoc(doc(db, 'applications', app.id), { status: 'accepted' });
                        // Notify Creator
                        await addDoc(collection(db, 'notifications'), {
                            recipientId: app.creatorId,
                            type: 'application_status',
                            title: 'Application Accepted!',
                            message: `Congratulations! Your application for "${campaign.title}" was accepted.`,
                            createdAt: serverTimestamp(),
                            referenceId: campaign.id,
                            read: false
                        });
                      }}
                      className="flex-1 py-2 bg-green-500 text-white rounded-lg text-[10px] font-bold"
                    >
                      Accept
                    </button>
                    <button 
                      onClick={async () => {
                        await updateDoc(doc(db, 'applications', app.id), { status: 'rejected' });
                        // Notify Creator
                        await addDoc(collection(db, 'notifications'), {
                            recipientId: app.creatorId,
                            type: 'application_status',
                            title: 'Application Update',
                            message: `Thank you for your interest. Unfortunately, your application for "${campaign.title}" was not selected.`,
                            createdAt: serverTimestamp(),
                            referenceId: campaign.id,
                            read: false
                        });
                      }}
                      className="flex-1 py-2 bg-red-50 text-red-500 border border-red-100 rounded-lg text-[10px] font-bold"
                    >
                      Reject
                    </button>
                  </div>
                )}
                
                 {app.status === 'under_review' && (
                    <button 
                     onClick={async () => {
                       const amountStr = app.budget || '0';
                       const amount = parseInt(amountStr.replace(/[^0-9]/g, '')) || 0;
                       
                       try {
                         await runTransaction(db, async (transaction) => {
                           // 1. Update application status
                           const appRef = doc(db, 'applications', app.id);
                           transaction.update(appRef, { status: 'paid', paidAt: serverTimestamp() });
   
                           // 2. Update creator's wallet
                           const walletPath = `users/${app.creatorId}/wallet/balance`;
                           const walletRef = doc(db, walletPath);
                           const walletSnap = await transaction.get(walletRef);
                           
                           if (!walletSnap.exists()) {
                             transaction.set(walletRef, { 
                               balance: amount, 
                               totalEarned: amount, 
                               updatedAt: serverTimestamp() 
                             });
                           } else {
                             const data = walletSnap.data();
                             transaction.update(walletRef, {
                               balance: (data.balance || 0) + amount,
                               totalEarned: (data.totalEarned || 0) + amount,
                               updatedAt: serverTimestamp()
                             });
                           }
   
                           // 3. Add transaction record
                           const transRef = doc(collection(db, `users/${app.creatorId}/transactions`));
                           transaction.set(transRef, {
                             type: 'credit',
                             amount: amount,
                             title: `Payment for ${app.title}`,
                             brand: app.brand,
                             timestamp: serverTimestamp(),
                             status: 'completed'
                           });
                         });
                       } catch (error) {
                         handleFirestoreError(error, OperationType.UPDATE, `applications/${app.id}`);
                       }
                     }}
                     className="w-full py-2 bg-brand-primary text-white rounded-lg text-[10px] font-bold"
                   >
                     Release Payment
                   </button>
                 )}
              </div>
            ))}
            {brandApplications.length === 0 && (
              <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                <p className="text-gray-400 text-xs">Waiting for creators to join...</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Action Zone for Creators */}
      {role === 'creator' && (
        <section className="sticky bottom-6 left-0 right-0 p-3 bg-white/80 backdrop-blur-2xl border border-white/50 z-40 max-w-lg mx-auto rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] mb-8 mx-4">
        <div className="flex gap-3">
          {!application ? (
            <button 
              onClick={() => setShowApplyModal(true)}
              className="flex-1 bg-brand-primary text-white py-4 rounded-[1.75rem] text-[13px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-primary/20"
            >
              <div className="w-5 h-5 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
                <Zap className="w-3.5 h-3.5 text-brand-accent fill-brand-accent" />
              </div> Join Campaign
            </button>
          ) : (
            <div className="flex-1">
                {application.status === 'pending' && (
                   <div className="flex items-center gap-3 bg-amber-50/50 border border-amber-100 rounded-[1.75rem] p-1 pr-4">
                      <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                         <Clock className="w-5 h-5 animate-spin-slow" />
                      </div>
                      <div className="flex-1">
                         <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest block">Application Pending</span>
                         <span className="text-[8px] font-bold text-amber-600/70 block uppercase tracking-tight">Our team is reviewing your profile</span>
                      </div>
                   </div>
                )}
                {application.status === 'accepted' && (
                    <form onSubmit={handleSubmitContent} className="flex gap-2">
                        <div className="flex-1 relative">
                            <input 
                                type="url"
                                placeholder="Paste proof link (Post/Reel)"
                                className="w-full h-full bg-blue-50/50 border border-blue-100 rounded-[1.75rem] pl-5 pr-4 text-[11px] font-bold text-blue-900 focus:ring-4 focus:ring-blue-500/10 outline-none placeholder:text-blue-300 transition-all"
                                value={submissionLink}
                                onChange={e => setSubmissionLink(e.target.value)}
                                required
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={submitting}
                            className="w-14 h-14 bg-brand-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-primary/20 active:scale-90 transition-all shrink-0"
                        >
                            {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload size={20} />}
                        </button>
                    </form>
                )}
                {application.status === 'under_review' && (
                   <div className="flex items-center gap-3 bg-blue-50/50 border border-blue-100 rounded-[1.75rem] p-1 pr-4">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                         <Clock className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                         <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest block">Under Review</span>
                         <span className="text-[8px] font-bold text-blue-600/70 block uppercase tracking-tight">Release expected within 24h</span>
                      </div>
                   </div>
                )}
                {application.status === 'paid' && (
                   <div className="flex items-center gap-3 bg-emerald-50/50 border border-emerald-100 rounded-[1.75rem] p-1 pr-4">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                         <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                         <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block">Payment Credited</span>
                         <span className="text-[8px] font-bold text-emerald-600/70 block uppercase tracking-tight">Check your Rexo wallet balance</span>
                      </div>
                   </div>
                )}
            </div>
          )}
          <button className="w-14 h-14 bg-gray-50 border border-gray-100 text-gray-400 rounded-full flex items-center justify-center active:scale-90 transition-all shrink-0">
            <MessageCircle size={22} />
          </button>
        </div>
      </section>
      )}
      
    {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-[3rem] p-8 w-full max-w-sm relative shadow-2xl"
          >
            <button 
              onClick={() => setShowApplyModal(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-900 active:scale-90 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-8">
               <div className="w-14 h-14 bg-blue-50 text-brand-primary rounded-[1.5rem] flex items-center justify-center mb-4">
                  <Zap className="fill-brand-primary" />
               </div>
               <h2 className="text-2xl font-black tracking-tight text-gray-900 leading-tight">Apply for<br/>Collaboration</h2>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">{campaign.title}</p>
            </div>

            <form onSubmit={handleApply} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 ml-1 block">Full Identity</label>
                  <input required type="text" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 px-4 text-xs font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" value={applyForm.name} onChange={e => setApplyForm({...applyForm, name: e.target.value})} placeholder="Your Name" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 ml-1 block">Location</label>
                  <input required type="text" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 px-4 text-xs font-bold outline-none" value={applyForm.location} onChange={e => setApplyForm({...applyForm, location: e.target.value})} placeholder="City" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 ml-1 block">Age</label>
                  <input required type="number" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 px-4 text-xs font-bold outline-none" value={applyForm.age} onChange={e => setApplyForm({...applyForm, age: e.target.value})} placeholder="Age" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 ml-1 block">Follower Base</label>
                  <div className="flex gap-2">
                    <input required type="text" className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl py-3.5 px-4 text-xs font-bold outline-none" value={applyForm.followers} onChange={e => setApplyForm({...applyForm, followers: e.target.value})} placeholder="e.g. 50k" />
                    <select required className="bg-gray-50 border border-gray-100 rounded-2xl px-3 text-[10px] font-black uppercase tracking-widest outline-none" value={applyForm.platform} onChange={e => setApplyForm({...applyForm, platform: e.target.value})}>
                        <option>Instagram</option>
                        <option>YouTube</option>
                        <option>X</option>
                    </select>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 ml-1 block">Profile Deep Link</label>
                  <input required type="url" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 px-4 text-xs font-bold outline-none" value={applyForm.socialLink} onChange={e => setApplyForm({...applyForm, socialLink: e.target.value})} placeholder="https://instagram.com/..." />
                </div>
              </div>
              
              <div className="pt-6">
                <button type="submit" disabled={applying} className="w-full bg-[#0A3D91] text-white py-4.5 rounded-[1.75rem] text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/30 active:scale-95 transition-all">
                    {applying ? 'Sending Identity...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <motion.div 
             initial={{ scale: 0.95, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="bg-white rounded-[2rem] p-6 w-full max-w-sm text-center relative"
           >
             <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-4">
                 <AlertTriangle className="w-8 h-8" />
             </div>
             <h2 className="text-xl font-black tracking-tight mb-2">Delete Campaign?</h2>
             <p className="text-gray-500 text-sm mb-6">This action cannot be undone. This will permanently remove the campaign.</p>
             <div className="flex gap-3">
                 <button onClick={() => setShowDeleteConfirm(false)} className="premium-button-secondary flex-1 py-3">Cancel</button>
                 <button onClick={handleDelete} className="bg-red-500 text-white font-bold rounded-2xl flex-1 py-3 hover:bg-red-600 transition-colors">Delete</button>
             </div>
           </motion.div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <motion.div 
             initial={{ scale: 0.95, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="bg-white rounded-[2rem] p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto"
           >
             <button onClick={() => setShowEditModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900">
                <X className="w-6 h-6" />
             </button>
             <h2 className="text-xl font-black tracking-tight mb-6 mt-2">Edit Campaign</h2>
             <form onSubmit={handleEditSubmit} className="space-y-4">
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Title</label>
                    <input required type="text" className="premium-input w-full" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Description</label>
                    <textarea rows={3} required className="premium-input w-full" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                 </div>
                 <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Budget</label>
                        <input required type="text" className="premium-input w-full" value={editForm.budget} onChange={e => setEditForm({...editForm, budget: e.target.value})} />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Timeline</label>
                        <input required type="text" className="premium-input w-full" value={editForm.timeline} onChange={e => setEditForm({...editForm, timeline: e.target.value})} />
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Location</label>
                        <input required type="text" className="premium-input w-full" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} />
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Category</label>
                        <select required className="premium-input w-full appearance-none bg-white font-medium text-sm" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})}>
                            <option value="Meme">Meme</option>
                            <option value="Tech">Tech</option>
                            <option value="Comedy">Comedy</option>
                            <option value="Sports">Sports</option>
                            <option value="Vlog">Vlog</option>
                        </select>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Platform</label>
                        <select required className="premium-input w-full appearance-none bg-white font-medium text-sm" value={editForm.platform} onChange={e => setEditForm({...editForm, platform: e.target.value})}>
                            <option value="Instagram">Instagram</option>
                            <option value="YouTube">YouTube</option>
                            <option value="Facebook">Facebook</option>
                            <option value="TikTok">TikTok</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">
                           {(editForm.campaignType === 'Music' || editForm.campaignType === 'UGC') ? 'Per Post Budget (₹)' : 'CPM (₹/1k views)'}
                        </label>
                        <input required type="number" step="0.01" min="0.01" className="premium-input w-full" value={editForm.cpm} onChange={e => setEditForm({...editForm, cpm: e.target.value})} />
                    </div>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Drive Link (Assets/Brief)</label>
                    <input type="url" className="premium-input w-full" value={editForm.driveLink || ''} onChange={e => setEditForm({...editForm, driveLink: e.target.value})} placeholder="https://drive.google.com/..." />
                 </div>
                 <div className="pt-4 mt-6 border-t border-gray-100">
                    <button type="submit" className="premium-button-primary w-full flex items-center justify-center py-3 text-xs uppercase tracking-widest font-black">
                        Save Changes
                    </button>
                 </div>
             </form>
           </motion.div>
        </div>
      )}

      <div className="h-20" /> {/* Spacer for fixed bottom */}
    </div>
  );
}
