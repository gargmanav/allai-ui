import { useEffect, useState } from "react";

interface AnimatedPyramidProps {
  size?: number;
  className?: string;
}

export function AnimatedPyramid({ size = 48, className = "" }: AnimatedPyramidProps) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((prev) => (prev + 0.5) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className={className}
      style={{ 
        width: size, 
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'center center'
        }}
      >
        <defs>
          <linearGradient id="pyramidGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        
        <g fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="50" y1="15" x2="20" y2="75" stroke="#22c55e" />
          <line x1="50" y1="15" x2="80" y2="75" stroke="#3b82f6" />
          <line x1="20" y1="75" x2="80" y2="75" stroke="#8b5cf6" />
          
          <line x1="50" y1="15" x2="50" y2="50" stroke="#22c55e" />
          <line x1="20" y1="75" x2="50" y2="50" stroke="#3b82f6" />
          <line x1="80" y1="75" x2="50" y2="50" stroke="#8b5cf6" />
          
          <circle cx="50" cy="15" r="4" fill="#22c55e" />
          <circle cx="20" cy="75" r="4" fill="#22c55e" />
          <circle cx="80" cy="75" r="4" fill="#3b82f6" />
          <circle cx="50" cy="50" r="4" fill="#8b5cf6" />
        </g>
      </svg>
    </div>
  );
}
