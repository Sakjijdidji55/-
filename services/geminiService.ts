import { GoogleGenAI, Type } from "@google/genai";
import { Protagonist, StorySegment, GameHistoryItem } from "../types";

// Configuration State
let config = {
  apiKey: (typeof process !== 'undefined' && process.env) ? process.env.API_KEY || 'dummy_key' : 'dummy_key',
  baseUrl: '', // Empty means default Google SDK
  textModel: 'gemini-2.5-flash',
  imageModel: 'gemini-2.5-flash-image'
};

// Google SDK Instance
let ai: GoogleGenAI | null = null;

const initClient = () => {
  try {
    // Only init Google SDK if we are NOT using a custom base URL
    if (!config.baseUrl) {
      ai = new GoogleGenAI({ apiKey: config.apiKey });
    } else {
      ai = null; // Use custom fetch
    }
  } catch (e) {
    console.error("Failed to init Gemini client", e);
  }
};

initClient();

export const updateConfig = (newConfig: { apiKey?: string; baseUrl?: string; textModel?: string; imageModel?: string }) => {
  if (newConfig.apiKey) config.apiKey = newConfig.apiKey;
  if (newConfig.baseUrl !== undefined) config.baseUrl = newConfig.baseUrl;
  if (newConfig.textModel) config.textModel = newConfig.textModel;
  if (newConfig.imageModel) config.imageModel = newConfig.imageModel;
  
  console.log("Config updated:", config);
  initClient();
};

// --- Prompts & Schemas ---
const CHAR_DESC_MALE = "1boy, solo, male protagonist Kaelen, 23 years old, young handsome ex-soldier, short messy black hair, sharp blue eyes, visible scar on neck, wearing a torn white tuxedo with tactical gear equipped over it, holding a futuristic pistol, resolute expression, dynamic pose, anime style, detailed face, cinematic lighting.";
const CHAR_DESC_FEMALE = "1girl, solo, female protagonist Elara, 20 years old, genius detective lolita, long silver hair in twin-tails with red ribbons, black gothic dress with white lace, wearing a golden monocle on one eye, holding a magnifying glass or data pad, cute but arrogant expression, anime style, masterpiece, highly detailed.";
const CHAR_DESC_COUPLE = "1boy and 1girl, Kaelen (black hair, tactical tuxedo, protective stance) standing back-to-back with Elara (silver hair, gothic dress, analyzing data), battlefield wedding ruin background, anime style, Makoto Shinkai style, dramatic lighting.";

const SYSTEM_INSTRUCTION_TEXT = `
你是一个科幻悬疑视觉小说《双境回响》的游戏管理员 (Game Master)。
语言：必须完全使用中文 (Chinese)。
艺术风格：明亮、多彩、精致的日本动漫风格 (Makoto Shinkai style)。

**核心指令：剧情连贯性 (Absolute Continuity)**
1.  **禁止瞬移 (No Teleportation)**：如果主角从A点移动到B点，**必须**描写移动的过程。
2.  **动作衔接 (Action Chaining)**：生成的**第一句话**，必须是对玩家上一个选择的**直接物理反馈**。
3.  **环境连续性 (Environmental Permanence)**：保持物品、状态的一致性。

**主角设定：**
1. **凯伦 (Kaelen)**: 沉默寡言的退役军人。战术冷静。
2. **艾拉拉 (Elara)**: 毒舌傲娇的天才萝莉侦探。

**输出限制：**
- 剧情文本 (narrative) 长度 4-8 句话。
- **必须**填写 'emotion' 字段。
- 确保 "visualDescription" 包含人物特征。
- 输出格式必须是严谨的 JSON。
`;

// JSON Schema definition for Google SDK
const STORY_SCHEMA_GOOGLE = {
  type: Type.OBJECT,
  properties: {
    narrative: { type: Type.STRING },
    monologue: { type: Type.STRING },
    speaker: { type: Type.STRING },
    emotion: { type: Type.STRING, enum: ['neutral', 'happy', 'angry', 'sad', 'surprised', 'determined', 'fear'] },
    visualDescription: { type: Type.STRING },
    choices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['action', 'dialogue', 'deduction'] }
        },
        required: ['id', 'text', 'type']
      }
    },
    isEnding: { type: Type.BOOLEAN },
    endingType: { type: Type.STRING, enum: ['true', 'good', 'normal', 'bad', 'dead'], nullable: true }
  },
  required: ['narrative', 'speaker', 'emotion', 'visualDescription', 'choices']
};

// Helper: Clean JSON from LLM response
function cleanJson(text: string): string {
  let clean = text.trim();
  if (clean.startsWith('```json')) clean = clean.replace('```json', '').replace('```', '');
  else if (clean.startsWith('```')) clean = clean.replace('```', '').replace('```', '');
  return clean;
}

// --- Generalized Text Generation (Supports both JSON Schema and Plain Text) ---
async function generateText(
  prompt: string, 
  systemInstruction: string, 
  requireJson: boolean = true,
  jsonSchema?: any
): Promise<string> {
  
  // 1. Custom API Path (OpenAI Compatible)
  if (config.baseUrl) {
    const systemContent = requireJson 
      ? systemInstruction + "\nIMPORTANT: Respond ONLY with valid JSON matching the schema provided in the user prompt context if any." 
      : systemInstruction;

    // For Custom API, we inject schema instructions into the system prompt if it's strictly required, 
    // or rely on the prompt structure.
    const messages = [
      { role: "system", content: systemContent },
      { role: "user", content: prompt }
    ];

    const body: any = {
      model: config.textModel,
      messages: messages,
      temperature: 0.7,
      stream: false,
    };

    if (requireJson) {
      body.response_format = { type: "json_object" };
      // Add schema hint to system prompt for custom models that might need it inline
      messages[0].content += `\nOutput JSON schema: ${JSON.stringify(jsonSchema || {}, null, 2)}`;
    }

    const response = await fetch(config.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Custom API Error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from Custom API");
    return cleanJson(content);
  } 
  
  // 2. Google Gemini SDK Path
  else {
    if (!ai) throw new Error("AI Client not initialized");
    
    const generateOptions: any = {
      model: config.textModel,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      }
    };

    if (requireJson && jsonSchema) {
      generateOptions.config.responseMimeType = 'application/json';
      generateOptions.config.responseSchema = jsonSchema;
    }

    const response = await ai.models.generateContent(generateOptions);
    return response.text || '';
  }
}

// --- Prompt Enhancer ---
// This uses the Text AI to rewrite a simple description into a detailed Art Prompt
async function enhanceImagePrompt(rawDescription: string, characterDesc: string): Promise<string> {
  const systemInstruction = `
    You are an elite AI Art Prompt Engineer.
    Your task is to take a scene description and a character description, and combine them into a highly detailed, comma-separated English prompt optimized for Anime Art Generators (like FLUX, Midjourney, NijiV6).
    
    Rules:
    1. Translate all Chinese input to English.
    2. Use Danbooru-style tags or descriptive sentences.
    3. Focus on: Lighting (cinematic, volumetric), Atmosphere, Composition (wide angle, dynamic), and Art Style (Makoto Shinkai, CoMix Wave Films, masterpiece, best quality, 8k).
    4. Ensure the character description is integrated naturally.
    5. Output ONLY the raw prompt text. Do not add "Here is the prompt:" or quotes.
  `;

  const prompt = `
    Input Scene: "${rawDescription}"
    Input Character: "${characterDesc}"
    
    Generate the detailed prompt now:
  `;

  try {
    // We use the text model to expand the prompt. jsonMode = false.
    const enhanced = await generateText(prompt, systemInstruction, false);
    return enhanced.trim();
  } catch (e) {
    console.warn("Prompt enhancement failed, falling back to raw concatenation.", e);
    return `(Best Quality), (Masterpiece), (Anime Style), ${characterDesc}, ${rawDescription}`;
  }
}

// --- Main Service Functions ---

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

export function getPrelude(protagonist: Protagonist): StorySegment[] {
  const isMale = protagonist === Protagonist.MALE;
  const commonIntro: StorySegment = {
    narrative: "Neovera，这座建立在旧世界尸骸上的玻璃花园，今夜显得格外刺眼。全息天空为了庆祝联姻，被强制调成了虚假的完美蔚蓝。",
    monologue: "公元2147年。这是一个连'自由意志'都可以被标价出售的时代。",
    speaker: "旁白",
    emotion: "neutral",
    visualDescription: "futuristic cyberpunk city Neovera, bright neon lights, glass skyscrapers, holographic sky, anime style, wide angle, no characters",
    choices: [{ id: 'next1', text: '继续', type: 'continue' }]
  };
  const charIntro: StorySegment = isMale ? {
    narrative: "我叫凯伦。在那场被称为'绞肉机'的边境战争后，我以为自己已经流干了所有的血。此刻，我对着镜子整理领结。",
    monologue: "颈侧的旧伤疤在隐隐作痛……这是危险逼近的信号。",
    speaker: "凯伦",
    emotion: "determined",
    visualDescription: "Kaelen looking at a mirror, wearing white tuxedo, young man 23 years old, black short hair, visible scar, anime style",
    choices: [{ id: 'next2', text: '检查武器', type: 'continue' }]
  } : {
    narrative: "我是艾拉拉。在这个充满谎言的城市里，我是唯一的'解题者'。我扶正了单片眼镜。",
    monologue: "父亲留下的最后一条线索指向了今天的婚礼。",
    speaker: "艾拉拉",
    emotion: "determined",
    visualDescription: "Elara adjusting hair ribbon, wedding dress, gothic detective accessories, golden monocle, silver twin-tails, anime style",
    choices: [{ id: 'next2', text: '激活扫描', type: 'continue' }]
  };
  const wedding: StorySegment = {
    narrative: "大门开启，圣咏声戛然而止。当我对上那一双眼睛时，世界仿佛静止。",
    monologue: "就在神父张开双臂的那一刻，头顶的彩绘玻璃发出了悲鸣。",
    speaker: isMale ? "凯伦" : "艾拉拉",
    emotion: "neutral",
    visualDescription: "Grand futuristic wedding hall, Kaelen and Elara standing opposite, tense atmosphere, anime style",
    choices: [{ id: 'start_game', text: '仪式开始', type: 'continue' }]
  };
  return [commonIntro, charIntro, wedding];
}

export async function generateStoryStart(protagonist: Protagonist): Promise<StorySegment> {
  const prompt = `
    以 ${protagonist} 的视角开始故事。
    场景：婚礼现场。
    突发事件：爆炸震碎穹顶，武装人员突入。
    任务：
    1. 描写爆炸视觉冲击。
    2. 角色高光时刻（凯伦保护/艾拉拉分析）。
    3. 建立互动。
    4. 标记 'emotion'。
    提供三个选项 (Action/Deduction/Dialogue)。
    用中文回答。
  `;
  
  return withRetry(async () => {
    const jsonStr = await generateText(prompt, SYSTEM_INSTRUCTION_TEXT, true, STORY_SCHEMA_GOOGLE);
    return JSON.parse(jsonStr) as StorySegment;
  });
}

export async function generateNextSegment(
  protagonist: Protagonist, 
  history: GameHistoryItem[], 
  lastChoice: string
): Promise<StorySegment> {
  const lastSegment = history[history.length - 1].segment;
  const turnCount = history.length;
  let pacingInstruction = turnCount < 10 ? "阶段：逃亡与磨合。" : "阶段：深入调查。";

  const prompt = `
    当前主角: ${protagonist}
    当前回合: ${turnCount}
    节奏: ${pacingInstruction}
    
    上一幕场景: "${lastSegment.visualDescription}"
    上一幕文本: "${lastSegment.narrative}"
    玩家选择: "${lastChoice}"
    
    任务:
    1. 第一句话必须描写 "${lastChoice}" 的直接动作后果。
    2. 描写路途/环境。
    3. 保持人设。
    
    生成 4-8 句剧情。用中文回答。
  `;

  return withRetry(async () => {
    const jsonStr = await generateText(prompt, SYSTEM_INSTRUCTION_TEXT, true, STORY_SCHEMA_GOOGLE);
    return JSON.parse(jsonStr) as StorySegment;
  });
}

export async function generateSceneImage(visualDescription: string): Promise<string> {
  // 1. Determine Character Context
  let characterDesc = "";
  const hasMale = visualDescription.includes("凯伦") || visualDescription.includes("Kaelen") || visualDescription.includes("男主");
  const hasFemale = visualDescription.includes("艾拉拉") || visualDescription.includes("Elara") || visualDescription.includes("女主");
  if (hasMale && hasFemale) characterDesc = CHAR_DESC_COUPLE;
  else if (hasMale) characterDesc = CHAR_DESC_MALE;
  else if (hasFemale) characterDesc = CHAR_DESC_FEMALE;

  // 2. Use AI to Enhance/Generate the Prompt (The "Prompt Engineer" Step)
  // This generates a MUCH more detailed prompt than the story writer could provide.
  const enhancedPrompt = await enhanceImagePrompt(visualDescription, characterDesc);
  console.log("Enhanced Image Prompt:", enhancedPrompt);

  // 3. Send Enhanced Prompt to Image Generator
  return withRetry(async () => {
    if (config.baseUrl) {
      // Custom API Image Generation
      try {
        // Try to infer image endpoint
        let imageUrlEndpoint = config.baseUrl.includes('chat/completions') 
          ? config.baseUrl.replace('chat/completions', 'images/generations')
          : config.baseUrl; 
        
        if (!imageUrlEndpoint.endsWith('images/generations') && !imageUrlEndpoint.endsWith('chat/completions')) {
           imageUrlEndpoint = imageUrlEndpoint.replace(/\/+$/, "") + "/images/generations";
        }

        const response = await fetch(imageUrlEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.imageModel, 
            prompt: enhancedPrompt, // Use the AI-enhanced prompt
            n: 1,
            size: "1024x1024" 
          })
        });

        if (!response.ok) throw new Error("Custom Image Gen Failed");
        
        const data = await response.json();
        if (data.data && data.data[0]) {
            if (data.data[0].url) return data.data[0].url; 
            if (data.data[0].b64_json) return `data:image/png;base64,${data.data[0].b64_json}`;
        }
        throw new Error("Unknown Image Response Format");
      } catch (e) {
        console.warn("Fallback: Custom image gen failed.", e);
        return ""; 
      }
    } else {
      // Default Gemini Image Gen
      if (!ai) throw new Error("AI Client not initialized");
      const response = await ai.models.generateContent({
        model: config.imageModel, 
        contents: { parts: [{ text: enhancedPrompt }] },
        config: { imageConfig: { aspectRatio: '16:9' } }
      });
      
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
      }
      throw new Error("No image generated");
    }
  });
}