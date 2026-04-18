import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDraw, DrawProps } from './hooks/useDraw';
import {
  Pencil, Eraser, Undo, Trash2,
  Sparkles, Palette, Loader2, Type, Share2
} from 'lucide-react';
import { cn } from './lib/utils';
import rough from 'roughjs';
import qrCode from './wechat-channel.jpg';
import { svgToPng, canvasToPng, shareImage } from './lib/share';

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
  '#305066', '#db6968', '#0ea8e3', '#f59e0b',
  '#22c55e', '#a855f7', '#ec4899', '#000000'
];

const BRUSH_SIZES = [3, 8, 15];

const PROMPTS_ROW1 = [
  { icon: '🐶', text: '小狗', prompt: '狗' },
  { icon: '🐱', text: '小猫', prompt: '猫' },
  { icon: '🚗', text: '汽车', prompt: '汽车' },
  { icon: '🍎', text: '苹果', prompt: '苹果' },
  { icon: '🏠', text: '房子', prompt: '房子' },
  { icon: '🚀', text: '火箭', prompt: '火箭' },
  { icon: '🌻', text: '向日葵', prompt: '向日葵' },
  { icon: '🐟', text: '小鱼', prompt: '鱼' },
  { icon: '🎂', text: '蛋糕', prompt: '蛋糕' },
  { icon: '⭐', text: '星星', prompt: '星星' },
];

const PROMPTS_ROW2 = [
  { icon: '🦋', text: '蝴蝶', prompt: '蝴蝶' },
  { icon: '🐢', text: '乌龟', prompt: '乌龟' },
  { icon: '🌈', text: '彩虹', prompt: '彩虹' },
  { icon: '🎈', text: '气球', prompt: '气球' },
  { icon: '🐘', text: '大象', prompt: '大象' },
  { icon: '🍕', text: '披萨', prompt: '披萨' },
  { icon: '🚢', text: '轮船', prompt: '轮船' },
  { icon: '🦁', text: '狮子', prompt: '狮子' },
  { icon: '🎸', text: '吉他', prompt: '吉他' },
  { icon: '🐧', text: '企鹅', prompt: '企鹅' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'word' | 'draw'>('word');

  // -- Word Mode State --
  const [sketchPrompt, setSketchPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [thinkingText, setThinkingText] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const wordSvgRef = useRef<SVGSVGElement>(null);
  const generateBtnRef = useRef<HTMLButtonElement>(null);

  // -- Draw Mode State --
  const [color, setColor] = useState<string>('#305066');
  const [lineWidth, setLineWidth] = useState<number>(8);
  const [isEraser, setIsEraser] = useState(false);
  const [isGuessing, setIsGuessing] = useState(false);
  const [guessResult, setGuessResult] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // -- Share State --
  const [isSharing, setIsSharing] = useState(false);

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

  const handleShareWord = async () => {
    const svg = wordSvgRef.current;
    if (!svg) return;
    setIsSharing(true);
    try {
      const blob = await svgToPng(svg);
      await shareImage(blob, `soul-painter-${sketchPrompt || 'art'}.png`, '灵魂画师', `看看AI画的「${sketchPrompt}」`);
    } catch (e) {
      console.error('Share failed:', e);
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareDraw = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSharing(true);
    try {
      const blob = await canvasToPng(canvas);
      await shareImage(blob, 'my-drawing.png', '灵魂画师', '看看我的灵魂画作！');
    } catch (e) {
      console.error('Share failed:', e);
    } finally {
      setIsSharing(false);
    }
  };

  const triggerWiggle = () => {
    const btn = generateBtnRef.current;
    if (!btn) return;
    btn.classList.remove('animate-wiggle');
    void btn.offsetWidth;
    btn.classList.add('animate-wiggle');
  };

  const handleGenerateSketch = async (promptOverride?: string | React.MouseEvent) => {
    const promptToUse = typeof promptOverride === 'string' ? promptOverride : sketchPrompt;
    if (!promptToUse.trim()) return;

    setIsGenerating(true);
    setThinkingText("正在构思...");
    triggerWiggle();

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
        svg.innerHTML = '';
        const rc = rough.svg(svg);

        for (let i = 0; i < result.steps.length; i++) {
          const step = result.steps[i];
          setThinkingText(`${step.description || '...'}`);

          let node;
          if (step.type === 'fill') {
            node = rc.path(step.path, {
              stroke: 'none',
              fill: step.color,
              fillStyle: 'solid',
              roughness: 0.5
            });
          } else {
            node = rc.path(step.path, {
              stroke: step.color,
              strokeWidth: step.width || 8,
              fill: 'none',
              roughness: 2.5,
              bowing: 1.5
            });
          }

          svg.appendChild(node);

          const paths = node.querySelectorAll('path');
          let maxDuration = 0;
          paths.forEach(p => {
              if (p.getAttribute('fill') && p.getAttribute('fill') !== 'none') {
                  p.style.opacity = '0';
                  p.getBoundingClientRect();
                  p.style.transition = `opacity 600ms ease-in`;
                  p.style.opacity = '1';
                  maxDuration = Math.max(maxDuration, 600);
              } else {
                  try {
                    const len = p.getTotalLength();
                    p.style.strokeDasharray = `${len}`;
                    p.style.strokeDashoffset = `${len}`;
                    const duration = Math.min(Math.max(len * 2, 400), 1200);
                    p.style.transition = `stroke-dashoffset ${duration}ms ease-out`;
                    p.getBoundingClientRect();
                    p.style.strokeDashoffset = '0';
                    maxDuration = Math.max(maxDuration, duration);
                  } catch(e) {}
              }
          });

          await new Promise(r => setTimeout(r, maxDuration + 100));
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
    <div className="h-screen w-full bg-[#f2e2c4] bg-dots flex flex-col text-[#305066] overflow-hidden">

      {/* Floating decorative shapes */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-[#0ea8e3]/10 animate-float" />
        <div className="absolute top-1/4 -right-6 w-24 h-24 rounded-full bg-[#db6968]/10 animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 -left-4 w-20 h-20 rounded-full bg-[#f59e0b]/10 animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Content Area */}
      <div className="flex-1 relative overflow-hidden mb-[76px] z-10">

        {/* ======================= */}
        {/* TAB 1: WORD MODE ("词") */}
        {/* ======================= */}
        <div className={cn(
          "absolute inset-0 flex-col items-center pt-6 px-5 overflow-y-auto w-full max-w-md mx-auto",
          activeTab === 'word' ? "flex" : "hidden"
        )}>
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-[#db6968] flex items-center justify-center shadow-md">
              <Sparkles size={22} className="text-white" />
            </div>
            <h1 className="text-[28px] font-black tracking-wide text-[#305066]">灵魂画师</h1>
          </div>

          {/* Quick Prompts Marquee */}
          <div className="w-full mb-5 mask-fade-x overflow-hidden">
            <div className="flex gap-2.5 mb-2.5 w-max animate-marquee-left marquee-row">
              {[...PROMPTS_ROW1, ...PROMPTS_ROW1].map((p, i) => (
                <button
                  key={`r1-${i}`}
                  onClick={() => handleGenerateSketch(p.prompt)}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm border-2 border-[#305066]/15 px-3.5 py-2 rounded-full text-[15px] whitespace-nowrap disabled:opacity-40 font-bold text-[#305066] hover:bg-white hover:border-[#0ea8e3] hover:text-[#0ea8e3] active:scale-95 shadow-sm transition-colors"
                >
                  <span className="text-lg">{p.icon}</span>
                  <span>{p.text}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2.5 w-max animate-marquee-right marquee-row">
              {[...PROMPTS_ROW2, ...PROMPTS_ROW2].map((p, i) => (
                <button
                  key={`r2-${i}`}
                  onClick={() => handleGenerateSketch(p.prompt)}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm border-2 border-[#305066]/15 px-3.5 py-2 rounded-full text-[15px] whitespace-nowrap disabled:opacity-40 font-bold text-[#305066] hover:bg-white hover:border-[#0ea8e3] hover:text-[#0ea8e3] active:scale-95 shadow-sm transition-colors"
                >
                  <span className="text-lg">{p.icon}</span>
                  <span>{p.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input + Generate Button (same row) */}
          <div className="flex items-center gap-2.5 w-full max-w-sm mb-5">
            <div className="flex items-center bg-white/90 backdrop-blur-sm rounded-2xl p-2 border-2 border-[#305066]/15 focus-within:border-[#0ea8e3] transition-colors shadow-sm flex-1">
              <input
                type="text"
                value={sketchPrompt}
                onChange={(e) => setSketchPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateSketch()}
                placeholder="你想画什么？"
                className="bg-transparent border-none outline-none text-lg flex-1 px-3 py-2 font-bold text-[#305066] placeholder:text-[#305066]/30"
              />
            </div>
            <button
              ref={generateBtnRef}
              onClick={() => handleGenerateSketch()}
              disabled={isGenerating || !sketchPrompt.trim()}
              className={cn(
                "relative flex items-center justify-center w-14 h-14 rounded-2xl text-white transition-all shadow-lg shrink-0",
                "disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed",
                "active:scale-90",
                isGenerating
                  ? "bg-[#305066]"
                  : "bg-[#db6968] hover:bg-[#c95756] shadow-[#db6968]/30"
              )}
            >
              {/* Pulse ring when idle & has text */}
              {!isGenerating && sketchPrompt.trim() && (
                <span className="absolute inset-0 rounded-2xl animate-[pulse-ring_2s_ease-out_infinite] pointer-events-none" />
              )}
              {isGenerating ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
            </button>
          </div>

          {/* Result Canvas */}
          <div className="w-full max-w-[340px] aspect-square bg-white/90 backdrop-blur-sm border-2 border-[#305066]/15 rounded-3xl shadow-lg relative flex items-center justify-center shrink-0 mb-6">
            <svg
              ref={wordSvgRef}
              viewBox="0 0 500 500"
              className={cn("w-full h-full p-3 rounded-3xl absolute inset-0 z-10", !hasGenerated && 'opacity-0')}
            />

            {/* Empty State */}
            {!hasGenerated && !isGenerating && !thinkingText && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 text-center">
                <Palette size={48} className="mb-3 text-[#0ea8e3]/30" />
                <p className="text-xl font-black text-[#305066] mb-1">画布在这里</p>
                <p className="text-sm font-bold text-[#305066]/40">输入描述或点击上方图标</p>
              </div>
            )}

            {/* Thinking Overlay */}
            {thinkingText && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-sm px-5 py-2.5 rounded-full shadow-md border border-[#305066]/10 flex items-center gap-2.5 animate-slide-up">
                <span className="flex gap-1">
                  <span className="w-2 h-2 bg-[#0ea8e3] rounded-full animate-[bounce-dot_1.2s_ease-in-out_infinite]" />
                  <span className="w-2 h-2 bg-[#db6968] rounded-full animate-[bounce-dot_1.2s_ease-in-out_0.2s_infinite]" />
                  <span className="w-2 h-2 bg-[#f59e0b] rounded-full animate-[bounce-dot_1.2s_ease-in-out_0.4s_infinite]" />
                </span>
                <span className="text-sm font-bold text-[#305066] whitespace-nowrap">{thinkingText}</span>
              </div>
            )}
          </div>

          {/* Share Button */}
          {hasGenerated && !isGenerating && (
            <button
              onClick={handleShareWord}
              disabled={isSharing}
              className="flex items-center gap-2 bg-[#0ea8e3] text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-md shadow-[#0ea8e3]/25 active:scale-95 transition-all disabled:opacity-40 mb-6 animate-pop-in"
            >
              {isSharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              <span>分享画作</span>
            </button>
          )}
        </div>

        {/* ======================= */}
        {/* TAB 2: DRAW MODE ("画") */}
        {/* ======================= */}
        <div className={cn(
          "absolute inset-0 flex-col items-center pt-5 px-4 overflow-y-auto w-full max-w-md mx-auto pb-24",
          activeTab === 'draw' ? "flex" : "hidden"
        )}>
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between mb-3 px-1">
            <h2 className="font-black text-xl text-[#305066]">画猜图</h2>
            <button
              onClick={handleGuess}
              disabled={isGuessing || !canUndo}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all",
                "disabled:opacity-40 disabled:cursor-not-allowed active:scale-95",
                canUndo && !isGuessing
                  ? "bg-[#0ea8e3] text-white shadow-md shadow-[#0ea8e3]/25 hover:bg-[#0c96cc]"
                  : "bg-white/60 text-[#305066]/30 border border-[#305066]/10"
              )}
            >
              {isGuessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>{isGuessing ? "AI 在看..." : "让 AI 猜"}</span>
            </button>
          </div>

          {/* Drawing Canvas */}
          <div ref={containerRef} className="w-full aspect-square bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg border-2 border-[#305066]/15 relative overflow-hidden shrink-0">

            {/* Draw Mode Empty State */}
            {!canUndo && !guessResult && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-80 z-0">
                <Pencil size={48} className="mb-3 text-[#0ea8e3]/25" />
                <p className="text-xl font-black text-[#305066] mb-1">拿起画笔吧</p>
                <p className="text-sm font-bold text-[#305066]/35">画完后点右上角让 AI 猜</p>
              </div>
            )}

            {/* AI Guess Result */}
            {guessResult && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-lg border border-[#305066]/10 animate-pop-in w-[90%] max-w-xs">
                <div className="flex items-start gap-2.5">
                  <div className="bg-[#0ea8e3]/10 text-[#0ea8e3] p-1.5 rounded-xl flex-shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-xs mb-0.5 text-[#0ea8e3]">AI 猜你画的是：</h4>
                    <p className="text-sm font-bold text-[#305066] leading-relaxed">{guessResult}</p>
                  </div>
                  <button
                    onClick={() => setGuessResult(null)}
                    className="text-[#305066]/30 hover:text-[#db6968] flex-shrink-0 -mt-0.5 -mr-0.5 p-1 text-lg leading-none"
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

          {/* Toolbar */}
          <div className="w-full mt-4 bg-white/90 backdrop-blur-sm rounded-2xl border border-[#305066]/10 p-3.5 shadow-md flex flex-col gap-3">
            {/* Colors */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto hide-scrollbar">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setIsEraser(false); }}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all flex-shrink-0 active:scale-90",
                    color === c && !isEraser
                      ? "ring-3 ring-offset-2 ring-[#305066]/40 scale-110"
                      : "hover:scale-110"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="w-full h-px bg-[#305066]/8" />

            {/* Tools & Sizes */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                <ToolButton icon={<Pencil size={18} />} active={!isEraser} onClick={() => setIsEraser(false)} />
                <ToolButton icon={<Eraser size={18} />} active={isEraser} onClick={() => setIsEraser(true)} />
                <ActionButton icon={<Undo size={18} />} onClick={undo} disabled={!canUndo} />
                <ActionButton icon={<Trash2 size={18} />} onClick={clear} />
                <ActionButton icon={<Share2 size={18} />} onClick={handleShareDraw} disabled={!canUndo || isSharing} />
              </div>

              <div className="w-px h-7 bg-[#305066]/8" />

              <div className="flex gap-1.5">
                {BRUSH_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setLineWidth(size)}
                    className={cn(
                      "w-9 h-9 flex items-center justify-center rounded-xl transition-all flex-shrink-0 active:scale-90",
                      lineWidth === size
                        ? "bg-[#0ea8e3]/10 ring-1.5 ring-[#0ea8e3]"
                        : "bg-transparent hover:bg-[#305066]/5"
                    )}
                  >
                    <div className="bg-[#305066] rounded-full" style={{ width: size + 2, height: size + 2 }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Tab Navigation */}
      <div className="fixed bottom-0 w-full z-50">
        <div className="max-w-md mx-auto px-4 pb-[env(safe-area-inset-bottom,8px)]">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-[#305066]/10 flex items-center justify-evenly p-1.5 mb-2">
            <TabButton
              active={activeTab === 'word'}
              onClick={() => setActiveTab('word')}
              icon={<Type size={24} strokeWidth={2.5} />}
              label="词作画"
            />
            <TabButton
              active={activeTab === 'draw'}
              onClick={() => setActiveTab('draw')}
              icon={<Pencil size={24} strokeWidth={2.5} />}
              label="画猜图"
            />
          </div>
        </div>
      </div>

      {/* Exhausted Overlay */}
      {isExhausted && (
        <div className="fixed inset-0 z-[100] bg-[#f2e2c4]/95 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl border border-[#305066]/10 shadow-2xl p-7 max-w-sm w-full flex flex-col items-center text-center animate-pop-in">
            <div className="text-5xl mb-3">😴</div>
            <h2 className="text-2xl font-black text-[#305066] mb-1.5">今日额度已用完</h2>
            <p className="text-base font-bold text-[#305066]/60 mb-4">
              AI 画师累了，明天再来吧！
            </p>
            <div className="bg-[#db6968]/8 rounded-xl px-6 py-3 mb-5">
              <p className="text-xs font-bold text-[#305066]/40 mb-1">距离恢复还有</p>
              <p className="text-3xl font-black text-[#db6968] tracking-wider font-mono">
                {formatCountdown(countdown)}
              </p>
            </div>
            <div className="w-full h-px bg-[#305066]/8 mb-5" />
            <p className="text-sm font-bold text-[#305066]/60 mb-3">
              关注公众号，获取最新消息
            </p>
            <img src={qrCode} alt="公众号二维码" className="w-44 h-44 rounded-xl" />
          </div>
        </div>
      )}

    </div>
  );
}

// -- Subcomponents --

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center flex-1 py-2.5 rounded-xl transition-all",
        active
          ? "bg-[#305066] text-white shadow-md"
          : "text-[#305066]/40 hover:text-[#305066]/70"
      )}
    >
      {icon}
      <span className="text-xs font-bold mt-0.5">{label}</span>
    </button>
  );
}

function ToolButton({ icon, active, onClick }: { icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 active:scale-90",
        active
          ? "bg-[#305066] text-white shadow-sm"
          : "bg-transparent text-[#305066]/35 hover:text-[#305066]/60 hover:bg-[#305066]/5"
      )}
    >
      {icon}
    </button>
  );
}

function ActionButton({ icon, onClick, disabled }: { icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 active:scale-90 bg-transparent text-[#305066]/35 hover:text-[#305066]/60 hover:bg-[#305066]/5 disabled:opacity-30 disabled:active:scale-100"
    >
      {icon}
    </button>
  );
}
