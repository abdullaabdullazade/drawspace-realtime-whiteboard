'use client';
import { useRef } from 'react';
import { motion } from 'framer-motion';
import { MousePointer2, Pencil, Eraser, Minus, Square, Circle, Type, ImagePlus } from 'lucide-react';

type Tool = 'select' | 'pencil' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'text' | 'image';

interface ToolbarProps {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  color: string;
  onColorChange: (c: string) => void;
  brushSize: 2 | 6 | 12;
  onBrushSizeChange: (s: number) => void;
}

const TOOLS: { id: Tool; icon: React.ReactNode; label: string }[][] = [
  [
    { id: 'select', icon: <MousePointer2 className="w-[18px] h-[18px]" strokeWidth={1.75} />, label: 'Select' },
    { id: 'pencil', icon: <Pencil className="w-[18px] h-[18px]" strokeWidth={1.75} />, label: 'Pencil' },
    { id: 'eraser', icon: <Eraser className="w-[18px] h-[18px]" strokeWidth={1.75} />, label: 'Eraser' },
  ],
  [
    { id: 'line', icon: <Minus className="w-[18px] h-[18px]" strokeWidth={1.75} />, label: 'Line' },
    { id: 'rectangle', icon: <Square className="w-[18px] h-[18px]" strokeWidth={1.75} />, label: 'Rectangle' },
    { id: 'circle', icon: <Circle className="w-[18px] h-[18px]" strokeWidth={1.75} />, label: 'Circle' },
  ],
  [
    { id: 'text', icon: <Type className="w-[18px] h-[18px]" strokeWidth={1.75} />, label: 'Text' },
    { id: 'image', icon: <ImagePlus className="w-[18px] h-[18px]" strokeWidth={1.75} />, label: 'Image' },
  ],
];

const COLORS = ['#111111', '#FF5E6C', '#F4B740', '#1FA463', '#6C5CE7', '#53A7FF', '#EC4899', '#FFFFFF'];
const BRUSH_SIZES: { size: 2 | 6 | 12; dot: number }[] = [
  { size: 2, dot: 4 },
  { size: 6, dot: 8 },
  { size: 12, dot: 12 },
];

export default function Toolbar({ tool, onToolChange, color, onColorChange, brushSize, onBrushSizeChange }: ToolbarProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed left-3 top-[68px] bottom-3 w-14 bg-[var(--card)] border border-[var(--border)] rounded-3xl flex flex-col items-center py-3 gap-1 z-40 overflow-y-auto" style={{ boxShadow: 'var(--shadow-md)' }}>
      {TOOLS.map((group, gi) => (
        <div key={gi} className="flex flex-col items-center gap-1 w-full px-1.5">
          {gi > 0 && <div className="w-7 h-px bg-[var(--border)] my-1" />}
          {group.map(({ id, icon, label }) => (
            <motion.button
              key={id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => onToolChange(id)}
              className={`tooltip w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-150 ${
                tool === id ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
              }`}
              data-tooltip={label}
            >
              {icon}
            </motion.button>
          ))}
        </div>
      ))}

      <div className="w-7 h-px bg-[var(--border)] my-1.5" />

      {/* Colors */}
      <div className="flex flex-col items-center gap-1.5 px-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onColorChange(c)}
            className={`w-5 h-5 rounded-full transition-transform duration-150 ${color === c ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--card)] scale-110' : 'hover:scale-110'}`}
            style={{ backgroundColor: c, border: (c === '#111111' || c === '#FFFFFF') ? '1px solid rgba(16,26,20,0.18)' : undefined }}
            title={c}
          />
        ))}
        <div className="relative">
          <button
            onClick={() => colorInputRef.current?.click()}
            className="w-5 h-5 rounded-full border border-[var(--border-2)] hover:scale-110 transition-transform duration-150"
            style={{ background: 'conic-gradient(from 0deg, #FF5E6C, #F4B740, #24D17E, #53A7FF, #6C5CE7, #FF5E6C)' }}
            title="Custom color"
          />
          <input ref={colorInputRef} type="color" value={color} onChange={(e) => onColorChange(e.target.value)} className="absolute opacity-0 w-0 h-0 pointer-events-none" />
        </div>
      </div>

      <div className="w-7 h-px bg-[var(--border)] my-1.5" />

      {/* Brush sizes */}
      <div className="flex flex-col items-center gap-1.5 px-1.5">
        {BRUSH_SIZES.map(({ size, dot }) => (
          <button
            key={size}
            onClick={() => onBrushSizeChange(size)}
            className={`flex items-center justify-center w-9 h-8 rounded-xl transition-colors duration-150 ${brushSize === size ? 'bg-[var(--primary)]/15' : 'hover:bg-[var(--hover)]'}`}
            title={`${size}px`}
          >
            <div className={`rounded-full transition-all duration-150 ${brushSize === size ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'}`} style={{ width: dot, height: dot }} />
          </button>
        ))}
      </div>
    </div>
  );
}
