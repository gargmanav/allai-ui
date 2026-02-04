interface SparklineProps {
  data: number[];
  color?: string;
  secondaryData?: number[];
  secondaryColor?: string;
  width?: number;
  height?: number;
  labels?: { primary: string; secondary?: string };
}

export function Sparkline({ 
  data, 
  color = "#3b82f6", 
  secondaryData,
  secondaryColor = "#10b981",
  width = 120, 
  height = 32,
  labels
}: SparklineProps) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data, ...(secondaryData || []), 1);
  const padding = 2;
  const effectiveHeight = height - padding * 2;
  const effectiveWidth = width - padding * 2;

  const getPath = (values: number[]) => {
    const points = values.map((v, i) => {
      const x = padding + (i / (values.length - 1)) * effectiveWidth;
      const y = padding + effectiveHeight - (v / maxVal) * effectiveHeight;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    });
    return points.join(' ');
  };

  return (
    <div className="mt-2">
      <svg width={width} height={height} className="overflow-visible">
        {secondaryData && (
          <path
            d={getPath(secondaryData)}
            fill="none"
            stroke={secondaryColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.7"
          />
        )}
        <path
          d={getPath(data)}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {labels && (
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-gray-500">{labels.primary}</span>
          </div>
          {labels.secondary && secondaryData && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: secondaryColor }} />
              <span className="text-[9px] text-gray-500">{labels.secondary}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
