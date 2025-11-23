import React, { useState } from 'react';
import { Protagonist } from '../types';

interface MainMenuProps {
  onStart: (protagonist: Protagonist) => void;
  onLoad: (file: File) => void;
  onImportScript: (file: File) => void;
  onContinue: () => void;
  onUpdateConfig: (config: { apiKey?: string, baseUrl?: string, imageBaseUrl?: string, textModel?: string, imageModel?: string }) => void;
  hasLocalSave: boolean;
  isLoading: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({ 
  onStart, 
  onLoad, 
  onImportScript,
  onContinue, 
  onUpdateConfig,
  hasLocalSave, 
  isLoading 
}) => {
  const [fileError, setFileError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings Form State
  const [tempApiKey, setTempApiKey] = useState("");
  const [tempBaseUrl, setTempBaseUrl] = useState("");
  const [tempImageBaseUrl, setTempImageBaseUrl] = useState("");
  const [tempTextModel, setTempTextModel] = useState("deepseek-ai/DeepSeek-V3");
  const [tempImageModel, setTempImageModel] = useState("black-forest-labs/FLUX.1-schnell");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, isScript: boolean) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "application/json") {
        setFileError("请选择正确的 JSON 文件");
        return;
      }
      setFileError(null);
      if (isScript) {
        onImportScript(file);
      } else {
        onLoad(file);
      }
    }
  };

  const handleSaveSettings = () => {
    onUpdateConfig({
      apiKey: tempApiKey.trim() || undefined,
      baseUrl: tempBaseUrl.trim() || undefined,
      imageBaseUrl: tempImageBaseUrl.trim() || undefined,
      textModel: tempTextModel.trim() || undefined,
      imageModel: tempImageModel.trim() || undefined
    });
    setShowSettings(false);
  };

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-800 font-sans">
      
      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
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

      {/* Settings Button */}
      <button 
        onClick={() => setShowSettings(true)}
        className="absolute top-6 right-6 z-20 bg-white/50 hover:bg-white/80 p-3 rounded-full shadow-md transition-all text-xl"
        title="API 设置"
      >
        ⚙️
      </button>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-pop-in">
            <h3 className="text-2xl font-black mb-4 text-slate-800">⚙️ 自定义 API 设置</h3>
            <p className="text-xs text-slate-500 mb-4">
              支持 Google Gemini 或 OpenAI 兼容接口 (如 SiliconFlow)。
              <br/>如果不填 URL，则默认使用内置 Google SDK。
            </p>
            
            <div className="space-y-3 text-sm">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Text API Address (Base URL)</label>
                <input 
                  type="text" 
                  placeholder="https://api.siliconflow.cn/v1/chat/completions" 
                  className="w-full p-2 border rounded-lg bg-slate-50 focus:border-sky-400 outline-none"
                  value={tempBaseUrl}
                  onChange={(e) => setTempBaseUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Image API Address (Optional)</label>
                <input 
                  type="text" 
                  placeholder="https://api.siliconflow.cn/v1/images/generations" 
                  className="w-full p-2 border rounded-lg bg-slate-50 focus:border-sky-400 outline-none"
                  value={tempImageBaseUrl}
                  onChange={(e) => setTempImageBaseUrl(e.target.value)}
                />
                <p className="text-[10px] text-slate-400 mt-1">留空则自动根据 Text API 推断。</p>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">API Key</label>
                <input 
                  type="password" 
                  placeholder="sk-..." 
                  className="w-full p-2 border rounded-lg bg-slate-50 focus:border-sky-400 outline-none"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Text Model</label>
                  <input 
                    type="text" 
                    placeholder="gemini-2.5-flash" 
                    className="w-full p-2 border rounded-lg bg-slate-50 focus:border-sky-400 outline-none"
                    value={tempTextModel}
                    onChange={(e) => setTempTextModel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Image Model</label>
                  <input 
                    type="text" 
                    placeholder="gemini-2.5-flash-image" 
                    className="w-full p-2 border rounded-lg bg-slate-50 focus:border-sky-400 outline-none"
                    value={tempImageModel}
                    onChange={(e) => setTempImageModel(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">取消</button>
              <button onClick={handleSaveSettings} className="px-6 py-2 bg-sky-500 text-white font-bold rounded-lg hover:bg-sky-600 shadow-md">保存设置</button>
            </div>
          </div>
        </div>
      )}

      <div className="z-10 text-center mb-8 animate-pop-in">
        <h1 className="text-6xl md:text-8xl font-black title-font mb-2 text-transparent bg-clip-text bg-gradient-to-b from-sky-400 to-blue-600 drop-shadow-sm">
          THYTHM
        </h1>
        <h2 className="text-3xl md:text-5xl font-bold title-font mb-6 text-pink-500 drop-shadow-sm">
          Echoes of Dystopia
        </h2>
        <div className="bg-white/80 backdrop-blur-sm px-8 py-2 rounded-full inline-block shadow-sm border border-sky-100">
          <p className="text-slate-500 tracking-[0.3em] text-xs md:text-sm font-bold uppercase">
            悬疑 · 恋爱
          </p>
        </div>
      </div>

      {/* Menu Actions */}
      <div className="z-10 mb-8 w-full max-w-lg flex flex-col gap-3">
         {hasLocalSave && (
            <button 
              onClick={onContinue}
              className="w-full bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white py-4 rounded-xl font-black text-xl shadow-lg transform hover:scale-105 transition-all border-2 border-white/30"
            >
               ▶ 继续游戏 (Continue)
            </button>
         )}
         
         <div className="flex gap-3">
            <label className="cursor-pointer flex-1">
                <div className="bg-white/80 hover:bg-white text-sky-600 border-2 border-sky-200 hover:border-sky-400 py-3 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2">
                  <span>📂 读取存档</span>
                </div>
                <input type="file" accept=".json" onChange={(e) => handleFileChange(e, false)} className="hidden" />
            </label>
            <label className="cursor-pointer flex-1">
                <div className="bg-white/80 hover:bg-white text-purple-600 border-2 border-purple-200 hover:border-purple-400 py-3 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2">
                  <span>📜 导入剧本</span>
                </div>
                <input type="file" accept=".json" onChange={(e) => handleFileChange(e, true)} className="hidden" />
            </label>
         </div>
         
         {fileError && <p className="text-red-500 text-sm text-center bg-white/80 px-2 py-1 rounded">{fileError}</p>}
      </div>

      <div className="z-10 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full px-4">
        {/* Male Lead */}
        <div 
          onClick={() => !isLoading && onStart(Protagonist.MALE)}
          className={`group relative cursor-pointer bg-white border-4 border-sky-100 hover:border-sky-400 p-6 md:p-8 rounded-[2rem] transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-2 ${isLoading ? 'opacity-50 grayscale pointer-events-none' : ''}`}
        >
           <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-5xl group-hover:scale-110 transition-transform">🛡️</div>
           <div className="relative z-10 flex flex-col items-center text-center mt-4">
             <h2 className="text-2xl font-black text-slate-800 mb-1 group-hover:text-sky-600 transition-colors">坚毅的士兵</h2>
             <h3 className="text-xs text-sky-500 mb-3 font-bold uppercase tracking-widest">凯伦 (Kaelen)</h3>
             <p className="text-slate-500 text-sm">"危险由我来挡。"</p>
           </div>
        </div>

        {/* Female Lead */}
        <div 
           onClick={() => !isLoading && onStart(Protagonist.FEMALE)}
           className={`group relative cursor-pointer bg-white border-4 border-pink-100 hover:border-pink-400 p-6 md:p-8 rounded-[2rem] transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-2 ${isLoading ? 'opacity-50 grayscale pointer-events-none' : ''}`}
        >
           <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-5xl group-hover:scale-110 transition-transform">🎀</div>
           <div className="relative z-10 flex flex-col items-center text-center mt-4">
             <h2 className="text-2xl font-black text-slate-800 mb-1 group-hover:text-pink-500 transition-colors">天才侦探</h2>
             <h3 className="text-xs text-pink-500 mb-3 font-bold uppercase tracking-widest">艾拉拉 (Elara)</h3>
             <p className="text-slate-500 text-sm">"真相只有一个！"</p>
           </div>
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sky-600 font-bold animate-pulse">少女祈祷中... (Loading)</p>
        </div>
      )}
      
      <div className="mt-12 text-slate-400 text-xs font-medium">Powered by Gemini 2.5</div>
      <style>{`@keyframes float { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(10deg); } } .animate-float { animation: float 6s ease-in-out infinite; }`}</style>
    </div>
  );
};