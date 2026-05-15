import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Rocket, 
  Target, 
  Zap, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2,
  DollarSign,
  Calendar,
  Image as ImageIcon,
  MapPin,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, auth, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { cn } from '../../lib/utils';
import { isAdminEmail } from '../../constants';

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Meme',
    campaignType: 'Logo',
    platform: 'Instagram',
    budget: '',
    totalBudget: 0,
    cpm: '0',
    timeline: '',
    location: 'Global',
    image: '',
    requirements: '',
    driveLink: ''
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;
    
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > 800) {
            height = Math.round((height * 800) / width);
            width = 800;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const base64Url = canvas.toDataURL('image/jpeg', 0.7);
          setFormData({ ...formData, image: base64Url });
          setUploading(false);
        };
        img.onerror = () => {
            console.error("Image load error");
            setUploading(false);
            alert("Failed to process image.");
        }
      };
      reader.onerror = () => {
          console.error("File read error");
          setUploading(false);
          alert("Failed to read file.");
      }
    } catch (error) {
      console.error("Error uploading campaign image:", error);
      setUploading(false);
    }
  };

  const categories = ['Meme', 'Tech', 'Comedy', 'Sports', 'Vlog'];
  const campaignTypes = ['Logo', 'Music', 'Clippings', 'UGC'];
  const platforms = ['Instagram', 'YouTube', 'Facebook', 'TikTok'];

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = () => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!formData.title.trim()) newErrors.title = "Title is required";
      if (formData.title.length < 5) newErrors.title = "Title must be at least 5 characters";
      if (!formData.image) newErrors.image = "Cover image is required";
    }
    if (step === 2) {
      if (formData.campaignType === 'Logo' || formData.campaignType === 'Clippings') {
        if (!formData.cpm || parseFloat(formData.cpm) <= 0) newErrors.cpm = "Valid CPM required";
      } else {
        if (!formData.cpm || parseFloat(formData.cpm) <= 0) newErrors.cpm = "Per Post Budget required";
      }
      if (!formData.totalBudget || formData.totalBudget <= 0) newErrors.totalBudget = "Valid total budget required";
      if (!formData.timeline.trim()) newErrors.timeline = "Timeline is required";
    }
    if (step === 3) {
      if (!formData.description.trim()) newErrors.description = "Brief description is required";
      if (formData.description.length < 20) newErrors.description = "Brief must be at least 20 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep()) setStep(s => s + 1);
  };
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    if (!validateStep()) return;
    if (!auth.currentUser) return;
    const isAdmin = isAdminEmail(auth.currentUser?.email);
    let isStillLoading = true;
    setLoading(true);
    
    // Safety timeout for the submission process
    const safetyTimeout = setTimeout(() => {
      if (isStillLoading) {
        setLoading(false);
        isStillLoading = false;
        alert("Submission is taking longer than expected. Please check your internet connection.");
      }
    }, 15000);

    try {
      const cleanedFormData = { ...formData };
      
      // Ensure numeric types
      const cpmValue = parseFloat(formData.cpm) || 0;
      const totalBudgetValue = parseFloat(formData.totalBudget as any) || 0;

      const campaignData = {
        title: cleanedFormData.title,
        description: cleanedFormData.description,
        category: cleanedFormData.category,
        campaignType: cleanedFormData.campaignType,
        platform: cleanedFormData.platform,
        budget: (cleanedFormData.campaignType === 'Logo' || cleanedFormData.campaignType === 'Clippings') 
          ? `₹${cpmValue} CPM` 
          : `₹${cpmValue.toLocaleString()} / Post`,
        cpm: cpmValue,
        totalBudget: totalBudgetValue,
        timeline: cleanedFormData.timeline,
        location: cleanedFormData.location,
        image: cleanedFormData.image,
        requirements: cleanedFormData.requirements,
        driveLink: cleanedFormData.driveLink,
        brandId: auth.currentUser.uid,
        brandName: isAdmin ? 'Rexo Administration' : (auth.currentUser.displayName || 'Brand'),
        brandEmail: auth.currentUser?.email,
        createdAt: serverTimestamp(),
        status: isAdmin ? 'active' : 'pending'
      };

      const campaignRef = await addDoc(collection(db, 'campaigns'), campaignData);

      if (!isAdmin) {
        // Notify Admin
        await addDoc(collection(db, 'notifications'), {
          recipientId: 'admin',
          type: 'campaign_post',
          title: 'New Campaign Submission',
          message: `${auth.currentUser.displayName || 'A Brand'} has submitted a new campaign: "${formData.title}"`,
          createdAt: serverTimestamp(),
          referenceId: campaignRef.id,
          read: false
        });
      }

      setStep(4); // Success step
    } catch (error: any) {
      console.error("Campaign Creation Error:", error);
      let displayError = "Failed to create campaign. Please try again.";
      try {
        // We still call this for logging, but we'll handle the UI here
        handleFirestoreError(error, OperationType.WRITE, 'campaigns');
      } catch (err: any) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error?.includes('offline')) {
            displayError = "You appear to be offline. Your campaign will be saved locally and synced when you're back online.";
          } else if (parsed.error?.includes('permission')) {
            displayError = "Access denied. Please ensure you are logged in as a verified Brand account.";
          } else {
            displayError = parsed.error || displayError;
          }
        } catch {
          displayError = err.message || displayError;
        }
      }
      alert(displayError);
    } finally {
      isStillLoading = false;
      clearTimeout(safetyTimeout);
      setLoading(false);
    }
  };

  const ProgressBanner = () => (
    <div className="flex justify-center mb-6">
        <div className="flex items-center gap-3">
            {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center">
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500",
                        step >= i ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-gray-100 text-gray-400"
                    )}>
                        {step > i ? <CheckCircle2 className="w-4 h-4" /> : i}
                    </div>
                    {i < 3 && (
                        <div className={cn(
                            "w-12 h-1 mx-2 rounded-full transition-all duration-500",
                            step > i ? "bg-brand-primary" : "bg-gray-100"
                        )} />
                    )}
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="max-w-[85%] mx-auto pb-20">
      {step < 4 && (
        <div className="flex items-center gap-2 mb-6">
            <button 
                onClick={() => navigate('/dashboard')}
                className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-display font-bold tracking-tight">Post Campaign</h1>
        </div>
      )}

      {step < 4 && <ProgressBanner />}

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="premium-card p-6"
      >
        {step === 1 && (
          <div className="space-y-3">
            <div className="space-y-1 text-center mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-brand-primary mx-auto mb-3">
                    <Rocket className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-display font-bold">Campaign Identity</h2>
                <p className="text-gray-500 text-xs">Define the core mission of your collaboration.</p>
            </div>

            <div className="space-y-2">
                <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400 ml-1">Campaign Title</label>
                    <input 
                        type="text" 
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        className={cn(
                            "w-full bg-gray-50 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all font-medium text-sm",
                            errors.title ? "border-red-300 ring-red-50" : "border-gray-100 focus:ring-brand-primary/20 focus:border-brand-primary"
                        )}
                        placeholder="e.g. Summer 2026 Collection Reveal"
                    />
                    {errors.title && <p className="text-[10px] font-bold text-red-500 mt-1 ml-1">{errors.title}</p>}
                </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400 ml-1">Platform</label>
                    <div className="relative">
                        <select 
                            value={formData.platform}
                            onChange={(e) => setFormData({...formData, platform: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all font-bold text-[11px] appearance-none cursor-pointer"
                        >
                            {platforms.map(plat => (
                                <option key={plat} value={plat}>{plat}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <ChevronRight className="w-3 h-3 rotate-90" />
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400 ml-1">Type</label>
                    <div className="relative">
                        <select 
                            value={formData.campaignType}
                            onChange={(e) => setFormData({...formData, campaignType: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all font-bold text-[11px] appearance-none cursor-pointer"
                        >
                            {campaignTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <ChevronRight className="w-3 h-3 rotate-90" />
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400 ml-1">Category</label>
                    <div className="relative">
                        <select 
                            value={formData.category}
                            onChange={(e) => setFormData({...formData, category: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all font-bold text-[11px] appearance-none cursor-pointer"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <ChevronRight className="w-3 h-3 rotate-90" />
                        </div>
                    </div>
                </div>
            </div>

                <div className="space-y-1 pt-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400 ml-1">Cover Image</label>
                     <div className="relative group">
                        <label className={cn(
                            "flex flex-col items-center justify-center w-full aspect-[21/10] rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden",
                            formData.image ? "border-brand-primary" : "border-gray-100 hover:border-brand-primary/40 bg-gray-50/50"
                        )}>
                            {uploading ? (
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-3 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
                                    <p className="text-[9px] font-bold text-brand-primary animate-pulse uppercase tracking-widest">Optimizing Assets</p>
                                </div>
                            ) : formData.image ? (
                                <img src={formData.image} className="w-full h-full object-cover" alt="Campaign cover" />
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-brand-primary">
                                        <ImageIcon className="w-5 h-5" />
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Select Cover Image</p>
                                </div>
                            )}
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                                disabled={uploading}
                            />
                        </label>
                        {errors.image && <p className="text-[10px] font-bold text-red-500 mt-2 text-center">{errors.image}</p>}
                    </div>
                </div>
            </div>

            <button 
                onClick={nextStep}
                disabled={!formData.title || !formData.image}
                className="premium-button-primary w-full mt-4 py-4 flex items-center justify-center gap-1.5 group"
            >
                Next Step
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
             <div className="space-y-2 text-center mb-10">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-brand-secondary mx-auto mb-4">
                    <Target className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-display font-bold">Logistics & Budget</h2>
                <p className="text-gray-500 text-sm">Be clear about what you are offering and when.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(formData.campaignType === 'Logo' || formData.campaignType === 'Clippings') ? (
                  <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">CPM (Cost Per 1k Views)</label>
                      <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₹</span>
                          <input 
                              type="number" 
                              min="0"
                              step="0.01"
                              value={formData.cpm}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  setFormData({
                                      ...formData, 
                                      cpm: val, 
                                      budget: `₹${val} CPM`
                                  });
                              }}
                              className={cn(
                                  "w-full bg-gray-50 border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 transition-all font-medium text-xs",
                                  errors.cpm ? "border-red-300 ring-red-50" : "border-gray-100 focus:ring-brand-primary/20 focus:border-brand-primary"
                              )}
                              placeholder="e.g. 50"
                          />
                      </div>
                      {errors.cpm && <p className="text-[9px] font-bold text-red-500 mt-1 ml-1">{errors.cpm}</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Per Post Budget (₹)</label>
                      <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₹</span>
                          <input 
                              type="number" 
                              value={formData.cpm} // Reuse cpm field for the numeric value of per-post
                              onChange={(e) => {
                                  const val = e.target.value;
                                  setFormData({
                                      ...formData, 
                                      cpm: val, 
                                      budget: `₹${Number(val).toLocaleString()} / Post`
                                  });
                              }}
                              className={cn(
                                  "w-full bg-gray-50 border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 transition-all font-medium text-xs",
                                  errors.cpm ? "border-red-300 ring-red-50" : "border-gray-100 focus:ring-brand-primary/20 focus:border-brand-primary"
                              )}
                              placeholder="e.g. 1500"
                          />
                      </div>
                      {errors.cpm && <p className="text-[9px] font-bold text-red-500 mt-1 ml-1">{errors.cpm}</p>}
                  </div>
                )}
                
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Total Campaign Budget (₹)</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₹</span>
                        <input 
                            type="number" 
                            value={formData.totalBudget || ''}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                setFormData({...formData, totalBudget: val, budget: `₹${val.toLocaleString()}`});
                            }}
                            className={cn(
                                "w-full bg-gray-50 border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 transition-all font-medium text-xs",
                                errors.totalBudget ? "border-red-300 ring-red-50" : "border-gray-100 focus:ring-brand-primary/20 focus:border-brand-primary"
                            )}
                            placeholder="e.g. 50000"
                        />
                    </div>
                    {errors.totalBudget && <p className="text-[9px] font-bold text-red-500 mt-1 ml-1">{errors.totalBudget}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Timeline</label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                            type="text" 
                            value={formData.timeline}
                            onChange={(e) => setFormData({...formData, timeline: e.target.value})}
                            className={cn(
                                "w-full bg-gray-50 border rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 transition-all font-medium",
                                errors.timeline ? "border-red-300 ring-red-50" : "border-gray-100 focus:ring-brand-primary/20 focus:border-brand-primary"
                            )}
                            placeholder="4 Weeks"
                        />
                    </div>
                    {errors.timeline && <p className="text-[9px] font-bold text-red-500 mt-1 ml-1">{errors.timeline}</p>}
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Location Preference</label>
                    <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                            type="text" 
                            value={formData.location}
                            onChange={(e) => setFormData({...formData, location: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all font-medium"
                            placeholder="USA, Remote, etc."
                        />
                    </div>
                </div>
            </div>

            <div className="flex gap-4 mt-10">
                <button onClick={prevStep} className="premium-button-secondary py-5 px-8">Back</button>
                <button onClick={nextStep} disabled={!formData.totalBudget || !formData.timeline} className="premium-button-primary flex-1 py-5 flex items-center justify-center gap-2 group">
                    Final Details
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2 text-center mb-10">
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-brand-accent mx-auto mb-4">
                    <Zap className="w-8 h-8 fill-brand-accent" />
                </div>
                <h2 className="text-2xl font-display font-bold">Project Brief</h2>
                <p className="text-gray-500 text-sm">Communicate the creative vision to creators.</p>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Description</label>
                <textarea 
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className={cn(
                        "w-full bg-gray-50 border rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 transition-all font-medium resize-none",
                        errors.description ? "border-red-300 ring-red-50" : "border-gray-100 focus:ring-brand-primary/20 focus:border-brand-primary"
                    )}
                    placeholder="Describe the campaign mission, goals, and style..."
                />
                {errors.description && <p className="text-[10px] font-bold text-red-500 mt-1 ml-1">{errors.description}</p>}
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Creator Requirements</label>
                <textarea 
                    rows={3}
                    value={formData.requirements}
                    onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all font-medium resize-none"
                    placeholder="e.g. Minimum 10k followers on Instagram, 5% engagement rate..."
                />
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Asset Links (Google Drive)</label>
                <input 
                    type="url"
                    value={formData.driveLink || ''}
                    onChange={(e) => setFormData({...formData, driveLink: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all font-medium"
                    placeholder="https://drive.google.com/..."
                />
            </div>

            <div className="flex gap-4 mt-10">
                <button onClick={prevStep} className="premium-button-secondary py-5 px-8">Back</button>
                <button 
                  onClick={handleSubmit} 
                  disabled={loading || !formData.description} 
                  className="premium-button-primary flex-1 py-5 flex items-center justify-center gap-2 group"
                >
                    {loading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <><Zap className="w-5 h-5 fill-white" /> Launch Campaign</>
                    )}
                </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="py-20 text-center space-y-6">
            <motion.div 
               initial={{ scale: 0 }}
               animate={{ scale: 1 }}
               className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-green-100"
            >
                <CheckCircle2 className="w-12 h-12 text-green-500" />
            </motion.div>
            <h2 className="text-4xl font-display font-bold tracking-tight uppercase tracking-tighter">Under Review</h2>
            <p className="text-gray-500 max-w-sm mx-auto font-medium">Your campaign has been submitted for administrative verification. Once approved, it will be broadcasted to our elite creator network.</p>
            <div className="flex flex-col gap-3 pt-10">
                <button onClick={() => navigate('/dashboard')} className="premium-button-primary py-5 flex items-center justify-center gap-2">
                    Back to Dashboard
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
