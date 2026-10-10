import { useRef, useEffect, useState } from 'react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Eraser, Pencil, Trash2 } from 'lucide-react';

export function Scratchpad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [mode, setMode] = useState<'draw' | 'erase'>('draw');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Make canvas responsive to container
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight - 60; // leave space for toolbar
    }
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
    }
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    if (mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) ctx.closePath();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-background border-l border-[hsl(var(--border))]">
      <div className="flex items-center justify-between p-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.3)]">
        <div className="flex gap-2">
          <Button 
            variant={mode === 'draw' ? 'default' : 'outline'} 
            size="icon" 
            onClick={() => setMode('draw')}
          >
            <Pencil size={16} />
          </Button>
          <Button 
            variant={mode === 'erase' ? 'default' : 'outline'} 
            size="icon" 
            onClick={() => setMode('erase')}
          >
            <Eraser size={16} />
          </Button>
          
          <input 
            type="color" 
            value={color} 
            onChange={(e) => { setColor(e.target.value); setMode('draw'); }}
            className="w-9 h-9 p-1 rounded cursor-pointer border border-[hsl(var(--border))]"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={clearCanvas} className="text-[hsl(var(--destructive))]">
          <Trash2 size={16} />
        </Button>
      </div>
      
      <div className="flex-1 w-full relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair w-full h-full touch-none"
        />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5">
          <span className="text-4xl font-bold uppercase rotate-[-45deg] tracking-[1em]">Scratchpad</span>
        </div>
      </div>
    </div>
  );
}
