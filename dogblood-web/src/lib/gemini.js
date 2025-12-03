// ... (Imports and client init remain the same)
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

// 使用 Magnum (適合邏輯與文筆平衡)
const FALLBACK_MODEL = "anthracite-org/magnum-v4-72b";

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
        console.warn("Standard JSON parse failed, attempting regex repair...");
        throw e;
    }
};

const getToneInstruction = (tone) => {
    switch (tone) {
        case "歡脫": return "【基調：幽默沙雕】多用內心吐槽，淡化沈重感，製造反差萌笑點。";
        case "嚴肅": return "【基調：嚴肅正劇】邏輯縝密，氛圍莊重，著重現實殘酷與人性博弈。";
        case "暗黑": return "【基調：暗黑壓抑】行文冷峻，描寫絕望與人性的陰暗面。";
        case "溫馨": return "【基調：溫馨治癒】細膩溫柔，著重生活小確幸與善意。";
        case "爽文": return "【基調：熱血爽快】節奏明快，抑揚頓挫，主角不憋屈，打臉痛快。";
        default: return "【基調：標準網文】節奏流暢，平衡劇情與互動。";
    }
};

const getPovInstruction = (pov) => {
    switch (pov) {
        case "女主": return "【視角：女主視角 (BG)】重點描寫心理活動、細膩情感與對男主的觀察。";
        case "男主": return "【視角：男主視角 (BG)】重點描寫行動力、大局觀與對女主的保護/佔有慾。";
        case "主受": return "【視角：主受視角 (BL)】重點描寫心理掙扎、感官體驗與對攻方氣場的感受。";
        case "主攻": return "【視角：主攻視角 (BL)】重點描寫掌控欲、凝視細節與心理上的佔有/寵溺。";
        case "第三人稱": return "【視角：第三人稱 (上帝視角)】鏡頭靈活，可多角度展現劇情與群像，不侷限於單一主角內心。";
        default: return "【視角：第三人稱限制視角】鏡頭緊跟主角。";
    }
};

// ... (API Helpers: translateToChinese, callOpenRouterPipeline, callOpenRouter, getGeminiModel - 保持不變) ...
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
                "model": FALLBACK_MODEL,
                "messages": [{ "role": "user", "content": prompt }],
                "temperature": 0.3
            })
        });
        if (!response.ok) throw new Error(`Translation API Error: ${response.status}`);
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Translation error:", error);
        throw error;
    }
};

const callOpenRouterPipeline = async (systemPrompt, userPrompt) => {
    if (!OPENROUTER_KEY) throw new Error("OpenRouter API Key not configured for fallback.");
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

const getGeminiModel = (jsonMode = false) => genAI.getGenerativeModel({
    model: "gemini-2.5-flash-preview-09-2025",
    safetySettings: safetySettings,
    generationConfig: jsonMode ? { responseMimeType: "application/json" } : {},
});

// ... (generateRandomSettings - 保持不變) ...
const isGeminiBlockedError = (error) => {
    const errStr = (error.message || error.toString()).toLowerCase();
    return errStr.includes("prohibited") ||
        errStr.includes("safety") ||
        errStr.includes("model output must contain") ||
        errStr.includes("candidate was blocked") ||
        errStr.includes("400");
};

// ... (generateRandomSettings - 保持不變) ...
export const generateRandomSettings = async (genre, tags = [], tone = "一般") => {
    const model = getGeminiModel(true);
    const toneDesc = getToneInstruction(tone);
    const styleGuide = `風格標籤：${tags.join('、')}。\n${toneDesc}`;

    const prompt = `請為「${genre}」小說生成原創設定 (JSON)。${styleGuide} 
    要求：原創、繁體中文、人設立體、吸睛文案。
    
    請回傳以下 JSON 格式：
    {
        "title": "小說標題",
        "protagonist": "主角姓名",
        "loveInterest": "對象/反派姓名",
        "trope": "核心梗/一句話簡介",
        "summary": "劇情大綱 (150字)"
    }`;

    try {
        const result = await model.generateContent(prompt);
        const rawData = cleanJson(result.response.text());

        // Ensure all fields exist to prevent "controlled input to uncontrolled" error
        return {
            title: rawData.title || '',
            protagonist: rawData.protagonist || '',
            loveInterest: rawData.loveInterest || '',
            trope: rawData.trope || '',
            summary: rawData.summary || ''
        };
    } catch (error) {
        console.error("Random settings generation failed:", error);
        return {
            title: "生成失敗",
            summary: "AI 靈感枯竭，請重試。",
            protagonist: "未知", loveInterest: "未知", trope: "未知"
        };
    }
};

// ... (generateNovelStart - 保持不變) ...
export const generateNovelStart = async (genre, settings, tags = [], tone = "一般", pov = "第三人稱") => {
    const model = getGeminiModel(false);
    const toneDesc = getToneInstruction(tone);
    const povDesc = getPovInstruction(pov);
    const styleGuide = `類型：${genre}\n風格標籤：${tags.join('、')}。\n${toneDesc}\n${povDesc}`;

    let extraInstruction = "";
    if (genre === "無限流") extraInstruction = "第一章重點：主角進入第一個恐怖/無限副本，介紹詭異的規則和死亡威脅。";
    else if (genre === "修仙玄幻") extraInstruction = "第一章重點：描寫主角身處的宗門/底層環境，以及獲得金手指(外掛)的瞬間。";
    else if (genre === "諜戰黑道") extraInstruction = "第一章重點：主角處於偽裝身分中。描寫一次驚險的任務或與目標人物的初次交鋒，重點在於「不知對方底細」的張力。";
    else if (genre === "末世生存") extraInstruction = "第一章重點：災難爆發的瞬間，秩序崩壞，主角利用先知或反應速度搶奪第一批物資。";
    else if (genre === "豪門宮鬥") extraInstruction = "第一章重點：主角遭受陷害或處於劣勢，但眼神中透露出復仇的火光，準備反擊。";
    else if (genre === "都市情緣") extraInstruction = "第一章重點：描寫主角與對象的初次相遇或重逢。氛圍要充滿曖昧、誤會或戲劇性。";

    if (tags.includes("重生")) extraInstruction += " (需描寫前世慘死與重生後的震驚)";
    if (tags.includes("馬甲")) extraInstruction += " (需強調主角隱藏身分的謹慎與對周圍的不信任)";

    const systemPrompt = `你是一名專業小說家。請撰寫第一章。繁體中文。`;
    const userPrompt = `
    設定：${settings.title} / ${settings.protagonist} / ${settings.trope}
    ${styleGuide}
    要求：${settings.summary}
    格式：1000字，衝突開場，自然引入配角。直接輸出正文。${extraInstruction}
    `;

    try {
        const result = await model.generateContent(systemPrompt + "\n" + userPrompt);
        return result.response.text();
    } catch (error) {
        if (isGeminiBlockedError(error)) {
            return await callOpenRouterPipeline(systemPrompt, userPrompt);
        }
        throw error;
    }
};

/**
 * 劇情狀態管理器 - V15 全局馬甲版
 * 修正：移除 Genre 的提早 return，改為疊加指令。
 * 讓「馬甲 (Hidden Identity)」與「感情 (Romance)」成為所有 Genre 的通用插件。
 */
const determinePlotDirectives = (currentChapterIndex, lastPlotState, genre, tags) => {
    // 輔助檢查 Tags
    const hasTag = (t) => tags.some(tag => tag.includes(t));
    const isAngst = hasTag("虐戀") || hasTag("追妻");
    const hasSecretIdentity = hasTag("馬甲") || hasTag("掉馬") || hasTag("臥底") || hasTag("隱藏身分");

    // 設定一個循環 (Arc) 為 40 章
    const ARC_LENGTH = 40;
    const cyclePos = (currentChapterIndex % ARC_LENGTH) + 1;
    const cycleNum = Math.floor(currentChapterIndex / ARC_LENGTH) + 1;

    let phase = "story_progression";
    let intensity = "medium";
    let directive = "";
    let romanceBeat = "";
    let arcName = (cyclePos === 1) ? `第${cycleNum}卷` : (lastPlotState?.arcName || `第${cycleNum}卷`);

    // --- 🌍 1. 世界觀/難度升級 (Global Scale) ---
    let scaleInstruction = "";
    if (cycleNum === 1) {
        scaleInstruction = "【當前格局：新手/開局】危機主要圍繞在主角個人生存或小團體利益。敵人等級較低，主角能力尚在成長中。";
    } else if (cycleNum <= 3) {
        scaleInstruction = `【當前格局：進階/勢力戰 (第${cycleNum}層級)】危機擴大到城市、門派、公司或大型組織。主角已有一席之地，捲入更複雜的權力博弈。敵人更加狡猾強大。`;
    } else {
        scaleInstruction = `【當前格局：頂級/世界級 (第${cycleNum}層級)】危機涉及世界存亡、位面規則、跨國陰謀或神明領域。主角已是強者/大佬，一舉一動影響大局。`;
    }

    // --- ❤️ 2. 感情線節奏 (Global Romance Arc) ---
    // 強制所有類型都要跑這個節奏
    if (cyclePos <= 5) {
        romanceBeat = "【感情：初遇/新階段的試探】描寫兩人互相靠近但又因秘密而產生的微妙距離感。眼神拉絲但言語克制。";
    } else if (cyclePos <= 20) {
        romanceBeat = "【感情：升溫與曖昧】在共同經歷事件中產生默契。不經意的肢體接觸，或是為了掩護對方而做出的親密舉動。";
    } else if (cyclePos <= 35) {
        // --- 危機期判定 ---
        if (hasSecretIdentity) {
            romanceBeat = "【感情：身分危機/猜忌】對方發現了主角的破綻(關於馬甲)，開始產生懷疑。主角為了圓謊不得不撒新的謊，內心煎熬。信任感面臨崩塌邊緣。";
        } else if (isAngst) {
            romanceBeat = "【感情：冰點/決裂/誤會爆發】矛盾激化，好感度看似觸底。互相折磨，心口不一。這是一段「感情值下降」的虐心劇情。";
        } else {
            romanceBeat = "【感情：波折/患難/保護與被保護】外部高壓導致的焦慮。可能為了不拖累對方而選擇推開，或是因為受傷而讓對方心痛自責。";
        }
    } else {
        romanceBeat = "【感情：雨過天晴/修復/昇華】危機解除。解開誤會，修復裂痕。經過考驗的感情比之前更加堅固。";
    }

    // --- 🎭 3. 馬甲(隱藏身分) 通用指令 (Global Identity Arc) ---
    // 只要有馬甲Tag，所有類型都要執行這套邏輯
    let identityDirective = "";
    if (hasSecretIdentity) {
        if (cyclePos <= 10) {
            identityDirective = "【馬甲線】：主角必須小心翼翼地隱藏真實身分/能力 (扮豬吃老虎/臥底/偽裝)。請安排主角在不想暴露的情況下解決問題的橋段。";
        } else if (cyclePos <= 30) {
            identityDirective = "【馬甲線】：危機！主角遇到無法用「表面身分」解決的麻煩。請安排一個「差點掉馬」的小插曲（如：無意中使出不該會的技能，或被熟人認出背影）。";
        } else if (cyclePos <= 38) {
            identityDirective = "【馬甲線】：身分危機升級！在解決主線高潮時，主角被迫使用了真實能力/身分。請描寫周圍人（尤其是CP）震驚或懷疑的眼神，但主角選擇暫時不解釋或逃離。";
        }
    }

    // ==========================================
    // 4. 結構性 Genre 判定 (Skeleton)
    // ==========================================

    // Genre 1: 無限流
    if (genre === "無限流") {
        if (cyclePos <= 5) {
            phase = "setup";
            intensity = "low (suspenseful)";
            directive = `【階段：副本導入】主角進入新環境。重點描寫詭異規則、壓抑感。切勿立刻開打，先鋪陳懸疑。更新 plot_state.arcName。`;
        } else if (cyclePos <= 30) {
            phase = "investigation";
            intensity = "medium";
            directive = "【階段：深度探索】尋找線索，經歷試錯。重點：發現規則漏洞、獲得關鍵道具。**雙線並行**：副本解密 + **安排與CP在危機中互助或猜疑**。";
        } else if (cyclePos <= 38) {
            phase = "climax";
            intensity = "high";
            directive = "【階段：終極解密】副本倒數時刻。BOSS戰或死亡機制觸發。主角利用線索絕地反擊。揭開本副本真相。";
        } else {
            phase = "rest";
            intensity = "low (fluff)";
            directive = "【階段：結算與群像】回到主神空間。清點獎勵。**群像時刻**：展現隊友們的私下生活、配角之間的副CP互動。";
            if (cyclePos === ARC_LENGTH) arcName = "準備進入新副本";
        }
    }
    // Genre 2: 諜戰黑道 (針對諜戰特化的邏輯，與通用馬甲線疊加會更強)
    else if (genre === "諜戰黑道") {
        if (cyclePos <= 10) {
            phase = "secret_identity";
            intensity = "medium (tension)";
            directive = `【階段：潛伏與入局】接獲新任務，進入新組織。建立偽裝，面對試探。更新 plot_state.arcName。`;
        } else if (cyclePos <= 30) {
            phase = "turf_war";
            intensity = "high (action)";
            directive = "【階段：上位與火拼】幫派鬥爭激化。街頭追逐、械鬥。展現狠勁獲得信任，同時傳遞情報。";
        } else {
            phase = "showdown";
            intensity = "high (climax)";
            directive = "【階段：收網與決戰】警方/敵對勢力總攻。在混亂中執行最終任務。結局慘烈。";
        }
    }
    // Genre 3: 修仙玄幻
    else if (genre === "修仙玄幻") {
        if (cyclePos <= 10) { phase = "training"; directive = `【階段：換地圖與蟄伏】來到更高層次的世界。重點是「積累底牌」和「遭遇輕視」。描寫對力量的渴望。更新 plot_state.arcName。`; }
        else if (cyclePos <= 32) { phase = "adventure"; directive = "【階段：歷練與機緣】外出尋找機緣。遭遇殺人奪寶。重點展現「越級挑戰」能力。"; }
        else { phase = "breakthrough"; directive = "【階段：突破與打臉】修為大漲，強勢回歸！請根據當前劇情安排一個眾人矚目的場合，讓主角一鳴驚人。"; if (cyclePos === ARC_LENGTH) arcName = "準備飛升/換地圖"; }
    }
    // Genre 4: 末世生存
    else if (genre === "末世生存") {
        if (cyclePos <= 10) { phase = "new_crisis"; directive = `【階段：新危機與遷徙】原據點不再安全。踏上遷徙之路。物資極度匱乏。更新 plot_state.arcName。`; }
        else if (cyclePos <= 32) { phase = "survival_journey"; directive = "【階段：艱難求生】在危機中遭遇人性考驗與屍潮。隊友受傷或犧牲。"; }
        else { phase = "new_base"; directive = "【階段：建立新家園】抵達新據點，擊退屍潮。開始建設與防禦。暫時獲得安寧。"; }
    }
    // Genre 5: 豪門宮鬥
    else if (genre === "豪門宮鬥") {
        if (cyclePos <= 10) { phase = "underestimation"; directive = `【階段：新局勢佈局】進入新環境。遭遇新反派挑釁，主角按兵不動，暗中佈局。更新 plot_state.arcName。`; }
        else if (cyclePos <= 30) { phase = "counter_attack"; directive = "【階段：連環反擊】主角收網，揭穿陰謀，當眾打臉。展現權謀手段。"; }
        else { phase = "alliance"; directive = "【階段：地位晉升】大獲全勝，地位實質提升。收服人心，擴大勢力。"; }
    }
    // Genre 6: 都市情緣
    else if (genre === "都市情緣") {
        if (cyclePos <= 20) { phase = "fluff_interaction"; directive = "【階段：日常撒糖/職場互動】重點描寫甜蜜互動、曖昧試探。生活小事中的寵溺感。更新 plot_state.arcName。"; }
        else { phase = "minor_obstacle"; directive = "【階段：外部助攻/職場危機】出現小波折，但兩人互相信任解決。感情更進一步。"; }
    }
    // Fallback
    else {
        if (cyclePos <= 10) directive = `【階段：新篇章開啟】更新 plot_state.arcName。`;
        else if (cyclePos <= 30) directive = "【階段：發展與挑戰】";
        else directive = "【階段：高潮與收尾】";
    }

    // 5. 最終組合指令 (Final Assembly)
    // 將所有圖層疊加：主線 + 馬甲 + 感情 + 世界觀
    const finalDirective = `
    ${directive}
    ${identityDirective ? `\n**【🎭 馬甲線特別指令】**：${identityDirective}` : ""}
    \n**【❤️ 感情線必修題】**：${romanceBeat}
    \n**【🌍 世界觀層級】**：${scaleInstruction}`;

    return { phase, intensity, directive: finalDirective, arcName };
};

// ... (generateNextChapter 保持不變) ...
export const generateNextChapter = async (novelContext, previousContent, characters = [], memories = [], tags = [], tone = "一般", pov = "女主", lastPlotState = null) => {
    const director = determinePlotDirectives(novelContext.currentChapterIndex, lastPlotState, novelContext.genre, tags);
    const toneDesc = getToneInstruction(tone);
    const povDesc = getPovInstruction(pov);
    const styleGuide = `類型：${novelContext.genre} | 風格標籤：${tags.join('、')}。\n${toneDesc}\n${povDesc}`;

    const charText = characters.map(c => `- ${c.name} (${c.role}): ${c.description} [狀態: ${c.status}]`).join('\n');
    const memText = memories.slice(0, 15).map(m => `- ${m.content}`).join('\n');

    let endingInstruction = "";
    if (novelContext.targetEndingChapter) {
        const left = novelContext.targetEndingChapter - novelContext.currentChapterIndex;
        if (left <= 3 && left > 0) endingInstruction = `【全局終局倒數】還有 ${left} 章完結。收束全書所有伏筆，揭開終極真相。`;
        else if (left <= 0) endingInstruction = `【全書大結局】這是最後一章！`;
    }

    const baseSystemPrompt = `你是一名專業的小說家。請撰寫下一章並維護世界觀數據。`;

    const geminiUserPrompt = `
    【小說資訊】
    標題：${novelContext.title}
    風格設定：${styleGuide}
    當前卷名/副本：${director.arcName}

    【本章導演指令 (重要)】
    1. **劇情與感情**：${director.directive}
    2. **情緒張力**：${director.intensity}
    3. **鏡頭規則 (Camera Rule)**：請嚴格遵守【${pov}視角】（第三人稱限制視角）。
       - 鏡頭必須始終聚焦於主角。
       - **嚴禁主角在整章中消失**。
       - 即使要寫配角/群像，也請通過主角的觀察、聽聞或互動來呈現，不要隨意切換到配角的上帝視角。
    4. **群像發展**：請讓配角有自己的生活和感情線（副CP），讓世界觀更真實。

    【上下文】
    記憶庫：${memText}
    角色狀態：${charText}
    前文摘要：${previousContent.slice(-1500)}

    【回傳 JSON】
    {
      "content": "小說內文...",
      "new_memories": ["關鍵事件1"],
      "character_updates": [],
      "plot_state": { 
          "phase": "${director.phase}", 
          "arcName": "${director.arcName}" 
      }
    }
    `;

    try {
        const geminiModel = getGeminiModel(true);
        const geminiPrompt = baseSystemPrompt + "\n" + geminiUserPrompt + `\n 回傳 JSON Schema 請包含 plot_state`;
        const result = await geminiModel.generateContent(geminiPrompt);
        return cleanJson(result.response.text());

    } catch (error) {
        if (isGeminiBlockedError(error)) {
            console.log("🚀 Fallback: Gemini blocked. Switching to English Pipeline...");
            try {
                const englishUserPrompt = `
                Novel: ${novelContext.title}
                Current Arc: ${director.arcName}
                
                DIRECTOR'S INSTRUCTION:
                ${director.directive}
                
                POV RULE:
                Third-person limited perspective following the MAIN CHARACTER (${pov}). 
                The MC must be present. Do not switch POV to random side characters.
                
                Previous Context: ${previousContent.slice(-1500)}
                
                Task: Write next chapter. STRICTLY FOLLOW INSTRUCTIONS.
                `;
                const chineseContent = await callOpenRouterPipeline(baseSystemPrompt, englishUserPrompt);
                return {
                    content: chineseContent,
                    new_memories: [],
                    character_updates: [],
                    plot_state: { phase: director.phase, arcName: director.arcName }
                };
            } catch (fbError) {
                console.error("Pipeline Failed:", fbError);
                throw new Error("系統暫時無法生成內容，請稍後再試。");
            }
        }
        throw error;
    }
};