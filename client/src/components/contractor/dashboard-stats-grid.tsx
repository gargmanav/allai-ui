import { ReactNode, Children, cloneElement, isValidElement } from "react";

interface DashboardStatsGridProps {
  children: ReactNode;
}

export function DashboardStatsGrid({ children }: DashboardStatsGridProps) {
  const childArray = Children.toArray(children);
  
  return (
    <div 
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        width: '100%',
        boxSizing: 'border-box',
        margin: '-4px'
      }}
    >
      {childArray.map((child, index) => (
        <div
          key={index}
          style={{
            width: 'calc(50% - 8px)',
            margin: '4px',
            boxSizing: 'border-box',
            flexShrink: 0,
            flexGrow: 0,
            minWidth: 0,
            overflow: 'hidden'
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
