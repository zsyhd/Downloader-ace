import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeIdleWaveformBars,
  computeSeekTimeFromPointer,
  computeWaveformBars,
} from './waveform.ts';

test('computeIdleWaveformBars returns deterministic normalized bar heights', () => {
  const bars = computeIdleWaveformBars(32);
  assert.equal(bars.length, 32);
  for (const h of bars) {
    assert.ok(h >= 0.16 && h <= 0.85, `Expected ${h} within [0.16, 0.85]`);
  }
});

test('computeWaveformBars maps active frequency bins into normalized bars when playing', () => {
  const fft = new Uint8Array(128);
  for (let i = 0; i < 64; i += 1) {
    fft[i] = i < 20 ? 220 : 90;
  }

  const playingBars = computeWaveformBars(fft, 24, true);
  assert.equal(playingBars.length, 24);
  assert.ok(playingBars[0] > playingBars[20], 'Low/mid bars should exceed silent high bins');
  for (const h of playingBars) {
    assert.ok(h >= 0.14 && h <= 1);
  }

  const pausedBars = computeWaveformBars(fft, 24, false);
  assert.deepEqual(pausedBars, computeIdleWaveformBars(24));
});

test('computeWaveformBars falls back gracefully when FFT data is empty or silent', () => {
  const silent = new Uint8Array(64);
  assert.deepEqual(computeWaveformBars(silent, 16, true), computeIdleWaveformBars(16));
  assert.deepEqual(computeWaveformBars(null, 16, true), computeIdleWaveformBars(16));
});

test('computeSeekTimeFromPointer clamps pointer coordinates to valid duration bounds', () => {
  assert.equal(computeSeekTimeFromPointer(150, 100, 200, 120), 30);
  assert.equal(computeSeekTimeFromPointer(50, 100, 200, 120), 0);
  assert.equal(computeSeekTimeFromPointer(400, 100, 200, 120), 120);
  assert.equal(computeSeekTimeFromPointer(150, 100, 200, 0), 0);
});
