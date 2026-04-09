"use client";

import { motion } from "framer-motion";

export default function Orbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <motion.div 
        animate={{
          x: [-20, 20, -20],
          y: [-20, 20, -20],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear"
        }}
        className="orb w-[600px] h-[600px] bg-blue-500/30 dark:bg-blue-700/20 top-[-200px] left-[-200px] blur-[120px]" 
      />
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
        className="orb w-[500px] h-[500px] bg-indigo-500/20 dark:bg-violet-700/20 bottom-[-150px] right-[-150px] blur-[120px]" 
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
        className="orb w-[400px] h-[400px] bg-emerald-500/20 dark:bg-emerald-700/10 top-[30%] left-[40%] blur-[120px]" 
      />
    </div>
  );
}
