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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900 select-none font-sans">
      
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt="Scene Background"
            className="w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
          />
        ) : (
          <div className={`w-full h-full bg-${themeColor}-100 animate-pulse`} />
        )}
        {/* Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
      </div>

      {/* Monologue / Thoughts Floating Text Layer */}
      {segment.monologue && !isLoading && (
        <div className="absolute top-24 left-8 md:left-20 right-8 md:right-1/3 z-10 pointer-events-none">
           <p className="text-white/90 text-lg md:text-xl italic font-serif drop-shadow-lg leading-relaxed animate-fade-in bg-black/30 p-4 rounded-xl backdrop-blur-sm inline-block">
             {segment.monologue}
           </p>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
           <div className="flex flex-col items-center animate-bounce">
             <div className={`w-16 h-16 border-4 border-${themeColor}-400 border-t-transparent rounded-full animate-spin mb-4`}></div>
             <span className="text-white font-bold text-lg drop-shadow-lg tracking-widest">读取中... (LOADING)</span>
           </div>
        </div>
      )}

      {/* Top Menu Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-20">
        <div className="flex gap-2">
            <button 
              onClick={onMainMenu}
              className="bg-black/50 hover:bg-black/70 text-white px-4 py-1 rounded-full backdrop-blur-md text-sm font-bold border border-white/20 transition-all"
            >
              🏠 主菜单
            </button>
            <button 
              onClick={handleSaveClick}
              className={`
                px-4 py-1 rounded-full backdrop-blur-md text-sm font-bold border border-white/20 transition-all
                ${isSaving ? 'bg-green-500 text-white' : 'bg-black/50 hover:bg-black/70 text-white'}
              `}
            >
              {isSaving ? '✔ 已保存文件' : '💾 保存进度'}
            </button>
        </div>
        
        <div className="bg-black/50 backdrop-blur-md px-4 py-1 rounded-full border border-white/20">
             <span className={`text-${themeColor}-300 font-bold text-sm uppercase tracking-wider`}>
               {isFemaleProtagonist ? '♥ 艾拉拉视角' : '⚔ 凯伦视角'}
             </span>
        </div>
      </div>

      {/* Main Interface Area */}
      <div className="absolute bottom-0 left-0 w-full z-30 flex flex-col justify-end p-4 md:p-8 pb-8">
        
        {/* Choices Container */}
        {showChoices && !isLoading && (
          <div className="w-full max-w-4xl mx-auto mb-6 flex flex-col gap-3 animate-pop-in">
            {segment.choices.map((choice) => (
              <button
                key={choice.id}
                onClick={() => onChoiceSelected(choice)}
                className={`
                  w-full p-4 text-center rounded-xl shadow-lg backdrop-blur-xl border-2 transition-all transform hover:scale-105 hover:-translate-y-1
                  ${choice.type === 'action' 
                    ? 'bg-red-500/80 border-red-300 text-white hover:bg-red-500' 
                    : choice.type === 'deduction' 
                      ? 'bg-purple-500/80 border-purple-300 text-white hover:bg-purple-500' 
                      : 'bg-white/90 border-sky-200 text-slate-800 hover:bg-white'}
                `}
              >
                <div className="flex flex-col items-center">
                   <span className="text-xs uppercase opacity-70 font-bold mb-1">
                     {choice.type === 'action' ? '行动' : choice.type === 'deduction' ? '推理' : '对话'}
                   </span>
                   <span className="text-lg font-bold">{choice.text}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Dialogue Box */}
        <div className="w-full max-w-6xl mx-auto relative">
           {/* Name Tag */}
           <div className="absolute -top-6 left-0 md:left-8 z-40">
              <div className={`
                px-8 py-2 rounded-t-2xl rounded-br-2xl shadow-lg transform translate-y-1
                bg-gradient-to-r ${isFemaleProtagonist ? 'from-pink-500 to-rose-400' : 'from-blue-600 to-sky-500'}
              `}>
                <span className="text-white font-black text-lg tracking-wide uppercase shadow-black drop-shadow-md">
                  {segment.speaker || "???"}
                </span>
              </div>
           </div>

           {/* Main Text Area */}
           <div 
             onClick={handleSkip}
             className={`
               relative bg-slate-900/90 backdrop-blur-md border-t-4 border-b-4 
               ${isFemaleProtagonist ? 'border-pink-400' : 'border-sky-400'}
               rounded-3xl p-6 md:p-8 min-h-[160px] shadow-2xl cursor-pointer hover:bg-slate-900/95 transition-colors
             `}
           >
              <div className="text-white text-lg md:text-xl leading-relaxed font-medium drop-shadow-sm">
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
                 <div className="absolute bottom-4 right-6 animate-bounce">
                    <span className={`text-2xl text-${themeColor}-400`}>▼</span>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};