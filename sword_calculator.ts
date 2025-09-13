// sword_calculator.ts

// 剣のランクを定義した配列
const swordRanks = [
  "e", "d", "c", "b", "a", "s", "ss", "g", "n", "n+",
  "m", "m+", "gm", "ugm", "ugm+", "hgm", "hgm+", "r", "r+"
];

/**
 * 目的の剣のランクを達成するために必要な、指定したランクの剣の総数を計算します。
 * @param startRank 開始ランク
 * @param targetRank 目的のランク
 * @returns 必要な剣の総数
 */
export function calculateSwords(startRank: string, targetRank: string): number | null {
  const startIndex = swordRanks.indexOf(startRank.toLowerCase());
  const targetIndex = swordRanks.indexOf(targetRank.toLowerCase());

  // 指定されたランクが無効な場合はnullを返す
  if (startIndex === -1 || targetIndex === -1 || startIndex >= targetIndex) {
    return null;
  }

  // 必要な剣の数を計算
  let totalSwords = 1;
  for (let i = targetIndex; i > startIndex; i--) {
    totalSwords *= 3;
  }

  return totalSwords;
}

/**
 * 目標ランクを達成するために、現在不足している剣の数を計算します。
 * @param targetRank 目標ランク
 * @param ownedSwords 現在持っている剣のリスト（例: [{rank: "g", count: 1}, {rank: "ss", count: 2}])
 * @returns 不足している剣の数と、合成に必要な内訳
 */
export function calculateRemainingSwords(targetRank: string, ownedSwords: { rank: string, count: number }[]): { needed: number, breakdown: string } | null {
    const targetIndex = swordRanks.indexOf(targetRank.toLowerCase());
    if (targetIndex === -1) {
        return null; // 無効な目標ランク
    }

    let neededForTarget = 1; // 最終的に必要な目標ランクの剣は1本

    // 目標ランクから下のランクへ遡って必要な本数を計算
    const breakdown: string[] = [];
    let remainingSwords = 0;

    for (let i = targetIndex - 1; i >= 0; i--) {
        const currentRank = swordRanks[i];
        const needed = neededForTarget * 3;
        
        // 所持している剣の数を取得
        const ownedCount = ownedSwords.find(s => s.rank.toLowerCase() === currentRank)?.count || 0;
        
        // 不足分を計算
        const 부족분 = needed - ownedCount;
        
        if (부족분 > 0) {
          remainingSwords += 부족분;
          breakdown.push(`- **${currentRank.toUpperCase()}**: ${부족분}本`);
          neededForTarget = 부족분; // 次のランクの必要本数を更新
        } else {
            neededForTarget = Math.ceil((needed - ownedCount) / 3);
        }

    }

    if(breakdown.length === 0){
        breakdown.push("・持っている剣で達成可能です！");
    }

    return {
        needed: remainingSwords,
        breakdown: breakdown.join("\n")
    };
}
