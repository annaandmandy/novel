import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import OpenAI from "openai";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const SITE_URL = "http://localhost:5173";
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
    dangerouslyAllowBrowser: true,
    defaultHeaders: { "HTTP-Referer": SITE_URL, "X-Title": SITE_NAME }
}) : null;

// --- 模型定義 ---
// 救援模型：Magnum v4 (創意寫作強，無審查，適合 Fallback)
const FALLBACK_MODEL = "anthracite-org/magnum-v4-72b";
// 中文特化模型：DeepSeek V3 (適合修仙/宮鬥/策劃)
const DEEPSEEK_MODEL = "deepseek/deepseek-chat";

// --- 🚫 ANTI-CLICHE & STYLE CONTROL ---
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

3. **職業與身分禁令**：
   - 除非題材是星際/賽博，否則嚴禁設定主角為數據分析師、AI工程師。

4. **世界觀去科技化**：
   - 魔法/修仙背景嚴禁使用「數據流」、「底層代碼」、「下載/上傳」。請用「靈力」、「神識」。

5. **無限流修正**：
   - 主神空間是「殘酷的角鬥場」，不是「電腦系統」。
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
        console.warn("JSON parse failed, checking text...", text.substring(0, 50));
        throw e;
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

const getToneInstruction = (tone) => {
    switch (tone) {
        case "歡脫": return "【基調：幽默沙雕】多用內心吐槽，淡化沈重感，製造反差萌笑點。行文輕快。";
        case "嚴肅": return "【基調：嚴肅正劇】邏輯縝密，氛圍莊重，著重現實殘酷與人性博弈。拒絕小白文風。";
        case "虐戀": return "【基調：虐心催淚】行文唯美但殘酷，著重描寫情感的拉扯、愛而不得的痛苦與犧牲。";
        case "暗黑": return "【基調：暗黑壓抑】行文冷峻，描寫絕望與人性的陰暗面。";
        case "溫馨": return "【基調：溫馨治癒】細膩溫柔，著重生活小確幸與善意。";
        case "爽文": return "【基調：熱血爽快】節奏明快，抑揚頓挫，主角不憋屈，打臉痛快。情緒調動要強烈。";
        default: return "【基調：標準網文】節奏流暢，平衡劇情與互動。";
    }
};

const getPovInstruction = (pov) => {
    switch (pov) {
        case "女主": return "【視角：女主視角 (晉江風)】重點描寫細膩的情感變化、對男主的觀察。";
        case "男主": return "【視角：男主視角 (起點風)】重點描寫行動力、大局觀、升級快感。";
        case "主受": return "【視角：主受視角 (耽美)】重點描寫心理掙扎、感官體驗（痛覺/快感）。";
        case "主攻": return "【視角：主攻視角 (耽美)】重點描寫掌控欲、凝視細節與心理上的佔有。";
        case "第三人稱": return "【視角：上帝視角】多角度展現劇情與群像。";
        default: return "【視角：第三人稱限制視角】鏡頭緊跟主角。";
    }
};

export const getRecommendedTotalChapters = (genre) => {
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

// 統一的 DeepSeek 呼叫函數 (直出中文)
const callDeepSeek = async (systemPrompt, userPrompt, jsonMode = false, temperature = null) => {
    if (!OPENROUTER_KEY) throw new Error("OpenRouter API Key missing.");
    console.log(`Calling DeepSeek V3 (JSON: ${jsonMode})...`);

    // Default temperatures: 0.7 for JSON/Logic, 1.2 for Creative Writing
    const defaultTemp = jsonMode ? 0.7 : 1.2;
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
                    { "role": "system", "content": systemPrompt + "\n請務必使用優美的繁體中文撰寫。修辭要符合中式網文習慣。" },
                    { "role": "user", "content": userPrompt }
                ],
                "temperature": finalTemp, // Use custom or default temperature
                "response_format": jsonMode ? { "type": "json_object" } : undefined,
                "max_tokens": 8192
            })
        });

        if (!response.ok) throw new Error(`DeepSeek API Error: ${response.status}`);
        const data = await response.json();
        const content = data.choices[0].message.content;

        if (jsonMode) return cleanJson(content);
        return content;
    } catch (error) {
        console.error("DeepSeek Call Failed:", error);
        throw error;
    }
};

const translateToChinese = async (text) => {
    console.log("Translating content to Traditional Chinese (using Magnum)...");
    const prompt = `
    You are a professional translator. Translate the following English novel text into fluent, beautiful Traditional Chinese (繁體中文).
    Maintain the original tone, style, and tension. Output ONLY the translated text.
    [Source Text]
    ${text}
    `;

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
        if (!response.ok) throw new Error(`Translation API Error`);
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        throw error;
    }
};

// 智慧救援管線 (Fallback Pipeline) - 僅使用 Magnum (FALLBACK_MODEL)
const callOpenRouterPipeline = async (systemPrompt, userPrompt) => {
    if (!OPENROUTER_KEY) throw new Error("OpenRouter API Key not configured.");

    console.log(`⚠️ Triggering Fallback: Switching to ${FALLBACK_MODEL} (English Pipeline)...`);

    const finalSystemPrompt = systemPrompt + "\nIMPORTANT: Write the story in ENGLISH. Focus on high-quality prose, tension, and LENGTH. Avoid AI cliches.";

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
                "messages": [
                    { "role": "system", "content": finalSystemPrompt },
                    { "role": "user", "content": userPrompt }
                ],
                "temperature": 0.8,
                "max_tokens": 4096,
                "presence_penalty": 0.3,
                "frequency_penalty": 0.3
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        let generatedText = data.choices[0].message.content;

        // Magnum Pipeline: English Gen -> Chinese Translate
        try {
            generatedText = await translateToChinese(generatedText);
        } catch (transError) {
            console.error("Translation failed, returning English text:", transError);
            generatedText += "\n\n(系統提示：翻譯服務暫時不可用，以上為原文)";
        }

        return generatedText;

    } catch (error) {
        console.error("OpenRouter Pipeline Failed:", error);
        throw error;
    }
};

const getGeminiModel = (jsonMode = false) => genAI.getGenerativeModel({
    model: "gemini-2.5-flash-preview-09-2025",
    safetySettings: safetySettings,
    generationConfig: jsonMode ? { responseMimeType: "application/json" } : {},
});

// ==========================================
// 核心 Agent 函數群
// ==========================================

const planChapter = async (director, blueprint, contextSummary, memories = [], clues = [], genre = "", tags = [], useDeepSeek = true) => {
    const memoryList = formatMemoriesForFallback(memories, 50);
    const clueList = clues.length > 0 ? clues.map(c => `- ${c}`).join('\n') : "目前暫無明確線索";

    // Extract side characters from blueprint if available
    let sideCharsText = "";
    try {
        const bp = typeof blueprint === 'string' ? JSON.parse(blueprint) : blueprint;
        if (bp && bp.side_characters && Array.isArray(bp.side_characters)) {
            sideCharsText = bp.side_characters.map(c => `- ${c.name} (${c.role}): ${c.profile}`).join('\n');
        }
    } catch (e) { }

    const prompt = `
    你是一位小說劇情策劃（Plot Architect）。
    請根據【導演節奏】、【世界觀藍圖】、【完整故事紀錄】與【現有線索】，為下一章撰寫詳細的劇情大綱。
    
    ${ANTI_CLICHE_INSTRUCTIONS}
    
    【導演指令 (本章節奏)】
    ${director.directive}
    
    【設計圖 (終極目標)】
    ${typeof blueprint === 'string' ? blueprint : JSON.stringify(blueprint)}
    
    【重要配角庫 (Available Cast)】
    ${sideCharsText || "暫無預設配角，請根據劇情需要創作"}
    (請判斷本章是否需要上述配角登場，或安排他們在背景行動)
    
    【故事進度 (Story So Far)】
    ${memoryList}
    
    【前情提要 (Immediate Context)】
    ${contextSummary}

    【待解謎題與線索 (Clue Tracker)】
    ${clueList}

    【風格與題材限制 (Genre Consistency)】
    當前題材：${genre}
    風格標籤：${tags.join('、')}
    **嚴格禁止出現不符合題材的元素**：
    - 如果是「諜戰黑道/都市/豪門」，嚴禁出現魔法、修仙、系統、神殿、異能等超自然元素。
    - 如果是「古代/宮鬥」，嚴禁出現現代科技、槍械、網路用語。
    - 如果是「西方奇幻」，嚴禁出現修仙術語（如金丹、元嬰）。
    
    【任務】
    1. **邏輯推演**：確保劇情發展符合邏輯，伏筆回收自然。
    2. **藍圖拆解**：思考如何將「終極謎題」拆解，在本章中埋下一個微小的伏筆。
    3. **衝突設計**：設計本章的核心衝突點 (Conflict) 與解決方式 (Resolution)。
    4. **感情規劃**：規劃感情線的具體互動場景。
    
    請回傳 JSON:
    {
        "chapter_title": "本章暫定標題",
        "outline": "詳細的劇情大綱 (約 300-500 字)，包含起承轉合。",
        "key_clue_action": "本章對線索的操作 (如：發現新線索、解開某線索)",
        "romance_moment": "本章的感情高光時刻設計"
    }
    `;

    // 策略：根據 useDeepSeek 決定是否使用 DeepSeek 策劃
    if (OPENROUTER_KEY && useDeepSeek) {
        try {
            return await callDeepSeek("你是一位專業的小說策劃。", prompt, true);
        } catch (e) {
            console.warn("DeepSeek Planning failed, falling back to Gemini.", e);
        }
    }

    // Fallback to Gemini
    const model = getGeminiModel(true);
    const geminiMemoryList = formatMemoriesForGemini(memories);
    try {
        // 為了 Gemini 重組 Prompt
        const geminiPrompt = `
        你是一位小說劇情策劃。請為下一章撰寫詳細大綱。
        ${ANTI_CLICHE_INSTRUCTIONS}
        導演指令：${director.directive}
        設計圖：${blueprint}
        故事進度：${geminiMemoryList}
        前情提要：${contextSummary}
        線索：${clueList}
        
        請回傳 JSON: { "chapter_title": "...", "outline": "...", "key_clue_action": "...", "romance_moment": "..." }
        `;
        const result = await model.generateContent(geminiPrompt);
        return cleanJson(result.response.text());
    } catch (e) {
        return null;
    }
};

const polishContent = async (draft, tone, pov) => {
    // 策略：其他一律使用 Gemini 進行潤色 (遵循用戶指令)
    const model = getGeminiModel(false);

    const editorPrompt = `
    你是一位資深的網文主編。請對以下小說初稿進行【深度潤色】。
    ${ANTI_CLICHE_INSTRUCTIONS}
    
    【潤色目標：商業出版級別】
    1. **去除 AI 感**：刪除重複的連接詞、過度生硬的心理獨白。
    2. **增強畫面感**：Show, Don't Tell。
    3. **風格強化**：
       - ${tone === '爽文' ? '加強情緒煽動力，用詞要狠。' : ''}
       - ${tone === '虐戀' ? '加強氛圍渲染，用詞要唯美揪心。' : ''}
    
    【注意】保留原有劇情，直接輸出潤色後的正文。
    
    [初稿內容]
    ${draft}
    `;

    try {
        const result = await model.generateContent(editorPrompt);
        return result.response.text();
    } catch (e) {
        return draft;
    }
};

// ==========================================
// 1. 生成初始設定 (中式題材用 DeepSeek，其他用 Gemini)
// ==========================================
export const generateRandomSettings = async (genre, tags = [], tone = "一般", targetChapterCount = null, category = "BG", useDeepSeek = true) => {
    const toneDesc = getToneInstruction(tone);
    const styleGuide = `風格標籤：${tags.join('、')}。\n${toneDesc}`;
    const totalChapters = targetChapterCount || getRecommendedTotalChapters(genre);

    // Model Selection Logic:
    // Directly use the user's choice. Default to true if not provided (backward compatibility).
    const shouldCallDeepSeek = useDeepSeek;

    const prompt = `
    請為「${genre}」小說生成一套**極具創意、反套路、具備爆款潛力**的原創設定。
    **類別**：${category}
    **預計篇幅：${totalChapters} 章**。
    ${styleGuide}
    ${ANTI_CLICHE_INSTRUCTIONS}
    
    【腦力激盪要求 (Brainstorming)】
    1. **拒絕平庸**：不要給我大眾化的設定。請嘗試「舊瓶裝新酒」或「極致的反差」。
    2. **核心梗 (Trope)**：必須足夠吸睛，一句話就能讓人想點進去。
    3. **網文感**：標題要夠「狗血」或「懸疑」，文案要「鉤子」十足。
    
    【嚴格要求】
    1. **絕對原創**：禁止使用現有知名作品人名。
    2. **純中文姓名**：角色名稱必須是純中文，**嚴禁**在後面加上拼音或英文（例如：嚴禁「林湘 (Lin Xiang)」），這會導致系統錯誤。
    3. **深度人設**：請為主角和核心對象設計完整的「人物冰山檔案」。
    4. **宏觀設計圖**：請在一開始就規劃好「終極目標」與「世界真相」。
    5. **重要配角**：請設計 3-6 位重要配角（死黨、反派手下、競爭對手等），每位需有姓名、身分與一個核心性格標籤。
    
    【回傳 JSON 格式】
    {
      "title": "小說標題",
      "summary": "150-200字的吸睛文案",
      "trope": "核心梗",
      "design_blueprint": { "main_goal": "...", "world_truth": "...", "ending_vision": "...", "side_characters": [{ "name": "...", "role": "...", "profile": "..." }] },
      "protagonist": { "name": "...", "role": "主角", "gender": "男/女/機器/無性別/雙性/流動/未知", "profile": { "appearance": "", "personality_surface": "", "personality_core": "", "biography": "", "trauma": "", "desire": "", "fear": "", "charm_point": "" } },
      "loveInterest": { "name": "...", "role": "攻略對象", "gender": "男/女/機器/無性別/雙性/流動/未知", "profile": { "appearance": "", "personality_surface": "", "personality_core": "", "biography": "", "trauma": "", "desire": "", "fear": "", "charm_point": "" } }
    }
    `;

    try {
        if (OPENROUTER_KEY && shouldCallDeepSeek) {
            // Use higher temperature (1.3) for random settings to encourage creativity/randomness
            return await callDeepSeek("你是一位腦洞大開的頂級網文創意總監。", prompt, true, 0.9);
        } else {
            const model = getGeminiModel(true);
            const result = await model.generateContent(prompt);
            return cleanJson(result.response.text());
        }
    } catch (error) {
        // Fallback to Gemini if DeepSeek fails, or generic error return
        if (isGeminiBlockedError(error)) {
            // If even Gemini fails, try OpenRouter Fallback (Magnum)
            try {
                const fallbackStr = await callOpenRouterPipeline("Generate novel settings JSON.", prompt);
                // Try to parse, if fails, return partial
                try { return cleanJson(fallbackStr); } catch (e) { return { title: "生成失敗", summary: "格式錯誤", protagonist: {}, loveInterest: {} }; }
            } catch (e) { return { title: "生成失敗", summary: "請重試。", protagonist: {}, loveInterest: {} }; }
        }
        return {
            title: "生成失敗",
            summary: "AI 靈感枯竭，請重試。",
            design_blueprint: {},
            protagonist: { name: "未知", gender: "未知", profile: {} },
            loveInterest: { name: "未知", gender: "未知", profile: {} }
        };
    }
};

// ==========================================
// 1.5 補完詳細設定 (當用戶手動輸入或修改後)
// ==========================================
export const ensureDetailedSettings = async (genre, simpleSettings, tags = [], tone = "一般", category = "BG", useDeepSeek = true) => {
    const toneDesc = getToneInstruction(tone);
    const styleGuide = `風格標籤：${tags.join('、')}。\n${toneDesc}`;

    const prompt = `
    請根據用戶提供的基礎小說資訊，補完深層設定（人物檔案與世界觀藍圖）。
    
    【用戶提供資訊】
    標題：${simpleSettings.title}
    文案/梗概：${simpleSettings.summary || simpleSettings.trope}
    核心梗：${simpleSettings.trope}
    主角名：${simpleSettings.protagonist}
    對象名：${simpleSettings.loveInterest}
    類別：${category}
    類型：${genre}
    ${styleGuide}
    
    【任務】
    1. 分析用戶提供的資訊，推導出合理的人物性格與背景。
    2. 建構完整的「世界觀藍圖」。
    3. 設計 3-6 位重要配角（死黨、反派手下、競爭對手等），每位需有姓名、身分與一個核心性格標籤。
    4. **純中文姓名**：所有角色名稱必須是純中文，**嚴禁**在後面加上拼音或英文（例如：嚴禁「林湘 (Lin Xiang)」）。
    5. 如果用戶未提供某些資訊，請自動補全。
    
    【回傳 JSON 格式】
    {
      "design_blueprint": { "main_goal": "...", "world_truth": "...", "ending_vision": "...", "side_characters": [{ "name": "...", "role": "...", "profile": "..." }] },
      "protagonist": { "name": "${simpleSettings.protagonist}", "role": "主角", "gender": "男/女/機器/無性別/雙性/流動/未知", "profile": { "appearance": "", "personality_surface": "", "personality_core": "", "biography": "", "trauma": "", "desire": "", "fear": "", "charm_point": "" } },
      "loveInterest": { "name": "${simpleSettings.loveInterest}", "role": "攻略對象", "gender": "男/女/機器/無性別/雙性/流動/未知", "profile": { "appearance": "", "personality_surface": "", "personality_core": "", "biography": "", "trauma": "", "desire": "", "fear": "", "charm_point": "" } }
    }
    `;

    try {
        if (OPENROUTER_KEY && useDeepSeek) {
            return await callDeepSeek("你是一位專業的小說架構師。", prompt, true);
        } else {
            const model = getGeminiModel(true);
            const result = await model.generateContent(prompt);
            return cleanJson(result.response.text());
        }
    } catch (error) {
        console.error("Failed to ensure detailed settings:", error);
        // Return minimal fallback to avoid crash
        return {
            design_blueprint: {},
            protagonist: { name: simpleSettings.protagonist, gender: "未知", profile: {} },
            loveInterest: { name: simpleSettings.loveInterest, gender: "未知", profile: {} }
        };
    }
};

// ==========================================
// 2. 生成第一章 (中式題材用 DeepSeek，其他用 Gemini)
// ==========================================
export const generateNovelStart = async (genre, settings, tags = [], tone = "一般", pov = "女主", useDeepSeek = true) => {
    const toneDesc = getToneInstruction(tone);
    const povDesc = getPovInstruction(pov);
    const styleGuide = `類型：${genre}\n風格標籤：${tags.join('、')}。\n${toneDesc}\n${povDesc}`;

    const protagonistProfile = JSON.stringify(settings.protagonist.profile);
    const loveInterestProfile = JSON.stringify(settings.loveInterest.profile);
    const blueprint = JSON.stringify(settings.design_blueprint);

    // Extract side characters
    let sideCharsText = "";
    if (settings.design_blueprint && settings.design_blueprint.side_characters) {
        sideCharsText = settings.design_blueprint.side_characters.map(c => `- ${c.name} (${c.role}): ${c.profile}`).join('\n');
    }

    const systemPrompt = `你是一位擅長「黃金三章」的網文大神。你的開篇拒絕套路，擅長用具體的畫面和衝突抓住讀者眼球。`;
    const userPrompt = `
    ${ANTI_CLICHE_INSTRUCTIONS}
    
    【小說資訊】
    標題：${settings.title}
    文案：${settings.summary}
    核心梗：${settings.trope}
    ${styleGuide}
    
    【世界觀藍圖】
    ${blueprint}
    
    【重要配角 (Available Cast)】
    ${sideCharsText}
    (請在第一章適度安排 1-2 位配角登場或被提及，增加世界真實感，但不要一次全部塞入)

    【主角】${settings.protagonist.name}
    ${protagonistProfile}
    
    【對象/重要角色】${settings.loveInterest.name}
    ${loveInterestProfile}
    
    【第一章寫作特別指令】
    1. **拒絕 AI 腔調與爛俗開頭**：
       - **嚴禁**使用「命運的齒輪開始轉動」、「這是一場遊戲」、「雙面人生」等抽象或中二的開場白。
       - **嚴禁**開篇大段心理獨白或哲學思考。直接寫「事」，不要寫「理」。
       - **嚴禁**將文案/摘要直接擴寫成正文。文案是廣告，正文是故事。
    
    2. **黃金開篇 (The Hook)**：
       - **直接切入衝突 (In Media Res)**：不要鋪墊，直接讓主角處於一個具體的麻煩、危機或特殊情境中（例如：正在被追殺、正在婚禮上被悔婚、正在驗屍台前）。
       - **畫面感 (Cinematic)**：多描寫光影、聲音、氣味、痛覺。讓讀者身臨其境。
       - **懸念設計**：結尾必須有一個「鉤子」（小高潮或反轉），讓人迫不及待想點開下一章。

    3. **字數與節奏**：
       - **字數**：3000字以上 (請務必寫長，細節要豐富)。
       - **慢熱揭露**：如果主角有隱藏身分或金手指，第一章只需「暗示」或「初露端倪」，不要像說明書一樣全盤托出。

    4. **鏡頭**：${pov}。
    5. **代詞規範**：男性用「他」，女性用「她」，動物/怪物用「它」，神/鬼/高維生物用「祂」。
    6. ${settings.extraInstruction || ""}

    【回傳 JSON 格式】
    {
      "content": "小說正文...",
      "character_updates": [
        { "name": "主角名", "role": "主角", "gender": "男/女/機器/無性別/雙性/流動/未知", "status": "初始狀態", "is_new": false, "profile_update": ${protagonistProfile} },
        { "name": "配角名", "role": "配角", "gender": "男/女/機器/無性別/雙性/流動/未知", "status": "登場", "is_new": true, "profile_update": { "appearance": "...", "personality": "...", "charm": "...", "biography": "..." } }
      ]
    }
    `;



    try {
        if (OPENROUTER_KEY && useDeepSeek) {
            return await callDeepSeek(systemPrompt, userPrompt, true);
        } else {
            const model = getGeminiModel(true);
            const result = await model.generateContent(systemPrompt + "\n" + userPrompt);
            const jsonResponse = cleanJson(result.response.text());

            // Gemini 初稿需要 Editor 潤色
            if (jsonResponse.content && jsonResponse.content.length > 500) {
                console.log("✍️ Editor Agent is polishing Chapter 1...");
                const polishedContent = await polishContent(jsonResponse.content, tone, pov);
                jsonResponse.content = polishedContent;
            }
            return jsonResponse;
        }
    } catch (error) {
        if (isGeminiBlockedError(error) || error.message.includes("DeepSeek")) {
            try {
                const content = await callOpenRouterPipeline(systemPrompt, userPrompt, genre, tags);
                return { content: content, character_updates: [] };
            } catch (e) { throw new Error("生成失敗，請重試"); }
        }
        throw error;
    }
};

// ==========================================
// 3. 生成下一章 (Writer: Gemini | Fallback: Magnum)
// ==========================================
// ... (determinePlotDirectives 保持 V22 不變) ...
const determinePlotDirectives = (currentChapterIndex, lastPlotState, genre, tags, totalChapters = 120) => {
    const hasTag = (t) => tags.some(tag => tag.includes(t));
    const isAngst = hasTag("虐戀") || hasTag("追妻");
    const hasSecretIdentity = hasTag("馬甲") || hasTag("掉馬") || hasTag("臥底") || hasTag("隱藏身分");
    const isRuleBased = hasTag("規則怪談");

    const actualTotalChapters = totalChapters || getRecommendedTotalChapters(genre);
    const phaseLength = Math.floor(actualTotalChapters / 3);
    let grandPhase = "early";
    if (currentChapterIndex > phaseLength * 2) grandPhase = "late";
    else if (currentChapterIndex > phaseLength) grandPhase = "mid";

    const isFinale = (actualTotalChapters - currentChapterIndex) <= 20;
    const ARC_LENGTH = 40;
    const cyclePos = (currentChapterIndex % ARC_LENGTH) + 1;
    const cycleNum = Math.floor(currentChapterIndex / ARC_LENGTH) + 1;
    const isSecondHalf = cyclePos > 20;
    const localPos = isSecondHalf ? cyclePos - 20 : cyclePos;
    const isRestPhase = localPos > 16;

    let directive = "";
    let romanceBeat = "";
    let intensity = "medium";
    let arcName = (cyclePos === 1) ? `第${cycleNum} 卷` : (lastPlotState?.arcName || `第${cycleNum} 卷`);
    if (cyclePos === 21) arcName = `第${cycleNum} 卷 - 下`;

    // --- 節奏控制 ---
    const pacingInstruction = isRestPhase
        ? "【節奏控制】：本章為「休整/過渡期」。請放慢節奏，多描寫日常互動、心理活動或整理收穫。"
        : "【節奏控制】：本章為「劇情推進期」。節奏緊湊。單一小事件請在3章內解決。";

    // --- 🌍 世界觀升級 ---
    let scaleInstruction = "";
    if (grandPhase === "early") scaleInstruction = "【前期 (生存與適應)】：危機圍繞在主角個人生存。";
    else if (grandPhase === "mid") scaleInstruction = "【中期 (勢力與博弈)】：危機擴大到組織。";
    else scaleInstruction = "【後期 (揭密與決戰)】：危機涉及世界存亡。";

    // --- ❤️ 感情線 ---
    if (isRestPhase) {
        romanceBeat = "【感情：日常溫存/深度對話】解開誤會，甜蜜互動。";
    } else {
        if (localPos <= 5) romanceBeat = "【感情：並肩作戰/試探】";
        else if (localPos <= 12) romanceBeat = "【感情：升溫/默契】";
        else {
            if (hasSecretIdentity) romanceBeat = "【感情：猜忌/身分危機】";
            else if (isAngst) romanceBeat = "【感情：冰點/互相折磨】";
            else romanceBeat = "【感情：生死與共/爆發】";
        }
    }

    // --- 🎭 馬甲線 ---
    let identityDirective = "";
    if (hasSecretIdentity) {
        if (isRestPhase) identityDirective = "【馬甲線】：回歸日常身分，處理矛盾。";
        else identityDirective = "【馬甲線】：執行任務時小心隱藏真實能力。";
    }

    // --- 終局覆寫 ---
    if (isFinale) {
        arcName = "終章：最終決戰";
        intensity = "high";
        scaleInstruction = "【終局模式】：所有伏筆必須回收。";
        if (actualTotalChapters - currentChapterIndex <= 3) directive = "【階段：大結局 (Epilogue)】塵埃落定。圓滿結局。";
        else if (actualTotalChapters - currentChapterIndex <= 10) directive = "【階段：終極決戰 (Climax)】面對最終BOSS。場面宏大。";
        else directive = "【階段：終局前奏 (Setup)】揭開「世界真相」。";

        const finalDirective = `${directive} \n\n **【❤️ 感情線必修題】**：${romanceBeat} \n **【🌍 三幕劇階段】**：${scaleInstruction} `;
        return { phase: "finale", intensity, directive: finalDirective, arcName };
    }

    if (genre === "無限流") {
        if (isRestPhase) directive = isSecondHalf ? "【階段：循環結算】回到主神空間。" : "【階段：現實世界】回到現實。";
        else if (localPos <= 3) {
            directive = `【階段：副本導入】描寫詭異規則。更新 plot_state.arcName。`;
            if (isRuleBased) directive += " **【規則怪談】請列出本副本的《規則守則》，包含矛盾規則。**";
        }
        else if (localPos <= 12) {
            directive = "【階段：深度探索】尋找線索，經歷試錯。雙線並行。";
            if (isRuleBased) directive += " **【規則怪談】驗證規則真偽，發現陷阱。出現精神污染現象。**";
        }
        else directive = "【階段：副本高潮】BOSS戰。主角利用線索絕地反擊。";
    }
    else if (genre === "諜戰黑道") {
        if (isRestPhase) directive = "【階段：偽裝與日常】回到表面身分。";
        else if (localPos <= 3) directive = `【階段：接獲任務】情報蒐集與佈局。`;
        else if (localPos <= 12) directive = "【階段：行動與博弈】執行潛入、跟蹤或交易。";
        else directive = "【階段：任務高潮】槍戰、追車或心理對決。";
    }
    else if (genre === "修仙玄幻") {
        if (isRestPhase) directive = "【階段：閉關與消化】回到宗門。清點收穫。";
        else if (localPos <= 3) directive = `【階段：機緣開啟】秘境或拍賣會。`;
        else if (localPos <= 12) directive = "【階段：爭奪與歷練】遭遇追殺。";
        else directive = "【階段：事件高潮】奪寶或打臉。";
    }
    else if (genre === "西方奇幻") {
        if (isRestPhase) directive = "【階段：酒館與休整】回到城鎮/公會。鑑定戰利品，升級裝備，招募新隊友。";
        else if (localPos <= 3) directive = `【階段：接取委託】前往新區域。遭遇魔物前哨。`;
        else if (localPos <= 12) directive = "【階段：地下城探索】解開機關，對抗精英怪。";
        else directive = "【階段：討伐BOSS】擊敗區域領主。";
    }
    else if (genre === "星際科幻") {
        if (isRestPhase) directive = "【階段：停泊與改裝】回到太空站。維修機甲。";
        else if (localPos <= 3) directive = `【階段：航線開啟】前往新星系。遭遇海盜。`;
        else if (localPos <= 12) directive = "【階段：戰術滲透】地面推進或小規模艦隊戰。";
        else directive = "【階段：戰役高潮】攻破敵方要塞。";
    }
    else if (genre === "末世生存") {
        if (isRestPhase) directive = "【階段：基地建設】回到安全區。種植與防禦。";
        else if (localPos <= 3) directive = `【階段：外出行動】尋找物資。`;
        else if (localPos <= 12) directive = "【階段：危機四伏】遭遇變異生物。";
        else directive = "【階段：生存高潮】屍潮防守。";
    }
    else if (genre === "豪門宮鬥") {
        if (isRestPhase) directive = "【階段：私下籌謀】分析局勢，拉攏盟友。";
        else if (localPos <= 3) directive = `【階段：風波起】宴會或聚會。`;
        else if (localPos <= 12) directive = "【階段：見招拆招】尋找破局關鍵。";
        else directive = "【階段：反擊高潮】當眾揭穿陰謀。";
    }
    else if (genre === "都市情緣") {
        if (isRestPhase) directive = "【階段：甜蜜約會】純粹發糖。";
        else if (localPos <= 3) directive = `【階段：生活波瀾】工作難題或情敵出現。`;
        else if (localPos <= 12) directive = "【階段：互相扶持】共同面對問題。";
        else directive = "【階段：解決與告白】問題解決。";
    }
    else { // Fallback
        if (isRestPhase) directive = "【階段：休整與過渡】";
        else if (localPos <= 12) directive = "【階段：劇情發展】";
        else directive = "【階段：高潮】";
    }

    const finalDirective = `
    ${directive}
    ${identityDirective ? `\n**【🎭 馬甲線特別指令】**：${identityDirective}` : ""}
\n **【❤️ 感情線必修題】**：${romanceBeat}
\n **【🌍 三幕劇階段】**：${scaleInstruction}
\n${pacingInstruction} `;

    return { phase: grandPhase, intensity, directive: finalDirective, arcName };
};

export const generateNextChapter = async (novelContext, previousContent, characters = [], memories = [], clues = [], tags = [], tone = "一般", pov = "女主", lastPlotState = null) => {
    const totalChapters = novelContext.targetEndingChapter || getRecommendedTotalChapters(novelContext.genre);

    // 1. Director (Logic)
    const director = determinePlotDirectives(novelContext.currentChapterIndex, lastPlotState, novelContext.genre, tags, totalChapters);

    const toneDesc = getToneInstruction(tone);
    const povDesc = getPovInstruction(pov);
    const styleGuide = `類型：${novelContext.genre} | 風格標籤：${tags.join('、')}。\n${toneDesc} \n${povDesc} `;
    const blueprintStr = JSON.stringify(novelContext.design_blueprint || {});
    const charText = characters.map(c => `- ${c.name} (${c.gender || '未知'}/${c.role}): ${c.description} [狀態: ${c.status}]`).join('\n');
    const memText = formatMemoriesForGemini(memories);
    const prevText = previousContent.slice(-1500);

    // 2. Planner (Logic = DeepSeek if selected, else Gemini)
    console.log("🧠 Planner Agent is working...");
    const useDeepSeek = novelContext.settings?.useDeepSeek ?? true; // Default to true if not set
    const chapterPlan = await planChapter(director, blueprintStr, prevText, memories, clues, novelContext.genre, tags, useDeepSeek);

    const outlineContext = chapterPlan ?
        `【本章劇情大綱(必須嚴格執行)】\n標題：${chapterPlan.chapter_title} \n大綱：${chapterPlan.outline} \n關鍵線索操作：${chapterPlan.key_clue_action} \n感情高光：${chapterPlan.romance_moment} ` :
        "";

    const cluesText = clues.length > 0 ? clues.join('\n') : "目前暫無未解線索";

    let endingInstruction = "";
    const left = totalChapters - novelContext.currentChapterIndex;
    if (left <= 5 && left > 0) endingInstruction = `【全局終局倒數】還有 ${left} 章完結。收束全書伏筆。`;
    else if (left <= 0) endingInstruction = `【全書大結局】這是最後一章！`;

    const baseSystemPrompt = `你是一名專業的小說家。請撰寫下一章並維護世界觀數據。`;
    const geminiUserPrompt = `
    ${ANTI_CLICHE_INSTRUCTIONS}
    【小說資訊】${novelContext.title}
    ${styleGuide}
    【設計圖】${blueprintStr}
    【導演指令】${director.directive}
    ${endingInstruction}
    ${outlineContext}
    
    【寫作重點】
    1. **字數**：3000字以上 (請務必寫長，細節要豐富)。
    2. **嚴格執行大綱**：請完全依照【本章劇情大綱】發展劇情，不要隨意更改核心走向。
    3. **鏡頭規則**：${pov}。鏡頭必須跟隨主角。
    4. **群像**：請描寫配角與路人的反應，增加世界真實感。
    5. **線索**：請根據「線索庫」推進謎題。
    6. **代詞規範**：男性用「他」，女性用「她」，動物/怪物用「它」，神/鬼/高維生物用「祂」。
    
    【上下文】
記憶：${memText}
線索：${cluesText}
角色：${charText}
前文：${prevText}

    【回傳 JSON】
{
    "content": "小說內文...",
        "new_memories": ["關鍵事件"],
            "new_clues": [],
                "resolved_clues": [],
                    "character_updates": [],
                        "plot_state": { "phase": "${director.phase}", "arcName": "${director.arcName}" }
}
`;

    try {
        // 3. Writer (Always Gemini as per request)
        const geminiModel = getGeminiModel(true);
        const geminiPrompt = baseSystemPrompt + "\n" + geminiUserPrompt + `\n 回傳 JSON Schema 請包含 plot_state`;
        const result = await geminiModel.generateContent(geminiPrompt);
        const jsonResponse = cleanJson(result.response.text());

        // 4. Editor (Always Gemini as per request)
        if (jsonResponse.content && jsonResponse.content.length > 500) {
            console.log("✍️ Editor Agent is polishing Chapter...");
            const polishedContent = await polishContent(jsonResponse.content, tone, pov);
            jsonResponse.content = polishedContent;
        }

        return jsonResponse;

    } catch (error) {
        if (isGeminiBlockedError(error)) {
            console.log("🚀 Fallback Triggered...");
            try {
                // Fallback uses Magnum (FALLBACK_MODEL) via pipeline
                const englishUserPrompt = `
Novel: ${novelContext.title}
                Current Arc: ${director.arcName}
DIRECTOR: ${director.directive}
POV: ${pov}
Context: ${prevText}
Task: Write next chapter.
                `;
                const chineseContent = await callOpenRouterPipeline(baseSystemPrompt, englishUserPrompt, novelContext.genre, tags);
                return {
                    content: chineseContent,
                    new_memories: [], new_clues: [], resolved_clues: [], character_updates: [],
                    plot_state: { phase: director.phase, arcName: director.arcName }
                };
            } catch (fbError) {
                throw new Error("系統暫時無法生成內容，請稍後再試。");
            }
        }
        throw error;
    }
};