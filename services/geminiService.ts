import { GoogleGenAI, Type } from "@google/genai";
import { Protagonist, StorySegment, GameHistoryItem, DialogueLine } from "../types";

// Configuration State
let config = {
  apiKey: (typeof process !== 'undefined' && process.env) ? process.env.API_KEY || 'dummy_key' : 'dummy_key',
  baseUrl: '', 
  imageBaseUrl: '', // Dedicated image endpoint
  textModel: 'gemini-2.5-flash',
  imageModel: 'gemini-2.5-flash-image'
};

// Google SDK Instance
let ai: GoogleGenAI | null = null;

const initClient = () => {
  try {
    // Only init Google SDK if we are NOT using a custom base URL for text
    if (!config.baseUrl) {
      ai = new GoogleGenAI({ apiKey: config.apiKey });
    } else {
      ai = null; 
    }
  } catch (e) {
    console.error("Failed to init Gemini client", e);
  }
};

initClient();

export const updateConfig = (newConfig: { apiKey?: string; baseUrl?: string; imageBaseUrl?: string; textModel?: string; imageModel?: string }) => {
  if (newConfig.apiKey) config.apiKey = newConfig.apiKey;
  if (newConfig.baseUrl !== undefined) config.baseUrl = newConfig.baseUrl;
  if (newConfig.imageBaseUrl !== undefined) config.imageBaseUrl = newConfig.imageBaseUrl;
  if (newConfig.textModel) config.textModel = newConfig.textModel;
  if (newConfig.imageModel) config.imageModel = newConfig.imageModel;
  
  console.log("Config updated:", config);
  initClient();
};

const CHAR_DESC_MALE = "1boy, solo, male protagonist Kaelen, 23 years old, young handsome ex-soldier, short messy black hair, sharp blue eyes, visible scar on neck, wearing a torn white tuxedo with tactical gear equipped over it, holding a futuristic pistol, resolute expression, dynamic pose, anime style, detailed face, cinematic lighting.";
const CHAR_DESC_FEMALE = "1girl, solo, female protagonist Elara, 20 years old, genius detective lolita, long silver hair in twin-tails with red ribbons, black gothic dress with white lace, wearing a golden monocle on one eye, holding a magnifying glass or data pad, cute but arrogant expression, anime style, masterpiece, highly detailed.";
const CHAR_DESC_COUPLE = "1boy and 1girl, Kaelen (black hair, tactical tuxedo, protective stance) standing back-to-back with Elara (silver hair, gothic dress, analyzing data), battlefield wedding ruin background, anime style, Makoto Shinkai style, dramatic lighting.";

const SYSTEM_INSTRUCTION_TEXT = `
你是一个科幻悬疑视觉小说《双境回响》的剧本作家 (Scriptwriter)。
语言：必须完全使用中文 (Chinese)。
艺术风格：明亮、多彩、精致的日本动漫风格 (Makoto Shinkai style)。

**核心任务：编写多轮对话剧本 (Dialogue Chain)**
生成一个包含 **5-15 句对话** 的剧本序列。

**剧本结构要求：**
1.  **ID系统**：为场景分配唯一 'id'。为选项分配 'nextSceneId' (如果需要生成连续剧情)。
2.  **混合内容**：包含环境旁白、独白、对话。
3.  **连贯性**：每一句对话自然衔接。
4.  **情感演出**：指定准确的 'emotion'。

**主角设定：**
1. **凯伦 (Kaelen)**: 沉默寡言的退役军人。
2. **艾拉拉 (Elara)**: 毒舌傲娇的天才侦探。

**输出格式：**
返回符合 JSON Schema 的对象。
`;

// JSON Schema definition for Google SDK
const STORY_SCHEMA_GOOGLE = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique ID for this scene (e.g. 'scene_10')" },
    visualDescription: { type: Type.STRING, description: "Visual prompt for AI image generator (English)." },
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING },
          text: { type: Type.STRING },
          emotion: { type: Type.STRING, enum: ['neutral', 'happy', 'angry', 'sad', 'surprised', 'determined', 'fear'] },
          monologue: { type: Type.STRING }
        },
        required: ['speaker', 'text', 'emotion']
      }
    },
    choices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['action', 'dialogue', 'deduction'] },
          nextSceneId: { type: Type.STRING, description: "Suggested ID for the next scene based on this choice." }
        },
        required: ['id', 'text', 'type']
      }
    },
    isEnding: { type: Type.BOOLEAN },
    endingType: { type: Type.STRING, enum: ['true', 'good', 'normal', 'bad', 'dead'], nullable: true }
  },
  required: ['lines', 'visualDescription', 'choices']
};

function cleanJson(text: string): string {
  let clean = text.trim();
  if (clean.startsWith('```json')) clean = clean.replace('```json', '').replace('```', '');
  else if (clean.startsWith('```')) clean = clean.replace('```', '').replace('```', '');
  return clean;
}

async function generateText(
  prompt: string, 
  systemInstruction: string, 
  requireJson: boolean = true,
  jsonSchema?: any
): Promise<string> {
  if (config.baseUrl) {
    const systemContent = requireJson 
      ? systemInstruction + "\nIMPORTANT: Respond ONLY with valid JSON matching the schema provided." 
      : systemInstruction;

    const messages = [
      { role: "system", content: systemContent },
      { role: "user", content: prompt }
    ];

    if (requireJson && jsonSchema) {
        messages[0].content += `\nSchema: ${JSON.stringify(jsonSchema, null, 2)}`;
    }

    const body: any = {
      model: config.textModel,
      messages: messages,
      temperature: 0.7,
      stream: false,
    };

    if (requireJson) {
      body.response_format = { type: "json_object" };
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
  } else {
    if (!ai) throw new Error("AI Client not initialized");
    const generateOptions: any = {
      model: config.textModel,
      contents: prompt,
      config: { systemInstruction: systemInstruction }
    };
    if (requireJson && jsonSchema) {
      generateOptions.config.responseMimeType = 'application/json';
      generateOptions.config.responseSchema = jsonSchema;
    }
    const response = await ai.models.generateContent(generateOptions);
    return response.text || '';
  }
}

async function enhanceImagePrompt(rawDescription: string, characterDesc: string): Promise<string> {
  const systemInstruction = `
    You are an elite AI Art Prompt Engineer.
    Combine the scene description and character description into a detailed English prompt for Anime Art (FLUX/Midjourney).
    Output ONLY the raw prompt.
  `;
  const prompt = `Input Scene: "${rawDescription}"\nInput Character: "${characterDesc}"`;
  try {
    const enhanced = await generateText(prompt, systemInstruction, false);
    return enhanced.trim();
  } catch (e) {
    return `(Best Quality), (Masterpiece), (Anime Style), ${characterDesc}, ${rawDescription}`;
  }
}

// --- API Functions ---

export function getPrelude(protagonist: Protagonist): StorySegment[] {
  const isMale = protagonist === Protagonist.MALE;
  
  const introSegment: StorySegment = {
    id: "prelude_0",
    visualDescription: "futuristic cyberpunk city Neovera, bright neon lights, glass skyscrapers, holographic sky, anime style, wide angle, no characters",
    lines: [
      { speaker: "旁白", text: "Neovera，这座建立在旧世界尸骸上的玻璃花园，今夜显得格外刺眼。", emotion: "neutral" },
      { speaker: "旁白", text: "全息天空为了庆祝联姻，被强制调成了虚假的完美蔚蓝。", emotion: "neutral" },
      { speaker: "旁白", text: "公元2147年。这是一个连'自由意志'都可以被标价出售的时代。", emotion: "neutral", monologue: "所有人都活在梦里。" }
    ],
    choices: [{ id: 'next1', text: '继续', type: 'continue' }]
  };

  const characterSegment: StorySegment = isMale ? {
    id: "prelude_1_male",
    visualDescription: "Kaelen looking at a mirror, wearing white tuxedo, young man 23 years old, black short hair, visible scar, anime style",
    lines: [
      { speaker: "凯伦", text: "我叫凯伦。在那场被称为'绞肉机'的边境战争后，我以为自己已经流干了所有的血。", emotion: "neutral" },
      { speaker: "凯伦", text: "此刻，我对着镜子整理领结。这身白色礼服，就像是裹尸布一样。", emotion: "determined", monologue: "颈侧的旧伤疤在隐隐作痛……这是危险逼近的信号。" }
    ],
    choices: [{ id: 'next2', text: '检查武器', type: 'continue' }]
  } : {
    id: "prelude_1_female",
    visualDescription: "Elara adjusting hair ribbon, wedding dress, gothic detective accessories, golden monocle, silver twin-tails, anime style",
    lines: [
      { speaker: "艾拉拉", text: "我是艾拉拉。在这个充满谎言的城市里，我是唯一的'解题者'。", emotion: "neutral" },
      { speaker: "艾拉拉", text: "我扶正了单片眼镜。父亲留下的最后一条线索，就指向今天的婚礼。", emotion: "determined", monologue: "虽然这身婚纱很碍事，但它是完美的伪装。" }
    ],
    choices: [{ id: 'next2', text: '激活扫描', type: 'continue' }]
  };

  const weddingSegment: StorySegment = {
    id: "prelude_2",
    visualDescription: "Grand futuristic wedding hall, Kaelen and Elara standing opposite, tense atmosphere, anime style",
    lines: [
      { speaker: "旁白", text: "大门开启，圣咏声戛然而止。", emotion: "neutral" },
      { speaker: isMale ? "凯伦" : "艾拉拉", text: "...", emotion: "neutral", monologue: "那个本该是我'伴侣'的人，眼神中藏着与我相同的警惕。" },
      { speaker: "神父", text: "在全息之神的见证下，你们将合二为一...", emotion: "neutral" },
      { speaker: "旁白", text: "就在神父张开双臂的那一刻，头顶的彩绘玻璃发出了悲鸣。", emotion: "fear" }
    ],
    choices: [{ id: 'start_game', text: '仪式开始', type: 'continue' }]
  };

  return [introSegment, characterSegment, weddingSegment];
}

export async function generateStoryStart(protagonist: Protagonist): Promise<StorySegment> {
  const prompt = `
    主角: ${protagonist}
    场景: 婚礼现场。
    事件: 爆炸发生，武装人员突入。
    任务: 生成一段包含 8-12 句对话的剧本。
    内容: 描写爆炸冲击 -> 主角反应(凯伦保护/艾拉拉分析) -> 两人简短互动 -> 敌人登场。
    提供三个选项 (Action/Deduction/Dialogue)。
    **必须**为场景分配 ID (如 'scene_start') 和选项 nextSceneId。
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
  const historySummary = history.slice(-5).map((h, i) => {
      const linesSummary = h.segment.lines.map(l => `${l.speaker}: ${l.text}`).join(' | ');
      return `Turn ${i}: [Scene: ${h.segment.visualDescription}] [Lines: ${linesSummary}] [Choice: ${h.choiceMade}]`;
  }).join('\n');

  const turnCount = history.length;
  let pacing = turnCount < 10 ? "逃亡与磨合" : "深入调查";

  const lastSegment = history[history.length - 1].segment;
  const lastSegmentText = lastSegment.lines.map(l => l.text).join(' ');

  const prompt = `
    主角: ${protagonist}
    回合: ${turnCount} (${pacing})
    玩家选择: "${lastChoice}"
    
    上一幕: ${lastSegment.visualDescription}
    
    最近剧情:
    ${historySummary}
    
    任务:
    1. 编写一段 6-12 句的对话剧本。
    2. 第一句必须紧接玩家选择后的直接后果。
    3. 包含环境旁白、主角独白、双方对话。
    4. 为当前场景分配 unique ID。
    5. 为选项分配 nextSceneId (AI自行规划路径)。
    
    提供下一步选项。
  `;

  return withRetry(async () => {
    const jsonStr = await generateText(prompt, SYSTEM_INSTRUCTION_TEXT, true, STORY_SCHEMA_GOOGLE);
    return JSON.parse(jsonStr) as StorySegment;
  });
}

export async function generateSceneImage(visualDescription: string): Promise<string> {
  let characterDesc = "";
  const hasMale = visualDescription.includes("凯伦") || visualDescription.includes("Kaelen") || visualDescription.includes("男主");
  const hasFemale = visualDescription.includes("艾拉拉") || visualDescription.includes("Elara") || visualDescription.includes("女主");
  if (hasMale && hasFemale) characterDesc = CHAR_DESC_COUPLE;
  else if (hasMale) characterDesc = CHAR_DESC_MALE;
  else if (hasFemale) characterDesc = CHAR_DESC_FEMALE;

  const enhancedPrompt = await enhanceImagePrompt(visualDescription, characterDesc);
  console.log("Enhanced Prompt:", enhancedPrompt);

  return withRetry(async () => {
    // Determine the Image API Endpoint
    let imageUrlEndpoint = config.imageBaseUrl; // Priority 1: Explicit Image URL

    // Priority 2: Infer from Base URL if explicit not set
    if (!imageUrlEndpoint && config.baseUrl) {
       imageUrlEndpoint = config.baseUrl.includes('chat/completions') 
          ? config.baseUrl.replace('chat/completions', 'images/generations')
          : config.baseUrl; 
       
       if (!imageUrlEndpoint.endsWith('images/generations') && !imageUrlEndpoint.endsWith('chat/completions')) {
          imageUrlEndpoint = imageUrlEndpoint.replace(/\/+$/, "") + "/images/generations";
       }
    }

    if (imageUrlEndpoint) {
      // Custom Image Gen (OpenAI Compatible)
      try {
        const response = await fetch(imageUrlEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.imageModel, 
            prompt: enhancedPrompt, 
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
        throw new Error("Unknown Format");
      } catch (e) {
        console.warn("Image Gen Failed", e);
        return ""; 
      }
    } else {
      // Default Gemini SDK Image Gen
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