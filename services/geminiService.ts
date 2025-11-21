import { GoogleGenAI, Type } from "@google/genai";
import { Protagonist, StorySegment, GameHistoryItem } from "../types";

// Safe access to process.env.API_KEY
const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;

if (!apiKey) {
  console.warn("API_KEY is missing. Please ensure it is set in the environment.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy_key' });

// Character Consistency Prompts - Enhanced for Visual Memorability
const CHAR_DESC_MALE = "1boy, solo, male protagonist Kaelen, 23 years old, young handsome ex-soldier, short messy black hair, sharp blue eyes, visible scar on neck, wearing a torn white tuxedo with tactical gear equipped over it, holding a futuristic pistol, resolute expression, dynamic pose, anime style, detailed face, cinematic lighting.";
const CHAR_DESC_FEMALE = "1girl, solo, female protagonist Elara, 20 years old, genius detective lolita, long silver hair in twin-tails with red ribbons, black gothic dress with white lace, wearing a golden monocle on one eye, holding a magnifying glass or data pad, cute but arrogant expression, anime style, masterpiece, highly detailed.";
const CHAR_DESC_COUPLE = "1boy and 1girl, Kaelen (black hair, tactical tuxedo, protective stance) standing back-to-back with Elara (silver hair, gothic dress, analyzing data), battlefield wedding ruin background, anime style, Makoto Shinkai style, dramatic lighting.";

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

**核心指令：剧情连贯性 (Absolute Continuity)**
目前玩家反馈剧情有跳跃感。为了解决这个问题，你必须严格遵守以下**连贯性法则**：

1.  **禁止瞬移 (No Teleportation)**：
    *   如果主角从A点移动到B点，**必须**描写移动的过程（走廊的脚步声、电梯的下降感、街道的风）。
    *   绝对不能上一句话还在婚礼大厅，下一句话就突然出现在地下室。

2.  **动作衔接 (Action Chaining)**：
    *   你生成的**第一句话**，必须是对玩家上一个选择的**直接物理反馈**。
    *   例如：玩家选择"躲在柱子后"，你的回复必须以"我迅速滑步闪身到大理石柱后方..."开头。

3.  **环境连续性 (Environmental Permanence)**：
    *   之前提到的物品、伤痕、天气必须保持一致。

**主角设定：**
1. **凯伦 (Kaelen)**: 沉默寡言的退役军人。即使在混乱中也保持战术冷静。
2. **艾拉拉 (Elara)**: 毒舌傲娇的天才侦探。喜欢用隐喻和嘲讽来掩饰紧张。

**剧情节奏控制：**
   - [第1-10回合] **逃亡与磨合**：婚礼现场->逃离路线->安全屋。重点描写两人如何从互不信任到被迫合作。
   - [第11-30回合] **调查与潜行**：深入城市阴暗面。每一个线索的发现都必须有逻辑铺垫。
   - [第31+回合] **真相与决战**。

**输出限制：**
- 剧情文本 (narrative) 长度放宽至 **4-8 句话**，以便你有足够的空间描写过渡细节。
- **必须**填写 'emotion' 字段。
- 确保 "visualDescription" 包含人物特征。
- 输出格式必须是 JSON。
`;

const STORY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.STRING,
      description: "主要的对话或动作文本。第一句必须紧承上文，中间包含环境/动作过渡，最后引出新局面。"
    },
    monologue: {
      type: Type.STRING,
      description: "角色的内心独白。用于补充当前场景的氛围或深层动机。"
    },
    speaker: {
      type: Type.STRING,
      description: "说话者的名字。"
    },
    emotion: {
      type: Type.STRING,
      enum: ['neutral', 'happy', 'angry', 'sad', 'surprised', 'determined', 'fear'],
      description: "说话者当前的情感。"
    },
    visualDescription: {
      type: Type.STRING,
      description: "场景描述提示词。必须与当前剧情紧密相关。"
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
    narrative: "Neovera，这座建立在旧世界尸骸上的玻璃花园，今夜显得格外刺眼。全息天空为了庆祝联姻，被强制调成了虚假的完美蔚蓝，掩盖了那些在阴影中溃烂的数据伤痕。",
    monologue: "公元2147年。这是一个连'自由意志'都可以被标价出售的时代。而我们这场盛大的婚礼，不过是财团之间的一笔交易。",
    speaker: "旁白",
    emotion: "neutral",
    visualDescription: "futuristic cyberpunk city Neovera, bright neon lights, glass skyscrapers, holographic sky, anime style, makoto shinkai style, wide angle, no characters",
    choices: [{ id: 'next1', text: '继续', type: 'continue' }]
  };

  const characterIntro: StorySegment = isMale ? {
    narrative: "我叫凯伦。在那场被称为'绞肉机'的边境战争后，我以为自己已经流干了所有的血。此刻，我对着镜子整理领结，这身昂贵的白色礼服让我觉得像是一具被精心装扮的尸体。",
    monologue: "颈侧的旧伤疤在隐隐作痛……这是危险逼近的信号。这场婚礼，恐怕不会按彩排进行。",
    speaker: "凯伦",
    emotion: "determined",
    visualDescription: "Kaelen looking at a mirror in a dressing room, wearing white tuxedo, young man 23 years old, black short hair, visible scar on neck, sharp eyes, anime style",
    choices: [{ id: 'next2', text: '检查隐藏的武器', type: 'continue' }]
  } : {
    narrative: "我是艾拉拉。在这个充满谎言的城市里，我是唯一的'解题者'。我扶正了单片眼镜，这身繁复的蕾丝婚纱重得像是一副枷锁，但我需要它来掩护我的微型终端。",
    monologue: "父亲留下的最后一条线索指向了今天的婚礼。虽然要和一个素未谋面的退伍大兵结婚很荒谬，但为了真相，我愿意入局。",
    speaker: "艾拉拉",
    emotion: "determined",
    visualDescription: "Elara adjusting her hair ribbon, wearing a white wedding dress with gothic detective accessories, golden monocle, silver twin-tails, cute but serious, anime style",
    choices: [{ id: 'next2', text: '激活数据扫描', type: 'continue' }]
  };

  const waitingScene: StorySegment = isMale ? {
    narrative: "推开休息室的门，长廊尽头的空气中弥漫着一股极难察觉的臭氧味——那是高能电容过载的前兆。两旁的守卫眼神僵硬，就像是被黑客入侵的义体。",
    monologue: "作为前特种兵的本能正在尖叫：这不是婚礼，这是刑场。",
    speaker: "凯伦",
    emotion: "fear",
    visualDescription: "Kaelen walking down a futuristic luxury corridor, wearing white tuxedo, black hair, tense atmosphere, anime style",
    choices: [{ id: 'next3', text: '推开大门', type: 'continue' }]
  } : {
    narrative: "走廊墙壁上的全息广告闪烁了一瞬，那是摩斯电码：'猎杀开始'。我微微眯起眼睛，手指轻轻扣住捧花下的EMP发生器。",
    monologue: "看来今天的'宾客'们，准备了一份不得了的贺礼啊。",
    speaker: "艾拉拉",
    emotion: "surprised",
    visualDescription: "Elara walking down a futuristic luxury corridor, holding a bouquet, wearing wedding dress, golden monocle, silver hair, anime style",
    choices: [{ id: 'next3', text: '推开大门', type: 'continue' }]
  };

  const weddingScene: StorySegment = {
    narrative: "大门开启，圣咏声戛然而止。当我对上那一双眼睛时，世界仿佛静止。那个本该是我'伴侣'的人，眼神中藏着与我相同的警惕。那是属于猎人的眼神。",
    monologue: "就在神父张开双臂的那一刻，头顶的彩绘玻璃发出了悲鸣。好戏开场了。",
    speaker: isMale ? "凯伦" : "艾拉拉",
    emotion: "neutral",
    visualDescription: "A grand futuristic wedding hall, Kaelen and Elara standing opposite each other at the altar, looking at each other intensely, holy atmosphere but tense, anime style",
    choices: [{ id: 'start_game', text: '仪式开始', type: 'continue' }]
  };

  return [commonIntro, characterIntro, waitingScene, weddingScene];
}

export async function generateStoryStart(protagonist: Protagonist): Promise<StorySegment> {
  const prompt = `
    以 ${protagonist} 的视角开始故事。
    场景：婚礼现场。
    突发事件：神父的话音未落，巨大的爆炸震碎了穹顶。一群佩戴"虚空面具"的武装人员随着红烟突入。
    
    任务：
    1. **极具张力的开场**：描写爆炸瞬间的视觉冲击（慢镜头感）。
    2. **角色高光时刻**：
       - 如果是凯伦：本能地挡在艾拉拉身前，从礼服下抽出武器，展现"守护者"的一面。
       - 如果是艾拉拉：冷静地推测出敌人的来源，并利用环境（如扔出捧花干扰）制造机会，展现"智者"的一面。
    3. **互动**：建立两人"背靠背"的信任雏形。
    4. **必须**为每段话标记 'emotion'。
    
    提供三个截然不同的应对选项 (Action-暴力突破/Deduction-快速分析/Dialogue-指挥威慑)。
    
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
  // Provide the last segment explicitly for context continuity
  const lastSegment = history[history.length - 1].segment;
  const fullHistoryContext = history.map((h, index) => 
    `[第${index + 1}回合]
    Speaker: ${h.segment.speaker}
    Text: ${h.segment.narrative}
    Location: ${h.segment.visualDescription}
    Choice: ${h.choiceMade || '无'}`
  ).join('\n---\n');

  const turnCount = history.length;
  let pacingInstruction = "";

  if (turnCount < 8) {
    pacingInstruction = "阶段：[开端铺垫]。混乱中建立羁绊。通过对话展示凯伦的'冷硬'和艾拉拉的'毒舌'。";
  } else if (turnCount < 35) {
    pacingInstruction = "阶段：[深入调查]。逐渐揭开Neovera的阴暗面。**必须**描写移动过程中的环境细节（废弃的地铁站、流光溢彩的数据中心）。";
  } else {
    pacingInstruction = "阶段：[决战/高潮]。";
  }

  const prompt = `
    当前主角: ${protagonist}
    当前回合数: ${turnCount}
    剧情节奏: ${pacingInstruction}
    
    **上一段剧情最后的场景**: "${lastSegment.visualDescription}"
    **上一段剧情最后的文本**: "${lastSegment.narrative}"
    **玩家的选择**: "${lastChoice}"
    
    任务 (Critical Task):
    1. **无缝衔接**: 你的第一句话必须直接描写玩家做出 "${lastChoice}" 后的直接动作后果。不能跳过动作过程。
    2. **环境过渡**: 如果玩家选择了离开或移动，请花费 1-2 句话描写路途中的景象，不要直接瞬移到目的地。
    3. **人设强化**: 凯伦关注战术，艾拉拉关注线索。
    
    请生成一段连贯、细腻的剧情（4-8句话）。
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
    **Composition Constraint**: Single cinematic shot. Dynamic angle. No split screens.
    Highly detailed, vibrant colors, beautiful lighting, bloom effect, ray tracing.
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