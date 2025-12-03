import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const SITE_URL = "http://localhost:5173";
const SITE_NAME = "DogBlood AI";

// --- Client 1: Google Gemini (Primary) ---
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

// --- Client 2: OpenRouter (Fallback) ---
// Use Magnum v4 (Anthracite) - Excellent for creative writing
const FALLBACK_MODEL = "anthracite-org/magnum-v4-72b";

const cleanJson = (text) => {
    try {
        // 1. Basic Markdown cleanup
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // 2. Aggressive cleanup for common JSON issues from LLMs
        // Ensure we only parse the content between the first { and last }
        const firstOpen = cleaned.indexOf('{');
        const lastClose = cleaned.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            cleaned = cleaned.substring(firstOpen, lastClose + 1);
        }

        return JSON.parse(cleaned);
    } catch (e) {
        console.warn("Standard JSON parse failed, attempting regex repair...");
        throw e;
    }
};

/**
 * Helper: Translate text to Traditional Chinese using OpenRouter (Magnum) to avoid safety blocks
 */
const translateToChinese = async (text) => {
    console.log("Translating content to Traditional Chinese (using OpenRouter)...");

    const prompt = `
    You are a professional translator. Translate the following English novel text into fluent, beautiful Traditional Chinese (繁體中文).
    Maintain the original tone, style, and tension.
    Output ONLY the translated text.
    
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
                "model": FALLBACK_MODEL, // Use Magnum for translation too
                "messages": [
                    { "role": "user", "content": prompt }
                ],
                "temperature": 0.3 // Lower temperature for translation accuracy
            })
        });

        if (!response.ok) {
            throw new Error(`Translation API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Translation error:", error);
        throw error;
    }
};

/**
 * Helper: Call OpenRouter Pipeline (English Gen -> Chinese Trans)
 */
const callOpenRouterPipeline = async (systemPrompt, userPrompt) => {
    if (!OPENROUTER_KEY) throw new Error("OpenRouter API Key not configured for fallback.");

    // Step 1: Generate in English (High Stability)
    console.log(`⚠️ Triggering Fallback: Generating in English with ${FALLBACK_MODEL}...`);

    const englishInstruction = "IMPORTANT: Write the story in ENGLISH. Do not use Chinese yet. Focus on high-quality prose and tension.";

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
                    { "role": "system", "content": systemPrompt + "\n" + englishInstruction },
                    { "role": "user", "content": userPrompt }
                ],
                "temperature": 0.8
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const englishText = data.choices[0].message.content;

        // Step 2: Translate to Chinese
        try {
            const chineseText = await translateToChinese(englishText);
            return chineseText;
        } catch (transError) {
            console.error("Translation failed, returning English text:", transError);
            return englishText + "\n\n(系統提示：翻譯服務暫時不可用，以上為原文)";
        }

    } catch (error) {
        console.error("OpenRouter Pipeline Failed:", error);
        throw error;
    }
};

/**
 * Helper: Call OpenRouter (Using native fetch)
 */
const callOpenRouter = async (systemPrompt, userPrompt, jsonMode = false) => {
    if (!OPENROUTER_KEY) throw new Error("OpenRouter API Key not configured for fallback.");
    console.log(`⚠️ Triggering Fallback: Switching to ${FALLBACK_MODEL}...`);

    // Magnum understands instructions well, but emphasizing Chinese is still good practice.
    const languageInstruction = "Strictly write in Traditional Chinese (繁體中文). Do not use English.";

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
                    { "role": "system", "content": systemPrompt + "\n" + languageInstruction },
                    { "role": "user", "content": userPrompt }
                ]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const text = data.choices[0].message.content;

        if (jsonMode) {
            try {
                return cleanJson(text);
            } catch (e) {
                console.error("JSON Repair Failed, returning raw content wrapped.");
                // ⭐️ Ultimate Fallback: Return raw text wrapped as valid object
                return {
                    content: text,
                    new_memories: [],
                    character_updates: []
                };
            }
        }
        return text;
    } catch (error) {
        console.error("OpenRouter API Call Failed:", error);
        throw error;
    }
};

// Helper to get Gemini model
const getGeminiModel = (jsonMode = false) => genAI.getGenerativeModel({
    model: "gemini-2.5-flash-preview-09-2025",
    safetySettings: safetySettings,
    generationConfig: jsonMode ? { responseMimeType: "application/json" } : {},
});

/**
 * 生成小說初始設定
 * 優化點：
 * 1. 加入 Tags 影響設定風格。
 * 2. 要求生成「角色特質」與「反差點」，避免臉譜化。
 * 3. 摘要要求寫成「文案」風格，而非百科全書風格。
 */
export const generateRandomSettings = async (genre, tags = []) => {
    const model = getGeminiModel(true); // 使用 JSON Mode

    // 構建風格描述
    const styleGuide = tags.length > 0 ? `用戶偏好風格：${tags.join('、')}。` : "";

    const prompt = `
    請你扮演一位白金級的網絡小說大神，為一部「${genre}」類型的小說生成一套具備爆款潛力的原創設定。
    ${styleGuide}
    
    【嚴格要求】
    1. **絕對原創**：禁止使用沈清秋、魏無羨、哈利波特等知名人物名。請創造有記憶點、符合類型的新名字。
    2. **繁體中文**：所有內容必須是繁體中文。
    3. **人設立體**：主角和反派不能是紙片人，必須有「性格缺陷」或「反差萌」。
    4. **黃金文案**：摘要(Summary)請寫成「封底文案」風格，要展示核心衝突、金手指爽點或情感虐點，吸引讀者點擊。
    
    請回傳 JSON 格式：
    {
      "title": "小說標題 (需吸睛，符合網文命名風格)",
      "protagonist": "主角姓名",
      "protagonist_traits": "主角性格關鍵詞 (如: 腹黑、社恐、高智商)",
      "loveInterest": "對象/反派姓名",
      "loveInterest_traits": "性格關鍵詞",
      "trope": "核心梗 (例如：重生復仇、系統攻略、破鏡重圓)",
      "summary": "150-200字的吸睛文案..."
    }
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        // Gemini 2.5 Flash 在 JSON mode 下通常不需要 regex 清理，但保留以防萬一
        const text = response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Error generating settings:", error);
        return {
            title: "生成失敗：靈感枯竭",
            protagonist: "未知",
            loveInterest: "未知",
            trope: "未知",
            summary: "AI 暫時無法連接到靈感庫，請重試。"
        };
    }
};

/**
 * 生成第一章
 * 優化點：
 * 1. 強調「黃金三章」法則：第一章必須有衝突或懸念。
 * 2. 禁止「說明書式」寫作，要求「Show, Don't Tell」。
 * 3. 引入功能性配角。
 */
export const generateNovelStart = async (genre, settings, tags = []) => {
    // For start generation, we also try Gemini first, but usually it's safer.
    // If needed, we can implement the same fallback logic here.
    const model = getGeminiModel(false);

    const styleGuide = tags.length > 0 ? `風格標籤：${tags.join('、')} (請務必遵守此基調)。` : "";
    const toneInstruction = genre === 'BL'
        ? '耽美風格：著重情感拉扯、眼神交流、曖昧氛圍或極致的衝突張力。'
        : '爽文風格：節奏明快，抑揚頓挫，主角不憋屈，有明確的目標感。';

    const prompt = `
    你是一個專業的網絡小說作家。請根據以下設定，撰寫小說的**第一章**。
    
    【設定卡】
    - 標題：${settings.title}
    - 主角：${settings.protagonist} (${settings.protagonist_traits || "性格鮮明"})
    - 關鍵人物：${settings.loveInterest} (${settings.loveInterest_traits || "性格鮮明"})
    - 核心梗：${settings.trope}
    - 摘要：${settings.summary}
    - ${styleGuide}
    
    【寫作指導：黃金開篇】
    1. **切入點**：直接從「事件」或「衝突」切入 (In Media Res)，不要寫長篇大論的世界觀背景介紹。背景設定要融合在劇情互動中。
    2. **感官描寫**：多描寫環境氛圍（光影、氣味、聲音）來烘托情緒。
    3. **配角引入**：請自然引入 1-2 位功能性配角（如：勢利眼的親戚、忠心的僕人、挑釁的路人），利用他們的反應來側面襯托主角的處境。
    4. **${toneInstruction}**
    5. **重生文特別條款**：如果是重生/穿越文，第一章需要描寫死亡/穿越的瞬間以及醒來後的心理震驚與現狀確認。

    【格式要求】
    - 字數：1000-1200 字。
    - 語言：繁體中文。
    - 直接輸出正文，不要有「第一章」標題或前言。
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error generating novel start:", error);
        throw error;
    }
};

/**
 * Generate Next Chapter (Hybrid)
 */
export const generateNextChapter = async (novelContext, previousContent, characters = [], memories = [], tags = []) => {
    // 1. Prepare Data
    const charText = characters.map(c => `- ${c.name} (${c.role}): ${c.description} [狀態: ${c.status}]`).join('\n');
    const memText = memories.slice(0, 15).map(m => `- ${m.content}`).join('\n');
    const styleGuide = tags.length > 0 ? `風格標籤：${tags.join('、')}` : "";

    let endingInstruction = "";
    if (novelContext.targetEndingChapter) {
        const left = novelContext.targetEndingChapter - novelContext.currentChapterIndex;
        if (left <= 3 && left > 0) endingInstruction = `【結局倒數】還有 ${left} 章完結。請開始收束所有伏筆，劇情進入最終高潮。`;
        else if (left <= 0) endingInstruction = `【大結局】這是最後一章！請給出一個情感飽滿、邏輯自洽的結局，回應開篇的伏筆。`;
    }

    const baseSystemPrompt = `你是一名專業的小說家。請撰寫下一章並維護世界觀數據。`;

    const userPrompt = `
    小說：${novelContext.title} (${novelContext.trope})
    ${styleGuide}
    ${endingInstruction}

    記憶庫：${memText}
    角色：${charText}
    前文：${previousContent.slice(-2000)}

    【任務】
    1. 承接劇情，邏輯連貫。
    2. 動態引入配角。
    3. JSON格式回傳: content, new_memories, character_updates。
    4. 內容需包含張力與衝突。
    5. **角色更新**：
       - **新角色**：請提供 \`name\`, \`description\` (完整介紹), \`status\` (簡短)。
       - **既有角色**：請提供 \`name\`, \`description_append\` (新增事蹟), \`status\` (簡短)。
    `;

    // --- STRATEGY: Try Gemini First ---
    try {
        const geminiModel = getGeminiModel(true);

        // Gemini Prompt Construction (Standard)
        const geminiPrompt = baseSystemPrompt + "\n" + userPrompt + `\n 回傳 JSON Schema: { "content": "...", "new_memories": ["重要事件摘要"], "character_updates": [{ "name": "角色名", "status": "狀態", "description": "新角色介紹", "description_append": "既有角色更新" }] }`;

        const result = await geminiModel.generateContent(geminiPrompt);
        const response = await result.response;
        const text = response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        const errStr = error.toString();
        console.warn("Gemini Error:", errStr);

        // Catch Safety errors, Empty output errors (blocked), and 400s
        if (errStr.includes("PROHIBITED_CONTENT") ||
            errStr.includes("Safety") ||
            errStr.includes("400") ||
            errStr.includes("model output must contain") ||
            errStr.includes("Candidate was blocked")) {

            console.log("🚀 Fallback: Switching to English Gen + Translation Pipeline...");

            try {
                // Generate Text in English -> Translate to Chinese
                const chineseContent = await callOpenRouterPipeline(baseSystemPrompt, userPrompt);

                // Return wrapped object (Skipping wiki updates to ensure stability)
                return {
                    content: chineseContent,
                    new_memories: [],
                    character_updates: []
                };
            } catch (fbError) {
                console.error("Pipeline Generation Failed:", fbError);
                throw new Error("系統暫時無法生成內容，請稍後再試。");
            }
        }
        throw error;
    }
};