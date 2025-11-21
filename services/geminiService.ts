import { GoogleGenAI, Type } from "@google/genai";
import { Protagonist, StorySegment, GameHistoryItem } from "../types";

// Safe access to process.env.API_KEY
const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;

if (!apiKey) {
  console.warn("API_KEY is missing. Please ensure it is set in the environment.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy_key' });

// Character Consistency Prompts - DEFINED ONCE, USED EVERYWHERE
// Male: 23 years old, young, handsome, short black hair, sharp eyes, tactical jacket.
const CHAR_DESC_MALE = "1boy, solo, male protagonist Kaelen, 23 years old, young handsome ex-soldier, short black hair, sharp blue eyes, resolute expression, wearing black tactical jacket and cargo pants, cool anime style, detailed face.";

// Female: 20 years old, detective lolita, silver twin-tails, gothic dress.
const CHAR_DESC_FEMALE = "1girl, solo, female protagonist Elara, 20 years old, detective lolita, silver long hair in twin-tails, black ribbon, gothic lolita detective dress with lace, cute but serious face, holding a magnifying glass or monocle, anime style, detailed eyes.";

// Couple: Both together.
const CHAR_DESC_COUPLE = "1boy and 1girl, Kaelen (black hair tactical jacket) standing next to Elara (silver hair gothic lolita dress), anime style, masterpiece.";

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
1. 凯伦·凡斯 (Kaelen - 男主): 23岁，退役军人，年轻英俊，黑色短发。性格坚毅、理性、保护欲强。
2. 艾拉拉·凡斯 (Elara - 女主): 20岁，天才侦探，洛丽塔风格(Lolita fashion)，银色双马尾。外表可爱但内心成熟冷静，擅长分析。

你的核心任务：
1. **提供长篇沉浸式体验**：目标游玩长度为 **30-50个回合**。
2. **保证剧情连贯性 (至关重要)**：
   - **因果逻辑**：每一个新片段必须是对上一个片段的直接回应。禁止跳跃。
   - **平滑过渡**：如果场景切换，必须描写路途。例如："走出大厅，穿过熙熙攘攘的街道..." 而不是直接出现在下一个地点。
   - **细节描写**：描写光影、声音、气味，让玩家感觉身临其境。
3. **丰富的结局分支**：根据玩家在整个游戏过程中的选择积累，判定最终结局。

剧情节奏控制：
   - [第1-30回合] 开端：婚礼被打断，突发危机。重点描写混乱的现场，以及两人如何在混乱中建立初步的信任。
   - [第30-50回合] 发展：深入调查。**节奏放缓**。每一个线索都需要通过对话或探索获得，不能直接给予。
   - [第50-80回合] 转折：惊人的背叛或真相。
   - [第80+回合] 高潮与结局。

输出限制：
- 剧情文本 (narrative) 控制在 3-5 句话。**句子之间要有逻辑连接词。**
- 心理活动 (monologue) 用于补充背景设定或深层心理，增强文学性。
- 确保 "visualDescription" 明确描述画面中出现的人物（凯伦或艾拉拉）以及环境。**必须指明人物的服装特征（男主黑色战术夹克，女主哥特萝莉装）。**
- 输出格式必须是 JSON。
`;

const STORY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.STRING,
      description: "主要的对话或动作文本。3-5句话，描写细腻，过渡自然。"
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
      description: "用于生成动漫风格插图的详细提示词。必须描述场景环境，并明确包含人物外观描述。"
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

// Refined Prelude to establish setting and build suspense
export function getPrelude(protagonist: Protagonist): StorySegment[] {
  const isMale = protagonist === Protagonist.MALE;
  
  const commonIntro: StorySegment = {
    narrative: "Neovera，一座建立在旧世界废墟上的玻璃之城。在这里，天空被全息投影取代，永远维持着虚假的蔚蓝。每个人都活在被算法规划好的梦境中。",
    monologue: "公元2147年。人类为了生存，出卖了自由。而我们，凡斯家族与市长家族的联姻，不过是这巨大机器中一次微不足道的齿轮咬合。",
    speaker: "旁白",
    visualDescription: "futuristic cyberpunk city Neovera, bright neon lights, glass skyscrapers, holographic sky, anime style, makoto shinkai style, wide angle, no characters",
    choices: [{ id: 'next1', text: '继续', type: 'continue' }]
  };

  const characterIntro: StorySegment = isMale ? {
    narrative: "我叫凯伦。自从那场惨烈的边境战争结束后，我就试图忘记硝烟的味道。镜子里的男人穿着挺括的白色礼服，胸前的勋章被礼花遮挡，显得有些讽刺。",
    monologue: "背上的伤疤还在阴雨天隐隐作痛。但我必须履行家族的契约，这是作为最后一名凡斯家族成员的责任……哪怕这意味着娶一个素未谋面的侦探。",
    speaker: "凯伦",
    visualDescription: "Kaelen looking at a mirror in a dressing room, wearing white tuxedo, young man 23 years old, black short hair, sharp eyes, anime style",
    choices: [{ id: 'next2', text: '整理衣领', type: 'continue' }]
  } : {
    narrative: "我是艾拉拉。在这个充满谎言和数据的城市里，真相是唯一的奢侈品。我调整了一下头上的蕾丝发带，这身繁复的婚纱对我来说，就像是一件昂贵的伪装工具。",
    monologue: "这场政治联姻背后肯定藏着什么。父亲最近神神秘秘的，而且……那些隐藏在城市网络暗处的数据流正在异常躁动。",
    speaker: "艾拉拉",
    visualDescription: "Elara adjusting her hair ribbon, wearing a white wedding dress with gothic detective accessories, silver twin-tails, cute but serious, anime style",
    choices: [{ id: 'next2', text: '检查随身装备', type: 'continue' }]
  };

  // NEW SEGMENT: The Corridor / Waiting Room
  const waitingScene: StorySegment = isMale ? {
    narrative: "推开休息室的门，长廊尽头是通往圣堂的入口。两旁的守卫向我致敬，但他们的眼神游移不定。空气中弥漫着一股不易察觉的焦味，像是电路过载的前兆。",
    monologue: "作为前军人，我的直觉在疯狂示警。这里太安静了，安静得像是一个精心布置的陷阱。",
    speaker: "凯伦",
    visualDescription: "Kaelen walking down a futuristic luxury corridor, wearing white tuxedo, black hair, anime style",
    choices: [{ id: 'next3', text: '推开大门', type: 'continue' }]
  } : {
    narrative: "走廊上的电子显示屏闪烁了一下，虽然只有一瞬间，但我捕捉到了。那是一串红色的乱码。我不动声色地握紧了藏在捧花里的微型扫描仪。",
    monologue: "看来今天的婚礼不会那么无聊了。这种干扰频率……不像是普通的系统故障。",
    speaker: "艾拉拉",
    visualDescription: "Elara walking down a futuristic luxury corridor, holding a bouquet, wearing wedding dress, silver hair, anime style",
    choices: [{ id: 'next3', text: '推开大门', type: 'continue' }]
  };

  const weddingScene: StorySegment = {
    narrative: "大门缓缓开启，圣堂的穹顶下坐满了Neovera的名流。当我对上那一双眼睛时，世界仿佛静止了。那就是我的搭档……虽然此刻我们还只是名义上的陌生人。",
    monologue: "就在神父张开双臂准备宣读誓词的那一刻，我听到了——那不是礼炮的声音，而是某种高能武器充能的蜂鸣声。",
    speaker: isMale ? "凯伦" : "艾拉拉",
    visualDescription: "A grand futuristic wedding hall, Kaelen (white tuxedo, black hair) and Elara (wedding dress, silver hair) standing opposite each other at the altar, looking at each other, holy atmosphere but tense, anime style",
    choices: [{ id: 'start_game', text: '仪式开始', type: 'continue' }]
  };

  return [commonIntro, characterIntro, waitingScene, weddingScene];
}

export async function generateStoryStart(protagonist: Protagonist): Promise<StorySegment> {
  const prompt = `
    以 ${protagonist} 的视角开始故事。
    场景：承接上一幕，婚礼现场。
    突发事件：神父的话音未落，巨大的爆炸声突然震碎了头顶绚丽的彩绘玻璃。碎片如雨点般落下，一群佩戴"虚空"面具的神秘武装分子伴随着红色的烟雾闯入。
    任务：
    1. 描写爆炸发生的瞬间冲击。
    2. 描写主角的第一反应（凯伦保护他人/艾拉拉寻找掩体并观察）。
    3. 建立与另一位主角的第一次互动（眼神交流或肢体接触）。
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
    场景: ${h.segment.narrative}
    心理/环境: ${h.segment.monologue || '无'}
    玩家选择: ${h.choiceMade || '无'}`
  ).join('\n---\n');

  const turnCount = history.length;
  let pacingInstruction = "";

  if (turnCount < 8) {
    pacingInstruction = "当前阶段：[开端铺垫]。不要急于推进剧情，详细描写周围环境的变化和角色的困惑。增加混乱和疑惑。**必须与上一段剧情紧密衔接**。不要结束游戏。";
  } else if (turnCount < 20) {
    pacingInstruction = "当前阶段：[深入调查]。主角开始掌握主动，发现线索。**如果主角移动了位置，请详细描写移动的过程。** 引入新的地点或NPC。不要结束游戏。";
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
    **重要提示**：
    1. 检查上一回合的场景和动作，确保新剧情在逻辑上是连续的。
    2. 如果玩家选择了"移动"或"前往"，必须描写移动的过程。
    3. 如果玩家选择了"对话"，必须紧接着上一句对话的内容。
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

// Updated Image Generation to ensure character consistency
export async function generateSceneImage(visualDescription: string): Promise<string> {
  let characterPrompt = "";
  
  // Simple heuristic to determine who is in the scene based on the text
  // Note: The AI narrative often mentions names. We prioritize the specific appearance constants.
  const hasMale = visualDescription.includes("凯伦") || visualDescription.includes("Kaelen") || visualDescription.includes("男主") || visualDescription.includes("me");
  const hasFemale = visualDescription.includes("艾拉拉") || visualDescription.includes("Elara") || visualDescription.includes("女主");

  if (hasMale && hasFemale) {
    characterPrompt = CHAR_DESC_COUPLE;
  } else if (hasMale) {
    characterPrompt = CHAR_DESC_MALE;
  } else if (hasFemale) {
    characterPrompt = CHAR_DESC_FEMALE;
  }

  // We append the specific character description to the dynamic scene description
  // This ensures the "look" overrides any vague description in the dynamic text.
  const prompt = `
    (Best Quality), (Masterpiece), (Anime Style), (Makoto Shinkai Style), highly detailed, vibrant colors, beautiful lighting, bloom effect.
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