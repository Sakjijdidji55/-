import React, { useState, useEffect, useRef } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export const Typewriter: React.FC<TypewriterProps> = ({ text, speed = 20, onComplete }) => {
  const [displayLength, setDisplayLength] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Reset when text changes
  useEffect(() => {
    setDisplayLength(0);
    if (timerRef.current) clearInterval(timerRef.current);

    const startTime = Date.now();
    
    timerRef.current = window.setInterval(() => {
      setDisplayLength((prev) => {
        if (prev < text.length) {
          return prev + 1;
        } else {
          if (timerRef.current) clearInterval(timerRef.current);
          if (onComplete) onComplete();
          return prev;
        }
      });
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, speed, onComplete]);

  return <span>{text.substring(0, displayLength)}</span>;
};