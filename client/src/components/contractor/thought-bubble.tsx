import { Lightbulb } from "lucide-react";
import { ReactNode } from "react";

interface ThoughtBubbleProps {
  children: ReactNode;
  title?: string;
  visible: boolean;
}

export function ThoughtBubble({ children, title = "Quick Insights", visible }: ThoughtBubbleProps) {
  if (!visible) return null;
  
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-50 pointer-events-none">
      <div 
        className="relative animate-in fade-in-0 zoom-in-95 duration-200"
        style={{
          filter: 'drop-shadow(0 8px 24px rgba(99, 102, 241, 0.25)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))',
        }}
      >
        <div 
          className="relative px-4 py-3 min-w-[200px] max-w-[280px]"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.95) 50%, rgba(243,244,255,0.92) 100%)',
            borderRadius: '20px',
            border: '2px solid rgba(255, 255, 255, 0.9)',
            boxShadow: 'inset 0 2px 8px rgba(255, 255, 255, 0.8), inset 0 -2px 8px rgba(99, 102, 241, 0.08)',
          }}
        >
          <div 
            className="absolute inset-0 rounded-[20px]"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 50%)',
              pointerEvents: 'none',
            }}
          />
          
          <div className="relative flex items-center gap-2 mb-2 pb-2 border-b border-indigo-100/50">
            <div 
              className="relative flex items-center justify-center w-6 h-6 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fbbf24 100%)',
                boxShadow: '0 0 12px rgba(251, 191, 36, 0.5), 0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-700" />
              <div 
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                  background: 'radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)',
                }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-700 tracking-tight">{title}</span>
          </div>
          
          <div className="relative text-sm text-gray-600 space-y-1">
            {children}
          </div>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 top-full flex flex-col items-center">
          <div 
            className="w-4 h-4 -mt-2 rotate-45"
            style={{
              background: 'linear-gradient(135deg, rgba(243,244,255,0.92) 0%, rgba(248,250,255,0.95) 100%)',
              border: '2px solid rgba(255, 255, 255, 0.9)',
              borderTop: 'none',
              borderLeft: 'none',
              boxShadow: '2px 2px 4px rgba(99, 102, 241, 0.1)',
            }}
          />
          
          <div className="flex flex-col items-center gap-1 mt-1">
            <div 
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(243,244,255,0.9) 100%)',
                boxShadow: '0 2px 6px rgba(99, 102, 241, 0.2), inset 0 1px 2px rgba(255,255,255,0.8)',
              }}
            />
            <div 
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(243,244,255,0.85) 100%)',
                boxShadow: '0 2px 4px rgba(99, 102, 241, 0.15), inset 0 1px 2px rgba(255,255,255,0.7)',
              }}
            />
            <div 
              className="w-1 h-1 rounded-full"
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(243,244,255,0.8) 100%)',
                boxShadow: '0 1px 3px rgba(99, 102, 241, 0.1)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
