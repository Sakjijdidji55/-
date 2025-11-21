import React, { useState, useEffect } from 'react';
import { MainMenu } from './components/MainMenu';
import { GameInterface } from './components/GameInterface';
import { generateStoryStart, generateNextSegment, generateSceneImage, getPrelude, updateConfig } from './services/geminiService';
import { AppState, GameState, Protagonist, Choice, StorySegment } from './types';

const LOCAL_STORAGE_KEY = 'echoes_autosave_v1';
const API_CONFIG_STORAGE_KEY = 'echoes_api_config_v1';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    status: GameState.MENU,
    protagonist: null,
    history: [],
    currentSegment: null,
    currentImage: null,
    preludeQueue: [],
    scriptMap: {}, // Changed from Queue to Map
    customApiKey: null,
    customBaseUrl: null,
    customImageBaseUrl: null,
    customModelName: null,
    customImageModelName: null,
    isLoading: false,
    error: null
  });

  const [hasLocalSave, setHasLocalSave] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) setHasLocalSave(true);
    try {
      const savedConfigStr = localStorage.getItem(API_CONFIG_STORAGE_KEY);
      if (savedConfigStr) {
        const savedConfig = JSON.parse(savedConfigStr);
        handleUpdateConfig(savedConfig);
      }
    } catch (e) {
      console.warn("Failed to load saved config");
    }
  }, []);

  useEffect(() => {
    if (state.status === GameState.PLAYING && !state.isLoading && state.currentSegment) {
      try {
        // Note: We generally don't want to save the entire scriptMap to local storage if it's huge
        // But for now, we dump state. Ideally, we just save the current scene ID for scripts.
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
        setHasLocalSave(true);
      } catch (e) {
        console.warn("Auto-save failed:", e);
      }
    }
  }, [state]);

  const handleUpdateConfig = (config: { apiKey?: string, baseUrl?: string, imageBaseUrl?: string, textModel?: string, imageModel?: string }) => {
    localStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify(config));
    updateConfig(config);
    setState(prev => ({ 
      ...prev, 
      customApiKey: config.apiKey || null,
      customBaseUrl: config.baseUrl || null,
      customImageBaseUrl: config.imageBaseUrl || null,
      customModelName: config.textModel || null,
      customImageModelName: config.imageModel || null
    }));
  };

  const handleSaveGame = () => {
    try {
      if (state.isLoading || state.error) return;
      const saveData = JSON.stringify(state, null, 2);
      const blob = new Blob([saveData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, "-");
      link.download = `echoes_save_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Failed to export game:", e);
    }
  };

  const handleLoadGame = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const savedState = JSON.parse(json) as AppState;
        if (!savedState.history || !savedState.status) throw new Error("Invalid save file");
        setState({ ...savedState, isLoading: false, error: null });
      } catch (e) {
        setState(prev => ({ ...prev, error: "无法读取存档文件。" }));
      }
    };
    reader.readAsText(file);
  };

  const handleImportScript = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        const scriptDataList = JSON.parse(json) as StorySegment[];
        
        if (!Array.isArray(scriptDataList) || scriptDataList.length === 0 || !scriptDataList[0].lines) {
          throw new Error("Invalid Script Format: Missing 'lines' array");
        }

        // Convert List to Map for Graph Navigation
        const scriptMap: Record<string, StorySegment> = {};
        scriptDataList.forEach((seg, index) => {
          // If no ID is provided in JSON, generate one (though graph nav requires IDs)
          const id = seg.id || `auto_id_${index}`;
          seg.id = id;
          scriptMap[id] = seg;
        });

        setState(prev => ({ ...prev, isLoading: true }));
        
        // Start with the first segment in the list (entry point)
        const firstSegment = scriptDataList[0];
        
        const image = await generateSceneImage(firstSegment.visualDescription);

        setState(prev => ({
          ...prev,
          status: GameState.PLAYING,
          protagonist: Protagonist.MALE, 
          currentSegment: firstSegment,
          currentImage: image,
          history: [{ segment: firstSegment }],
          scriptMap: scriptMap, // Store the full script graph
          preludeQueue: [],
          isLoading: false,
          error: null
        }));

      } catch (e) {
        console.error(e);
        setState(prev => ({ ...prev, isLoading: false, error: "剧本格式错误: 需包含 'lines' 数组。" }));
      }
    };
    reader.readAsText(file);
  };

  const handleContinueGame = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) setState(JSON.parse(saved));
    } catch (e) {
      setState(prev => ({ ...prev, error: "无法读取自动存档。" }));
    }
  };

  const handleMainMenu = () => {
    setState(prev => ({ ...prev, status: GameState.MENU, error: null, isLoading: false }));
  };

  const handleStartGame = async (protagonist: Protagonist) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      const prelude = getPrelude(protagonist);
      const firstSegment = prelude[0];
      const remainingPrelude = prelude.slice(1);
      const image = await generateSceneImage(firstSegment.visualDescription);

      setState(prev => ({
        ...prev,
        status: GameState.PLAYING,
        protagonist,
        currentSegment: firstSegment,
        currentImage: image,
        history: [{ segment: firstSegment }],
        preludeQueue: remainingPrelude,
        scriptMap: {},
        isLoading: false
      }));
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, isLoading: false, error: "连接失败，请检查 API Key 或网络。" }));
    }
  };

  const handleChoiceSelected = async (choice: Choice) => {
    if (!state.protagonist) return;
    
    const updatedHistory = [...state.history];
    if (state.currentSegment) {
        updatedHistory[updatedHistory.length - 1].choiceMade = choice.text;
    }

    setState(prev => ({ ...prev, isLoading: true, history: updatedHistory, error: null }));

    try {
      // PRIORITY 1: Script Map (Graph Navigation)
      // Check if the choice has a nextSceneId and we have a loaded script
      if (choice.nextSceneId && state.scriptMap && state.scriptMap[choice.nextSceneId]) {
          const nextSegment = state.scriptMap[choice.nextSceneId];
          const nextImage = await generateSceneImage(nextSegment.visualDescription);
          
          setState(prev => ({
              ...prev,
              currentSegment: nextSegment,
              currentImage: nextImage,
              history: [...updatedHistory, { segment: nextSegment }],
              isLoading: false
          }));
          return;
      }

      // PRIORITY 2: Prelude Queue (Linear)
      if (state.preludeQueue && state.preludeQueue.length > 0) {
          const nextSegment = state.preludeQueue[0];
          const remainingQueue = state.preludeQueue.slice(1);
          const nextImage = await generateSceneImage(nextSegment.visualDescription);

          setState(prev => ({
              ...prev,
              currentSegment: nextSegment,
              currentImage: nextImage,
              preludeQueue: remainingQueue,
              history: [...updatedHistory, { segment: nextSegment }],
              isLoading: false
          }));
          return;
      }

      // PRIORITY 3: AI Generation (Infinite Mode)
      let nextSegment;
      if (choice.id === 'start_game') {
          nextSegment = await generateStoryStart(state.protagonist);
      } else {
          nextSegment = await generateNextSegment(state.protagonist, updatedHistory, choice.text);
      }

      if (nextSegment.isEnding) {
        let nextStatus = GameState.GAME_OVER;
        if (['true', 'good', 'normal'].includes(nextSegment.endingType || '')) nextStatus = GameState.VICTORY;
        setState(prev => ({ ...prev, status: nextStatus }));
      }

      const nextImage = await generateSceneImage(nextSegment.visualDescription);

      setState(prev => ({
        ...prev,
        currentSegment: nextSegment,
        currentImage: nextImage,
        history: [...updatedHistory, { segment: nextSegment }],
        isLoading: false
      }));

    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, isLoading: false, error: "请求失败，请检查 API 设置。" }));
    }
  };

  const getEndingDisplay = () => {
    const type = state.currentSegment?.endingType || 'normal';
    switch (type) {
      case 'true': return { title: '✨ 真结局 (True Ending) ✨', color: 'text-yellow-500' };
      case 'good': return { title: '🎉 好结局 (Good Ending)', color: 'text-green-500' };
      case 'bad': return { title: '💔 坏结局 (Bad Ending)', color: 'text-red-500' };
      case 'dead': return { title: '💀 死亡 (DEAD END)', color: 'text-red-800' };
      default: return { title: '结局', color: 'text-slate-600' };
    }
  };

  const endingStyle = getEndingDisplay();

  return (
    <div className="antialiased text-slate-800 bg-slate-900 min-h-screen font-sans">
      {state.error && (
        <div className="fixed top-0 left-0 w-full bg-red-500/90 backdrop-blur text-white text-center p-4 z-[100] text-sm font-bold shadow-lg flex justify-between items-center px-8 animate-slide-down">
          <span>⚠️ {state.error}</span>
          <button onClick={() => setState(s => ({...s, error: null}))} className="bg-white/20 px-3 py-1 rounded hover:bg-white/30">关闭</button>
        </div>
      )}

      {state.status === GameState.MENU && (
        <MainMenu 
          onStart={handleStartGame} 
          onLoad={handleLoadGame}
          onImportScript={handleImportScript}
          onContinue={handleContinueGame}
          onUpdateConfig={handleUpdateConfig}
          hasLocalSave={hasLocalSave}
          isLoading={state.isLoading} 
        />
      )}

      {state.status === GameState.PLAYING && (
        <GameInterface 
          segment={state.currentSegment}
          imageSrc={state.currentImage}
          onChoiceSelected={handleChoiceSelected}
          protagonist={state.protagonist!}
          isLoading={state.isLoading}
          onSave={handleSaveGame}
          onMainMenu={handleMainMenu}
        />
      )}

      {(state.status === GameState.GAME_OVER || state.status === GameState.VICTORY) && (
         <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md p-8 text-center animate-fade-in">
            <h1 className={`text-4xl md:text-6xl font-black mb-4 title-font drop-shadow-md ${endingStyle.color}`}>
              {endingStyle.title}
            </h1>
            <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-xl border-4 border-sky-100">
              <p className="text-slate-600 mb-8 text-lg font-medium leading-relaxed whitespace-pre-line">
                {state.currentSegment?.lines?.map(l => l.text).join('\n') || "故事结束。"}
              </p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => window.location.reload()} className="px-8 py-3 bg-sky-500 text-white font-bold rounded-full hover:scale-105 transition-transform shadow-lg">重新开始</button>
                <button onClick={handleMainMenu} className="px-8 py-3 bg-slate-200 text-slate-600 font-bold rounded-full hover:bg-slate-300 transition-colors shadow-lg">返回主菜单</button>
              </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;