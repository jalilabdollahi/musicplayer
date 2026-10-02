import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';
import { VisualizerMode } from '../types/music';

interface VisualizerCanvasProps {
  mode: VisualizerMode;
  height?: number;
  className?: string;
  isPlaying: boolean;
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  mode,
  height = 56,
  className = '',
  isPlaying,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const peaksRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bars = 48;
    if (peaksRef.current.length !== bars) {
      peaksRef.current = new Array(bars).fill(0);
    }

    const render = () => {
      const width = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, width, h);

      const analyser = audioEngine.getAnalyser();

      if (!analyser || !isPlaying) {
        // Subtle ambient idle line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.moveTo(0, h / 2);
        ctx.lineTo(width, h / 2);
        ctx.stroke();
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      if (mode === 'spectrum') {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        const barWidth = Math.max(2, (width / bars) - 2);
        const gradient = ctx.createLinearGradient(0, h, 0, 0);
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
        gradient.addColorStop(0.6, 'rgba(56, 189, 248, 0.8)');
        gradient.addColorStop(1, 'rgba(226, 176, 83, 0.95)');

        for (let i = 0; i < bars; i++) {
          // Logarithmic distribution to emphasize musical frequencies
          const sampleIndex = Math.floor(Math.pow(i / bars, 1.8) * (bufferLength * 0.75));
          const val = dataArray[sampleIndex] || 0;
          const barHeight = Math.max(2, (val / 255) * (h - 4));
          const x = i * (barWidth + 2) + 2;
          const y = h - barHeight;

          // Draw spectrum bar
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, barWidth, barHeight);

          // Peak falloff
          if (val > (peaksRef.current[i] || 0)) {
            peaksRef.current[i] = val;
          } else {
            peaksRef.current[i] = Math.max(0, (peaksRef.current[i] || 0) - 2.5);
          }

          const peakY = h - (peaksRef.current[i] / 255) * (h - 4);
          ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
          ctx.fillRect(x, peakY - 1, barWidth, 1.5);
        }
      } else if (mode === 'waveform') {
        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#38bdf8';
        ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
        ctx.shadowBlur = 6;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * h) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Circular / phase visualizer
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        const centerX = width / 2;
        const centerY = h / 2;
        const radius = Math.min(centerX, centerY) * 0.65;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(226, 176, 83, 0.2)';
        ctx.fill();

        for (let i = 0; i < 32; i++) {
          const angle = (i / 32) * Math.PI * 2;
          const val = dataArray[i * 2] || 0;
          const lineLen = (val / 255) * (radius * 0.6);

          const x1 = centerX + Math.cos(angle) * radius;
          const y1 = centerY + Math.sin(angle) * radius;
          const x2 = centerX + Math.cos(angle) * (radius + lineLen);
          const y2 = centerY + Math.sin(angle) * (radius + lineLen);

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [mode, isPlaying]);

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        width={360}
        height={height}
        className="w-full h-full block"
      />
    </div>
  );
};
