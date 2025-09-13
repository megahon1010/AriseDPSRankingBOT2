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

  // 剣の合成ルールは3本で1ランクアップ
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
    
    // 現在の所持剣をMapに変換して検索を高速化
    const ownedMap = new Map<string, number>();
    ownedSwords.forEach(s => ownedMap.set(s.rank.toLowerCase(), s.count));

    let totalNeededForTarget = 1; // 最終的に必要な目標ランクの剣は1本

    const neededBreakdown = new Map<string, number>();

    // 目標ランクから一番低いランクまで遡って計算
    for (let i = targetIndex; i > 0; i--) {
        const currentRank = swordRanks[i];
        const prevRank = swordRanks[i - 1];

        const needed = totalNeededForTarget * 3;
        const ownedCount = ownedMap.get(prevRank) || 0;
        
        const remaining = needed - ownedCount;

        if (remaining > 0) {
            neededBreakdown.set(prevRank, (neededBreakdown.get(prevRank) || 0) + remaining);
            totalNeededForTarget = remaining;
        } else {
            // 足りている場合は、次のランクを合成できる分を計算
            const newSwords = Math.floor(ownedCount / 3);
            const remainingSwords = ownedCount % 3;
            totalNeededForTarget -= newSwords;
            if (totalNeededForTarget < 0) totalNeededForTarget = 0;
            // 次のランクに必要な本数が0になった時点で、これ以上下のランクの剣は不要
            if (totalNeededForTarget === 0) break;
        }
    }

    const totalSwordsNeeded = Array.from(neededBreakdown.values()).reduce((sum, count) => sum + count, 0);
    
    const breakdown: string[] = [];
    if (totalSwordsNeeded > 0) {
        // breakdownを元のランク順に並べ替え
        for (let i = 0; i < swordRanks.length; i++) {
            const rank = swordRanks[i];
            if (neededBreakdown.has(rank)) {
                breakdown.push(`- **${rank.toUpperCase()}**: ${neededBreakdown.get(rank)}本`);
            }
        }
    } else {
        breakdown.push("・持っている剣で達成可能です！");
    }

    return {
        needed: totalSwordsNeeded,
        breakdown: breakdown.join("\n")
    };
}
