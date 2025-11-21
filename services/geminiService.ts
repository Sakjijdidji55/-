import { GoogleGenAI, Type } from "@google/genai";
import { Protagonist, StorySegment, GameHistoryItem } from "../types";

// Safe access to process.env.API_KEY
const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;

if (!apiKey) {
  console.warn("API_KEY is missing. Please ensure it is set in the environment.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy_key' });

// Character Consistency Prompts - DEFINED ONCE, USED EVERYWHERE
const CHAR_DESC_MALE = "1boy, solo, male protagonist Kaelen, 23 years old, young handsome ex-soldier, short black hair, sharp blue eyes, resolute expression, wearing black tactical jacket and cargo pants, cool anime style, detailed face.";
const CHAR_DESC_FEMALE = "1girl, solo, female protagonist Elara, 20 years old, detective lolita, silver long hair in twin-tails, black ribbon, gothic lolita detective dress with lace, cute but serious face, holding a magnifying glass or monocle, anime style, detailed eyes.";
const CHAR_DESC_COUPLE = "1boy and 1girl, Kaelen (black hair tactical jacket) standing next to Elara (silver hair gothic lolita dress), anime style, masterpiece.";

// Retry helper
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

主角：
1. 凯伦 (Kaelen): 退役军人，坚毅、理性。
2. 艾拉拉 (Elara): 侦探萝莉，智慧、傲娇。

你的核心任务：
1. **提供长篇沉浸式体验**：目标游玩长度为 **30-50个回合**。
2. **增强环境描写与沉浸感**：
   - 不要只写动作，要描写**光影、声音、气味、温度**。例如："空气中弥漫着电路烧焦的刺鼻气味"、"全息霓虹灯在破碎的玻璃上折射出诡异的光"。
   - **内心活动 (Monologue)**：必须反映角色对当前局势的深层思考或情感波动，而不仅仅是吐槽。
3. **保证剧情连贯性 (严禁跳跃)**：
   - 如果场景发生变化，必须描写**移动的过程**（走过走廊、推开大门、躲入掩体）。
   - 每一个新片段必须紧密承接上一个片段的结尾。

剧情节奏控制：
   - [第1-30回合] 开端：婚礼危机。重点描写突发事件的混乱感和视觉冲击。
   - [第30-50回合] 发展：深入调查。节奏放缓，侧重于环境探索和线索分析。
   - [第50-80回合] 转折：背叛与真相。
   - [第80+回合] 高潮与结局。

输出限制：
- 剧情文本 (narrative) 控制在 3-6 句话。句子之间要有逻辑连接词。
- **必须**填写 'emotion' 字段。
- 确保 "visualDescription" 明确描述画面。
- 输出格式必须是 JSON。
`;

const STORY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.STRING,
      description: "主要的对话或动作文本。增加感官细节（视觉/听觉/嗅觉）。"
    },
    monologue: {
      type: Type.STRING,
      description: "角色的内心独白、环境氛围渲染或对局势的战术/逻辑分析。"
    },
    speaker: {
      type: Type.STRING,
      description: "说话者的名字。"
    },
    emotion: {
      type: Type.STRING,
      enum: ['neutral', 'happy', 'angry', 'sad', 'surprised', 'determined', 'fear'],
      description: "说话者当前的情感，用于控制立绘动画。"
    },
    visualDescription: {
      type: Type.STRING,
      description: "场景描述提示词。"
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
    isEnding: { type: Type.BOOLEAN },
    endingType: { type: Type.STRING, enum: ['true', 'good', 'normal', 'bad', 'dead'], nullable: true }
  },
  required: ['narrative', 'speaker', 'emotion', 'visualDescription', 'choices']
};

export function getPrelude(protagonist: Protagonist): StorySegment[] {
  const isMale = protagonist === Protagonist.MALE;
  
  const commonIntro: StorySegment = {
    narrative: "Neovera，一座建立在旧世界废墟上的玻璃之城。在这里，天空被全息投影取代，永远维持着虚假的蔚蓝。繁华的表象下，数据流如静脉般在城市深处搏动。",
    monologue: "公元2147年。人类为了生存，将灵魂出卖给了算法。而我们，不过是这巨大机器中微不足道的尘埃。",
    speaker: "旁白",
    emotion: "neutral",
    visualDescription: "futuristic cyberpunk city Neovera, bright neon lights, glass skyscrapers, holographic sky, anime style, makoto shinkai style, wide angle, no characters",
    choices: [{ id: 'next1', text: '继续', type: 'continue' }]
  };

  const characterIntro: StorySegment = isMale ? {
    narrative: "我叫凯伦。自从那场惨烈的边境战争结束后，我就试图忘记硝烟的味道。此刻，镜子里的男人穿着挺括的白色礼服，胸前的勋章被礼花遮挡，显得有些讽刺。",
    monologue: "背上的伤疤还在阴雨天隐隐作痛。但我必须履行家族的契约，哪怕这意味着要在这个虚伪的舞台上扮演一个完美的傀儡。",
    speaker: "凯伦",
    emotion: "determined",
    visualDescription: "Kaelen looking at a mirror in a dressing room, wearing white tuxedo, young man 23 years old, black short hair, sharp eyes, anime style",
    choices: [{ id: 'next2', text: '整理衣领', type: 'continue' }]
  } : {
    narrative: "我是艾拉拉。在这个充满谎言和数据的城市里，真相是唯一的奢侈品。我调整了一下头上的蕾丝发带，这身繁复的婚纱对我来说，就像是一件昂贵的伪装工具。",
    monologue: "这场政治联姻背后肯定藏着什么。父亲最近神神秘秘的，而且……那些隐藏在城市网络暗处的数据流正在异常躁动。",
    speaker: "艾拉拉",
    emotion: "determined",
    visualDescription: "Elara adjusting her hair ribbon, wearing a white wedding dress with gothic detective accessories, silver twin-tails, cute but serious, anime style",
    choices: [{ id: 'next2', text: '检查随身装备', type: 'continue' }]
  };

  const waitingScene: StorySegment = isMale ? {
    narrative: "推开休息室的门，长廊尽头是通往圣堂的入口。两旁的守卫向我致敬，但他们的眼神游移不定。空气中弥漫着一股不易察觉的焦味，像是电路过载的前兆。",
    monologue: "作为前军人，我的直觉在疯狂示警。这里太安静了，安静得像是一个精心布置的陷阱。",
    speaker: "凯伦",
    emotion: "fear",
    visualDescription: "Kaelen walking down a futuristic luxury corridor, wearing white tuxedo, black hair, anime style",
    choices: [{ id: 'next3', text: '推开大门', type: 'continue' }]
  } : {
    narrative: "走廊上的电子显示屏闪烁了一下，虽然只有一瞬间，但我捕捉到了。那是一串红色的乱码。我不动声色地握紧了藏在捧花里的微型扫描仪。",
    monologue: "看来今天的婚礼不会那么无聊了。这种干扰频率……不像是普通的系统故障。",
    speaker: "艾拉拉",
    emotion: "surprised",
    visualDescription: "Elara walking down a futuristic luxury corridor, holding a bouquet, wearing wedding dress, silver hair, anime style",
    choices: [{ id: 'next3', text: '推开大门', type: 'continue' }]
  };

  const weddingScene: StorySegment = {
    narrative: "大门缓缓开启，圣堂的穹顶下坐满了Neovera的名流。当我对上那一双眼睛时，世界仿佛静止了。那就是我的搭档……虽然此刻我们还只是名义上的陌生人。",
    monologue: "就在神父张开双臂准备宣读誓词的那一刻，我听到了——那不是礼炮的声音，而是某种高能武器充能的蜂鸣声，尖锐得刺痛耳膜。",
    speaker: isMale ? "凯伦" : "艾拉拉",
    emotion: "neutral",
    visualDescription: "A grand futuristic wedding hall, Kaelen and Elara standing opposite each other at the altar, looking at each other, holy atmosphere but tense, anime style",
    choices: [{ id: 'start_game', text: '仪式开始', type: 'continue' }]
  };

  return [commonIntro, characterIntro, waitingScene, weddingScene];
}

export async function generateStoryStart(protagonist: Protagonist): Promise<StorySegment> {
  const prompt = `
    以 ${protagonist} 的视角开始故事。
    场景：承接上一幕，婚礼现场。
    突发事件：神父的话音未落，巨大的爆炸声突然震碎了头顶绚丽的彩绘玻璃。碎片如彩色的雨点般落下，烟尘四起。
    
    任务：
    1. **细腻的环境描写**：描写爆炸的冲击波、破碎玻璃的声音、人群的尖叫、烟雾的味道。
    2. **即时反应**：描写主角的第一反应（凯伦保护他人/艾拉拉寻找掩体并快速观察局势）。
    3. **互动**：建立与另一位主角的第一次互动（眼神交流、拉手、或背靠背）。
    4. **内心独白**：反映主角此刻的震惊以及迅速冷静下来的心理过程。
    
    提供三个截然不同的应对选项 (Action/Deduction/Dialogue)。
    
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

export async function generateNextSegment(
  protagonist: Protagonist, 
  history: GameHistoryItem[], 
  lastChoice: string
): Promise<StorySegment> {
  const fullHistoryContext = history.map((h, index) => 
    `[第${index + 1}回合]
    Speaker: ${h.segment.speaker}
    Text: ${h.segment.narrative}
    Location Context: ${h.segment.visualDescription}
    Choice: ${h.choiceMade || '无'}`
  ).join('\n---\n');

  const turnCount = history.length;
  let pacingInstruction = "";

  if (turnCount < 8) {
    pacingInstruction = "阶段：[开端铺垫]。描写环境的破坏和混乱。增加感官细节（烟雾、尖叫、警报声）。不要急于离开现场。";
  } else if (turnCount < 35) {
    pacingInstruction = "阶段：[深入调查]。掌握主动，发现线索。**如果涉及位置移动，必须详细描写移动的过程和沿途的景象。**";
  } else {
    pacingInstruction = "阶段：[决战/高潮]。";
  }

  const prompt = `
    当前主角: ${protagonist}
    当前回合数: ${turnCount}
    剧情节奏: ${pacingInstruction}
    
    历史:
    ${fullHistoryContext}
    
    玩家选择: "${lastChoice}"
    
    任务：
    1. **承接上文**：根据玩家的选择，描写直接的后果。如果玩家选择了移动，请描写移动的过程，不要瞬移。
    2. **环境渲染**：加入至少一处关于环境（光、声、味）的细腻描写。
    3. **内心活动**：在 monologue 中展示角色对当前情况的战术判断或逻辑推理。
    4. **推进剧情**：自然过渡到下一个微场景。
    
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
  let characterPrompt = "";
  
  const hasMale = visualDescription.includes("凯伦") || visualDescription.includes("Kaelen") || visualDescription.includes("男主");
  const hasFemale = visualDescription.includes("艾拉拉") || visualDescription.includes("Elara") || visualDescription.includes("女主");

  if (hasMale && hasFemale) {
    characterPrompt = CHAR_DESC_COUPLE;
  } else if (hasMale) {
    characterPrompt = CHAR_DESC_MALE;
  } else if (hasFemale) {
    characterPrompt = CHAR_DESC_FEMALE;
  }

  const prompt = `
    (Best Quality), (Masterpiece), (Anime Style), (Makoto Shinkai Style).
    **Composition Constraint**: Construct a single, coherent scene. Use a cinematic composition. DO NOT use split screens.
    Highly detailed, vibrant colors, beautiful lighting.
    ${characterPrompt}
    Background/Scene Context: ${visualDescription}
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
