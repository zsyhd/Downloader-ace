export function computeIdleWaveformBars(barCount: number): number[] {
  if (barCount <= 0) return [];
  const bars: number[] = [];
  for (let i = 0; i < barCount; i += 1) {
    const t = barCount > 1 ? i / (barCount - 1) : 0.5;
    const wave =
      0.34 +
      0.16 * Math.sin(t * Math.PI * 3.5 + 0.4) +
      0.1 * Math.cos(t * Math.PI * 7.2);
    bars.push(Number(Math.min(0.85, Math.max(0.16, wave)).toFixed(3)));
  }
  return bars;
}

export function computeWaveformBars(
  frequencyData: Uint8Array | null,
  barCount: number,
  isPlaying: boolean
): number[] {
  if (barCount <= 0) return [];
  const idle = computeIdleWaveformBars(barCount);

  if (!isPlaying || !frequencyData || frequencyData.length === 0) {
    return idle;
  }

  let energySum = 0;
  for (let i = 0; i < frequencyData.length; i += 1) {
    energySum += frequencyData[i];
  }
  if (energySum === 0) {
    return idle;
  }

  // Focus on lower ~75% of FFT bins where music & vocals carry meaningful amplitude
  const usableBins = Math.max(barCount, Math.floor(frequencyData.length * 0.75));
  const bars: number[] = [];

  for (let i = 0; i < barCount; i += 1) {
    const startBin = Math.floor((i / barCount) * usableBins);
    const endBin = Math.max(
      startBin + 1,
      Math.floor(((i + 1) / barCount) * usableBins)
    );

    let maxVal = 0;
    let sumVal = 0;
    let count = 0;
    for (let b = startBin; b < endBin && b < frequencyData.length; b += 1) {
      const v = frequencyData[b];
      if (v > maxVal) maxVal = v;
      sumVal += v;
      count += 1;
    }

    const avg = count > 0 ? sumVal / count : 0;
    const blended = (avg * 0.55 + maxVal * 0.45) / 255;
    const normalized = Math.min(1, Math.max(0.14, 0.14 + Math.pow(blended, 0.85) * 0.86));
    bars.push(Number(normalized.toFixed(3)));
  }

  return bars;
}

export function computeSeekTimeFromPointer(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  durationSeconds: number
): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  if (!Number.isFinite(rectWidth) || rectWidth <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, (clientX - rectLeft) / rectWidth));
  return Number((ratio * durationSeconds).toFixed(3));
}
