import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

export default function PosterSlider() {
  const [posters, setPosters] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db, 'posters'), 
      orderBy('order', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const activePosters = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((p: any) => p.isActive === true);
      setPosters(activePosters);
    }, (err) => {
      console.error('PosterSlider lookup failed:', err);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (posters.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % posters.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [posters.length]);

  if (posters.length === 0) return null;

  const handlePosterClick = (poster: any) => {
    if (poster.link) {
      if (poster.link.startsWith('http')) {
        window.open(poster.link, '_blank');
      } else {
        navigate(poster.link);
      }
    }
  };

  return (
    <div className="relative w-[85%] mx-auto aspect-[16/6] overflow-hidden rounded-2xl shadow-xl shadow-black/5 bg-gray-100 border border-white hardware-accelerated">
      <AnimatePresence initial={false}>
        <motion.div
          key={posters[currentIndex]?.id}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ 
            duration: 0.6, 
            ease: [0.32, 0.72, 0, 1],
            opacity: { duration: 0.4 } 
          }}
          className="absolute inset-0 cursor-pointer"
          onClick={() => handlePosterClick(posters[currentIndex])}
        >
          <img 
            src={posters[currentIndex].imageUrl} 
            alt={posters[currentIndex].title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          {posters[currentIndex].title && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-5">
              <h3 className="text-white font-display font-black text-lg tracking-tight leading-tight">
                {posters[currentIndex].title}
              </h3>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {posters.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
              idx === currentIndex ? 'bg-white w-4' : 'bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
