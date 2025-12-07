import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  color?: string;
  barCount?: number;
}

export const Visualizer: React.FC<VisualizerProps> = ({ 
  analyser, 
  isPlaying, 
  color = '#8b5cf6',
  barCount = 64
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 0);

    const render = () => {
      // Handle canvas resizing
      if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
      }

      const width = canvas.width;
      const height = canvas.height;
      const barWidth = width / barCount;

      ctx.clearRect(0, 0, width, height);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
        
        // We generally want the lower frequencies (bass) to be more visible, 
        // so we step through the data array with a stride.
        const step = Math.floor(dataArray.length / barCount);

        for (let i = 0; i < barCount; i++) {
          const value = dataArray[i * step];
          const percent = value / 255;
          const barHeight = height * percent * 0.8; // Scale factor
          
          const x = i * barWidth;
          const y = height - barHeight;

          // Gradient fill
          const gradient = ctx.createLinearGradient(0, height, 0, y);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, '#60a5fa'); // Light blue tip

          ctx.fillStyle = gradient;
          
          // Rounded bars
          ctx.beginPath();
          ctx.roundRect(x + 2, y, barWidth - 4, barHeight, 4);
          ctx.fill();
        }
      } else {
        // Resting state: a thin line
        ctx.fillStyle = '#262626';
        ctx.fillRect(0, height - 2, width, 2);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isPlaying, color, barCount]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full"
    />
  );
};