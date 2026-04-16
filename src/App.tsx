import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDraw, DrawProps } from './hooks/useDraw';
import { 
  Pencil, Eraser, Undo, Redo, Trash2, Download, 
  Sparkles, Palette, Loader2, Type
} from 'lucide-react';
import { cn } from './lib/utils';
import rough from 'roughjs';
import qrCode from './wechat-channel.jpg';

// Calculate seconds until midnight Pacific Time
function getSecondsUntilPacificMidnight(): number {
  const now = new Date();
  const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const midnight = new Date(pacific);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return Math.floor((midnight.getTime() - pacific.getTime()) / 1000);
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const COLORS = [
  '#000000', '#ef4444', '#f97316', '#eab308', 
  '#22c55e', '#3b82f6', '#a855f7', '#ec4899'
];

const BRUSH_SIZES = [2, 5, 10, 20, 30];

const QUICK_PROMPTS = [
  { icon: '🐶', text: '小狗', prompt: '狗' },
  { icon: '🐱', text: '小猫', prompt: '猫' },
  { icon: '🚗', text: '汽车', prompt: '汽车' },
  { icon: '🍎', text: '苹果', prompt: '苹果' },
  { icon: '🏠', text: '房子', prompt: '房子' },
  { icon: '🚀', text: '火箭', prompt: '火箭' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'word' | 'draw'>('word');
  
  // -- Word Mode State --
  const [sketchPrompt, setSketchPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [thinkingText, setThinkingText] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const wordSvgRef = useRef<SVGSVGElement>(null);

  // -- Draw Mode State --
  const [color, setColor] = useState<string>('#000000');
  const [lineWidth, setLineWidth] = useState<number>(5);
  const [isEraser, setIsEraser] = useState(false);
  const [isGuessing, setIsGuessing] = useState(false);
  const [guessResult, setGuessResult] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // -- Exhausted State --
  const [isExhausted, setIsExhausted] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!isExhausted) return;
    setCountdown(getSecondsUntilPacificMidnight());
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setIsExhausted(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isExhausted]);

  const draw = useCallback(({ ctx, currentPoint, prevPoint }: DrawProps) => {
    const startPoint = prevPoint ?? currentPoint;
    ctx.beginPath();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = isEraser ? '#ffffff' : color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();
  }, [color, lineWidth, isEraser]);

  const { canvasRef, onMouseDown, clear, undo, redo, canUndo, canRedo, saveHistory } = useDraw(draw, color, lineWidth);

  // Resize drawing canvas accurately
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setCanvasSize({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef]);

  // Initialize drawing canvas with white background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [canvasSize, canvasRef]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'my-drawing.png';
    a.click();
  };

  const handleGenerateSketch = async (promptOverride?: string | React.MouseEvent) => {
    const promptToUse = typeof promptOverride === 'string' ? promptOverride : sketchPrompt;
    if (!promptToUse.trim()) return;
    
    setIsGenerating(true);
    setThinkingText("正在构思...");
    
    const svg = wordSvgRef.current;
    if (!svg) {
      setIsGenerating(false);
      return;
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToUse }),
      });

      if (response.status === 429) {
        setIsExhausted(true);
        setThinkingText(null);
        setIsGenerating(false);
        return;
      }
      if (!response.ok) throw new Error('API request failed');
      const result = await response.json();
      if (result.thinking) setThinkingText(result.thinking);

      if (result.steps && Array.isArray(result.steps)) {
        setHasGenerated(true);
        svg.innerHTML = ''; // Clear SVG completely
        const rc = rough.svg(svg);

        // Animate drawing steps
        for (let i = 0; i < result.steps.length; i++) {
          const step = result.steps[i];
          setThinkingText(`${step.description || '...'}`);
          
          let node;
          if (step.type === 'fill') {
            node = rc.path(step.path, {
              stroke: 'none',
              fill: step.color,
              fillStyle: 'solid',
              roughness: 0.5 // Slight roughness for fills
            });
          } else {
            node = rc.path(step.path, {
              stroke: step.color,
              strokeWidth: step.width || 8,
              fill: 'none',
              roughness: 2.5, // Higher roughness for crayon stroke effect
              bowing: 1.5
            });
          }

          svg.appendChild(node);

          const paths = node.querySelectorAll('path');
          let maxDuration = 0;
          paths.forEach(p => {
              if (p.getAttribute('fill') && p.getAttribute('fill') !== 'none') {
                  // This is a fill path (solid)
                  p.style.opacity = '0';
                  // Force layout
                  p.getBoundingClientRect();
                  p.style.transition = `opacity 600ms ease-in`;
                  p.style.opacity = '1';
                  maxDuration = Math.max(maxDuration, 600);
              } else {
                  // This is a stroke path
                  try {
                    const len = p.getTotalLength();
                    p.style.strokeDasharray = `${len}`;
                    p.style.strokeDashoffset = `${len}`;
                    const duration = Math.min(Math.max(len * 2, 400), 1200);
                    p.style.transition = `stroke-dashoffset ${duration}ms ease-out`;
                    p.getBoundingClientRect(); // trigger reflow
                    p.style.strokeDashoffset = '0';
                    maxDuration = Math.max(maxDuration, duration);
                  } catch(e) {
                      // Safari throws if path is hidden or not rendered
                  }
              }
          });
          
          await new Promise(r => setTimeout(r, maxDuration + 100)); // Delay between steps dynamically
        }

        if (promptOverride && typeof promptOverride === 'string') {
          setSketchPrompt(promptOverride);
        }
        setTimeout(() => setThinkingText(null), 1500);
      }
    } catch (error) {
      console.error('Error generating sketch:', error);
      setThinkingText("哎呀，创作过程中断了...");
      setTimeout(() => setThinkingText(null), 2500);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGuess = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsGuessing(true);
    setGuessResult(null);
    
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64Data = dataUrl.split(',')[1];

      const response = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data }),
      });

      if (response.status === 429) {
        setIsExhausted(true);
        setIsGuessing(false);
        return;
      }
      if (!response.ok) throw new Error('API request failed');
      const data = await response.json();
      setGuessResult(data.result);
    } catch (error) {
      console.error('Error guessing:', error);
      setGuessResult('哎呀，AI 没看懂你的灵魂画作，再画点细节吧！');
    } finally {
      setIsGuessing(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#FFFAED] flex flex-col text-[#1D1D1F] overflow-hidden" style={{ fontFamily: "'Nunito', 'Comic Sans MS', 'Chalkboard SE', sans-serif" }}>
      
      {/* Dynamic Content Area (Accounts for Bottom Tab Bar) */}
      <div className="flex-1 relative overflow-hidden mb-[80px]">
        
        {/* ======================= */}
        {/* TAB 1: WORD MODE ("词") */}
        {/* ======================= */}
        <div className={cn(
          "absolute inset-0 flex-col items-center pt-8 px-6 overflow-y-auto w-full max-w-4xl mx-auto",
          activeTab === 'word' ? "flex" : "hidden"
        )}>
          {/* Header Title */}
          <div className="flex items-center gap-2 font-black text-[32px] mb-8 tracking-wider text-[#FF5151] drop-shadow-sm">
            <Sparkles size={32} className="text-[#FFB800]" />
            <span>灵魂画师</span>
          </div>

          <div className="w-full max-w-sm">
            {/* Quick Prompts */}
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {QUICK_PROMPTS.map(p => (
                <button 
                  key={p.text} 
                  onClick={() => handleGenerateSketch(p.prompt)} 
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 bg-white border-2 border-[#FFE0D1] border-b-4 active:border-b-2 active:translate-y-[2px] px-4 py-2 rounded-2xl text-base transition-all whitespace-nowrap disabled:opacity-50 font-bold text-[#FF7A00]"
                >
                  <span className="text-xl">{p.icon}</span>
                  <span>{p.text}</span>
                </button>
              ))}
            </div>

            {/* Input & Generate Button */}
            <div className="flex items-center bg-white rounded-3xl p-3 border-4 border-[#FFE0D1] focus-within:border-[#FFB800] transition-colors w-full mb-8">
              <input
                type="text"
                value={sketchPrompt}
                onChange={(e) => setSketchPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateSketch()}
                placeholder="你想画什么？"
                className="bg-transparent border-none outline-none text-xl flex-1 px-4 py-2 font-bold text-[#5C3A21] placeholder:text-[#D4BBA6]"
              />
              <button
                onClick={() => handleGenerateSketch()}
                disabled={isGenerating || !sketchPrompt.trim()}
                className="flex items-center justify-center bg-[#FF5151] border-b-4 border-[#CC3232] active:border-b-0 active:translate-y-1 text-white w-14 h-14 rounded-2xl disabled:opacity-50 transition-all shadow-md"
                title="生成画作"
              >
                {isGenerating ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
              </button>
            </div>
          </div>

          {/* Result Box */}
          <div className="w-full max-w-[360px] aspect-square bg-white border-4 border-[#FFE0D1] rounded-[40px] shadow-lg relative flex items-center justify-center shrink-0">
            <svg 
              ref={wordSvgRef} 
              viewBox="0 0 500 500" 
              className={cn("w-full h-full p-4 rounded-[40px] absolute inset-0 z-10", !hasGenerated && 'opacity-0')} 
            />
            
            {/* Empty State */}
            {!hasGenerated && !isGenerating && !thinkingText && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-[#D4BBA6] p-6 text-center">
                <Palette size={56} className="mb-4 text-[#FFE0D1]" />
                <p className="text-2xl font-black mb-2 text-[#5C3A21]">你想看什么？</p>
                <p className="text-base font-bold">输入描述或点击上方小图标，<br/>让 AI 画给你看 ✨</p>
              </div>
            )}

            {/* Thinking Overlay */}
            {thinkingText && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-white/95 px-6 py-3 rounded-full shadow-lg border-2 border-[#FFE0D1] flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                <div className="w-3 h-3 bg-[#FFB800] rounded-full animate-bounce" />
                <span className="text-base font-bold text-[#5C3A21] whitespace-nowrap">{thinkingText}</span>
              </div>
            )}
          </div>
        </div>

        {/* ======================= */}
        {/* TAB 2: DRAW MODE ("画") */}
        {/* ======================= */}
        <div className={cn(
          "absolute inset-0 flex-col items-center pt-6 px-4 overflow-y-auto w-full max-w-md mx-auto pb-24",
          activeTab === 'draw' ? "flex" : "hidden"
        )}>
          {/* Top Actions */}
          <div className="w-full flex items-center justify-between mb-4 px-2">
            <div className="font-black text-[22px] text-[#FF5151]">画猜图</div>
            <button 
              onClick={handleGuess}
              disabled={isGuessing || !canUndo}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[15px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed border-b-4 active:border-b-0 active:translate-y-1 shadow-sm",
                canUndo && !isGuessing
                  ? "bg-[#FFB800] border-[#CC9300] text-white"
                  : "bg-white border-[#FFE0D1] text-[#D4BBA6]"
              )}
            >
              {isGuessing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              <span>{isGuessing ? "AI 在看..." : "让 AI 猜"}</span>
            </button>
          </div>

          {/* Drawing Canvas */}
          <div ref={containerRef} className="w-full aspect-square bg-white rounded-[40px] shadow-lg border-4 border-[#FFE0D1] relative overflow-hidden shrink-0">
            
            {/* Draw Mode Empty State */}
            {!canUndo && !guessResult && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-[#D4BBA6] opacity-80 z-0">
                <Pencil size={56} className="mb-4 text-[#FFE0D1]" />
                <p className="text-2xl font-black mb-2 text-[#5C3A21]">拿起画笔吧</p>
                <p className="text-base font-bold">画完后点击右上角的按钮</p>
              </div>
            )}

            {/* AI Guess Result Box */}
            {guessResult && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white/95 px-5 py-4 rounded-3xl shadow-xl border-4 border-[#FFE0D1] animate-in fade-in slide-in-from-top-4 w-[90%] max-w-xs">
                <div className="flex items-start gap-3">
                  <div className="bg-[#FFF0ED] text-[#FF5151] p-2 rounded-2xl flex-shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-sm mb-1 text-[#FF5151]">AI 猜你说：</h4>
                    <p className="text-sm font-bold text-[#5C3A21] leading-relaxed">{guessResult}</p>
                  </div>
                  <button 
                    onClick={() => setGuessResult(null)}
                    className="ml-auto text-[#D4BBA6] hover:text-[#FF7A00] flex-shrink-0 -mt-1 -mr-1 p-1"
                  >
                    &times;
                  </button>
                </div>
              </div>
            )}

            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onMouseDown={onMouseDown}
              onTouchStart={onMouseDown}
              className="touch-none cursor-crosshair absolute inset-0 z-10"
              style={{ backgroundColor: 'transparent' }}
            />
          </div>

          {/* Unified Toolbar */}
          <div className="w-full mt-6 bg-white rounded-[32px] border-4 border-[#FFE0D1] p-4 shadow-lg flex flex-col gap-4">
            {/* Colors */}
            <div className="flex items-center justify-between gap-3 overflow-x-auto hide-scrollbar pb-2 pt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setIsEraser(false); }}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-transform flex-shrink-0 shadow-sm",
                    color === c && !isEraser ? "border-white outline outline-4 outline-[#FFB800] scale-110" : "border-white hover:scale-110"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            
            <div className="w-full h-1 rounded-full bg-[#FFE0D1]" />
            
            {/* Tools & Sizes */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-2">
                <ToolButton icon={<Pencil size={20} />} active={!isEraser} onClick={() => setIsEraser(false)} />
                <ToolButton icon={<Eraser size={20} />} active={isEraser} onClick={() => setIsEraser(true)} />
                <ActionButton icon={<Undo size={20} />} onClick={undo} disabled={!canUndo} />
                <ActionButton icon={<Trash2 size={20} />} onClick={clear} />
              </div>
              
              <div className="w-1 h-8 rounded-full bg-[#FFE0D1]" />
              
              <div className="flex gap-2">
                {[3, 8, 15].map((size) => (
                  <button
                    key={size}
                    onClick={() => setLineWidth(size)}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-2xl transition-all flex-shrink-0 border-b-2 active:border-b-0 active:translate-y-[2px]",
                      lineWidth === size ? "bg-[#FFF0ED] border-[#FF5151]" : "bg-white border-[#FFE0D1] hover:bg-[#FFFFA5]"
                    )}
                  >
                    <div className="bg-[#5C3A21] rounded-full" style={{ width: size + 2, height: size + 2 }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Tab Navigation */}
      <div className="absolute bottom-0 w-full h-[88px] bg-[#FFFFA5] border-t-4 border-[#FFD500] flex items-center justify-evenly z-50 shadow-[0_-8px_24px_rgba(255,165,0,0.15)] pb-safe rounded-t-[32px]">
        <button 
          onClick={() => setActiveTab('word')} 
          className={cn(
            "flex flex-col items-center justify-center w-28 h-20 transition-all rounded-[24px] mt-2",
            activeTab === 'word' ? "bg-white text-[#FF5151] -translate-y-4 shadow-md border-b-4 border-[#FFE0D1]" : "text-[#D4BBA6] hover:text-[#FF7A00]"
          )}
        >
          <Type size={32} strokeWidth={activeTab === 'word' ? 3 : 2.5} />
          <span className="text-[14px] font-black mt-1">词作画</span>
        </button>
        <button 
          onClick={() => setActiveTab('draw')} 
          className={cn(
            "flex flex-col items-center justify-center w-28 h-20 transition-all rounded-[24px] mt-2",
            activeTab === 'draw' ? "bg-white text-[#FF5151] -translate-y-4 shadow-md border-b-4 border-[#FFE0D1]" : "text-[#D4BBA6] hover:text-[#FF7A00]"
          )}
        >
          <Pencil size={32} strokeWidth={activeTab === 'draw' ? 3 : 2.5} />
          <span className="text-[14px] font-black mt-1">画猜图</span>
        </button>
      </div>

      {/* Exhausted Overlay */}
      {isExhausted && (
        <div className="absolute inset-0 z-[100] bg-[#FFFAED]/95 flex items-center justify-center p-6">
          <div className="bg-white rounded-[40px] border-4 border-[#FFE0D1] shadow-2xl p-8 max-w-sm w-full flex flex-col items-center text-center">
            <div className="text-5xl mb-4">😴</div>
            <h2 className="text-2xl font-black text-[#FF5151] mb-2">今日额度已用完</h2>
            <p className="text-base font-bold text-[#5C3A21] mb-4">
              AI 画师累了，明天再来吧！
            </p>
            <div className="bg-[#FFF0ED] rounded-2xl px-6 py-3 mb-6">
              <p className="text-sm font-bold text-[#D4BBA6] mb-1">距离恢复还有</p>
              <p className="text-3xl font-black text-[#FF5151] tracking-wider font-mono">
                {formatCountdown(countdown)}
              </p>
            </div>
            <div className="w-full h-1 rounded-full bg-[#FFE0D1] mb-6" />
            <p className="text-sm font-bold text-[#5C3A21] mb-4">
              关注公众号，获取最新消息
            </p>
            <img src={qrCode} alt="公众号二维码" className="w-48 h-48 rounded-2xl" />
          </div>
        </div>
      )}

    </div>
  );
}

// Subcomponents for cleaner code
function ToolButton({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-11 h-11 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 border-b-2 active:border-b-0 active:translate-y-[2px]",
        active ? "bg-[#FFF0ED] text-[#FF5151] border-[#FF5151]" : "bg-white text-[#D4BBA6] border-[#FFE0D1] hover:text-[#FF7A00]"
      )}
    >
      {icon}
    </button>
  );
}

function ActionButton({ icon, onClick, disabled }: { icon: React.ReactNode, onClick: () => void, disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 border-b-2 active:border-b-0 active:translate-y-[2px] bg-white text-[#D4BBA6] border-[#FFE0D1] hover:text-[#FF7A00] disabled:opacity-50 disabled:active:border-b-2 disabled:active:translate-y-0"
    >
      {icon}
    </button>
  );
}
