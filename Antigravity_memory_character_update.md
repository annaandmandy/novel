AutoGravity Task: Fix Generation Halt, Auto-Update Wiki & UI Tweaks

1. 任務目標 (Objective)

修復生成中斷: 解決閱讀器卡在第 3 章的問題。

實裝自動記憶系統: 讓 AI 在生成小說內容的同時，自動判斷並回傳需要更新的角色狀態或新增的劇情記憶，並由前端自動寫入資料庫。

UI 優化: 調整閱讀器邊距，增加舒適的呼吸感。

2. 問題診斷 (Diagnosis)

Issue A: 自動生成卡在第 3 章 (Stuck at Chapter 3)

原因: prefetchChapters 錯誤處理不完善，導致 API 失敗後鎖死。

解決: 增加錯誤狀態 (generationError) 與 UI 重試按鈕。

Issue B: 記憶系統未整合與自動更新 (Missing Auto-Update Wiki)

原因: 生成時未傳入 Wiki 資料，且生成後沒有機制去更新 Wiki。

解決:

將 Gemini 輸出改為 JSON 格式。

Prompt 要求 AI 提取「狀態變更」與「關鍵事件」。

前端收到 JSON 後，並行更新 chapters, characters, memories 表格。

Issue C: 閱讀器邊距過窄 (UI Margins)

原因: 文字內容貼近視窗邊緣，閱讀體驗有壓迫感。

解決: 在主容器增加 p-4 或 p-6 以及 max-w 限制。

3. 執行步驟 (Execution Steps)

請依照以下順序修改程式碼：

Step 1: 修改 src/lib/gemini.js (改為 JSON 輸出模式)

修改 generateNextChapter，配置模型輸出 JSON schema，並解析回傳的結構化資料。

修改要求:

設定 responseMimeType: "application/json"。

Prompt 必須明確定義 JSON 欄位：content (內文), character_updates (陣列), new_memories (陣列)。

參考程式碼 (gemini.js):

/* ... imports ... */

export const generateNextChapter = async (settings, previousContent, characters = [], memories = []) => {
  // 設定回應格式為 JSON
  const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-preview-09-2025",
      generationConfig: { responseMimeType: "application/json" }
  });

  const charText = characters.map(c => `- ${c.name}: ${c.description} [目前狀態: ${c.status}]`).join('\n');
  const memText = memories.slice(0, 10).map(m => `- ${m.content}`).join('\n');

  const prompt = `
    你是一名網文小說家。請根據設定撰寫下一章，並同時更新世界觀數據。

    【小說設定】標題: ${settings.title}, 主角: ${settings.protagonist}, 類型: ${settings.trope}
    【角色狀態】${charText}
    【記憶庫】${memText}
    【上一章】${previousContent.slice(-2000)}

    【任務要求】
    1. 撰寫新章節 (約 1000-1500 字)。
    2. 偵測是否有角色狀態改變 (如: 受傷、升級、獲得物品) 或新角色登場。
    3. 偵測是否發生值得記錄的關鍵劇情 (Memory)。
    4. 回傳嚴格的 JSON 格式。

    【JSON Schema】
    {
      "content": "小說內文...",
      "new_memories": ["主角獲得了XX劍", "反派YYY登場"],
      "character_updates": [
        { "name": "主角名", "status": "重傷", "description_append": "獲得了雷電異能" } 
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return JSON.parse(response.text());
};


Step 2: 修改 src/pages/Reader.jsx (處理資料更新與 UI)

修改重點:

處理 JSON 回傳: 呼叫 API 後，解構回傳值。

將 content 寫入 chapters 表。

遍歷 character_updates: 若角色存在則更新 status/description，不存在則 insert 新角色。

遍歷 new_memories: 寫入 memories 表。

UI 邊距: 在主內容 div 增加 p-4 md:p-8 與 max-w-3xl。

參考程式碼片段 (Reader.jsx):

/* ... imports ... */

export default function Reader() {
    /* ... state ... */
    const [generationError, setGenerationError] = useState(null);

    const prefetchChapters = async () => {
        if (isPrefetching.current) return;
        isPrefetching.current = true;
        setGenerating(true);
        setGenerationError(null);

        try {
            let lastChapter = chapters[chapters.length - 1];
            
            // 1. 呼叫 AI (取得 JSON)
            const aiResponse = await generateNextChapter(
                novel.settings, 
                lastChapter.content, 
                characters, 
                memories
            );

            // 2. 處理資料庫更新 (並行處理以加快速度)
            const updates = [];

            // A. 新增章節
            const newIndex = lastChapter.chapter_index + 1;
            updates.push(
                supabase.from('chapters').insert({
                    novel_id: novel.id,
                    chapter_index: newIndex,
                    title: `第 ${newIndex} 章`,
                    content: aiResponse.content
                }).select().single()
                .then(({ data }) => {
                    if (data) setChapters(prev => [...prev, data]);
                })
            );

            // B. 自動更新記憶 (Memory)
            if (aiResponse.new_memories?.length > 0) {
                const memoryInserts = aiResponse.new_memories.map(m => ({
                    novel_id: novel.id,
                    content: m,
                    type: 'auto_event'
                }));
                updates.push(
                    supabase.from('memories').insert(memoryInserts).select()
                    .then(({ data }) => {
                        if (data) setMemories(prev => [...data, ...prev]);
                    })
                );
            }

            // C. 自動更新角色 (Character)
            if (aiResponse.character_updates?.length > 0) {
                for (const update of aiResponse.character_updates) {
                    // 簡單邏輯：根據名字尋找現有角色
                    const existingChar = characters.find(c => c.name.includes(update.name));
                    
                    if (existingChar) {
                        // 更新狀態
                        updates.push(
                            supabase.from('characters')
                            .update({ 
                                status: update.status,
                                // 選擇性追加描述，避免覆蓋
                                description: existingChar.description + (update.description_append ? ` | ${update.description_append}` : "")
                            })
                            .eq('id', existingChar.id)
                        );
                    } else {
                        // 新增角色 (簡單處理)
                        updates.push(
                            supabase.from('characters').insert({
                                novel_id: novel.id,
                                name: update.name,
                                role: '配角', // 預設
                                status: update.status,
                                description: update.description_append || "新登場角色"
                            })
                        );
                    }
                }
                // 重新抓取角色以同步 UI
                updates.push(fetchWikiData()); 
            }

            await Promise.all(updates);

        } catch (error) {
            console.error("Auto-generation failed:", error);
            setGenerationError("生成失敗，點擊重試");
        } finally {
            isPrefetching.current = false;
            setGenerating(false);
        }
    };

    /* ... useEffect logic ... */

    return (
        <div className={`h-screen ${theme.bg} ${theme.text} ...`}>
            {/* UI 修正: 增加 margin (p-4 md:p-8) 和 max-width */}
            <div
                onClick={handlePageClick}
                className="flex-1 px-6 py-12 md:p-12 max-w-3xl mx-auto w-full cursor-pointer flex flex-col transition-all duration-300"
            >
                {/* Content... */}
            </div>

            {/* Sidebar... (記得加上錯誤重試按鈕) */}
            {generationError && (
                 <button onClick={() => prefetchChapters()} className="...">
                    重試
                 </button>
            )}
        </div>
    );
}


4. 驗證 (Verification)

觸發變更: 在手動輸入的記憶中寫入「主角即將遭遇重傷」。

檢查生成: 觸發下一章生成。

確認更新: 打開 Wiki 面板，檢查主角的狀態是否自動變成了「重傷」，以及記憶列表中是否多出了新章節的關鍵事件。

檢查 UI: 確認閱讀器文字距離視窗邊緣有適當的留白。