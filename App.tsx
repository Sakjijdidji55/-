
import React, { useState, useEffect } from 'react';
import { MainMenu } from './components/MainMenu';
import { GameInterface } from './components/GameInterface';
import { generateStoryStart, generateNextSegment, generateSceneImage, getPrelude } from './services/geminiService';
import { AppState, GameState, Protagonist, Choice } from './types';

const LOCAL_STORAGE_KEY = 'echoes_autosave_v1';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    status: GameState.MENU,
    protagonist: null,
    history: [],
    currentSegment: null,
    currentImage: null,
    preludeQueue: [],
    isLoading: false,
    error: null
  });

  const [hasLocalSave, setHasLocalSave] = useState(false);

  // Check for local save on mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      setHasLocalSave(true);
    }
  }, []);

  // Auto-save whenever state changes significantly (Playing mode, not loading)
  useEffect(() => {
    if (state.status === GameState.PLAYING && !state.isLoading && state.currentSegment) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
        setHasLocalSave(true);
      } catch (e) {
        console.warn("Auto-save failed (possibly quota exceeded):", e);
      }
    }
  }, [state]);

  // Save game state to a downloadable JSON file (Manual Backup)
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
      
      console.log("Game exported successfully.");
    } catch (e) {
      console.error("Failed to export game:", e);
    }
  };

  // Load game state from a user-uploaded JSON file
  const handleLoadGame = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const savedState = JSON.parse(json) as AppState;
        
        // Validate critical fields
        if (!savedState.history || !savedState.status) {
           throw new Error("Invalid save file format");
        }

        setState({ ...savedState, isLoading: false, error: null });
      } catch (e) {
        console.error("Failed to load game:", e);
        setState(prev => ({ ...prev, error: "无法读取存档文件，格式可能损坏。" }));
      }
    };
    reader.readAsText(file);
  };

  const handleContinueGame = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const savedState = JSON.parse(saved) as AppState;
        setState(savedState);
      }
    } catch (e) {
      console.error("Failed to continue game:", e);
      setState(prev => ({ ...prev, error: "无法读取自动存档。" }));
    }
  };

  const handleMainMenu = () => {
    setState(prev => ({
       ...prev,
       status: GameState.MENU,
       error: null,
       isLoading: false
    }));
  };

  const handleStartGame = async (protagonist: Protagonist) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      // Clear old save when starting new
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      
      // Get fixed prelude segments
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
        isLoading: false
      }));
    } catch (error) {
      console.error(error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "连接不稳定，请重试。" 
      }));
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
      // 1. Check if there are segments left in the Prelude Queue
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

      // 2. If Prelude just finished (queue empty, but we were in prelude), start AI Story
      // We detect this by checking if the last choice was from the Prelude (usually 'type: continue' or specific ID)
      // OR simply if we just exhausted the queue.
      // A more robust way: If the current segment was the LAST prelude item.
      // The last prelude item usually calls 'generateStoryStart'.
      
      let nextSegment;
      // If choice ID is 'start_game' (defined in prelude), we trigger the AI start
      if (choice.id === 'start_game') {
          nextSegment = await generateStoryStart(state.protagonist);
      } else {
          // Normal AI progression
          nextSegment = await generateNextSegment(
            state.protagonist,
            updatedHistory,
            choice.text
          );
      }

      if (nextSegment.isEnding) {
        let nextStatus = GameState.GAME_OVER;
        if (['true', 'good', 'normal'].includes(nextSegment.endingType || '')) {
          nextStatus = GameState.VICTORY;
        } else {
          nextStatus = GameState.GAME_OVER;
        }
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
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "网络连接中断，请重新选择。" 
      }));
    }
  };

  // Helper to determine ending title and styling
  const getEndingDisplay = () => {
    const type = state.currentSegment?.endingType || 'normal';
    switch (type) {
      case 'true':
        return { title: '✨ 真结局 (True Ending) ✨', color: 'text-yellow-400 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500' };
      case 'good':
        return { title: '🎉 好结局 (Good Ending)', color: 'text-green-500' };
      case 'normal':
        return { title: '📜 普通结局 (Normal Ending)', color: 'text-slate-600' };
      case 'bad':
        return { title: '💔 坏结局 (Bad Ending)', color: 'text-red-500' };
      case 'dead':
        return { title: '💀 死亡 (DEAD END)', color: 'text-red-800' };
      default:
        return { title: '结局', color: 'text-slate-600' };
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
          onContinue={handleContinueGame}
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
              <p className="text-slate-600 mb-8 text-lg font-medium leading-relaxed">
                {state.currentSegment?.narrative || "故事结束。"}
              </p>
              <div className="flex gap-4 justify-center">
                <button 
                  onClick={() => window.location.reload()}
                  className="px-8 py-3 bg-gradient-to-r from-sky-400 to-pink-400 text-white font-bold rounded-full hover:scale-105 transition-transform shadow-lg"
                >
                  重新开始
                </button>
                <button 
                  onClick={handleMainMenu}
                  className="px-8 py-3 bg-slate-200 text-slate-600 font-bold rounded-full hover:bg-slate-300 transition-colors shadow-lg"
                >
                  返回主菜单
                </button>
              </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;
