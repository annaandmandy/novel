export const planInfinite = async ({ director, blueprint, contextSummary, memories, clues }) => {

    // 1. 使用「副本進度條」(初版簡易版)
    const totalClues = blueprint?.instance?.total_clues || 5;
    const solved = clues.filter(c => c.solved).length;
    const progress = solved / totalClues;

    let phase = "exploration";
    let shouldFinish = false;

    if (progress >= 0.95) {
        phase = "boss";
    }
    if (progress >= 1.0) {
        shouldFinish = true;
    }

    // 2. 簡易反重複邏輯（可後續擴展）
    const last = memories[memories.length - 1]?.content || "";
    const repeated = last.includes(contextSummary.slice(0, 20));

    return {
        chapter_title: director.arcName + "（無限流）",
        outline: `
      [無限流專用大綱]
      - 當前副本進度：${(progress * 100).toFixed(0)}%
      - 當前階段：${phase}
      - ${repeated
                ? "⚠️偵測到重複傾向，請推動劇情、揭露新規則或進入下一階段。"
                : "正常推進。"
            }
      - 若 shouldFinish = true，代表本章需要進入副本結算流程。
    `,
        key_clue_action: progress < 1 ? "推進線索" : "所有線索已解完",
        romance_moment: "",
        shouldFinish
    }
};
