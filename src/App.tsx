/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Trophy, RefreshCw, Info, ChevronRight, Eye, Palette, Languages } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';

// --- Types ---
interface Color {
  h: number;
  s: number;
  l: number;
}

type Language = 'en' | 'zh';

interface GameState {
  status: 'idle' | 'playing' | 'gameover';
  score: number;
  timeLeft: number;
  level: number;
  gridSize: number;
  baseColor: Color;
  diffColor: Color;
  diffIndex: number;
  lastDiffInfo?: {
    base: string;
    diff: string;
    delta: number;
  };
}

// --- Translations ---
const translations = {
  en: {
    title: "Yunbao Family's Game",
    score: "Score",
    time: "Time",
    heroTitle: "Yunbao Family's Color Challenge",
    heroDesc: "Find the block with the slightly different shade. Difficulty increases with every correct choice. A fun challenge for the whole Yunbao family!",
    startBtn: "Start Challenge",
    sec60: "60 Seconds",
    visualTraining: "Visual Training",
    globalRank: "Global Rank",
    level: "Level",
    grid: "Grid",
    complete: "Challenge Complete",
    profileReady: "The Yunbao family's visual acuity profile is ready.",
    finalScore: "Final Score",
    colorSensitivity: "Color Sensitivity",
    visualPrecision: "Visual Precision",
    rankExceptional: "Exceptional. Your perception is on par with master painters.",
    rankProfessional: "Professional grade. You have a keen eye for subtle nuances.",
    rankAverage: "Above average. Keep practicing to refine your sensitivity.",
    rankDeveloping: "Developing. Regular training will significantly improve your color vision.",
    lastComparison: "Last Comparison",
    deltaDesc: "The difference between these two colors was only {delta}% in lightness.",
    tryAgain: "Try Again",
    artEdition: "Yunbao Family Edition",
    precisionEngine: "v1.0.5 Precision Engine",
    optimized: "Optimized for Retina",
    lab: "Yunbao Vision Lab",
  },
  zh: {
    title: "云宝一家人的游戏",
    score: "得分",
    time: "时间",
    heroTitle: "云宝一家的色彩大挑战",
    heroDesc: "在极其相似的色块中找出差异的那一个。难度随正确选择递增。云宝一家人快来比比看谁的眼力最好！",
    startBtn: "开始挑战",
    sec60: "60 秒限时",
    visualTraining: "视觉训练",
    globalRank: "全球排名",
    level: "等级",
    grid: "网格",
    complete: "挑战完成",
    profileReady: "云宝一家的视觉敏锐度报告已生成。",
    finalScore: "最终得分",
    colorSensitivity: "色彩敏感度",
    visualPrecision: "视觉精准度",
    rankExceptional: "卓越。你的感知力足以媲美绘画大师。",
    rankProfessional: "专业水准。你对细微差别有着敏锐的洞察力。",
    rankAverage: "高于平均。继续练习以进一步提升敏感度。",
    rankDeveloping: "成长中。定期的训练将显著改善你的色彩视觉。",
    lastComparison: "最后对比",
    deltaDesc: "这两个颜色之间的亮度差异仅为 {delta}%。",
    tryAgain: "再试一次",
    artEdition: "云宝一家人专用版",
    precisionEngine: "v1.0.5 精准引擎",
    optimized: "针对视网膜屏优化",
    lab: "云宝视觉实验室",
  }
};

// --- Audio Utils ---
const playPianoChord = (isCorrect: boolean) => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  
  const ctx = new AudioContextClass();
  const now = ctx.currentTime;
  
  const frequencies = isCorrect ? [261.63, 329.63, 392.00] : [130.81, 138.59, 146.83];
  
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 1.5);
  });
};

// --- Constants ---
const INITIAL_TIME = 60;
const MIN_DELTA = 1;

// --- Utils ---
const colorToCSS = (c: Color) => `hsl(${c.h}, ${c.s}%, ${c.l}%)`;

const generateColors = (level: number) => {
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(Math.random() * 40) + 40;
  const l = Math.floor(Math.random() * 40) + 30;

  const delta = Math.max(MIN_DELTA, 15 - Math.floor(level / 4));
  
  const isLighter = Math.random() > 0.5;
  const diffL = isLighter ? l + delta : l - delta;

  const baseColor = { h, s, l };
  const diffColor = { h, s, l: diffL };

  let gridSize = 2;
  if (level > 2) gridSize = 3;
  if (level > 6) gridSize = 4;
  if (level > 12) gridSize = 5;
  if (level > 20) gridSize = 6;
  if (level > 30) gridSize = 7;
  if (level > 45) gridSize = 8;

  const diffIndex = Math.floor(Math.random() * (gridSize * gridSize));

  return { baseColor, diffColor, diffIndex, gridSize, delta };
};

export default function App() {
  const [lang, setLang] = useState<Language>('zh');
  const [state, setState] = useState<GameState>({
    status: 'idle',
    score: 0,
    timeLeft: INITIAL_TIME,
    level: 1,
    gridSize: 2,
    baseColor: { h: 0, s: 0, l: 0 },
    diffColor: { h: 0, s: 0, l: 0 },
    diffIndex: 0,
  });

  const t = translations[lang];

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const toggleLang = () => setLang(prev => prev === 'en' ? 'zh' : 'en');

  const startGame = useCallback(() => {
    const { baseColor, diffColor, diffIndex, gridSize } = generateColors(1);
    setState({
      status: 'playing',
      score: 0,
      timeLeft: INITIAL_TIME,
      level: 1,
      gridSize,
      baseColor,
      diffColor,
      diffIndex,
    });
  }, []);

  const nextLevel = useCallback((currentLevel: number, currentScore: number) => {
    const nextLvl = currentLevel + 1;
    const { baseColor, diffColor, diffIndex, gridSize, delta } = generateColors(nextLvl);
    
    setState(prev => ({
      ...prev,
      level: nextLvl,
      score: currentScore + 1,
      gridSize,
      baseColor,
      diffColor,
      diffIndex,
      lastDiffInfo: {
        base: colorToCSS(prev.baseColor),
        diff: colorToCSS(prev.diffColor),
        delta
      }
    }));
  }, []);

  const handleBlockClick = (index: number) => {
    if (state.status !== 'playing') return;

    if (index === state.diffIndex) {
      playPianoChord(true);
      nextLevel(state.level, state.score);
    } else {
      playPianoChord(false);
      setState(prev => ({
        ...prev,
        timeLeft: Math.max(0, prev.timeLeft - 3),
      }));
    }
  };

  useEffect(() => {
    if (state.status === 'playing' && state.timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setState(prev => {
          if (prev.timeLeft <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return { ...prev, timeLeft: 0, status: 'gameover' };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.status]);

  useEffect(() => {
    if (state.status === 'gameover' && state.score > 20) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF']
      });
    }
  }, [state.status, state.score]);

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans selection:bg-[#1A1A1A] selection:text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Palette className="w-6 h-6 text-[#1A1A1A]" />
            <h1 className="text-xl font-bold tracking-tight uppercase">{t.title}</h1>
          </div>
          <button 
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors text-[10px] font-bold uppercase tracking-widest"
          >
            <Languages className="w-3 h-3" />
            {lang === 'en' ? '中文' : 'EN'}
          </button>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest opacity-50 font-bold">{t.score}</span>
            <span className="text-2xl font-mono font-bold leading-none">{state.score}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest opacity-50 font-bold">{t.time}</span>
            <span className={cn(
              "text-2xl font-mono font-bold leading-none transition-colors",
              state.timeLeft < 10 ? "text-red-500 animate-pulse" : "text-black"
            )}>
              {state.timeLeft}s
            </span>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-12 px-6 max-w-4xl mx-auto flex flex-col items-center">
        <AnimatePresence mode="wait">
          {state.status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center space-y-8 max-w-lg"
            >
              <div className="space-y-4">
                <h2 className="text-5xl font-serif italic leading-tight">
                  {t.heroTitle}
                </h2>
                <p className="text-lg text-black/60 leading-relaxed">
                  {t.heroDesc}
                </p>
              </div>
              
              <button
                onClick={startGame}
                className="group relative px-12 py-4 bg-[#1A1A1A] text-white rounded-full overflow-hidden transition-transform hover:scale-105 active:scale-95"
              >
                <span className="relative z-10 flex items-center gap-2 font-bold uppercase tracking-widest text-sm">
                  {t.startBtn} <ChevronRight className="w-4 h-4" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-20 transition-opacity" />
              </button>

              <div className="grid grid-cols-3 gap-4 pt-8">
                <div className="p-4 bg-white rounded-2xl border border-black/5 space-y-2">
                  <Timer className="w-5 h-5 mx-auto opacity-40" />
                  <p className="text-[10px] uppercase tracking-wider font-bold opacity-40">{t.sec60}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-black/5 space-y-2">
                  <Eye className="w-5 h-5 mx-auto opacity-40" />
                  <p className="text-[10px] uppercase tracking-wider font-bold opacity-40">{t.visualTraining}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-black/5 space-y-2">
                  <Trophy className="w-5 h-5 mx-auto opacity-40" />
                  <p className="text-[10px] uppercase tracking-wider font-bold opacity-40">{t.globalRank}</p>
                </div>
              </div>
            </motion.div>
          )}

          {state.status === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="w-full flex flex-col items-center gap-8"
            >
              <div 
                className="grid gap-2 sm:gap-4 w-full aspect-square max-w-[500px]"
                style={{ 
                  gridTemplateColumns: `repeat(${state.gridSize}, 1fr)`,
                  gridTemplateRows: `repeat(${state.gridSize}, 1fr)`
                }}
              >
                {Array.from({ length: state.gridSize * state.gridSize }).map((_, i) => (
                  <motion.button
                    key={`${state.level}-${i}`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ delay: i * 0.01 }}
                    onClick={() => handleBlockClick(i)}
                    className="w-full h-full rounded-lg sm:rounded-xl shadow-sm cursor-pointer"
                    style={{ 
                      backgroundColor: i === state.diffIndex 
                        ? colorToCSS(state.diffColor) 
                        : colorToCSS(state.baseColor) 
                    }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-4 text-black/40 text-xs font-bold uppercase tracking-widest">
                <span>{t.level} {state.level}</span>
                <div className="w-1 h-1 rounded-full bg-black/20" />
                <span>{state.gridSize}x{state.gridSize} {t.grid}</span>
              </div>
            </motion.div>
          )}

          {state.status === 'gameover' && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-12 w-full max-w-2xl"
            >
              <div className="space-y-4">
                <h2 className="text-6xl font-serif italic">{t.complete}</h2>
                <p className="text-xl text-black/60">{t.profileReady}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-3xl border border-black/5 flex flex-col items-center justify-center space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] font-bold opacity-40">{t.finalScore}</span>
                  <span className="text-7xl font-mono font-bold tracking-tighter">{state.score}</span>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-black/5 space-y-6 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 opacity-40" />
                    <span className="text-xs uppercase tracking-widest font-bold opacity-40">{t.colorSensitivity}</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-medium">{t.visualPrecision}</span>
                      <span className="text-lg font-mono font-bold">
                        {Math.min(100, Math.floor((state.score / 40) * 100))}%
                      </span>
                    </div>
                    <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (state.score / 40) * 100)}%` }}
                        className="h-full bg-[#1A1A1A]" 
                      />
                    </div>
                    <p className="text-xs text-black/50 leading-relaxed">
                      {state.score > 35 ? t.rankExceptional :
                       state.score > 25 ? t.rankProfessional :
                       state.score > 15 ? t.rankAverage :
                       t.rankDeveloping}
                    </p>
                  </div>
                </div>
              </div>

              {state.lastDiffInfo && (
                <div className="bg-white p-6 rounded-3xl border border-black/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">{t.lastComparison}</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">Delta: {state.lastDiffInfo.delta}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-12 rounded-xl shadow-inner border border-black/5" style={{ backgroundColor: state.lastDiffInfo.base }} />
                    <div className="flex-1 h-12 rounded-xl shadow-inner border border-black/5" style={{ backgroundColor: state.lastDiffInfo.diff }} />
                  </div>
                  <p className="text-[10px] text-center opacity-30 italic">
                    {t.deltaDesc.replace('{delta}', state.lastDiffInfo.delta.toString())}
                  </p>
                </div>
              )}

              <button
                onClick={startGame}
                className="group px-12 py-4 bg-[#1A1A1A] text-white rounded-full flex items-center gap-2 mx-auto font-bold uppercase tracking-widest text-sm transition-all hover:bg-black active:scale-95"
              >
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                {t.tryAgain}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="fixed bottom-6 left-6 right-6 flex justify-between items-end pointer-events-none">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-20">{t.artEdition}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-20">{t.precisionEngine}</p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-20">{t.optimized}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-20">{t.lab}</p>
        </div>
      </footer>
    </div>
  );
}
