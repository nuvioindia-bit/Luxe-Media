import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Facebook, Instagram, Users, TrendingUp, BarChart3, MessageSquare, Heart, Share2, ArrowUpRight, Lock } from 'lucide-react';
import { auth } from '../lib/firebase';
import { isAdminEmail } from '../constants';

interface FBData {
  name: string;
  fan_count: number;
  followers_count: number;
  category: string;
  picture?: { data: { url: string } };
}

interface IGData {
  username: string;
  name: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  profile_picture_url: string;
}

const MetaInsights: React.FC = () => {
  const [fbData, setFbData] = useState<FBData | null>(null);
  const [igData, setIgData] = useState<IGData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const isAdmin = isAdminEmail(auth.currentUser?.email);
    setIsAuthorized(isAdmin);

    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [fbRes, igRes] = await Promise.all([
          fetch('/api/meta/facebook/page'),
          fetch('/api/meta/instagram/profile')
        ]);

        if (!fbRes.ok || !igRes.ok) throw new Error('Failed to fetch Meta data');

        const [fb, ig] = await Promise.all([fbRes.json(), igRes.json()]);
        setFbData(fb);
        setIgData(ig);
      } catch (err) {
        console.error(err);
        setError('Error connecting to Meta API. Check your tokens and backend configuration.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-neutral-400" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Feature Coming Soon</h1>
        <p className="text-neutral-500 max-w-sm">Social insights are currently in private beta and will be available for all users soon.</p>
        <button 
          onClick={() => window.history.back()}
          className="mt-8 px-6 py-2 bg-neutral-900 text-white rounded-xl font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-neutral-50 pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 font-sans">Social Command Center</h1>
        <p className="text-neutral-500 mt-1">Cross-platform insights for Facebook & Instagram</p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-red-700">
          <p className="font-semibold">Connection Error</p>
          <p className="text-sm mt-1">{error}</p>
          <p className="text-xs mt-4 opacity-75">Ensure your Meta App is configured and tokens are valid in the system settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Facebook Section */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-200"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                  <Facebook className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{fbData?.name || 'Facebook Page'}</h2>
                  <p className="text-neutral-500 text-sm">{fbData?.category}</p>
                </div>
              </div>
              <button className="text-blue-600 font-medium text-sm flex items-center gap-1 hover:underline">
                View Page <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                <p className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-1">Fan Count</p>
                <p className="text-2xl font-bold font-mono">{(fbData?.fan_count || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                <p className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-1">Followers</p>
                <p className="text-2xl font-bold font-mono">{(fbData?.followers_count || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-4">
               <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest">Recent Performance</h3>
               {[
                 { label: 'Post Engagement', value: '+12.5%', icon: MessageSquare, color: 'text-blue-600' },
                 { label: 'Page Reach', value: '+4.2%', icon: TrendingUp, color: 'text-green-600' },
                 { label: 'Ad Performance', value: '88/100', icon: BarChart3, color: 'text-purple-600' }
               ].map((item, idx) => (
                 <div key={idx} className="flex items-center justify-between p-4 hover:bg-neutral-50 rounded-xl transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-white shadow-sm ${item.color}`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-neutral-700">{item.label}</span>
                    </div>
                    <span className={`font-bold ${item.color}`}>{item.value}</span>
                 </div>
               ))}
            </div>
          </motion.div>

          {/* Instagram Section */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-200"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 rounded-2xl flex items-center justify-center text-white">
                  <Instagram className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">@{igData?.username || 'Instagram'}</h2>
                  <p className="text-neutral-500 text-sm overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">{igData?.name}</p>
                </div>
              </div>
              <button className="text-purple-600 font-medium text-sm flex items-center gap-1 hover:underline">
                View Profile <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 text-center">
                <p className="text-2xl font-bold font-mono">{(igData?.media_count || 0).toLocaleString()}</p>
                <p className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">Posts</p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 text-center">
                <p className="text-2xl font-bold font-mono">{(igData?.followers_count || 0).toLocaleString()}</p>
                <p className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">Followers</p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 text-center">
                <p className="text-2xl font-bold font-mono">{(igData?.follows_count || 0).toLocaleString()}</p>
                <p className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">Following</p>
              </div>
            </div>

            <div className="space-y-4">
               <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest">Growth Metrics</h3>
               {[
                 { label: 'Like Ratio', value: '4.8%', icon: Heart, color: 'text-red-500' },
                 { label: 'Save Rate', value: '2.1%', icon: Share2, color: 'text-blue-500' }
               ].map((item, idx) => (
                 <div key={idx} className="flex items-center justify-between p-4 hover:bg-neutral-50 rounded-xl transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-white shadow-sm ${item.color}`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-neutral-700">{item.label}</span>
                    </div>
                    <span className={`font-bold ${item.color}`}>{item.value}</span>
                 </div>
               ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Global Activity Feed Placeholder */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold font-sans">Unified Content Stream</h2>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-neutral-200 rounded-full text-xs font-semibold">Live Updates</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {[1,2,3].map(i => (
             <div key={i} className="bg-white p-4 rounded-2xl border border-neutral-200 animate-pulse">
                <div className="w-full aspect-square bg-neutral-100 rounded-xl mb-4"></div>
                <div className="h-4 bg-neutral-100 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-neutral-100 rounded w-1/2"></div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};

export default MetaInsights;
