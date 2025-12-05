import {
    callDeepSeek,
    getGeminiModel,
    cleanJson,
    ANTI_CLICHE_INSTRUCTIONS
} from "../../lib/llm.js";

// ==========================================
// 🎲 Smart Theme Pool (百大副本庫)
// ==========================================
const THEME_POOL = {
    // 🏫 現代/都市靈異 (適合新手/前期)
    modern: [
        "深夜校園", "404號公寓", "廢棄醫院", "午夜末班車", "無人便利店",
        "詭異遊樂園", "死亡直播間", "鬧鬼電影院", "整形美容院", "猛鬼大廈",
        "陰森圖書館", "地下停車場", "模特兒經紀公司", "深山療養院", "雨夜屠夫案",
        "逃離網戒中心", "無限電梯", "靈異照相館", "蠟像館驚魂", "玩偶工廠"
    ],
    // 🏮 中式/民俗恐怖 (適合中式恐怖 Tag)
    chinese: [
        "冥婚古宅", "湘西趕屍", "封門鬼村", "戲班驚魂", "黃皮子墳",
        "陰陽客棧", "苗疆蠱寨", "鎖龍井", "紙人回魂夜", "義莊守夜",
        "奈何橋邊", "繡花鞋老宅", "皮影戲班", "長生邪教", "血祭龍王廟",
        "山村老屍", "狐仙廟", "鬼市交易", "殭屍王爺", "五行殺陣"
    ],
    // 🏰 西式/宗教/克蘇魯 (適合西幻/克蘇魯 Tag)
    western: [
        "德古拉城堡", "開膛手傑克", "塞勒姆女巫審判", "寂靜嶺迷霧", "血腥瑪麗",
        "舊日支配者祭壇", "深海拉萊耶", "瘋狂修道院", "惡魔召喚儀式", "恐怖孤兒院",
        "溫徹斯特鬼屋", "人皮客棧", "喪屍圍城", "弗蘭肯斯坦實驗室", "吸血鬼舞會",
        "狼人村落", "惡靈附身", "詛咒人偶安娜貝爾", "深淵凝視", "黑彌撒"
    ],
    // 🚀 科幻/未來/收容 (適合星際/賽博 Tag)
    scifi: [
        "SCP收容失效", "AI暴走都市", "太空幽靈船", "生化危機實驗室", "賽博貧民窟",
        "複製人工廠", "虛擬現實崩壞", "缸中之腦", "機械公敵", "異形母巢",
        "時空折疊站", "核輻射廢土", "基因改造營", "量子幽靈", "矩陣重啟",
        "反烏托邦監獄", "記憶提取中心", "深海基地", "月球背面", "硅基生物入侵"
    ],
    // ⚔️ 生存/大逃殺/規則 (適合無限流/規則怪談)
    survival: [
        "絕地求生島", "死亡迷宮", "飢餓遊戲", "俄羅斯輪盤賭場", "暴風雪山莊",
        "亞馬遜食人族", "泰坦尼克號沉沒夜", "龐貝古城末日", "切爾諾貝利", "迷霧森林",
        "規則怪談：動物園", "規則怪談：媽媽的紙條", "七日殺", "死亡列車", "天空鬥技場",
        "謊言之城", "禁止呼吸", "黑暗童話鎮", "愛麗絲夢遊仙境", "無盡迴廊"
    ]
};

// 專屬的防套路指令 (針對無限流優化)
const INFINITE_ANTI_CLICHE = `
${ANTI_CLICHE_INSTRUCTIONS}
【無限流特化禁令】
1. **場景真實感**：主神空間不是冷冰冰的白色房間，它可以是詭異的廣場、血腥的列車站或宏大的神殿。
2. **規則的壓迫感**：規則不是用來遵守的，是用來「踩線」的。請描寫違規後的具體慘狀。
3. **拒絕數據流**：不要出現「叮！系統提示」。請用環境變化、耳邊低語或視網膜上的血字來傳達任務。
`;

/**
 * 根據標籤與進度選擇最佳副本主題 (含去重機制)
 */
const selectDungeonTheme = (tags = [], cycleNum = 1, usedThemes = []) => {
    let availablePools = [];

    // 1. 根據 Tag 權重選擇池子
    if (tags.includes("中式恐怖") || tags.includes("古風") || tags.includes("盜墓")) {
        availablePools.push(...THEME_POOL.chinese, ...THEME_POOL.chinese); // 加權
    }
    if (tags.includes("克蘇魯") || tags.includes("西幻") || tags.includes("吸血鬼")) {
        availablePools.push(...THEME_POOL.western);
    }
    if (tags.includes("星際") || tags.includes("賽博龐克") || tags.includes("科幻")) {
        availablePools.push(...THEME_POOL.scifi);
    }

    // 2. 預設池子 (總是包含現代與生存)
    availablePools.push(...THEME_POOL.modern, ...THEME_POOL.survival);

    // 3. 難度/格局過濾 (簡單模擬)
    // 如果是後期 (cycleNum > 3)，嘗試加入更科幻或宏大的主題
    if (cycleNum > 3) {
        availablePools.push(...THEME_POOL.scifi, ...THEME_POOL.western);
    }

    // 4. 去重過濾 (Deduplication)
    // 過濾掉已經在 usedThemes 中的主題
    const freshThemes = availablePools.filter(theme => !usedThemes.includes(theme));

    // 5. 選擇邏輯
    let finalPool = freshThemes;

    // 如果過濾後沒剩幾個了（極端情況），就放寬限制，允許重複但盡量避免
    if (freshThemes.length === 0) {
        console.warn("Themes exhausted for tags, resetting pool.");
        finalPool = availablePools;
    }

    // 隨機選取
    const randomTheme = finalPool[Math.floor(Math.random() * finalPool.length)];
    return randomTheme;
};

// ==========================================
// 1. 專屬設定生成 (支援模型切換)
// ==========================================
export const generateInfiniteSettings = async (tags = [], tone = "一般", targetChapterCount = null, category = "BG", useDeepSeek = false) => {
    const toneDesc = `基調：${tone}`;
    const totalChapters = targetChapterCount || 200;

    const prompt = `
    你是一位頂級的無限流小說架構師。
    請設計一套驚悚、懸疑且具備爆款潛力的設定。
    **類別**：${category}。**篇幅**：${totalChapters} 章。
    風格：${tags.join('、')}。\n${toneDesc}
    
    ${INFINITE_ANTI_CLICHE}
    
    【任務要求】
    1. **原創世界觀**：設計一個獨特的主神空間/系統機制（例如：以壽命為貨幣、失敗即抹殺存在）。
    2. **主線謎題**：主角進入無限世界並非偶然，請設計一個貫穿全書的懸疑主線（如：尋找失蹤親人、揭開世界真相）。
    3. **第一副本設計**：請直接設計好「第一個副本」的詳細設定。
    
    【回傳 JSON】
    {
      "title": "小說標題",
      "summary": "吸睛文案",
      "trope": "核心梗",
      "design_blueprint": {
          "main_goal": "主角終極目標",
          "world_truth": "世界隱藏真相",
          "ending_vision": "預設結局"
      },
      "first_dungeon_setting": {
          "dungeon_name": "副本名稱",
          "difficulty": "等級",
          "background_story": "副本背景",
          "core_rules": ["規則1...", "規則2..."],
          "mechanics": { "gameplay": "核心玩法", "threat": "主要威脅" }
      },
      "protagonist": { "name": "主角名", "role": "主角", "gender": "...", "profile": { "appearance": "...", "personality_surface": "...", "personality_core": "...", "biography": "...", "trauma": "...", "desire": "..." } },
      "loveInterest": { "name": "對象名", "role": "...", "gender": "...", "profile": { ... } }
    }
    `;

    try {
        if (useDeepSeek) {
            return await callDeepSeek("你是一位無限流架構師。", prompt, true);
        } else {
            const model = getGeminiModel(true);
            const res = await model.generateContent(prompt);
            return cleanJson(res.response.text());
        }
    } catch (e) {
        console.warn("Settings generation failed, retrying with Gemini...", e);
        const model = getGeminiModel(true);
        const res = await model.generateContent(prompt);
        return cleanJson(res.response.text());
    }
};

// ==========================================
// 2. 專屬第一章生成 (支援模型切換)
// ==========================================
export const generateInfiniteStart = async (settings, tags = [], tone = "一般", pov = "女主", useDeepSeek = false) => {
    const styleGuide = `風格：${tags.join('、')} | 基調：${tone} | 視角：${pov}`;

    const firstDungeon = settings.first_dungeon_setting;
    const rulesText = firstDungeon?.core_rules?.join('\n') || "未知規則";

    const prompt = `
    你是一位無限流小說家。請撰寫第一章。
    ${INFINITE_ANTI_CLICHE}
    【小說設定】${settings.title}
    ${styleGuide}
    
    【當前副本：${firstDungeon?.dungeon_name}】
    背景：${firstDungeon?.background_story}
    規則：${rulesText}
    
    【主角】${JSON.stringify(settings.protagonist)}
    【對象】${JSON.stringify(settings.loveInterest)}

    【寫作要求】
    1. **開局即高能**：主角醒來時已身處副本中。描寫周圍環境的詭異與新人的恐慌。
    2. **規則展示**：請安排主角發現規則書。
    3. **初遇**：安排與攻略對象的初次相遇。
    4. **字數**：1500-2000字。

    【回傳 JSON】
    {
      "content": "小說正文...",
      "character_updates": [ ... ],
      "plot_state": {
          "phase": "setup",
          "arcName": "${firstDungeon?.dungeon_name}",
          "instance_progress": 5,
          "cycle_num": 1,
          "current_dungeon": ${JSON.stringify(firstDungeon)},
          "current_rules": { "title": "規則", "rules": ${JSON.stringify(firstDungeon?.core_rules || [])}, "hidden_truth": "..." }
      }
    }
    `;

    try {
        if (useDeepSeek) {
            return await callDeepSeek("你是一位無限流小說家。", prompt, true);
        } else {
            const model = getGeminiModel(true);
            const result = await model.generateContent(prompt);
            return cleanJson(result.response.text());
        }
    } catch (e) {
        throw new Error("生成失敗，請重試");
    }
};

// ==========================================
// 3. 副本架構師 (內部工具)
// ==========================================
export const generateDungeonDesign = async (arcName, tone, tags = [], cycleNum, extraInstruction = "", hazards = [], useDeepSeek = false) => {
    const isRuleBased = tags.includes("規則怪談");
    const hazardsText = hazards.length > 0 ? `\n環境危害 (Debuffs)：${hazards.join('、')} (請將這些危險融入環境描寫)` : "";

    const prompt = `
    你是一位頂級的無限流副本設計師 (Dungeon Architect)。
    請為第 ${cycleNum} 個副本【${arcName}】設計一套完整、致命且邏輯自洽的設定。
    基調：${tone}。
    標籤：${tags.join('、')}。
    ${hazardsText}
    ${extraInstruction ? `特殊要求：${extraInstruction}` : ""}

    【設計要求】
    1. **完整世界觀**：不只是一個場景，要有一個詭異的背景故事（如：被獻祭的村莊、充滿執念的畫廊）。
    2. **核心機制**：
       - 如果是${isRuleBased ? '「規則怪談」：請設計 5-8 條紅藍字規則，包含矛盾與認知污染。' : '「一般副本」：請設計主線任務、支線任務、時間/能力限制與失敗懲罰。'}
       - **玩法機制**：請設計一個獨特的過關機制（如：聲音感知、光影躲避、記憶重組），而不只是單純殺怪。
    3. **怪物/Boss**：設計 1-2 種雜兵與 1 個核心 Boss，需有弱點機制。
    4. **多重結局**：設計普通通關（存活）與完美通關（解開真相）的條件。
    
    【回傳 JSON 格式】
    {
        "dungeon_name": "副本名稱",
        "difficulty": "等級 (如：B+)",
        "background_story": "副本背景故事 (200字)",
        "core_rules": ["規則1...", "規則2..."],
        "mechanics": {
            "gameplay_focus": "核心玩法",
            "sanity_system": "理智值/污染規則",
            "environment": "環境詭變機制"
        },
        "entities": [
            { "name": "怪物名", "description": "...", "weakness": "..." }
        ],
        "endings": {
            "normal": "普通結局條件",
            "true": "真結局條件"
        }
    }
    `;

    try {
        if (useDeepSeek) {
            return await callDeepSeek("你是一位無限流副本架構師。", prompt, true);
        } else {
            const model = getGeminiModel(true);
            const res = await model.generateContent(prompt);
            return cleanJson(res.response.text());
        }
    } catch (e) {
        console.warn("Architect failed, fallback to Gemini");
        const model = getGeminiModel(true);
        const res = await model.generateContent(prompt);
        return cleanJson(res.response.text());
    }
};

// ==========================================
// 4. 動態規則生成 (內部工具)
// ==========================================
export const generateRuleSet = async (arcName, tone, isRuleBased, useDeepSeek = false) => {
    let prompt = "";
    if (isRuleBased) {
        prompt = `你是一位「規則怪談」設計師。為副本【${arcName}】設計一套致命規則。基調：${tone}。
        要求：場景契合、細思極恐、包含邏輯陷阱(紅字規則)。
        回傳 JSON: { "title": "規則書標題", "rules": ["規則1..."], "hidden_truth": "規則背後的真相" }`;
    } else {
        prompt = `你是一位無限流「主神系統」。為副本【${arcName}】發布任務。基調：${tone}。
        要求：明確目標、限制條件、失敗懲罰、隱藏通關機制。
        回傳 JSON: { "title": "任務面板", "rules": ["主線...", "限制..."], "hidden_truth": "隱藏機制" }`;
    }

    try {
        if (useDeepSeek) {
            return await callDeepSeek("你是一位規則設計師。", prompt, true);
        } else {
            const model = getGeminiModel(true);
            const res = await model.generateContent(prompt);
            return cleanJson(res.response.text());
        }
    } catch (e) {
        const model = getGeminiModel(true);
        const res = await model.generateContent(prompt);
        return cleanJson(res.response.text());
    }
};

import { supabase } from '../../lib/supabase.js';

// ==========================================
// 5. 無限流 Planner Agent (整合進度與規則)
// ==========================================
export const planInfinite = async ({
    novelId, // Receive novelId
    director,
    blueprint,
    contextSummary,
    memories = [],
    clues = [],
    characters = [],
    tags = [],
    tone = "一般",
    lastPlotState = null,
    useDeepSeek = false
}) => {
    // 1. 狀態初始化
    let currentDungeon = lastPlotState?.current_dungeon || null;
    let currentRules = lastPlotState?.current_rules || null;
    let cycleNum = lastPlotState?.cycle_num || 1;
    let instanceProgress = lastPlotState?.instance_progress || 0;
    let usedThemes = lastPlotState?.used_themes || [];

    // 2. 🚨 強制同步導演指令 (Fix for Progress Reset Bug)
    // 如果導演說要重置 (setup) 或休整 (rest)，Planner 必須聽話，不能只看上一章的 progress
    if (director.phase === 'setup' && director.instanceProgress <= 5) {
        instanceProgress = 0;
        currentDungeon = null; // 清空舊副本，觸發生成新副本
    } else if (director.phase === 'rest') {
        instanceProgress = 0; // 休整期進度重置
        currentDungeon = null; // 離開副本
    } else {
        // 否則，在副本內繼續推進
        const resolvedCluesCount = clues.filter(c => c.includes("已解決") || c.includes("解開")).length;
        const totalCluesEstimated = 5;
        const clueProgress = Math.min(resolvedCluesCount / totalCluesEstimated, 1);
        const hasBossForeshadow = memories.slice(-10).some(m => m.content.includes("Boss") || m.content.includes("怪物") || m.content.includes("鬼"));
        const bossProgress = hasBossForeshadow ? 0.5 : 0.0;
        const organicProgress = (clueProgress * 50) + (bossProgress * 30);

        instanceProgress = Math.max(instanceProgress + 5, organicProgress);
        if (instanceProgress > 100) instanceProgress = 100;
    }

    // 3. 階段判定 (Phase Determination)
    let phase = "investigation";
    if (director.phase === 'setup' || (instanceProgress < 15 && director.phase !== 'rest')) phase = "setup";
    else if (instanceProgress < 75) phase = "investigation";
    else if (instanceProgress < 95) phase = "climax";
    else phase = "resolution";

    // 優先遵守導演的特殊狀態
    if (director.phase === 'rest') phase = 'rest';
    if (director.phase === 'finale') phase = 'finale';

    // 4. 副本/規則生成 (Smart Theme Selection)
    // 條件：必須是 setup 階段，且還沒有當前副本
    const isNewDungeon = phase === 'setup' && !currentDungeon;

    if (isNewDungeon) {
        // ✨ 使用智慧題材庫選擇主題 (傳入 usedThemes 進行去重)
        const randomTheme = selectDungeonTheme(tags, cycleNum, usedThemes);
        const dungeonName = `${director.arcName} - ${randomTheme}`;
        console.log(`🎲 [Infinite Planner] Generating New Dungeon: ${dungeonName}`);

        // 生成副本設定
        currentDungeon = await generateDungeonDesign(dungeonName, tone, tags, cycleNum, "", [], useDeepSeek);
        currentRules = await generateRuleSet(currentDungeon.dungeon_name, tone, tags.includes("規則怪談"), useDeepSeek);

        usedThemes.push(randomTheme);
        instanceProgress = 5;

        // 💾 Save to Supabase
        if (novelId) {
            try {
                const { error } = await supabase.from('dungeons').insert({
                    novel_id: novelId,
                    name: currentDungeon.dungeon_name,
                    cycle_num: cycleNum,
                    difficulty: currentDungeon.difficulty,
                    background_story: currentDungeon.background_story,
                    mechanics: currentDungeon.mechanics,
                    core_rules: currentDungeon.core_rules,
                    rule_logic: currentRules, // Save the full rule object including hidden truth
                    entities: currentDungeon.entities,
                    endings: currentDungeon.endings,
                    status: 'active'
                });
                if (error) console.error("Failed to save dungeon to DB:", error);
                else console.log("✅ Dungeon saved to DB");
            } catch (err) {
                console.error("DB Save Error:", err);
            }
        }
    }

    // 5. 規則推進邏輯
    const ruleOps = (() => {
        if (phase === "setup") return "展示所有【明規則】。";
        if (phase === "investigation") return "驗證規則真偽，發現【隱規則】或【紅字陷阱】。";
        if (phase === "climax") return "利用規則【漏洞】反殺 Boss。";
        if (phase === "resolution") return "回收規則伏筆。";
        if (phase === "rest") return "主神空間休整。";
        return "探索規則。";
    })();

    // 6. 呼叫 Planner
    const dungeonContext = currentDungeon ? `
    【🏯 當前副本：${currentDungeon.dungeon_name}】
    難度：${currentDungeon.difficulty}
    背景：${currentDungeon.background_story}
    核心玩法：${currentDungeon.mechanics?.gameplay_focus}
    通關條件：${currentDungeon.endings?.normal} / ${currentDungeon.endings?.true}
    ` : "【當前場景】主神空間/現實世界 (安全區)";

    const rulesContext = currentRules ? `
    【📜 規則/任務】
    ${currentRules.rules.join('\n')}
    真相：${currentRules.hidden_truth}
    ` : "";

    const prompt = `
    你是一位無限流小說策劃。請根據以下資訊規劃下一章大綱。
    
    ${ANTI_CLICHE_INSTRUCTIONS}
    
    【當前狀態】
    - 階段：${phase.toUpperCase()} (進度: ${Math.floor(instanceProgress)}%)
    - 導演指令：${director.directive}
    - 規則策略：${ruleOps}

    ${dungeonContext}
    ${rulesContext}

    【設計圖】${typeof blueprint === 'string' ? blueprint : JSON.stringify(blueprint)}
    【前情提要】${contextSummary}
    【線索】${clues.length > 0 ? clues.join('\n') : "無"}

    【任務】
    1. 根據副本進度，推進劇情。
    2. **副本內**：務必遵守規則邏輯。**休息區**：務必推進主線與感情。
    3. 結合 **${tone}** 風格與 **${tags.join('/')}** 元素。

    回傳 JSON:
    {
        "chapter_title": "本章標題",
        "outline": "詳細大綱 (300字+)",
        "key_clue_action": "線索操作",
        "romance_moment": "感情高光 (若有)",
        "suggested_progress_increment": 5,
        "should_finish_instance": ${phase === 'resolution'} 
    }
    `;

    let plan;
    try {
        if (useDeepSeek) {
            plan = await callDeepSeek("你是一位無限流策劃。", prompt, true);
        } else {
            const model = getGeminiModel(true);
            const res = await model.generateContent(prompt);
            plan = cleanJson(res.response.text());
        }
    } catch (e) {
        console.warn("Planner failed, fallback default.");
        plan = { chapter_title: "新的一章", outline: "推進劇情...", suggested_progress_increment: 5 };
    }

    return {
        ...plan,
        plot_state_update: {
            phase,
            instance_progress: instanceProgress,
            current_dungeon: currentDungeon,
            current_rules: currentRules,
            cycle_num: cycleNum,
            used_themes: usedThemes
        }
    };
};