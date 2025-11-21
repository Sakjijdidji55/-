import React, { useState, useEffect, useRef } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export const Typewriter: React.FC<TypewriterProps> = ({ text, speed = 20, onComplete }) => {
  const [displayLength, setDisplayLength] = useState(0);
  const timerRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Keep ref synced with latest callback
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

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
          // Use the ref to call the callback without triggering effect cleanup
          if (onCompleteRef.current) onCompleteRef.current();
          return prev;
        }
      });
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // Removed onComplete from dependencies to prevent restart on parent re-render
  }, [text, speed]); 

  return <span>{text.substring(0, displayLength)}</span>;
};