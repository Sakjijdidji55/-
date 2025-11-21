import React, { useState, useEffect } from 'react';
import { StorySegment, Choice, Protagonist } from '../types';
import { Typewriter } from './Typewriter';

interface GameInterfaceProps {
  segment: StorySegment | null;
  imageSrc: string | null;
  onChoiceSelected: (choice: Choice) => void;
  protagonist: Protagonist;
  isLoading: boolean;
  onSave: () => void;
  onMainMenu: () => void;
}

// SVG Flower Component
const SakuraFlower: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 512 512" className={className} fill="currentColor">
    <path d="M256 512C256 512 256 256 256 256C256 256 512 256 512 256C512 256 256 256 256 256C256 256 256 0 256 0C256 0 256 256 256 256C256 256 0 256 0 256C0 256 256 256 256 256C256 256 256 512 256 512Z" fillOpacity="0" />
    <path d="M369.1 444.2C365.9 446.7 362.4 448.9 358.7 450.7C344.1 458 327.6 462.1 310.2 462.1C261.6 462.1 222.2 422.7 222.2 374.1C222.2 354 228.9 335.6 240.3 321L256 302.7L271.7 321C283.1 335.6 289.8 354 289.8 374.1C289.8 398.3 280.2 420.2 264.4 436C288.9 447 316.7 453.1 346 453.1C388.7 453.1 428.1 438.6 459 414.2L459.8 413.6L369.1 444.2Z" opacity="0.6"/>
    <path d="M256 208.6C251.4 214 247.3 219.9 243.6 226.2C232.8 244.7 226.6 266.3 226.6 289.4C226.6 353.1 278.3 404.8 341.9 404.8C365.1 404.8 386.6 398.6 405.1 387.8C411.4 384.1 417.3 380 422.7 375.4L256 208.6Z"/>
    <path d="M142.9 67.8C146.1 65.3 149.6 63.1 153.3 61.3C167.9 54 184.4 49.9 201.8 49.9C250.4 49.9 289.8 89.3 289.8 137.9C289.8 158 283.1 176.4 271.7 191L256 209.3L240.3 191C228.9 176.4 222.2 158 222.2 137.9C222.2 113.7 231.8 91.8 247.6 76C223.1 65 195.3 58.9 166 58.9C123.3 58.9 83.9 73.4 53 97.8L52.2 98.4L142.9 67.8Z" opacity="0.6"/>
    <path d="M256 303.4C260.6 298 264.7 292.1 268.4 285.8C279.2 267.3 285.4 245.7 285.4 222.6C285.4 158.9 233.7 107.2 170.1 107.2C146.9 107.2 125.4 113.4 106.9 124.2C100.6 127.9 94.7 132 89.3 136.6L256 303.4Z"/>
  </svg>
);

export const GameInterface: React.FC<GameInterfaceProps> = ({
  segment,
  imageSrc,
  onChoiceSelected,
  protagonist,
  isLoading,
  onSave,
  onMainMenu
}) => {
  const [showChoices, setShowChoices] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setShowChoices(false);
  }, [segment]);

  const handleTextComplete = () => {
    setShowChoices(true);
  };

  const handleSkip = () => {
    if (!showChoices) setShowChoices(true);
  };

  const handleSaveClick = () => {
    onSave();
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 2000);
  };

  if (!segment) return <div className="w-full h-screen bg-sky-50"></div>;

  const isFemaleProtagonist = protagonist === Protagonist.FEMALE;
  const themeColor = isFemaleProtagonist ? 'pink' : 'sky';
  const themeGradient = isFemaleProtagonist ? 'from-pink-500 to-rose-400' : 'from-blue-500 to-cyan-400';
  
  const portraitIcon = isFemaleProtagonist ? '🎀' : '🛡️';

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900 select-none font-sans">
      
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt="Scene Background"
            className="w-full h-full object-cover transition-opacity duration-1000 ease-in-out animate-fade-in"
          />
        ) : (
          <div className={`w-full h-full bg-${themeColor}-100 animate-pulse`} />
        )}
        {/* Vignette & Floral Borders */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10 pointer-events-none" />
        
        <div className={`absolute top-0 left-0 w-64 h-64 text-${themeColor}-300/30 pointer-events-none`}>
           <SakuraFlower className="w-full h-full transform -translate-x-16 -translate-y-16 rotate-45" />
        </div>
        <div className={`absolute top-0 right-0 w-48 h-48 text-${themeColor}-200/20 pointer-events-none`}>
           <SakuraFlower className="w-full h-full transform translate-x-10 -translate-y-10 -rotate-12" />
        </div>
        <div className={`absolute bottom-0 right-0 w-96 h-96 text-${themeColor}-400/10 pointer-events-none`}>
           <SakuraFlower className="w-full h-full transform translate-x-32 translate-y-32 rotate-180" />
        </div>
      </div>

      {/* Monologue / Thoughts Floating Text Layer */}
      {segment.monologue && !isLoading && (
        <div 
          key={`mono-${segment.narrative}`} 
          className="absolute top-24 left-8 md:left-20 right-8 md:right-1/3 z-10 pointer-events-none animate-slide-up"
        >
           <div className="bg-black/40 backdrop-blur-md p-6 rounded-tr-3xl rounded-bl-3xl border-l-4 border-white/30 shadow-lg">
             <p className="text-white/95 text-lg md:text-xl italic font-medium leading-relaxed drop-shadow-md">
               {segment.monologue}
             </p>
           </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
           <div className="flex flex-col items-center animate-bounce bg-white/10 p-8 rounded-3xl backdrop-blur-md border border-white/20">
             <div className={`w-16 h-16 border-4 border-${themeColor}-400 border-t-transparent rounded-full animate-spin mb-4`}></div>
             <span className="text-white font-bold text-lg drop-shadow-lg tracking-widest">
               少女祈祷中... (Loading)
             </span>
           </div>
        </div>
      )}

      {/* Top Menu Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-20">
        <div className="flex gap-3">
            <button 
              onClick={onMainMenu}
              className="bg-white/20 hover:bg-white/40 text-white px-4 py-2 rounded-full backdrop-blur-md text-sm font-bold border border-white/30 transition-all shadow-sm"
            >
              🏠 主菜单
            </button>
            <button 
              onClick={handleSaveClick}
              className={`
                px-4 py-2 rounded-full backdrop-blur-md text-sm font-bold border border-white/30 transition-all shadow-sm
                ${isSaving ? 'bg-green-500/80 text-white' : 'bg-white/20 hover:bg-white/40 text-white'}
              `}
            >
              {isSaving ? '✔ 已保存' : '💾 保存'}
            </button>
        </div>
        
        <div className="bg-white/20 backdrop-blur-md px-6 py-2 rounded-full border border-white/30 shadow-sm">
             <span className={`text-${themeColor}-100 font-bold text-sm uppercase tracking-wider flex items-center gap-2`}>
               <span>{isFemaleProtagonist ? '♥ 艾拉拉线' : '⚔ 凯伦线'}</span>
             </span>
        </div>
      </div>

      {/* Main Interface Area */}
      <div className="absolute bottom-0 left-0 w-full z-30 flex flex-col justify-end p-4 md:p-8 pb-6">
        
        {/* Choices Container */}
        {showChoices && !isLoading && (
          <div className="w-full max-w-4xl mx-auto mb-8 flex flex-col gap-4 animate-pop-in">
            {segment.choices.map((choice) => (
              <button
                key={choice.id}
                onClick={() => onChoiceSelected(choice)}
                className={`
                  w-full p-4 text-center rounded-2xl shadow-lg backdrop-blur-xl border-2 transition-all transform hover:scale-[1.02] hover:-translate-y-1 group
                  ${choice.type === 'action' 
                    ? 'bg-red-500/80 border-red-300 text-white hover:bg-red-500' 
                    : choice.type === 'deduction' 
                      ? 'bg-purple-500/80 border-purple-300 text-white hover:bg-purple-500' 
                      : choice.type === 'continue'
                        ? `bg-gradient-to-r ${themeGradient} text-white border-transparent`
                        : 'bg-white/90 border-sky-200 text-slate-800 hover:bg-white'}
                `}
              >
                <div className="flex items-center justify-center gap-3">
                  {choice.type !== 'continue' && (
                    <span className="text-xs uppercase opacity-70 font-black bg-black/10 px-2 py-1 rounded">
                      {choice.type === 'action' ? '行动' : choice.type === 'deduction' ? '推理' : '对话'}
                    </span>
                  )}
                   <span className="text-lg font-bold tracking-wide">{choice.text}</span>
                   {choice.type === 'continue' && <span className="group-hover:translate-x-1 transition-transform">▶</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Dialogue Box Container */}
        <div className="w-full max-w-6xl mx-auto relative mt-4">
           
           {/* Character Portrait / Name Tag Cluster */}
           <div className="absolute -top-16 left-0 md:left-4 z-40 flex items-end animate-slide-up">
              {/* Portrait Circle */}
              <div className={`
                w-24 h-24 rounded-full border-4 border-white shadow-xl bg-gradient-to-br ${themeGradient}
                flex items-center justify-center text-5xl transform translate-y-8 z-10 relative overflow-hidden
              `}>
                <span className="filter drop-shadow-lg transform hover:scale-110 transition-transform cursor-default">
                  {portraitIcon}
                </span>
                {/* Shine effect */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-full pointer-events-none"></div>
              </div>

              {/* Name Label */}
              <div className={`
                px-10 py-2 rounded-t-2xl rounded-br-2xl shadow-lg transform -translate-x-4 mb-4
                bg-gradient-to-r ${themeGradient}
              `}>
                <span className="text-white font-black text-xl tracking-wide uppercase shadow-black drop-shadow-md pl-4">
                  {segment.speaker || "???"}
                </span>
              </div>
           </div>

           {/* Main Text Area */}
           <div 
             key={segment.narrative} /* CRITICAL: Forces re-animation on text change */
             onClick={handleSkip}
             className={`
               relative bg-slate-900/80 backdrop-blur-xl border-2 animate-slide-up
               ${isFemaleProtagonist ? 'border-pink-300/50' : 'border-sky-300/50'}
               rounded-3xl p-6 md:p-8 min-h-[180px] shadow-2xl cursor-pointer hover:bg-slate-900/90 transition-colors
               flex items-start pt-10
             `}
           >
              {/* Decorative Corner Lines */}
              <div className={`absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 rounded-tr-xl border-${themeColor}-400/50`}></div>
              <div className={`absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 rounded-bl-xl border-${themeColor}-400/50`}></div>

              <div className="text-white text-lg md:text-xl leading-relaxed font-medium drop-shadow-sm w-full pl-4 md:pl-24">
                {showChoices ? (
                  segment.narrative
                ) : (
                  <Typewriter 
                    text={segment.narrative} 
                    speed={30} 
                    onComplete={handleTextComplete} 
                  />
                )}
                {!showChoices && (
                   <span className={`inline-block ml-2 w-3 h-3 rounded-full bg-${themeColor}-400 animate-ping`}></span>
                )}
              </div>
              
              {/* Next Arrow */}
              {!showChoices && (
                 <div className="absolute bottom-4 right-8 animate-bounce">
                    <span className={`text-3xl text-${themeColor}-400 filter drop-shadow-glow`}>▼</span>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};