import {
    callDeepSeek,
    getGeminiModel,
    cleanJson,
    ANTI_CLICHE_INSTRUCTIONS,
    getToneInstruction,
    getPovInstruction
} from "../../lib/llm.js";

import { supabase } from '../../lib/supabase.js';

// 專屬的防套路指令 (針對無限流優化)
const INFINITE_ANTI_CLICHE = `
${ANTI_CLICHE_INSTRUCTIONS}
【無限流特化：拒絕跑團風 (Anti-RPG)】
1. **人物大於規則**：規則是用來被主角打破的，副本是用來談戀愛的。不要花大篇幅解釋機制，要花篇幅描寫**在機制下的人性與互動**。
2. **極致張力**：主角與CP的關係應該充滿張力（如：宿敵、共犯、唯一的救贖）。他們是彼此在深淵中唯一的依靠，或者是互相試探的對手。
3. **群像刻畫**：隊友不是報幕員。請賦予他們鮮明的性格（如：愛財如命但講義氣、膽小但關鍵時刻不掉鏈子）。
`;

// ==========================================
// 🎲 Smart Theme Pool (百大副本庫)
// ==========================================
const THEME_POOL = {
    // 🏫 現代/都市靈異 (適合新手/前期)
    modern: [
        "深夜校園", "404號公寓", "廢棄醫院", "午夜末班車", "無人便利店",
        "詭異遊樂園", "死亡直播間", "鬧鬼電影院", "整形美容院", "猛鬼大廈",
        "陰森圖書館", "地下停車場", "模特兒經紀公司", "深山療養院", "雨夜屠夫案",
        "逃離網戒中心", "無限電梯", "靈異照相館", "蠟像館驚魂", "玩偶工廠",
        "太平間夜班", "都市傳說俱樂部", "廢棄地鐵線", "自殺直播間", "網紅鬼屋探險",
        "恐怖快遞站", "雨夜計程車", "鏡中公寓", "迴聲走廊", "鄰居的日記",
        "直播帶貨的詛咒", "數字詛咒信", "電子寵物復仇", "智能家居失控", "虛擬偶像鬼魂",
        "加班大樓的怨念", "共享單車墳場", "外賣員的末路", "KTV最後一間", "密室逃脫真人版",
        "網吧包夜驚魂", "快遞櫃裡的秘密", "合租房禁忌", "電梯維修日", "停電的購物中心",
        "末日預言聊天群", "相親對象是鬼", "寵物監控的真相", "遺物整理師", "最後一班渡輪"
    ],

    // 🏮 中式/民俗恐怖 (適合中式恐怖 Tag)
    chinese: [
        "冥婚古宅", "湘西趕屍", "封門鬼村", "戲班驚魂", "黃皮子墳",
        "陰陽客棧", "苗疆蠱寨", "鎖龍井", "紙人回魂夜", "義莊守夜",
        "奈何橋邊", "繡花鞋老宅", "皮影戲班", "長生邪教", "血祭龍王廟",
        "山村老屍", "狐仙廟", "鬼市交易", "殭屍王爺", "五行殺陣",
        "水鬼拉替身", "吊死鬼林", "斷頭新娘", "畫皮妖", "古鏡攝魂",
        "借陰壽", "養小鬼", "趕屍客棧", "鬼打牆山村", "撈屍人",
        "陰兵借道", "鬼嬰哭墳", "河神娶親", "祖墳風水局", "打生樁",
        "紮紙術傳承", "趕海遇海鬼", "龍脈鎮壓", "鬼戲台", "死人妝",
        "陰宅中介", "鬼當鋪", "背屍工", "問米婆", "走陰人",
        "棺材鋪秘聞", "屍變客棧", "鬼抬轎", "陰胎", "骨灰盒的詛咒",
        "夜哭郎", "鬼剃頭", "餓鬼道", "陰司路引", "地府快遞"
    ],

    // 🏰 西式/宗教/克蘇魯 (適合西幻/克蘇魯 Tag)
    western: [
        "德古拉城堡", "開膛手傑克", "塞勒姆女巫審判", "寂靜嶺迷霧", "血腥瑪麗",
        "舊日支配者祭壇", "深海拉萊耶", "瘋狂修道院", "惡魔召喚儀式", "恐怖孤兒院",
        "溫徹斯特鬼屋", "人皮客棧", "喪屍圍城", "弗蘭肯斯坦實驗室", "吸血鬼舞會",
        "狼人村落", "惡靈附身", "詛咒人偶安娜貝爾", "深淵凝視", "黑彌撒",
        "聖嬰遺骸", "懺悔室秘密", "聖水污染", "褻瀆教堂", "異端審判所",
        "死靈法師塔", "地獄邊境", "魔鬼契約", "七宗罪試煉", "天使墮落日",
        "黑死病醫生", "活體標本館", "畸形秀馬戲團", "人體蜈蚣實驗", "靈魂交換儀式",
        "地獄廚房", "詛咒油畫", "鬼修女", "邪神胎兒", "食人魔莊園",
        "瘟疫醫生面具", "活埋俱樂部", "人體蠟像", "瘋人院地下", "獻祭之夜",
        "古神低語", "深海恐懼症", "星空瘋狂", "不可名狀之物", "宇宙恐怖",
        "黃衣之王", "奈亞拉托提普", "阿撒托斯之夢", "遠古者遺跡", "星之彩"
    ],

    // 🚀 科幻/未來/收容 (適合星際/賽博 Tag)
    scifi: [
        "SCP收容失效", "AI暴走都市", "太空幽靈船", "生化危機實驗室", "賽博貧民窟",
        "複製人工廠", "虛擬現實崩壞", "缸中之腦", "機械公敵", "異形母巢",
        "時空折疊站", "核輻射廢土", "基因改造營", "量子幽靈", "矩陣重啟",
        "反烏托邦監獄", "記憶提取中心", "深海基地", "月球背面", "硅基生物入侵",
        "智械危機", "意識上傳失敗", "時間悖論監獄", "平行宇宙交匯", "克魯蘇AI",
        "數字鬼魂", "賽博精神病院", "義體排斥反應", "腦機接口病毒", "全息幻境崩壞",
        "戴森球故障", "蟲族入侵", "星際難民船", "黑洞邊緣站", "量子糾纏詛咒",
        "記憶篡改公司", "情感刪除服務", "永生代價", "克隆體叛亂", "納米機器人瘟疫",
        "虛擬偶像覺醒", "數據幽靈復仇", "元宇宙崩潰", "意識囚籠", "靈魂備份站",
        "時間回溯失敗", "因果律武器失控", "高維生物觀察", "文明重置器", "宇宙歸零",
        "外星遺物感染", "星際恐懼症", "維度裂縫", "反物質泄露", "奇點降臨"
    ],

    // ⚔️ 生存/大逃殺/規則 (適合無限流/規則怪談)
    survival: [
        "絕地求生島", "死亡迷宮", "飢餓遊戲", "俄羅斯輪盤賭場", "暴風雪山莊",
        "亞馬遜食人族", "泰坦尼克號沉沒夜", "龐貝古城末日", "切爾諾貝利", "迷霧森林",
        "規則怪談：動物園", "規則怪談：媽媽的紙條", "七日殺", "死亡列車", "天空鬥技場",
        "謊言之城", "禁止呼吸", "黑暗童話鎮", "愛麗絲夢遊仙境", "無盡迴廊",
        "大逃殺校園", "殺人遊戲別墅", "定時炸彈城市", "倖存者名額爭奪", "氧氣耗盡空間站",
        "深海潛艇困境", "沙漠求生", "極地考察站", "火山爆發前夜", "隕石撞擊倒數",
        "喪屍圍城十日", "病毒感染隔離區", "食人族部落", "原始森林求生", "無人荒島",
        "規則怪談：公司", "規則怪談：學校", "規則怪談：醫院", "規則怪談：旅館", "規則怪談：遊輪",
        "死亡遊戲直播", "賭命擂台", "致命捉迷藏", "殺手與平民", "最後的晚餐",
        "時限迷宮", "機關城堡", "毒氣密室", "洪水倒灌", "高溫熔爐",
        "冰封末日", "酸雨侵蝕", "輻射廢土", "磁極翻轉", "太陽耀斑"
    ],

    // 🌟 新增類別：混合/跨界/創意類
    hybrid: [
        "賽博鬼城", "AI詛咒", "機械幽靈", "數字招魂", "虛擬地獄",
        "義體鬼魂", "全息鬼屋", "納米詛咒", "量子鬼魅", "時間幽靈",
        "都市狐仙", "地鐵陰兵", "寫字樓養屍", "快遞鬼妻", "網紅黃皮子",
        "共享單車借陰債", "外賣餓鬼", "直播驅魔", "電競通靈", "滴滴鬼車",
        "舊日支配者的公司", "深潛者地鐵", "星空瘋人院", "古神直播間", "邪神外賣",
        "克蘇魯規則怪談", "深淵電梯", "不可名狀的學校", "星空恐懼遊樂園", "古神詛咒APP",
        "表情包詛咒", "emoji殺人事件", "短視頻循環地獄", "彈幕鬼魂", "雲端鬼魂",
        "Wi-Fi招魂", "藍牙附身", "二維碼詛咒", "網紅濾鏡真相", "算法殺人",
        "兵馬俑復活", "故宮夜巡", "金字塔詛咒", "特洛伊木馬病毒", "維京鬼船",
        "瑪雅預言末日", "秦始皇永生計劃", "木乃伊快遞", "騎士亡魂", "武士怨靈"
    ],

    // 🎭 新增類別：心理/超現實/抽象
    psychological: [
        "記憶迷宮", "夢境囚籠", "意識深淵", "人格分裂診所", "現實扭曲病房",
        "時間感知失調", "空間認知崩壞", "感官剝奪實驗", "集體幻覺小鎮", "存在危機危機",
        "邏輯地獄", "悖論房間", "自指詛咒", "無限迴圈公寓", "自我吞噬空間",
        "他者地獄", "鏡像監獄", "聲音實體化", "色彩殺人", "幾何恐懼",
        "語言病毒", "思想污染", "概念實體", "抽象恐懼", "形而上詛咒",
        "存在性虛無", "意義崩塌", "認知邊界", "理性盡頭", "瘋狂臨界點"
    ],

    // 🏛️ 新增類別：歷史/神話/傳說改編
    historical: [
        "特洛伊之夜", "龐貝最後一夜", "圓明園鬼影", "兵馬俑蘇醒", "瑪雅血祭",
        "亞特蘭蒂斯回歸", "樓蘭鬼城", "吳哥窟詛咒", "印加黃金城", "所羅門寶藏",
        "聖杯詛咒", "約櫃殺機", "死海古卷秘密", "諾亞方舟殘骸", "巴別塔遺跡",
        "奧林匹斯神怒", "北歐諸神黃昏", "埃及十災重現", "巴比倫空中花園", "波斯不死軍",
        "匈奴王陵墓", "成吉思汗秘葬", "秦始皇地宮", "武則天無字碑", "大明咒術案",
        "維京英靈殿", "騎士團秘寶", "女巫審判夜", "海盜鬼船", "西部亡魂鎮"
    ],

    // 🎪 新增類別：娛樂/流行文化梗
    popculture: [
        "綜藝大逃殺", "真人秀地獄", "偶像養成詛咒", "電競選手亡魂", "主播連線鬼",
        "電影拍攝事故", "劇組鬧鬼事件", "漫展克蘇魯", "同人展異變", "Cosplay殺人事件",
        "遊戲實體化", "副本成真", "裝備具現化", "技能覺醒日", "氪金詛咒",
        "短視頻挑戰死亡", "直播PK地獄", "彈幕殺人", "評論區鬼魂", "點贊詛咒",
        "微博熱搜詭事", "朋友圈靈異", "微信群死亡遊戲", "知乎怪談成真", "B站鬼畜實體化"
    ],

    // 🌌 新增類別：宇宙/高維/終極恐怖
    cosmic: [
        "宇宙歸零", "熱寂前夕", "真空衰變", "奇點降臨", "維度坍塌",
        "時間盡頭", "因果崩壞", "物理法則失效", "數學地獄", "邏輯末日",
        "觀察者效應恐怖", "量子自殺", "平行宇宙污染", "多世界詛咒", "退相干地獄",
        "黑洞信息悖論", "白洞噴發", "蟲洞迷失", "曲速引擎故障", "超光速詛咒",
        "宇宙背景輻射低語", "暗物質實體", "暗能量侵蝕", "弦理論噩夢", "M理論地獄",
        "高維生物飼養場", "宇宙農場主假說", "缸中之腦集群", "模擬世界崩潰", "造物主棄坑"
    ]
};

const selectDungeonTheme = (tags = [], cycleNum = 1, usedThemes = []) => {
    let availablePools = [];

    // 1. 根據 Tag 權重選擇池子
    if (tags.includes("中式恐怖") || tags.includes("古風") || tags.includes("盜墓")) {
        availablePools.push(...THEME_POOL.chinese, ...THEME_POOL.chinese); // 加權
        availablePools.push(...THEME_POOL.historical); // 關聯歷史
    }
    if (tags.includes("克蘇魯") || tags.includes("西幻") || tags.includes("吸血鬼")) {
        availablePools.push(...THEME_POOL.western);
        availablePools.push(...THEME_POOL.cosmic); // 關聯宇宙恐怖
    }
    if (tags.includes("星際") || tags.includes("賽博龐克") || tags.includes("科幻")) {
        availablePools.push(...THEME_POOL.scifi);
        availablePools.push(...THEME_POOL.cosmic); // 關聯宇宙恐怖
    }
    if (tags.includes("懸疑") || tags.includes("驚悚") || tags.includes("燒腦")) {
        availablePools.push(...THEME_POOL.psychological);
    }

    // 2. 預設池子 (總是包含現代、生存、混合、流行文化)
    // 這些類型適應性強，可以作為通用填充
    availablePools.push(
        ...THEME_POOL.modern,
        ...THEME_POOL.survival,
        ...THEME_POOL.hybrid,
        ...THEME_POOL.popculture
    );

    // 3. 難度/格局過濾 (簡單模擬)
    // 如果是後期 (cycleNum > 5)，嘗試加入更科幻、宏大或抽象的主題
    if (cycleNum > 5) {
        availablePools.push(...THEME_POOL.scifi, ...THEME_POOL.cosmic, ...THEME_POOL.psychological);
    }

    // 4. 去重過濾 (Deduplication)
    const freshThemes = availablePools.filter(theme => !usedThemes.includes(theme));
    const finalPool = freshThemes.length > 0 ? freshThemes : availablePools;
    return finalPool[Math.floor(Math.random() * finalPool.length)];
};

// ==========================================
// 1. 專屬設定生成 (支援模型切換)
// ==========================================
export const generateInfiniteSettings = async (tags = [], tone = "一般", targetChapterCount = null, category = "BG", useDeepSeek = false) => {
    const toneDesc = getToneInstruction(tone);
    const totalChapters = targetChapterCount || 200;
    const isRuleBased = tags.includes("規則怪談");

    const dungeonRequirement = isRuleBased
        ? "設計【規則怪談】副本。必須包含5-8條詭異的紅藍字規則，以及規則背後的邏輯陷阱。"
        : "設計【生存/動作/解謎】副本。重點在於「主線任務」與「環境威脅」。";

    // 🔴 修改點：移除具體書名，改用風格描述
    const prompt = `
    你是一位頂級的無限流小說架構師。
    請設計一套驚悚、懸疑但充滿 CP 張力的設定。
    **類別**：${category}。**篇幅**：${totalChapters} 章。
    風格：${tags.join('、')}。\n${toneDesc}
    
    ${INFINITE_ANTI_CLICHE}
    
    【任務要求】
    1. **CP 設計 (關鍵)**：設計一對強強 CP（或極致拉扯）。他們在現實世界是否有過節？還是久別重逢？或者是系統的對立面（考官vs考生、監管者vs囚犯、神明vs信徒）？
    2. **主角團 (The Squad)**：請設計 2-3 位**固定隊友**。他們將與主角一起闖關。請賦予他們討喜的性格標籤（如：歐皇、鈔能力者、武力擔當）。
    3. **主線謎題**：主角進入無限世界並非偶然。請設計一個貫穿全書的懸疑主線。
    4. **第一副本設計**：${dungeonRequirement}
    
    【回傳 JSON】
    {
      "title": "小說標題",
      "summary": "吸睛文案",
      "trope": "核心梗",
      "design_blueprint": {
          "main_goal": "主角終極目標",
          "world_truth": "世界隱藏真相",
          "ending_vision": "預設結局",
          "side_characters": [ 
              { "name": "...", "role": "隊友/搞笑擔當", "profile": "..." },
              { "name": "...", "role": "隊友/智囊", "profile": "..." }
          ]
      },
      "first_dungeon_setting": {
          "dungeon_name": "副本名稱",
          "difficulty": "等級",
          "background_story": "副本背景",
          "core_rules": ["規則1...", "規則2..."], 
          "missions": ["主線任務...", "支線任務..."], 
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
// 1.5 專屬設定補全 (Ensure Detail)
// ==========================================
export const ensureInfiniteSettings = async (simpleSettings, tags = [], tone = "一般", category = "BG", useDeepSeek = false) => {
    const isRuleBased = tags.includes("規則怪談");
    const dungeonRequirement = isRuleBased
        ? "設計【規則怪談】副本。包含詭異規則書。"
        : "設計【生存/動作】副本。包含明確的系統任務面板與抹殺條件。";

    const prompt = `
    你是一位無限流小說架構師。
    ${INFINITE_ANTI_CLICHE}

    【用戶提供資訊】
    標題：${simpleSettings.title}
    簡介：${simpleSettings.summary || simpleSettings.trope}
    主角：${simpleSettings.protagonist}
    對象：${simpleSettings.loveInterest}

    【補全任務】
    1. 深度人設。
    2. 主線設計。
    3. **第一副本設計**：${dungeonRequirement}

    【回傳 JSON】
    {
      "design_blueprint": {
          "main_goal": "主角終極目標",
          "world_truth": "世界隱藏真相",
          "ending_vision": "預設結局",
          "side_characters": [{ "name": "...", "role": "...", "profile": "..." }]
      },
      "first_dungeon_setting": {
          "dungeon_name": "副本名稱",
          "difficulty": "等級",
          "background_story": "副本背景",
          "core_rules": ["規則1...", "規則2..."],
          "missions": ["主線任務...", "支線任務..."],
          "mechanics": { "gameplay": "核心玩法", "threat": "主要威脅" },
          "entities": [{ "name": "...", "description": "...", "weakness": "..." }],
          "endings": { "normal": "...", "true": "..." }
      },
      "protagonist": {
          "name": "${simpleSettings.protagonist}",
          "role": "主角",
          "gender": "未知",
          "profile": { "appearance": "...", "personality_surface": "...", "personality_core": "...", "biography": "...", "trauma": "...", "desire": "..." }
      },
      "loveInterest": {
          "name": "${simpleSettings.loveInterest}",
          "role": "攻略對象",
          "gender": "未知",
          "profile": { "appearance": "...", "personality_surface": "...", "personality_core": "...", "biography": "...", "trauma": "...", "desire": "..." }
      }
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
        return {
            design_blueprint: { main_goal: "活下去", world_truth: "未知" },
            first_dungeon_setting: { dungeon_name: "新手試煉", missions: ["活下去"] },
            protagonist: { name: simpleSettings.protagonist, profile: {} },
            loveInterest: { name: simpleSettings.loveInterest, profile: {} }
        };
    }
};

// ==========================================
// 2. 專屬第一章生成 (分流：規則 vs 任務)
// ==========================================
export const generateInfiniteStart = async (settings, tags = [], tone = "一般", pov = "女主", useDeepSeek = false) => {
    const toneDesc = getToneInstruction(tone);
    const povDesc = getPovInstruction(pov);
    const styleGuide = `風格：${tags.join('、')} | ${toneDesc} | ${povDesc}`;
    const isRuleBased = tags.includes("規則怪談");

    const firstDungeon = settings.first_dungeon_setting;

    let sideCharsText = "";
    if (settings.design_blueprint?.side_characters) {
        sideCharsText = settings.design_blueprint.side_characters.map(c => `- ${c.name} (${c.role}): ${c.profile}`).join('\n');
    }

    let mechanismDisplay = isRuleBased
        ? `**規則展示**：發現詭異規則（紙條/血字）。主角敏銳地察覺規則漏洞。`
        : `**任務發布**：系統發布任務。主角冷靜分析局勢。`;

    // 🔴 修改點：移除書名，改為風格描述
    const prompt = `
    你是一位無限流小說家。請撰寫第一章。
    **寫作風格**：高智商、強強對抗、快節奏、氛圍驚悚但邏輯嚴密。
    ${INFINITE_ANTI_CLICHE}
    【小說設定】${settings.title}
    ${styleGuide}
    
    【當前副本：${firstDungeon?.dungeon_name}】
    背景：${firstDungeon?.background_story}
    規則/任務：${isRuleBased ? firstDungeon?.core_rules?.join('\n') : firstDungeon?.missions?.join('\n')}
    
    【主角】${JSON.stringify(settings.protagonist)}
    【對象】${JSON.stringify(settings.loveInterest)}
    
    【重要配角 (The Squad)】
    ${sideCharsText}
    (請安排 1-2 位重要隊友在第一章登場，展現他們與主角的互動/初識)

    【寫作要求】
    1. **群像開場**：主角身邊有一群人（新人/資深者）。描寫群體的恐慌 vs 主角的冷靜/瘋狂。
    2. ${mechanismDisplay}
    3. **CP 張力**：安排與攻略對象的初次交鋒（或許是對立陣營，或許是神祕大佬，或許是落難搭檔）。
    4. **字數**：2000字以上。細節要足。

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
          "current_rules": { "title": "${isRuleBased ? '規則書' : '任務面板'}", "rules": [], "hidden_truth": "..." }
      }
    }
    `;

    try {
        let result;
        if (useDeepSeek) {
            result = await callDeepSeek("你是一位無限流小說家。", prompt, true);
        } else {
            const model = getGeminiModel(true);
            const res = await model.generateContent(prompt);
            result = cleanJson(res.response.text());
        }

        // 🛡️ 強制覆蓋 plot_state，確保資料完整性
        if (!result.plot_state) result.plot_state = {};

        result.plot_state.phase = "setup";
        result.plot_state.arcName = firstDungeon?.dungeon_name || "未知副本";
        result.plot_state.instance_progress = 5;
        result.plot_state.cycle_num = 1;
        result.plot_state.current_dungeon = firstDungeon;
        result.plot_state.current_rules = {
            title: isRuleBased ? "規則書" : "任務面板",
            rules: isRuleBased ? (firstDungeon?.core_rules || []) : (firstDungeon?.missions || []),
            hidden_truth: "未知"
        };

        return result;
    } catch (e) {
        const model = getGeminiModel(true);
        const res = await model.generateContent(prompt);
        return cleanJson(res.response.text());
    }
};

// ==========================================
// 3. 副本架構師 (支援 規則 vs 任務 雙模式)
// ==========================================
export const generateDungeonDesign = async (arcName, tone, tags = [], cycleNum, extraInstruction = "", hazards = [], useDeepSeek = false) => {
    const isRuleBased = tags.includes("規則怪談");
    const hazardsText = hazards.length > 0 ? `\n環境危害：${hazards.join('、')}` : "";

    const designType = isRuleBased ? "規則怪談" : "一般無限流";
    const mechanicReq = isRuleBased
        ? "請設計 5-8 條紅藍字規則，包含矛盾與認知污染。"
        : "請設計明確的「主線任務」、「支線任務」、「限制條件」與「失敗懲罰」。";

    const prompt = `
    你是一位無限流副本設計師。
    請為第 ${cycleNum} 個副本【${arcName}】設計設定。
    類型：${designType}。基調：${tone}。
    ${hazardsText} ${extraInstruction}

    【設計要求】
    1. **世界觀**：詭異的背景故事。
    2. **核心機制**：${mechanicReq}
    3. **怪物/Boss**：設計雜兵與 Boss。
    4. **結局**：普通/完美通關條件。

    【回傳 JSON】
    {
        "dungeon_name": "副本名稱",
        "difficulty": "等級",
        "background_story": "...",
        "core_rules": ${isRuleBased ? '["規則1..."]' : '[]'},
        "missions": ${isRuleBased ? '[]' : '["主線任務..."]'},
        "mechanics": { "gameplay_focus": "...", "environment": "..." },
        "entities": [ { "name": "...", "description": "...", "weakness": "..." } ],
        "endings": { "normal": "...", "true": "..." }
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
        const model = getGeminiModel(true);
        const res = await model.generateContent(prompt);
        return cleanJson(res.response.text());
    }
};

// ==========================================
// 4. 動態規則/任務生成 (Adapter)
// ==========================================
export const generateRuleSet = async (arcName, tone, isRuleBased, useDeepSeek = false) => {
    // This function is now an adapter. The actual rules/missions are generated within generateDungeonDesign.
    // It returns a placeholder structure that will be populated by the dungeon design.
    return {
        title: isRuleBased ? "規則守則" : "任務面板",
        rules: [], // These will be populated from currentDungeon.core_rules or currentDungeon.missions
        hidden_truth: "待探索"
    };
};

// ==========================================
// 5. 無限流 Planner Agent (分流邏輯)
// ==========================================
export const planInfinite = async ({
    director,
    blueprint,
    contextSummary,
    memories = [],
    clues = [],
    characters = [],
    tags = [],
    tone = "一般",
    lastPlotState = null,
    useDeepSeek = false,
    novelId = null
}) => {
    const isRuleBased = tags.includes("規則怪談");

    // 1. 狀態初始化
    let currentDungeon = lastPlotState?.current_dungeon || null;
    let currentRules = lastPlotState?.current_rules || null;
    let cycleNum = lastPlotState?.cycle_num || 1;
    let instanceProgress = lastPlotState?.instance_progress || 0;
    let usedThemes = lastPlotState?.used_themes || [];

    // 2. 進度計算與副本重置邏輯 (保留修復後的邏輯)
    if (director.phase === 'rest') {
        instanceProgress = 0;
        currentDungeon = null;
    } else if (director.phase === 'setup' && (!currentDungeon || instanceProgress >= 100)) {
        // 只有在「沒有副本」或「上個副本已結束」時，才接受 setup 指令
        instanceProgress = 0;
        currentDungeon = null;
        cycleNum += 1;
    } else {
        // 否則，在副本內繼續推進
        const resolvedCluesCount = clues.filter(c => c.includes("已解決") || c.includes("解開")).length;
        const totalCluesEstimated = 5;
        const clueProgress = Math.min(resolvedCluesCount / totalCluesEstimated, 1);
        const hasBossForeshadow = memories.slice(-10).some(m => m.content.includes("Boss") || m.content.includes("怪物"));
        const bossProgress = hasBossForeshadow ? 0.5 : 0.0;
        const organicProgress = (clueProgress * 50) + (bossProgress * 30);

        let newProgress = Math.max(instanceProgress + 5, organicProgress);
        if (instanceProgress > 0) {
            instanceProgress = Math.max(instanceProgress, newProgress);
        } else {
            instanceProgress = newProgress;
        }

        if (instanceProgress > 100) instanceProgress = 100;
    }

    // 3. 階段判定
    let phase = "investigation";
    if (director.phase === 'setup' || (instanceProgress < 15 && director.phase !== 'rest')) phase = "setup";
    else if (instanceProgress < 75) phase = "investigation";
    else if (instanceProgress < 95) phase = "climax";
    else phase = "resolution";

    if (director.phase === 'rest') phase = 'rest';
    if (director.phase === 'finale') phase = 'finale';

    // 4. 副本生成
    // 條件：必須是 setup 階段，且還沒有當前副本
    const isNewDungeon = phase === 'setup' && !currentDungeon;

    if (isNewDungeon) {
        const randomTheme = selectDungeonTheme(tags, cycleNum, usedThemes);
        const dungeonName = `${director.arcName} - ${randomTheme}`;
        console.log(`🎲 [Infinite Planner] Generating New Dungeon: ${dungeonName}`);

        // 生成副本設定
        currentDungeon = await generateDungeonDesign(dungeonName, tone, tags, cycleNum, "", [], useDeepSeek);

        // 統一格式化 Rules
        const rulesList = isRuleBased
            ? (currentDungeon.core_rules || [])
            : (currentDungeon.missions || ["任務：存活"]);

        currentRules = {
            title: isRuleBased ? "規則守則" : "任務面板",
            rules: rulesList,
            hidden_truth: "待探索"
        };

        usedThemes.push(randomTheme);
        instanceProgress = 5;

        // 💾 Save to Supabase
        if (novelId) {
            console.log(`💾 Saving dungeon to DB for Novel ID: ${novelId}`);
            try {
                await supabase.from('dungeons').insert({
                    novel_id: novelId,
                    name: currentDungeon.dungeon_name,
                    cycle_num: cycleNum,
                    difficulty: currentDungeon.difficulty,
                    background_story: currentDungeon.background_story,
                    mechanics: currentDungeon.mechanics,
                    core_rules: rulesList,
                    rule_logic: currentRules,
                    entities: currentDungeon.entities,
                    endings: currentDungeon.endings,
                    status: 'active'
                });
                console.log("✅ Dungeon saved to DB");
            } catch (err) { console.error("DB Save Error:", err); }
        } else {
            console.warn("⚠️ No novelId provided, skipping DB save.");
        }
    } else if (currentDungeon) {
        console.log(`🛡️ [Infinite Planner] Keeping existing dungeon: ${currentDungeon.dungeon_name} (Progress: ${instanceProgress}%)`);
    }

    // 5. 遊戲機制操作邏輯 (Gameplay Ops)
    const gameplayOps = (() => {
        if (phase === "setup") return isRuleBased ? "展示【規則守則】，營造詭異感。" : "發布【主線任務】，確立生存目標。";
        if (phase === "investigation") return isRuleBased ? "驗證規則真偽，遭遇違反規則的代價。" : "探索地圖，完成支線，遭遇怪物襲擊。";
        if (phase === "climax") return isRuleBased ? "利用規則漏洞反殺 Boss。" : "與 Boss 進行正面決戰或極限逃生。";
        if (phase === "resolution") return "結算獎勵，揭示副本真相。";
        if (phase === "rest") return "主神空間休整。";
        return "推進劇情。";
    })();

    // 6. 呼叫 Planner
    const dungeonContext = currentDungeon ? `
    【🏯 當前副本：${currentDungeon.dungeon_name}】
    難度：${currentDungeon.difficulty}
    背景：${currentDungeon.background_story}
    核心玩法：${currentDungeon.mechanics?.gameplay_focus}
    通關條件：${currentDungeon.endings?.normal}
    ` : "【當前場景】主神空間/現實世界";

    const rulesContext = currentRules ? `
    【📜 ${currentRules.title}】
    ${currentRules.rules.join('\n')}
    ` : "";

    const prompt = `
    你是一位無限流小說策劃。請根據以下資訊規劃下一章大綱。

    ${INFINITE_ANTI_CLICHE}

    【當前狀態】
    - 階段：${phase.toUpperCase()} (進度: ${Math.floor(instanceProgress)}%)
    - 導演指令：${director.directive}
    - **玩法策略**：${gameplayOps}

    ${dungeonContext}
    ${rulesContext}

    【設計圖】${typeof blueprint === 'string' ? blueprint : JSON.stringify(blueprint)}
    【前情提要】${contextSummary}
    【線索】${clues.length > 0 ? clues.join('\n') : "無"}

    【任務】
    1. 根據副本進度，推進劇情。
    2. **機制演繹**：${isRuleBased ? '讓主角分析規則邏輯。' : '讓主角執行任務目標。'}
    3. 衝突設計與感情規劃。

    回傳 JSON: { "chapter_title": "...", "outline": "...", "key_clue_action": "...", "romance_moment": "...", "suggested_progress_increment": 5, "should_finish_instance": false }
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