import React from 'react';
import { motion, useAnimation } from 'framer-motion';

interface JigglyButtonProps {
  text: string;
  backgroundColor: string;
  textColor: string;
  onTap: () => void;
  className?: string;
}

export const JigglyButton: React.FC<JigglyButtonProps> = ({ 
  text, 
  backgroundColor, 
  textColor, 
  onTap,
  className = ""
}) => {
  const controls = useAnimation();

  const handleTap = () => {
    controls.start({
      scale: [1, 0.85, 1.05, 0.95, 1],
      transition: { duration: 0.4, type: "spring" }
    });
    onTap();
  };

  return (
    <motion.button
      animate={controls}
      whileTap={{ scale: 0.9 }}
      onClick={handleTap}
      className={`rounded-[25px] shadow-sm flex items-center justify-center select-none outline-none ${className}`}
      style={{ 
        backgroundColor: backgroundColor,
        color: textColor,
        boxShadow: `0 4px 12px ${backgroundColor}66` // Add transparency to shadow color
      }}
    >
      <span className="text-2xl font-bold">{text}</span>
    </motion.button>
  );
};