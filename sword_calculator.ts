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
 * あるランクの剣を、Eランクに換算したときの総数を計算します。
 * @param rank 剣のランク
 * @param count 剣の本数
 * @returns Eランク換算の総数
 */
export function convertToE(rank: string, count: number): number | null {
    const startIndex = swordRanks.indexOf(rank.toLowerCase());
    if (startIndex === -1) {
        return null;
    }

    let totalE = count;
    for (let i = startIndex; i > 0; i--) {
        totalE *= 3;
    }

    return totalE;
}

/**
 * 目標ランクを達成するために、現在不足している剣の数を計算します。
 * @param targetRank 目標ランク
 * @param ownedSwords 現在持っている剣のリスト（例: [{rank: "g", count: 1}, {rank: "ss", count: 2}])
 * @returns 不足している剣の数
 */
export function calculateRemainingSwords(targetRank: string, ownedSwords: { rank: string, count: number }[]): { needed: number } | null {
    const targetIndex = swordRanks.indexOf(targetRank.toLowerCase());
    if (targetIndex === -1) {
        return null; // 無効な目標ランク
    }

    // 目標ランクに必要なEランクの剣の総数を計算
    const neededTotalE = calculateSwords("e", targetRank);
    if (neededTotalE === null) {
        return null;
    }

    // 所持している剣をすべてEランクに換算して総数を計算
    let ownedTotalE = 0;
    for (const sword of ownedSwords) {
        const eCount = convertToE(sword.rank, sword.count);
        if (eCount === null) {
            return null; // 無効な所持ランク
        }
        ownedTotalE += eCount;
    }

    // 不足しているEランクの剣の総数
    const remainingTotalE = neededTotalE - ownedTotalE;
    
    // 不足分が0以下なら、達成可能
    if (remainingTotalE <= 0) {
        return { needed: 0 };
    }

    return { needed: remainingTotalE };
}
