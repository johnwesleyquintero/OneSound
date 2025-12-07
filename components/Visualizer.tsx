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
  color = '#8b5cf6', // Default to wes-purple
  barCount = 128
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
      // Handle canvas resizing logic
      if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
      }

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
        
        // We focus on the lower-mid frequencies for better visual energy
        const bufferLength = dataArray.length;
        // Use a subset of data to avoid high-end fizz
        const usefulDataSize = Math.floor(bufferLength * 0.7);
        const barWidth = width / barCount;

        // Create Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.4, color);
        gradient.addColorStop(0.5, '#ffffff'); // Center bright line
        gradient.addColorStop(0.6, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = gradient;

        for (let i = 0; i < barCount; i++) {
            // Map bar index to frequency index (logarithmic-ish mapping usually looks better, but linear is fine for this style)
            const dataIndex = Math.floor((i / barCount) * usefulDataSize);
            const value = dataArray[dataIndex];
            
            // Scaling logic for aesthetics
            const percent = value / 255;
            const barHeight = (height * 0.8) * percent; 
            
            // X position
            const x = i * barWidth;
            
            // Draw Mirrored Bar
            // Top half
            // ctx.fillRect(x, centerY - barHeight / 2, barWidth - 2, barHeight);
            
            // Improved Rounded Bar look
            if (barHeight > 2) {
                ctx.globalAlpha = 0.8 + (percent * 0.2);
                ctx.beginPath();
                // Draw a symmetric pill shape centered vertically
                const radius = (barWidth - 1) / 2;
                ctx.roundRect(x, centerY - (barHeight / 2), barWidth - 1, barHeight, radius);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            } else {
                // Center line when quiet
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(x, centerY - 1, barWidth - 1, 2);
                ctx.fillStyle = gradient; // Reset
            }
        }
      } else {
        // Resting state: A subtle pulsing line
        ctx.beginPath();
        ctx.strokeStyle = '#262626';
        ctx.lineWidth = 2;
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
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