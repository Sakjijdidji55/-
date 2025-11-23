export enum Protagonist {
  MALE = '尤里乌斯 (Julius)',
  FEMALE = '卡罗特 (Carrot)'
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export interface Choice {
  id: string;
  text: string;
  type: 'action' | 'dialogue' | 'deduction' | 'continue';
  nextSceneId?: string; 
}

export type Emotion = 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised' | 'determined' | 'fear';

export interface DialogueLine {
  speaker: string;
  text: string;
  emotion: Emotion;
  monologue?: string; 
}

export interface StorySegment {
  id?: string; 
  visualDescription: string; 
  imageUrl?: string; // Store the generated image URL/Base64 here
  lines: DialogueLine[];
  choices: Choice[];
  isEnding?: boolean;
  endingType?: 'true' | 'good' | 'normal' | 'bad' | 'dead';
}

export interface GameHistoryItem {
  segment: StorySegment;
  choiceMade?: string;
}

export interface AppState {
  status: GameState;
  protagonist: Protagonist | null;
  history: GameHistoryItem[];
  currentSegment: StorySegment | null;
  currentImage: string | null;
  preludeQueue: StorySegment[]; 
  scriptMap: Record<string, StorySegment>; 
  
  // Configuration
  customApiKey: string | null;
  customBaseUrl: string | null;
  customImageBaseUrl: string | null; 
  customModelName: string | null; 
  customImageModelName: string | null; 

  isLoading: boolean;
  error: string | null;
}