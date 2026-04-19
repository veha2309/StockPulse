"use client";
import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";

const Orbs = memo(function Orbs() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile, { passive: true });
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <motion.div 
        animate={{
          x: [-20, 20, -20],
          y: [-20, 20, -20],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: isMobile ? 20 : 10, // Slower on mobile
          repeat: Infinity,
          ease: "linear"
        }}
        className="orb w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] bg-blue-500/20 dark:bg-blue-700/15 top-[-100px] sm:top-[-200px] left-[-100px] sm:left-[-200px] blur-[60px] sm:blur-[100px] will-change-transform" 
      />
      
      {!isMobile && (
        <>
          <motion.div 
            animate={{
              x: [20, -20, 20],
              y: [20, -20, 20],
              scale: [1.1, 1, 1.1],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "linear"
            }}
            className="orb w-[500px] h-[500px] bg-indigo-500/20 dark:bg-violet-700/20 bottom-[-150px] right-[-150px] blur-[100px] will-change-transform" 
          />
          <motion.div 
            animate={{
              x: [-30, 30, -30],
              y: [30, -30, 30],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "linear"
            }}
            className="orb w-[400px] h-[400px] bg-emerald-500/20 dark:bg-emerald-700/10 top-[30%] left-[40%] blur-[100px] will-change-transform" 
          />
        </>
      )}
    </div>
  );
});

export default Orbs;


