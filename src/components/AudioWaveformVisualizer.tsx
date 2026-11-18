import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { computeSeekTimeFromPointer, computeWaveformBars } from '../utils/waveform.ts';

interface AudioWaveformVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  onSeek: (timeSeconds: number) => void;
}

const BAR_COUNT = 44;

export function AudioWaveformVisualizer({
  analyser,
  isPlaying,
  currentTime,
  duration,
  bufferedEnd,
  onSeek,
}: AudioWaveformVisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fftBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const smoothedBarsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0.24));
  const isDraggingRef = useRef(false);

  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const latestRef = useRef({
    analyser,
    isPlaying,
    currentTime,
    duration,
    bufferedEnd,
    hoverRatio,
  });
  latestRef.current = {
    analyser,
    isPlaying,
    currentTime,
    duration,
    bufferedEnd,
    hoverRatio,
  };

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    if (width <= 0 || height <= 0) return;

    const {
      analyser: activeAnalyser,
      isPlaying: playing,
      currentTime: time,
      duration: totalDuration,
      bufferedEnd: buffered,
      hoverRatio: hover,
    } = latestRef.current;

    let freqData: Uint8Array | null = null;
    if (playing && activeAnalyser) {
      if (!fftBufferRef.current || fftBufferRef.current.length !== activeAnalyser.frequencyBinCount) {
        fftBufferRef.current = new Uint8Array(activeAnalyser.frequencyBinCount);
      }
      activeAnalyser.getByteFrequencyData(fftBufferRef.current);
      freqData = fftBufferRef.current;
    }

    const targetBars = computeWaveformBars(freqData, BAR_COUNT, playing);
    const prevBars = smoothedBarsRef.current;
    for (let i = 0; i < BAR_COUNT; i += 1) {
      const target = targetBars[i] ?? 0.2;
      const prev = prevBars[i] ?? target;
      prevBars[i] = prev + (target - prev) * (playing ? 0.36 : 0.25);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const progressRatio =
      totalDuration > 0 ? Math.min(1, Math.max(0, time / totalDuration)) : 0;
    const bufferedRatio =
      totalDuration > 0 ? Math.min(1, Math.max(0, buffered / totalDuration)) : 0;

    const totalBars = BAR_COUNT;
    const gap = Math.max(2, Math.floor(width / (totalBars * 3.2)));
    const barWidth = Math.max(2, (width - gap * (totalBars - 1)) / totalBars);

    const activeGrad = ctx.createLinearGradient(0, 0, width, 0);
    activeGrad.addColorStop(0, '#8B5CF6');
    activeGrad.addColorStop(0.52, '#6366F1');
    activeGrad.addColorStop(1, '#38BDF8');

    for (let i = 0; i < totalBars; i += 1) {
      const barRatio = (i + 0.5) / totalBars;
      const amp = prevBars[i] ?? 0.25;
      const barHeight = Math.max(4, Math.round(amp * (height - 6)));
      const x = i * (barWidth + gap);
      const y = Math.round((height - barHeight) / 2);
      const radius = Math.min(barWidth / 2, 3);

      const isPlayed = progressRatio > 0 && barRatio <= progressRatio;
      const isHoveredAhead =
        hover !== null && barRatio > progressRatio && barRatio <= hover;
      const isBuffered = bufferedRatio > 0 && barRatio <= bufferedRatio;

      if (isPlayed) {
        ctx.fillStyle = activeGrad;
      } else if (isHoveredAhead) {
        ctx.fillStyle = 'rgba(165, 180, 252, 0.55)';
      } else if (isBuffered) {
        ctx.fillStyle = 'rgba(199, 210, 254, 0.24)';
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
      }

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, barWidth, barHeight, radius);
      } else {
        ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();
    }

    // Playhead indicator
    if (totalDuration > 0) {
      const playheadX = Math.min(width - 1, Math.max(1, progressRatio * width));
      ctx.fillStyle = '#E0E7FF';
      ctx.fillRect(playheadX - 1, 2, 2, height - 4);
    }

    // Hover hairline
    if (hover !== null && totalDuration > 0) {
      const hoverX = Math.min(width - 1, Math.max(1, hover * width));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(hoverX, 4, 1, height - 8);
    }

    ctx.restore();
  }, []);

  // Size canvas cleanly to container width with crisp devicePixelRatio
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.max(120, Math.round(rect.width * dpr));
      const targetHeight = Math.round(48 * dpr);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      drawFrame();
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => updateSize());
      ro.observe(container);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [drawFrame]);

  // Animate at 60fps only while actively playing (or redraw on state updates when paused)
  useEffect(() => {
    drawFrame();
    if (!isPlaying) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      const interval = window.setInterval(drawFrame, 180);
      return () => window.clearInterval(interval);
    }

    let rafId = 0;
    const tick = () => {
      drawFrame();
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying, currentTime, duration, bufferedEnd, hoverRatio, analyser, drawFrame]);

  const seekFromEvent = (e: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || duration <= 0) return;
    const rect = container.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverRatio(ratio);
    const targetSeconds = computeSeekTimeFromPointer(e.clientX, rect.left, rect.width, duration);
    onSeek(targetSeconds);
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    seekFromEvent(e);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverRatio(ratio);
    if (isDraggingRef.current && duration > 0) {
      const targetSeconds = computeSeekTimeFromPointer(e.clientX, rect.left, rect.width, duration);
      onSeek(targetSeconds);
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onSeek(Math.min(duration, currentTime + 5));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onSeek(Math.max(0, currentTime - 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSeek(duration);
    }
  };

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label="نمودار موج صوتی و موقعیت پخش"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration > 0 ? duration : 100)}
      aria-valuenow={Math.round(currentTime)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        isDraggingRef.current = false;
        setHoverRatio(null);
      }}
      onKeyDown={handleKeyDown}
      className="relative h-12 w-full select-none rounded-lg focus-visible:outline-2 focus-visible:outline-violet-400 cursor-pointer"
    >
      <canvas
        ref={canvasRef}
        data-testid="audio-waveform-canvas"
        className="block h-12 w-full"
      />
    </div>
  );
}
