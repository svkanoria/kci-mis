"use client";

import { formatIndianNumber } from "@/lib/utils/format";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const RecipientNameCellRenderer = (params: any) => {
  const value = params.value;
  if (!value || typeof value !== "string" || !value.startsWith("[")) {
    return <span title={value}>{value}</span>;
  }

  let items: string[] = [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      items = parsed;
    } else {
      return <span title={value}>{value}</span>;
    }
  } catch (e) {
    return <span title={value}>{value}</span>;
  }

  if (items.length === 0) return null;

  if (items.length === 1) {
    return <span title={items[0]}>{items[0]}</span>;
  }

  const numVisible = 2;
  const displayItems = items.slice(0, numVisible);
  const remainingCount = items.length - numVisible;

  return (
    <div className="flex items-center justify-between h-full w-full pr-1">
      <div className="flex flex-col justify-center gap-0.5 overflow-hidden">
        {displayItems.map((item, index) => (
          <span key={index} className="truncate text-xs" title={item}>
            {item}
          </span>
        ))}
      </div>
      {remainingCount > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium cursor-pointer hover:bg-secondary/80 ml-1 border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              +{remainingCount}
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
              {items.slice(numVisible).map((item, idx) => (
                <div
                  key={idx}
                  className="text-xs py-1.5 px-1 border-b last:border-0 border-border/50"
                >
                  {item}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export const SparklineCellRenderer = (params: any) => {
  if (!params.value) return null;
  const { trend, avg, slope, intercept, isFlipped } = params.value;

  if (!trend || trend.length < 2) return null;

  const width = 140;
  const graphWidth = 105;
  const height = 37;
  const padding = 3;

  let regValues: number[] = [];
  if (typeof slope === "number" && typeof intercept === "number") {
    const y1 = intercept;
    const y2 = slope * (trend.length - 1) + intercept;
    regValues = [y1, y2];
  }

  const max = Math.max(...trend, avg ?? 0, ...regValues);
  const min = Math.min(...trend, avg ?? 0, ...regValues);
  const range = max - min || 1;

  const getX = (i: number, total: number) => {
    const ratio = i / (total - 1);
    const effectiveRatio = isFlipped ? 1 - ratio : ratio;
    return effectiveRatio * (graphWidth - 2 * padding) + padding;
  };

  const points = trend
    .map((val: number, i: number) => {
      const x = getX(i, trend.length);
      const y =
        height - padding - ((val - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(" ");

  const zeroPoints = trend
    .map((val: number, i: number) => {
      if (val !== 0) return null;
      const x = getX(i, trend.length);
      const y =
        height - padding - ((val - min) / range) * (height - 2 * padding);
      return { x, y };
    })
    .filter((p: any) => p !== null);

  const avgY =
    height - padding - ((avg - min) / range) * (height - 2 * padding);

  let regLine = null;
  if (typeof slope === "number" && typeof intercept === "number") {
    const y1Val = intercept;
    const y2Val = slope * (trend.length - 1) + intercept;

    const x1 = isFlipped ? graphWidth - padding : padding;
    const x2 = isFlipped ? padding : graphWidth - padding;

    const y1 =
      height - padding - ((y1Val - min) / range) * (height - 2 * padding);
    const y2 =
      height - padding - ((y2Val - min) / range) * (height - 2 * padding);

    regLine = (
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#10b981"
        strokeWidth="1"
        opacity="0.5"
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-full w-full overflow-hidden">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.5"
        />
        {regLine}
        {zeroPoints.map((p: any, i: number) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill="#ef4444" />
        ))}
        <line
          x1={padding}
          y1={avgY}
          x2={graphWidth - padding}
          y2={avgY}
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="4 2"
          opacity="0.7"
        />
        <text
          x={graphWidth + 4}
          y={8}
          fontSize="8"
          fill="#6b7280"
          textAnchor="start"
        >
          {formatIndianNumber(max)}
        </text>
        <text
          x={graphWidth + 4}
          y={height - 2}
          fontSize="8"
          fill="#6b7280"
          textAnchor="start"
        >
          {formatIndianNumber(min)}
        </text>
      </svg>
    </div>
  );
};

export const BarSparklineCellRenderer = (params: any) => {
  if (!params.value) return null;
  const { trend, avg, isFlipped } = params.value;

  if (!trend || trend.length < 1) return null;

  const width = 140;
  const graphWidth = 100;
  const height = 37;
  const padding = 3;
  const barGap = 2;

  const max = Math.max(...trend, avg ?? 0, 0);
  const min = Math.min(...trend, avg ?? 0, 0);
  const range = max - min || 1;

  const totalBars = trend.length;
  const barWidth = Math.max(
    1,
    (graphWidth - 2 * padding - (totalBars - 1) * barGap) / totalBars,
  );

  const zeroY = height - padding - ((0 - min) / range) * (height - 2 * padding);

  const bars = trend.map((val: number, i: number) => {
    const x = isFlipped
      ? graphWidth - padding - barWidth - i * (barWidth + barGap)
      : padding + i * (barWidth + barGap);

    const valY =
      height - padding - ((val - min) / range) * (height - 2 * padding);

    const barHeight = Math.abs(zeroY - valY);
    const y = Math.min(zeroY, valY);

    const fill = val >= 0 ? "#2563eb" : "#ef4444";

    return (
      <rect
        key={i}
        x={x}
        y={y}
        width={barWidth}
        height={barHeight}
        fill={fill}
        opacity="0.8"
      />
    );
  });

  const avgY =
    height - padding - ((avg - min) / range) * (height - 2 * padding);

  return (
    <div className="flex items-center justify-center h-full w-full overflow-hidden">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {bars}
        <line
          x1={padding}
          y1={avgY}
          x2={graphWidth - padding}
          y2={avgY}
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="4 2"
          opacity="0.7"
        />
        {Math.abs(avgY - zeroY) > 2 && (
          <line
            x1={padding}
            y1={zeroY}
            x2={graphWidth - padding}
            y2={zeroY}
            stroke="#666"
            strokeWidth="0.5"
            opacity="0.5"
          />
        )}
        <text
          x={graphWidth + 4}
          y={8}
          fontSize="9"
          fill="#6b7280"
          textAnchor="start"
        >
          {formatIndianNumber(max)}
        </text>
        <text
          x={graphWidth + 4}
          y={height - 2}
          fontSize="9"
          fill="#6b7280"
          textAnchor="start"
        >
          {formatIndianNumber(min)}
        </text>
      </svg>
    </div>
  );
};
