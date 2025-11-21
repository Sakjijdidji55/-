import React, { useEffect, useState } from 'react';
import { Protagonist } from '../types';

interface MainMenuProps {
  onStart: (protagonist: Protagonist) => void;
  onLoad: (file: File) => void;
  onContinue: () => void;
  hasLocalSave: boolean;
  isLoading: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStart, onLoad, onContinue, hasLocalSave, isLoading }) => {
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "application/json") {
        setFileError("请选择正确的 JSON 存档文件");
        return;
      }
      setFileError(null);
      onLoad(file);
    }
  };

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-800 font-sans">
      
      {/* Decorative Background Elements (Flowers/Sakura) */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
         {/* CSS Sakura Pedals */}
         {[...Array(10)].map((_, i) => (
            <div key={i} className="absolute animate-float" style={{
               left: `${Math.random() * 100}%`,
               top: `${Math.random() * 100}%`,
               animationDuration: `${5 + Math.random() * 10}s`,
               opacity: 0.6
            }}>
               <div className="text-pink-300 text-2xl">🌸</div>
            </div>
         ))}
         
         <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-pink-200/40 rounded-full blur-[80px] animate-pulse"></div>
         <div className="absolute -bottom-20 -right-20 w-[600px] h-[600px] bg-sky-200/40 rounded-full blur-[80px]"></div>
      </div>

      <div className="z-10 text-center mb-8 animate-pop-in">
        <h1 className="text-6xl md:text-8xl font-black title-font mb-2 text-transparent bg-clip-text bg-gradient-to-b from-sky-400 to-blue-600 drop-shadow-sm">
          双境回响
        </h1>
        <h2 className="text-3xl md:text-5xl font-bold title-font mb-6 text-pink-500 drop-shadow-sm">
          Echoes of Dystopia
        </h2>
        <div className="bg-white/80 backdrop-blur-sm px-8 py-2 rounded-full inline-block shadow-sm border border-sky-100">
          <p className="text-slate-500 tracking-[0.3em] text-xs md:text-sm font-bold uppercase">
            双视角 · 悬疑 · 恋爱
          </p>
        </div>
      </div>

      {/* Menu Actions */}
      <div className="z-10 mb-8 w-full max-w-md flex flex-col gap-3">
         {hasLocalSave && (
            <button 
              onClick={onContinue}
              className="w-full bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white py-4 rounded-xl font-black text-xl shadow-lg transform hover:scale-105 transition-all border-2 border-white/30"
            >
               ▶ 继续游戏 (Continue)
            </button>
         )}

         <label className="cursor-pointer block w-full">
            <div className="bg-white/80 hover:bg-white text-sky-600 border-2 border-sky-200 hover:border-sky-400 py-3 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2">
               <span>📂 读取存档文件 (Load File)</span>
            </div>
            <input type="file" accept=".json" onChange={handleFileChange} className="hidden" />
         </label>
         {fileError && <p className="text-red-500 text-sm mt-2 bg-white/80 px-2 rounded">{fileError}</p>}
      </div>

      <div className="z-10 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full px-4">
        
        {/* Male Lead Selection */}
        <div 
          onClick={() => !isLoading && onStart(Protagonist.MALE)}
          className={`
            group relative cursor-pointer bg-white border-4 border-sky-100 hover:border-sky-400
            p-6 md:p-8 rounded-[2rem] transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-2
            ${isLoading ? 'opacity-50 grayscale pointer-events-none' : ''}
          `}
        >
           <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-5xl group-hover:scale-110 transition-transform">
             🛡️
           </div>
           <div className="relative z-10 flex flex-col items-center text-center mt-4">
             <h2 className="text-2xl font-black text-slate-800 mb-1 group-hover:text-sky-600 transition-colors">坚毅的士兵</h2>
             <h3 className="text-xs text-sky-500 mb-3 font-bold uppercase tracking-widest">凯伦·凡斯 (Kaelen)</h3>
             <div className="w-full h-px bg-sky-100 my-3"></div>
             <p className="text-slate-500 text-sm leading-relaxed">
               "危险由我来挡。" <br/>
               <span className="text-xs opacity-75">退役军人 | 冷静 | 强悍</span>
             </p>
           </div>
        </div>

        {/* Female Lead Selection */}
        <div 
           onClick={() => !isLoading && onStart(Protagonist.FEMALE)}
           className={`
            group relative cursor-pointer bg-white border-4 border-pink-100 hover:border-pink-400
            p-6 md:p-8 rounded-[2rem] transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-2
            ${isLoading ? 'opacity-50 grayscale pointer-events-none' : ''}
          `}
        >
           <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-5xl group-hover:scale-110 transition-transform">
             🎀
           </div>
           <div className="relative z-10 flex flex-col items-center text-center mt-4">
             <h2 className="text-2xl font-black text-slate-800 mb-1 group-hover:text-pink-500 transition-colors">天才侦探</h2>
             <h3 className="text-xs text-pink-500 mb-3 font-bold uppercase tracking-widest">艾拉拉·凡斯 (Elara)</h3>
             <div className="w-full h-px bg-pink-100 my-3"></div>
             <p className="text-slate-500 text-sm leading-relaxed">
               "真相只有一个！" <br/>
               <span className="text-xs opacity-75">侦探萝莉 | 智慧 | 傲娇</span>
             </p>
           </div>
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sky-600 font-bold animate-pulse">故事生成中... (Story Init)</p>
        </div>
      )}
      
      <div className="mt-12 text-slate-400 text-xs font-medium">
        Powered by Gemini 2.5 Flash & Image Generation
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
};