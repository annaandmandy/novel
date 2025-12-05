import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const SITE_URL = process.env.SITE_URL || "http://localhost:5173";
const SITE_NAME = "DogBlood AI";

// --- Client Init ---
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

const openai = OPENROUTER_KEY ? new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: OPENROUTER_KEY,
    defaultHeaders: { "HTTP-Referer": SITE_URL, "X-Title": SITE_NAME }
}) : null;

// --- 模型定義 ---
const FALLBACK_MODEL = "anthracite-org/magnum-v4-72b";
const DEEPSEEK_MODEL = "deepseek/deepseek-chat";
const PLANNER_MODEL = "deepseek/deepseek-chat";
const EDITOR_MODEL = "deepseek/deepseek-chat";

// --- 🚫 ANTI-CLICHE & STYLE CONTROL (V3.0 嚴格隔離版) ---
const ANTI_CLICHE_INSTRUCTIONS = `
【🚫 寫作禁令 (Negative Constraints) - V3.0】
1. **嚴格題材隔離 (Genre Integrity)**：
   - **如果題材是「諜戰黑道/都市/豪門」**：嚴禁出現魔法、修仙、系統面板、神殿、異能、妖魔、穿越等超自然元素。這是一個唯物主義的現實世界。
   - **如果題材是「豪門宮鬥/古代」**：嚴禁出現現代科技（手機、槍械、汽車）、現代網路用語（YYDS、打call、CPU）。
   - **如果題材是「西方奇幻」**：嚴禁出現東方修仙術語（金丹、元嬰、御劍、道友）。請使用法術位、魔力循環、騎士階級。
   - **如果題材是「末世生存」**：如果是寫實向，嚴禁出現過於魔幻的修仙技能，應以異能或科技為主。

2. **拒絕 AI 腔調**：
   - 嚴禁使用「不是...而是...」、「值得一提的是」、「命運的齒輪開始轉動」。拒絕教科書式排比。
   - 嚴禁在章節結尾進行總結或昇華。
   - **去重檢查**：嚴禁重複上一章已經寫過的對話或場景。

3. **職業與身分禁令**：
   - 除非題材是星際/賽博，否則嚴禁設定主角為數據分析師、AI工程師。

4. **世界觀去科技化**：
   - 魔法/修仙背景嚴禁使用「數據流」、「底層代碼」、「下載/上傳」。請用「靈力」、「神識」。

5. **無限流修正**：
   - 主神空間是「殘酷的角鬥場」，不是「電腦系統」。副本具有高度隨機性與致命性。
`;

// --- Utilities ---
const cleanJson = (text) => {
    try {
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstOpen = cleaned.indexOf('{');
        const lastClose = cleaned.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            cleaned = cleaned.substring(firstOpen, lastClose + 1);
        }
        return JSON.parse(cleaned);
    } catch (e) {
        console.warn("JSON parse failed, returning raw text wrapper...");
        return null; // Return null to signal failure
    }
};

const isGeminiBlockedError = (error) => {
    const errStr = (error.message || error.toString()).toLowerCase();
    return errStr.includes("prohibited") ||
        errStr.includes("safety") ||
        errStr.includes("model output must contain") ||
        errStr.includes("candidate was blocked") ||
        errStr.includes("400");
};

// ... (getToneInstruction, getPovInstruction, getRecommendedTotalChapters 保持不變) ...
const getToneInstruction = (tone) => {
    switch (tone) {
        case "歡脫": return "【基調：幽默沙雕】多用內心吐槽，淡化沈重感，製造反差萌笑點。";
        case "嚴肅": return "【基調：嚴肅正劇】邏輯縝密，氛圍莊重，著重現實殘酷與人性博弈。";
        case "虐戀": return "【基調：虐心催淚】行文唯美但殘酷，著重描寫情感的拉扯、愛而不得的痛苦與犧牲。";
        case "暗黑": return "【基調：暗黑壓抑】行文冷峻，描寫絕望與人性的陰暗面。";
        case "溫馨": return "【基調：溫馨治癒】細膩溫柔，著重生活小確幸與善意。";
        case "爽文": return "【基調：熱血爽快】節奏明快，抑揚頓挫，打臉痛快。";
        default: return "【基調：標準網文】節奏流暢，平衡劇情與互動。";
    }
};

const getPovInstruction = (pov) => {
    switch (pov) {
        case "女主": return "【視角：女主視角 (晉江風)】重點描寫細膩的情感變化、對男主的觀察。";
        case "男主": return "【視角：男主視角 (起點風)】重點描寫行動力、大局觀。";
        case "主受": return "【視角：主受視角 (耽美)】重點描寫心理掙扎、感官體驗。";
        case "主攻": return "【視角：主攻視角 (耽美)】重點描寫掌控欲、心理上的佔有。";
        case "第三人稱": return "【視角：第三人稱】多角度展現劇情與群像。";
        default: return "【視角：第三人稱限制視角】鏡頭緊跟主角。";
    }
};

const getRecommendedTotalChapters = (genre) => {
    switch (genre) {
        case "無限流": case "修仙玄幻": case "西方奇幻": case "星際科幻": return 200;
        case "末世生存": return 160;
        default: return 120;
    }
};

// --- Memory Optimizer ---
const formatMemoriesForGemini = (memories) => {
    if (!memories || memories.length === 0) return "暫無記憶";
    return memories.map((m, i) => `[Event ${i + 1}] ${m.content}`).join('\n');
};

const formatMemoriesForFallback = (memories, limit = 30) => {
    if (!memories || memories.length === 0) return "暫無記憶";
    const startMemories = memories.slice(0, 5);
    const recentMemories = memories.slice(-limit);
    const combined = [...new Set([...startMemories, ...recentMemories])];
    return combined.map(m => `- ${m.content}`).join('\n');
};

// --- API Helpers ---
const isChineseFlavor = (genre, tags = []) => {
    const safeTags = Array.isArray(tags) ? tags : [];
    return genre === '修仙玄幻' ||
        genre === '豪門宮鬥' ||
        safeTags.includes('中式恐怖') ||
        safeTags.includes('古風') ||
        safeTags.includes('盜墓');
};

// ... (callDeepSeek, translateToChinese, callOpenRouterPipeline 保持不變) ...
const callDeepSeek = async (systemPrompt, userPrompt, jsonMode = false, temperature = null) => {
    if (!OPENROUTER_KEY) throw new Error("OpenRouter API Key missing.");
    const defaultTemp = jsonMode ? 0.7 : 1.1;
    const finalTemp = temperature !== null ? temperature : defaultTemp;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_KEY}`,
                "HTTP-Referer": SITE_URL,
                "X-Title": SITE_NAME,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": DEEPSEEK_MODEL,
                "messages": [
                    { "role": "system", "content": systemPrompt + "\n請務必使用優美的繁體中文撰寫。" },
                    { "role": "user", "content": userPrompt }
                ],
                "temperature": finalTemp,
                "response_format": jsonMode ? { "type": "json_object" } : undefined,
                "max_tokens": 8192
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`DeepSeek API Error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        if (jsonMode) {
            const json = cleanJson(content);
            if (!json) throw new Error("DeepSeek JSON parse failed");
            return json;
        }
        return content;
    } catch (error) {
        console.error("DeepSeek Call Failed:", error);
        throw error;
    }
};

const translateToChinese = async (text) => {
    const prompt = `Translate to Traditional Chinese (Taiwanese Novel Style/繁體中文). Maintain tone. Output ONLY translated text.\n\n${text}`;
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_KEY}`,
                "HTTP-Referer": SITE_URL,
                "X-Title": SITE_NAME,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": FALLBACK_MODEL,
                "messages": [{ "role": "user", "content": prompt }],
                "temperature": 0.3
            })
        });
        if (!response.ok) throw new Error(`Translation Error`);
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        throw error;
    }
};

const callOpenRouterPipeline = async (systemPrompt, userPrompt, genre, tags = []) => {
    if (!OPENROUTER_KEY) throw new Error("OpenRouter API Key not configured.");

    const useDeepSeek = isChineseFlavor(genre, tags);
    const fallbackModel = useDeepSeek ? DEEPSEEK_MODEL : FALLBACK_MODEL;

    console.log(`⚠️ Fallback to ${fallbackModel}`);

    let finalSystemPrompt = systemPrompt;
    if (useDeepSeek) {
        finalSystemPrompt += "\n請務必使用優美的繁體中文撰寫。";
    } else {
        finalSystemPrompt += "\nIMPORTANT: Write in ENGLISH. Focus on quality prose.";
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_KEY}`,
                "HTTP-Referer": SITE_URL,
                "X-Title": SITE_NAME,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": fallbackModel,
                "messages": [
                    { "role": "system", "content": finalSystemPrompt },
                    { "role": "user", "content": userPrompt }
                ],
                "temperature": useDeepSeek ? 1.1 : 0.8,
                "max_tokens": 4096
            })
        });

        if (!response.ok) throw new Error(`API Error`);
        const data = await response.json();
        let generatedText = data.choices[0].message.content;

        if (!useDeepSeek) {
            generatedText = await translateToChinese(generatedText);
        }
        return generatedText;
    } catch (error) {
        throw error;
    }
};

const getGeminiModel = (jsonMode = false) => genAI.getGenerativeModel({
    model: "gemini-2.5-flash-preview-09-2025",
    safetySettings: safetySettings,
    generationConfig: jsonMode ? { responseMimeType: "application/json" } : {},
});

// ==========================================
// 🧠 Agent Functions
// ==========================================

/**
 * Planner Agent: 加入了副本進度管理
 */
const planChapter = async (director, blueprint, contextSummary, memories = [], clues = [], genre = "", tags = [], useDeepSeek = false, characters = [], instanceProgress = 0) => {
    const memoryList = formatMemoriesForFallback(memories, 50);
    const clueList = clues.length > 0 ? clues.map(c => `- ${c}`).join('\n') : "目前暫無明確線索";

    const prompt = `
    你是一位小說劇情策劃（Plot Architect）。
    請根據【導演指令】、【世界觀藍圖】與【當前進度】，規劃下一章的詳細大綱。
    
    ${ANTI_CLICHE_INSTRUCTIONS}
    
    【當前狀態】
    - 劇情階段：${director.phase}
    - 導演指令：${director.directive}
    - 副本/篇章進度：${instanceProgress}% (請根據此進度判斷劇情推進速度)
    
    【設計圖 (終極目標)】
    ${typeof blueprint === 'string' ? blueprint : JSON.stringify(blueprint)}
    
    【前情提要】
    ${contextSummary}

    【任務】
    1. **進度管理**：如果進度接近 100%，請安排高潮或收尾；如果剛開始，請安排鋪墊。
    2. **邏輯推演**：確保劇情連貫，伏筆回收。
    3. **衝突設計**：設計本章的核心衝突點。
    4. **感情規劃**：規劃感情線的具體互動。
    
    請回傳 JSON:
    {
        "chapter_title": "本章暫定標題",
        "outline": "詳細的劇情大綱 (約 300-500 字)",
        "key_clue_action": "本章對線索的操作",
        "romance_moment": "感情高光時刻",
        "suggested_progress_increment": 5, // 建議本章推進多少進度 (1-10)
        "should_finish_instance": false // 是否建議結束當前副本/篇章
    }
    `;

    if (OPENROUTER_KEY && useDeepSeek) {
        try {
            return await callDeepSeek("你是一位專業的小說策劃。", prompt, true);
        } catch (e) {
            console.warn("DeepSeek Planning failed, fallback to Gemini.");
        }
    }

    const model = getGeminiModel(true);
    try {
        const result = await model.generateContent(prompt);
        return cleanJson(result.response.text());
    } catch (e) {
        return null;
    }
};

const polishContent = async (draft, tone, pov) => {
    // ... (Same as previous polishContent) ...
    const model = getGeminiModel(false);
    const editorPrompt = `你是一位資深的網文主編。請對以下初稿進行【深度潤色】。\n${ANTI_CLICHE_INSTRUCTIONS}\n【潤色目標】去除AI味，增強畫面感，符合${tone}基調。\n[初稿]\n${draft}`;
    try {
        const result = await model.generateContent(editorPrompt);
        return result.response.text();
    } catch (e) { return draft; }
};

// ... (generateRandomSettings & generateNovelStart - Same as before, omitted for brevity) ...
// (請保留原本的 generateRandomSettings 和 generateNovelStart 完整代碼)
export const generateRandomSettings = async (genre, tags = [], tone = "一般", targetChapterCount = null, category = "BG") => {
    // ... (Copy previous implementation)
    const model = getGeminiModel(true);
    const toneDesc = getToneInstruction(tone);
    const styleGuide = `風格標籤：${tags.join('、')}。\n${toneDesc}`;
    const totalChapters = targetChapterCount || getRecommendedTotalChapters(genre);

    const prompt = `
    請為「${genre}」小說生成一套具備爆款潛力的原創設定。
    **類別**：${category}
    **預計篇幅：${totalChapters} 章**。
    ${styleGuide}
    
    ${ANTI_CLICHE_INSTRUCTIONS}
    
    【嚴格要求】
    1. **絕對原創**：禁止使用現有知名作品人名。
    2. **深度人設**：請為主角和核心對象設計完整的「人物冰山檔案」。
    3. **宏觀設計圖**：請在一開始就規劃好「終極目標」與「世界真相」。
    
    【回傳 JSON 格式】
    {
      "title": "小說標題",
      "summary": "150-200字的吸睛文案 (封底風格)",
      "trope": "核心梗",
      "design_blueprint": {
          "main_goal": "主角的終極目標",
          "world_truth": "世界的隱藏真相",
          "ending_vision": "預設結局走向 (Happy/Bad/Open)"
      },
      "protagonist": {
        "name": "主角名",
        "role": "主角",
        "profile": {
            "appearance": "外貌特徵",
            "personality_surface": "表層性格",
            "personality_core": "內在價值觀",
            "biography": "生平摘要",
            "trauma": "過去的陰影/創傷",
            "desire": "核心慾望/目標",
            "fear": "最大的恐懼",
            "charm_point": "反差萌點/小癖好"
        }
      },
      "loveInterest": {
        "name": "對象名",
        "role": "攻略對象/反派",
        "profile": {
            "appearance": "", "personality_surface": "", "personality_core": "", 
            "biography": "", "trauma": "", "desire": "", "fear": "", "charm_point": ""
        }
      }
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        return cleanJson(result.response.text());
    } catch (error) {
        return {
            title: "生成失敗",
            summary: "AI 靈感枯竭，請重試。",
            design_blueprint: {},
            protagonist: { name: "未知", profile: {} },
            loveInterest: { name: "未知", profile: {} }
        };
    }
};

export const generateNovelStart = async (genre, settings, tags = [], tone = "一般", pov = "女主") => {
    const model = getGeminiModel(true);
    const toneDesc = getToneInstruction(tone);
    const povDesc = getPovInstruction(pov);
    const styleGuide = `類型：${genre}\n風格標籤：${tags.join('、')}。\n${toneDesc}\n${povDesc}`;

    const protagonistProfile = JSON.stringify(settings.protagonist.profile);
    const loveInterestProfile = JSON.stringify(settings.loveInterest.profile);
    const blueprint = JSON.stringify(settings.design_blueprint);

    let extraInstruction = "";
    if (genre === "無限流") extraInstruction = "第一章重點：主角進入第一個恐怖/無限副本。請描寫周圍同時進入的「一群人」（約10-20人），包括尖叫的新人、冷漠的資深者、以及很快就會死掉的炮灰路人，營造群體恐慌感。**禁止描寫為電腦程式或虛擬世界，強調真實的死亡與血腥。**";
    else if (genre === "修仙玄幻") extraInstruction = "第一章重點：描寫主角身處的宗門/底層環境。請描寫周圍弟子的嘲笑、底層雜役的眾生相，不要讓場景只有主角一人。";
    else if (genre === "諜戰黑道") extraInstruction = "第一章重點：主角處於偽裝身分中。請描寫組織內部繁忙的景象、周圍的小弟或路人，展現真實的黑道/職場生態。";
    else if (genre === "末世生存") extraInstruction = "第一章重點：災難爆發。請描寫混亂奔逃的人群、被咬的路人、堵塞的交通，展現末日的宏大混亂感。";
    else if (genre === "豪門宮鬥") extraInstruction = "第一章重點：主角遭受陷害。請描寫周圍看熱鬧的群眾、勢利眼的僕人、冷漠的旁觀者。";
    else if (genre === "都市情緣") extraInstruction = "第一章重點：描寫主角與對象的初次相遇。請描寫周圍環境（酒吧/學校/公司）的熱鬧與路人的反應。";

    if (tags.includes("重生")) extraInstruction += " (需描寫前世慘死與重生後的震驚)";
    if (tags.includes("馬甲")) extraInstruction += " (需強調主角隱藏身分的謹慎與對周圍的不信任)";

    const systemPrompt = `你是一名專業小說家。請撰寫第一章。繁體中文。`;
    const userPrompt = `
    ${ANTI_CLICHE_INSTRUCTIONS}
    【小說設定】${settings.title} / ${settings.trope}
    ${styleGuide}
    【設計圖】${blueprint}
    【主角】${settings.protagonist.name}: ${protagonistProfile}
    【對象】${settings.loveInterest.name}: ${loveInterestProfile}
    
    【寫作要求】
    1. **字數**：1500-2000字。
    2. **黃金開篇**：衝突開場 (In Media Res)，直接切入事件。
    3. **群像與配角**：請自然引入 1-2 位功能性配角。務必賦予配角鮮明的特徵。
    4. **有意義的衝突**：主角遭遇的麻煩必須阻礙他的核心渴望，迫使他行動。
    5. ${extraInstruction}

    【回傳 JSON 格式】
    {
      "content": "小說內文...",
      "character_updates": [
        { "name": "主角名", "role": "主角", "status": "初始狀態", "is_new": false, "profile_update": ${protagonistProfile} },
        { "name": "配角名", "role": "配角", "status": "登場", "is_new": true, "profile_update": { "appearance": "...", "personality": "...", "charm": "...", "biography": "..." } }
      ]
    }
    `;

    try {
        const result = await model.generateContent(systemPrompt + "\n" + userPrompt);
        const jsonResponse = cleanJson(result.response.text());

        // Initialize plot state for first chapter
        jsonResponse.plot_state = {
            phase: 'setup',
            arcName: '第1卷',
            instance_progress: 5, // Initial progress
            cycle_num: 1
        };

        if (jsonResponse.content && jsonResponse.content.length > 500) {
            const polishedContent = await polishContent(jsonResponse.content, tone, pov);
            jsonResponse.content = polishedContent;
        }
        return jsonResponse;

    } catch (error) {
        if (isGeminiBlockedError(error)) {
            try {
                const content = await callOpenRouterPipeline(systemPrompt, userPrompt, genre, tags);
                return { content: content, character_updates: [], plot_state: { phase: 'setup', arcName: '第1卷', instance_progress: 5, cycle_num: 1 } };
            } catch (e) { throw new Error("生成失敗，請重試"); }
        }
        throw error;
    }
};

/**
 * 劇情狀態管理器 - V23 事件驅動版 (Event-Driven)
 * 使用 instance_progress (0-100) 來決定階段，而非固定章節數。
 */
const determinePlotDirectives = (currentChapterIndex, lastPlotState, genre, tags, totalChapters = 120) => {
    const hasTag = (t) => tags.some(tag => tag.includes(t));
    const isAngst = hasTag("虐戀") || hasTag("追妻");
    const hasSecretIdentity = hasTag("馬甲") || hasTag("掉馬");

    // 初始化狀態 (如果上一章沒有傳入狀態)
    let progress = lastPlotState?.instance_progress || 0;
    let cycleNum = lastPlotState?.cycle_num || 1;
    let arcName = lastPlotState?.arcName || `第${cycleNum}卷`;
    let phase = "setup"; // default

    // --- 1. 階段判定 (Based on Progress) ---
    // 無限流/副本類：彈性長度，由 Planner 決定何時結束
    if (progress <= 15) phase = "setup";
    else if (progress <= 75) phase = "investigation";
    else if (progress < 100) phase = "climax";
    else phase = "resolution"; // progress >= 100

    // 如果上一章已經結算 (resolution)，本章進入休整 (Rest) 或開啟新循環
    if (lastPlotState?.phase === 'resolution') {
        phase = "rest";
        progress = 0; // 重置進度給下一章（但本章還是 Rest）
    } else if (lastPlotState?.phase === 'rest') {
        // Rest 結束，開啟新循環
        phase = "setup";
        progress = 5;
        cycleNum += 1;
        arcName = `第${cycleNum}卷`;
    }

    // --- 2. 指令生成 ---
    let directive = "";
    let intensity = "medium";

    // 通用邏輯 (可根據 Genre 特化)
    if (phase === "setup") {
        intensity = "low (suspense)";
        directive = `【階段：新篇章/副本導入】主角進入新環境。**重點描寫環境的詭異/新奇、規則的建立、新配角的登場。** 暫時不要有高強度戰鬥，先鋪陳氛圍。更新 plot_state.arcName。`;
    } else if (phase === "investigation") {
        intensity = "medium";
        directive = `【階段：探索與發展】劇情推進期。尋找線索、解決小障礙、人際互動。**請根據進度條 (${progress}%) 決定劇情的緊湊度。** 若進度較低，多寫細節與鋪墊；若進度較高，準備迎接轉折。`;
    } else if (phase === "climax") {
        intensity = "high";
        directive = `【階段：高潮與決戰】**副本/事件的最高潮！** BOSS 戰、謎題揭曉、身分曝光。所有衝突集中爆發。主角必須全力以赴。`;
    } else if (phase === "resolution") {
        intensity = "low";
        directive = `【階段：結算與收尾】事件解決後的餘韻。清點收穫、治療傷勢、情感昇華。**請務必在本章結束當前事件，並給出一個明確的結局（小結）。**`;
    } else if (phase === "rest") {
        intensity = "low (fluff)";
        directive = `【階段：休整與日常】過渡章節。回到安全區/日常身分。處理戰利品、與 CP 發糖、鋪陳主線伏筆。準備迎接下一個挑戰。`;
    }

    // --- 3. 感情與馬甲 (Global Overlays) ---
    let romanceBeat = "感情升溫";
    if (phase === "investigation") romanceBeat = "並肩作戰/試探";
    if (phase === "climax") romanceBeat = isAngst ? "虐心抉擇" : "生死與共";
    if (phase === "rest") romanceBeat = "甜蜜日常/深度對話";

    let identityDirective = "";
    if (hasSecretIdentity && phase !== "rest") {
        identityDirective = "【馬甲線】：在行動中小心隱藏身分，或因意外差點掉馬。";
    }

    // --- 4. 終局判定 ---
    // 如果總章節快到了，強制覆蓋為終局模式
    if (totalChapters - currentChapterIndex <= 20) {
        arcName = "終章：最終決戰";
        phase = "finale";
        intensity = "high";
        directive = "【終局模式】收束全書伏筆，面對最終 BOSS。";
    }

    const finalDirective = `${directive}\n${identityDirective}\n**【❤️ 感情線】**：${romanceBeat}`;

    return { phase, intensity, directive: finalDirective, arcName, instanceProgress: progress, cycleNum };
};

// ==========================================
// 3. 生成下一章
// ==========================================
export const generateNextChapter = async (novelContext, previousContent, characters = [], memories = [], clues = [], tags = [], tone = "一般", pov = "女主", lastPlotState = null, useDeepSeek = false) => {
    const totalChapters = novelContext.targetEndingChapter || getRecommendedTotalChapters(novelContext.genre);

    // 1. Director decides high-level phase
    const director = determinePlotDirectives(novelContext.currentChapterIndex, lastPlotState, novelContext.genre, tags, totalChapters);

    const toneDesc = getToneInstruction(tone);
    const povDesc = getPovInstruction(pov);
    const styleGuide = `類型：${novelContext.genre} | 風格：${tags.join('、')} | ${toneDesc} | ${povDesc}`;
    const blueprintStr = JSON.stringify(novelContext.design_blueprint || {});
    const charText = characters.map(c => `- ${c.name} (${c.role}): ${c.description} [狀態: ${c.status}]`).join('\n');
    const memText = formatMemoriesForGemini(memories);
    const prevText = previousContent.slice(-2000);

    // 2. Planner details the chapter AND updates progress
    console.log("🧠 Planner working...");
    const chapterPlan = await planChapter(director, blueprintStr, prevText, memories, clues, novelContext.genre, tags, useDeepSeek, characters, director.instanceProgress);

    // Planner 決定本章實際推進了多少進度
    const progressIncrement = chapterPlan?.suggested_progress_increment || 5;
    const shouldFinish = chapterPlan?.should_finish_instance || false;

    // 更新狀態給前端
    let newProgress = director.instanceProgress + progressIncrement;
    let newPhase = director.phase;

    // 根據 Planner 的建議強制轉階段
    if (shouldFinish && director.phase === 'investigation') {
        newPhase = 'climax'; // 既然策劃說該完了，那就進高潮
        newProgress = 80;    // 強制拉高進度
    } else if (shouldFinish && director.phase === 'climax') {
        newPhase = 'resolution';
        newProgress = 100;
    } else if (newProgress >= 100) {
        newPhase = 'resolution'; // 自然滿進度
    }

    const outlineContext = chapterPlan ?
        `【本章大綱】\n標題：${chapterPlan.chapter_title}\n內容：${chapterPlan.outline}\n線索：${chapterPlan.key_clue_action}\n感情：${chapterPlan.romance_moment}` : "";

    const geminiUserPrompt = `
    ${ANTI_CLICHE_INSTRUCTIONS}
    【資訊】${novelContext.title} | ${director.arcName} | ${director.phase} (${newProgress}%)
    【風格】${styleGuide}
    【設計圖】${blueprintStr}
    【導演指令】${director.directive}
    ${outlineContext}
    
    【去重指令】請檢查前文，絕對不要重複上一章的結尾內容或對話。劇情必須向前推進。
    
    【上下文】
    記憶：${memText}
    線索：${clues.join('\n')}
    角色：${charText}
    前文：${prevText}

    【回傳 JSON】
    {
      "content": "小說內文...",
      "new_memories": [], "new_clues": [], "resolved_clues": [], "character_updates": [],
      "plot_state": { 
          "phase": "${newPhase}", 
          "arcName": "${director.arcName}",
          "instance_progress": ${newProgress},
          "cycle_num": ${director.cycleNum}
      }
    }
    `;

    try {
        const geminiModel = getGeminiModel(true);
        const result = await geminiModel.generateContent(geminiUserPrompt);
        const jsonResponse = cleanJson(result.response.text());

        if (jsonResponse.content && jsonResponse.content.length > 500) {
            const polishedContent = await polishContent(jsonResponse.content, tone, pov);
            jsonResponse.content = polishedContent;
        }

        // 確保回傳正確的狀態
        if (!jsonResponse.plot_state) {
            jsonResponse.plot_state = { phase: newPhase, arcName: director.arcName, instance_progress: newProgress, cycle_num: director.cycleNum };
        }

        return jsonResponse;

    } catch (error) {
        if (isGeminiBlockedError(error)) {
            // Fallback logic (Keep using Magnum pipeline)
            try {
                const content = await callOpenRouterPipeline(geminiUserPrompt, "", novelContext.genre, tags);
                return {
                    content: content,
                    new_memories: [], character_updates: [],
                    plot_state: { phase: newPhase, arcName: director.arcName, instance_progress: newProgress, cycle_num: director.cycleNum }
                };
            } catch (e) { throw new Error("系統忙碌"); }
        }
        throw error;
    }
};

// --- Routes ---
app.post('/api/generate-chapter', async (req, res) => {
    try {
        const { novelContext, prevText, characters, memories, clues, tags, tone, pov, lastPlotState, useDeepSeek } = req.body;
        const result = await generateNextChapter(novelContext, prevText, characters, memories, clues, tags, tone, pov, lastPlotState, useDeepSeek);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Helper Functions for Routes ---

const ensureDetailedSettings = async (genre, settings, tags = [], tone = "一般", category = "BG", useDeepSeek = false) => {
    const model = getGeminiModel(true);
    const prompt = `
    請為小說補充詳細設定。
    標題：${settings.title}
    題材：${genre}
    
    請回傳 JSON:
    {
        "design_blueprint": { "main_goal": "...", "world_truth": "...", "ending_vision": "..." },
        "protagonist": { "profile": { "appearance": "...", "personality_surface": "...", "personality_core": "...", "biography": "..." }, "gender": "..." },
        "loveInterest": { "profile": { "appearance": "...", "personality_surface": "...", "personality_core": "...", "biography": "..." }, "gender": "..." }
    }
    `;
    try {
        const result = await model.generateContent(prompt);
        return cleanJson(result.response.text());
    } catch (e) {
        return { design_blueprint: {}, protagonist: { profile: {} }, loveInterest: { profile: {} } };
    }
};

const refineCharacterProfile = async (charData, novelContext, useDeepSeek = false) => {
    const model = getGeminiModel(true);
    const prompt = `
    請完善角色設定：${charData.name}
    小說：${novelContext.title}
    
    回傳 JSON:
    {
        "profile": { "appearance": "...", "personality_surface": "...", "personality_core": "...", "biography": "..." }
    }
    `;
    try {
        const result = await model.generateContent(prompt);
        return cleanJson(result.response.text())?.profile || {};
    } catch (e) { return {}; }
};

app.post('/api/ensure-detailed-settings', async (req, res) => {
    try {
        const { genre, settings, tags, tone, category, useDeepSeek } = req.body;
        const result = await ensureDetailedSettings(genre, settings, tags, tone, category, useDeepSeek);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/refine-character', async (req, res) => {
    try {
        const { charData, novelContext, useDeepSeek } = req.body;
        const result = await refineCharacterProfile(charData, novelContext, useDeepSeek);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/generate-settings', async (req, res) => {
    try {
        const { genre, tags, tone, targetChapterCount, category } = req.body;
        const result = await generateRandomSettings(genre, tags, tone, targetChapterCount, category);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-start', async (req, res) => {
    try {
        const { genre, settings, tags, tone, pov } = req.body;
        const result = await generateNovelStart(genre, settings, tags, tone, pov);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Note: ensureDetailedSettings and refineCharacterProfile functions were not defined in the provided snippet.
// Assuming they should be imported or defined if used. 
// For now, I will add placeholders or if they are missing from the file, I should probably define them or remove the route if not needed.
// However, based on the user's error, generate-settings is definitely missing.

// If ensureDetailedSettings is needed, it needs to be defined. 
// Looking at previous context, it seems it was there. I will add a basic implementation or check if I missed it.
// Wait, the user replaced the whole file content and the previous content had comments saying "// ... (Other routes: ...)"
// This means the user accidentally removed the route definitions when pasting the code.

// I need to restore them. Since I don't have the implementation of ensureDetailedSettings and refineCharacterProfile in the snippet provided by the user,
// I will assume they are similar to generateRandomSettings or I need to find where they were.
// Actually, I can see `ensureDetailedSettings` was called in `Create.jsx`.
// I will add the routes and basic implementations if they are missing from the file.

// Let's add the routes first.


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
