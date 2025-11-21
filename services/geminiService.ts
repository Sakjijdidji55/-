import { GoogleGenAI, Type } from "@google/genai";
import { Protagonist, StorySegment, GameHistoryItem } from "../types";

// Safe access to process.env.API_KEY
const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;

if (!apiKey) {
  console.warn("API_KEY is missing. Please ensure it is set in the environment.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy_key' });

// Character Consistency Prompts
const CHAR_DESC_MALE = "男主角凯伦(Kaelen): 23岁年轻英俊的退役军人，黑色短发，眼神锐利坚毅，身穿战术风格的黑色夹克和工装裤，身材挺拔，表情冷静可靠。动漫风格。";
const CHAR_DESC_FEMALE = "女主角艾拉拉(Elara): 20岁的天才侦探，哥特洛丽塔(Detective Lolita)风格，银色长发双马尾，戴着精致的黑色蝴蝶结，穿着带有侦探元素的深色蕾丝洋装，可爱的娃娃脸但眼神充满智慧和冷静，佩戴单片眼镜或拿着放大镜。动漫风格。";

// Retry helper to handle transient network errors
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`API call failed, retrying... (${retries} attempts left). Error:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

const SYSTEM_INSTRUCTION = `
你是一个科幻悬疑视觉小说《双境回响》的游戏管理员 (Game Master)。
语言：必须完全使用中文 (Chinese)。
艺术风格：明亮、多彩、精致的日本动漫风格 (Makoto Shinkai style)。
背景：Neovera，一个表面高科技但暗流涌动的未来城市。

主角（双视角）：
1. 凯伦·凡斯 (Kaelen - 男主): 23岁，退役军人，性格坚毅、理性、保护欲强。
2. 艾拉拉·凡斯 (Elara - 女主): 20岁，天才侦探，洛丽塔风格，外表可爱但内心成熟冷静，擅长分析。

你的核心任务：
1. **提供长篇沉浸式体验**：目标游玩长度为 **30-50个回合**。除非玩家做出导致立即死亡的致命错误，否则**绝不要在20回合前结束故事**。
2. **丰富的结局分支**：根据玩家在整个游戏过程中的选择积累，判定最终结局。
   - true (真结局): 揭开世界真相，完美解决危机，两人羁绊极深。
   - good (好结局): 战胜反派，幸存下来，但谜题未完全解开。
   - normal (普通结局): 付出惨重代价才获得胜利。
   - bad (坏结局): 被反派洗脑、囚禁或世界毁灭。
   - dead (死亡结局): 也就是 Game Over，中途因愚蠢选择死亡。

3. **剧情节奏控制**：
   - [第1-5回合] 开端：婚礼被打断，突发危机，引入悬念。
   - [第6-15回合] 发展：深入调查，结识盟友，遭遇小BOSS，发现线索。
   - [第16-30回合] 转折：惊人的背叛或真相，世界观反转，主角陷入绝境。
   - [第30+回合] 高潮与结局：最终决战，收束伏笔。

限制：
- 剧情文本 (narrative) 必须简洁，不要超过3句话。
- 心理活动或环境描写 (monologue) 放在 monologue 字段中，用于背景展示。
- 确保 "visualDescription" 明确描述画面中出现的人物（凯伦或艾拉拉）以及环境。
- 输出格式必须是 JSON。
`;

const STORY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.STRING,
      description: "主要的对话或动作文本。请保持简练 (2-3句)。"
    },
    monologue: {
      type: Type.STRING,
      description: "角色的内心独白或环境氛围描写。这将显示在背景上，可以稍微长一点。"
    },
    speaker: {
      type: Type.STRING,
      description: "说话者的名字。"
    },
    visualDescription: {
      type: Type.STRING,
      description: "用于生成动漫风格插图的详细提示词。必须描述场景环境，如果有人物在场，请指明是 Kaelen 还是 Elara。"
    },
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
    isEnding: {
      type: Type.BOOLEAN,
      description: "如果导致游戏结束或胜利，则为 True。"
    },
    endingType: {
      type: Type.STRING,
      enum: ['true', 'good', 'normal', 'bad', 'dead'],
      nullable: true
    }
  },
  required: ['narrative', 'speaker', 'visualDescription', 'choices']
};

export async function generateStoryStart(protagonist: Protagonist): Promise<StorySegment> {
  const prompt = `
    以 ${protagonist} 的视角开始故事。
    场景：你们两人的婚礼现场。虽然是政治联姻，但气氛神圣。
    突发事件：婚礼突然被一群佩戴高科技面具的神秘武装人员打断，天空变成了诡异的红色。
    请用中文回答，开启这个长篇悬疑冒险。
  `;
  
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: STORY_SCHEMA,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    return JSON.parse(text) as StorySegment;
  });
}

export async function generateNextSegment(
  protagonist: Protagonist, 
  history: GameHistoryItem[], 
  lastChoice: string
): Promise<StorySegment> {
  // Context window optimization: send COMPLETE history for long-term coherence
  // Gemini 2.5 Flash has a large context window, so we can afford 50+ turns of text easily.
  const fullHistoryContext = history.map((h, index) => 
    `[第${index + 1}回合]
    场景: ${h.segment.narrative}
    心理/环境: ${h.segment.monologue || '无'}
    玩家选择: ${h.choiceMade || '无'}`
  ).join('\n---\n');

  const turnCount = history.length;
  let pacingInstruction = "";

  // Dynamic Pacing Control
  if (turnCount < 8) {
    pacingInstruction = "当前阶段：[开端铺垫]。请继续埋下伏笔，不要解决主要谜题。增加混乱和疑惑。不要结束游戏。";
  } else if (turnCount < 20) {
    pacingInstruction = "当前阶段：[深入调查]。主角开始掌握主动，发现线索。引入新的地点或NPC。不要结束游戏。";
  } else if (turnCount < 35) {
    pacingInstruction = "当前阶段：[危机深化]。剧情需要反转，揭示阴谋的冰山一角。主角面临重大挫折。不要结束游戏。";
  } else {
    pacingInstruction = "当前阶段：[决战/高潮]。如果玩家做出了正确的选择积累，可以引导向结局。否则继续战斗。请提供多种结局的可能性。";
  }

  const prompt = `
    当前主角: ${protagonist}
    当前回合数: ${turnCount}
    剧情节奏强行指引: ${pacingInstruction}
    
    完整故事记录:
    ${fullHistoryContext}
    
    玩家刚才的选择: "${lastChoice}"
    
    请根据完整历史和节奏指引继续剧情。
    如果这是 Death End (玩家选了必死选项)，可以结束。
    否则，请继续推进故事，不要让游戏过早结束。
    请用中文回答。
  `;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: STORY_SCHEMA,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    return JSON.parse(text) as StorySegment;
  });
}

export async function generateSceneImage(visualDescription: string): Promise<string> {
  // Determine which character traits to inject based on the visual description text
  let characterPrompt = "";
  
  // Simple keyword check to see who should be in the image
  const hasMale = visualDescription.includes("凯伦") || visualDescription.includes("Kaelen") || visualDescription.includes("男主");
  const hasFemale = visualDescription.includes("艾拉拉") || visualDescription.includes("Elara") || visualDescription.includes("女主");

  if (hasMale && !hasFemale) {
    characterPrompt = CHAR_DESC_MALE;
  } else if (hasFemale && !hasMale) {
    characterPrompt = CHAR_DESC_FEMALE;
  } else if (hasMale && hasFemale) {
    characterPrompt = "男主角凯伦(黑发锐利军人)和女主角艾拉拉(银发双马尾侦探)在一起。";
  }

  // Force strict art style
  const prompt = `
    (Best Quality), (Masterpiece), (Anime Style), (Makoto Shinkai Style), highly detailed, vibrant colors, beautiful lighting.
    ${characterPrompt}
    场景描述: ${visualDescription}
  `;
  
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
         parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: '16:9'
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image generated");
  });
}