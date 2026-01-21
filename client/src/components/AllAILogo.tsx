interface AllAILogoProps {
  className?: string;
  size?: number;
}

export default function AllAILogo({ className = "", size = 128 }: AllAILogoProps) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <style>
        {`
          @keyframes pyramidRotate3D {
            0% { transform: rotateY(0deg); }
            100% { transform: rotateY(360deg); }
          }
          .pyramid-3d-rotate {
            animation: pyramidRotate3D 4s linear infinite;
            transform-style: preserve-3d;
          }
        `}
      </style>
      <div 
        style={{
          perspective: '500px',
          perspectiveOrigin: 'center center'
        }}
      >
        <svg 
          width={size * 0.45} 
          height={size * 0.38} 
          viewBox="0 0 100 85"
          className="pyramid-3d-rotate"
        >
          <defs>
            <linearGradient id="pyramidLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
            <linearGradient id="pyramidRight" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <polygon points="50,2 20,42 50,32" fill="url(#pyramidLeft)" />
          <polygon points="50,2 80,42 50,32" fill="url(#pyramidRight)" />
          <polygon points="20,42 50,82 50,32" fill="url(#pyramidLeft)" opacity="0.85" />
          <polygon points="80,42 50,82 50,32" fill="url(#pyramidRight)" opacity="0.85" />
          <line x1="50" y1="2" x2="50" y2="32" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          <line x1="50" y1="32" x2="50" y2="82" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        </svg>
      </div>
      <span 
        className="font-semibold text-gray-800 dark:text-gray-200 tracking-wide"
        style={{ 
          fontSize: size * 0.2,
          marginTop: 4
        }}
      >
        AllAI
      </span>
    </div>
  );
}
