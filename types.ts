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
  type: 'action' | 'dialogue' | 'deduction';
}

export interface StorySegment {
  narrative: string; // Main dialogue or action text (Bottom box)
  monologue?: string; // Internal thoughts or atmosphere (Floating text)
  speaker: string; // Name of speaker or "Narrator"
  visualDescription: string; // Prompt for image generation
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
  isLoading: boolean;
  error: string | null;
}