export enum Protagonist {
  MALE = '凯伦·凡斯 (Kaelen)',
  FEMALE = '艾拉拉·凡斯 (Elara)'
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
  nextSceneId?: string; // The ID of the target scene if this choice is selected
}

export type Emotion = 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised' | 'determined' | 'fear';

export interface DialogueLine {
  speaker: string;
  text: string;
  emotion: Emotion;
  monologue?: string; 
}

export interface StorySegment {
  id?: string; // Unique ID for the scene (Required for Script Mode)
  visualDescription: string; 
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
  
  // Changed from linear Queue to ID-based Map for branching scripts
  scriptMap: Record<string, StorySegment>; 
  
  // Configuration
  customApiKey: string | null;
  customBaseUrl: string | null;
  customImageBaseUrl: string | null; // Dedicated URL for image generation
  customModelName: string | null; 
  customImageModelName: string | null; 

  isLoading: boolean;
  error: string | null;
}