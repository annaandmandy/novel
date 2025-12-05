export const writeInfiniteChapter = async ({ novelContext, plan, prevText, tone, pov }) => {

    const systemPrompt = `
    你是無限流小說專門作者。
    請依照無限流的「事件驅動」節奏撰寫本章。
    - 根據 plan.shouldFinish 決定是否結算副本
    - 嚴禁重複上一章的事件或對話
    - 若進度高，請推向 Boss 或規則反轉
  `;

    const userPrompt = `
    【副本階段】${plan.phase}
    【大綱】${plan.outline}
    【是否結束副本】${plan.shouldFinish}
    【前文摘要】${prevText.slice(0, 300)}
    【風格】${tone} | ${pov}
    
    若 shouldFinish = true：
    - 進行副本結算
    - 發放獎勵或記憶碎片
    - 開啟下一副本伏筆（但不進入）
  `;

    const model = getGeminiModel(true);
    const result = await model.generateContent(systemPrompt + userPrompt);
    return cleanJson(result.response.text());
};
