/**
 * React bindings for `@trendcraft/chart/sparkline`.
 *
 * @example
 * ```tsx
 * import { Sparkline, SparklineList } from '@trendcraft/chart/react/sparkline';
 *
 * <SparklineList hover>
 *   {tickers.map(t => (
 *     <Sparkline key={t.id} type="line" data={t.closes} width={80} height={30} />
 *   ))}
 * </SparklineList>
 * ```
 */
import {
  type CSSProperties,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type SparklineGroup,
  type SparklineHandle,
  type SparklineOptions,
  createSparkline,
  createSparklineGroup,
} from "../src/sparkline";

export type {
  ColorSpec,
  HoverPayload,
  SparklineCandle,
  SparklineOptions,
} from "../src/sparkline";

type GroupContext = SparklineGroup | null;
const GroupCtx = createContext<GroupContext>(null);

export type SparklineListProps = {
  hover?: boolean | { format?: (d: import("../src/sparkline").HoverPayload) => string };
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
};

export function SparklineList({ hover = true, style, className, children }: SparklineListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [group, setGroup] = useState<SparklineGroup | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: hover changes not re-applied; remount to change.
  useEffect(() => {
    if (!containerRef.current) return;
    const g = createSparklineGroup({ container: containerRef.current, hover });
    setGroup(g);
    return () => {
      g.destroy();
      setGroup(null);
    };
  }, []);

  return (
    <div ref={containerRef} className={className} style={style}>
      <GroupCtx.Provider value={group}>{children}</GroupCtx.Provider>
    </div>
  );
}

export type SparklineProps = SparklineOptions & {
  width?: number;
  height?: number;
  style?: CSSProperties;
  className?: string;
};

export function Sparkline({ width = 80, height = 30, style, className, ...opts }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SparklineHandle | null>(null);
  const group = useContext(GroupCtx);

  // biome-ignore lint/correctness/useExhaustiveDependencies: opts handled by separate update effect below.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (group) {
      handleRef.current = group.add(canvas, opts as SparklineOptions);
    } else {
      handleRef.current = createSparkline(canvas, opts as SparklineOptions);
    }
    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [group]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: granular opts deps; full opts ref would over-trigger.
  useEffect(() => {
    handleRef.current?.update(opts as Partial<SparklineOptions>);
  }, [
    opts.data,
    opts.type,
    opts.fill,
    opts.baseline,
    opts.maxCandles,
    opts.totalSlots,
    opts.color,
    opts.session,
    opts.breakGap,
    opts.densityFallback,
    opts.hover,
    opts.colors,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ width, height, display: "inline-block", ...style }}
    />
  );
}
