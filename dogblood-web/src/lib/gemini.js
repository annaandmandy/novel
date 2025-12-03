import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Missing VITE_GEMINI_API_KEY in .env file");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Helper to get model - User requested specific model
const getModel = (jsonMode = false) => genAI.getGenerativeModel({
    model: "gemini-2.5-flash-preview-09-2025",
    generationConfig: jsonMode ? { responseMimeType: "application/json" } : {},
    safetySettings: [
        {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE",
        },
        {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE",
        },
        {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE",
        },
        {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE",
        },
    ],
});

/**
 * 生成小說初始設定
 * 優化點：
 * 1. 加入 Tags 影響設定風格。
 * 2. 要求生成「角色特質」與「反差點」，避免臉譜化。
 * 3. 摘要要求寫成「文案」風格，而非百科全書風格。
 */
export const generateRandomSettings = async (genre, tags = []) => {
    const model = getModel(true); // 使用 JSON Mode

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
    const model = getModel(false); // 第一章回傳純文本，讓 AI 自由發揮

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
 * 生成下一章
 * 優化點：
 * 1. **角色保護機制**：防止隨機發便當。
 * 2. **動態世界觀**：根據劇情進度引入新角色。
 * 3. **節奏控制**：要求 AI 識別當前是「鋪墊期」還是「高潮期」。
 */
export const generateNextChapter = async (novelContext, previousContent, characters = [], memories = [], tags = []) => {
    const model = getModel(true); // JSON Mode

    const charText = characters.map(c => `- ${c.name} (${c.role}): ${c.description} [狀態: ${c.status}]`).join('\n');
    // 取最近的 15 條記憶，避免 Context 溢出，但保留關鍵資訊
    const memText = memories.slice(0, 15).map(m => `- ${m.content}`).join('\n');
    const styleGuide = tags.length > 0 ? `風格標籤：${tags.join('、')}` : "";

    // 結局判定邏輯
    let endingInstruction = "";
    if (novelContext.targetEndingChapter) {
        const chaptersLeft = novelContext.targetEndingChapter - novelContext.currentChapterIndex;
        if (chaptersLeft <= 3 && chaptersLeft > 0) {
            endingInstruction = `【結局倒數】還有 ${chaptersLeft} 章完結。請開始收束所有伏筆，劇情進入最終高潮。`;
        } else if (chaptersLeft <= 0) {
            endingInstruction = `【大結局】這是最後一章！請給出一個情感飽滿、邏輯自洽的結局，回應開篇的伏筆。`;
        }
    }

    const prompt = `
    你是一名網文小說家。請撰寫下一章（第 ${novelContext.currentChapterIndex + 1} 章），並維護世界觀數據。

    【當前狀態】
    - 小說：${novelContext.title} (${novelContext.trope})
    - 主角：${novelContext.protagonist}
    - ${styleGuide}
    ${endingInstruction}

    【記憶庫 (Memory)】
    ${memText || "暫無記憶"}

    【角色列表 (Wiki)】
    ${charText || "暫無角色資料"}

    【上一章內容 (Context)】
    ${previousContent.slice(-2500)}

    【寫作任務要求】
    1. **劇情推進**：承接上文，邏輯連貫。請在每一章安排一個「小高潮」或「懸念鉤子」(Cliffhanger) 在結尾。
    2. **角色保護機制 (重要)**：
       - **嚴禁隨意寫死重要角色**。除非劇情進入重大轉折點（大高潮）且邏輯上避無可避，否則主要配角和主角不得死亡。
       - 如果是「重生文」且目前是回憶殺，則允許死亡描述。
       - 一般情況下，請使用「重傷、失蹤、昏迷、被俘」代替直接死亡，保留後續劇情彈性。
    3. **動態配角引入**：
       - 只有在劇情轉換地圖或發生新事件時，才自然引入新角色（如：新副本的引路人、新反派）。
       - 請務必賦予新角色獨特的說話方式或外貌特徵，不要寫成大眾臉。
    4. **互動與對話**：增加角色間的對話互動，通過對話推動劇情，減少大段的心理獨白。

    【數據維護要求 (JSON)】
    1. **狀態偵測**：偵測角色是否受傷、升級、中毒、獲得道具。
    2. **稱號變更**：若角色獲得新身分（如登基、晉升），請更新 status，**不要**視為新角色。
    3. **識別規則**：更新角色時，'name' 欄位必須使用**原名**。
    4. **記憶寫入**：只記錄對後續劇情有影響的關鍵事件（獲得關鍵道具、得知驚天秘密、重要關係突破）。

    【JSON Schema】
    {
      "content": "小說內文 (約1200-1500字)...",
      "new_memories": ["關鍵事件1", "關鍵事件2"],
      "character_updates": [
        { "name": "主角原名", "status": "重傷", "description_append": "被反派偷襲，經脈受損" },
        { "name": "新角色名", "status": "初登場", "description_append": "神秘的黑衣人，似乎認識主角" }
      ]
    }
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        // 雙重保險清理 JSON
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Error generating next chapter:", error);
        // 如果 JSON 解析失敗，通常是因為模型輸出了額外文字，這裡可以做更高級的 Error Recovery
        // 目前先拋出錯誤讓前端處理重試
        throw new Error("AI 生成格式錯誤，請重試");
    }
};