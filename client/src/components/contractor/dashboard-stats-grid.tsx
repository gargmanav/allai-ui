import { ReactNode } from "react";

interface DashboardStatsGridProps {
  children: ReactNode;
}

export function DashboardStatsGrid({ children }: DashboardStatsGridProps) {
  return (
    <div 
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {children}
    </div>
  );
}
