// sword_calculator.ts

// 剣のランクを定義した配列
const swordRanks = [
  "e", "d", "c", "b", "a", "s", "ss", "g", "n", "n+",
  "m", "m+", "gm", "gm+", "ugm", "ugm+", "hgm", "hgm+", "r", "r+"
];

/**
 * あるランクの剣を、指定した基準ランクに換算したときの総数を計算します。
 * @param fromRank 換算元のランク
 * @param toRank 換算先のランク
 * @param count 剣の本数
 * @returns 換算先のランクでの総数
 */
export function convertFromTo(fromRank: string, toRank: string, count: number): number | null {
    const fromIndex = swordRanks.indexOf(fromRank.toLowerCase());
    const toIndex = swordRanks.indexOf(toRank.toLowerCase());

    if (fromIndex === -1 || toIndex === -1) {
        return null;
    }

    if (fromIndex === toIndex) {
        return count;
    }

    if (fromIndex > toIndex) {
        // ランクが下がる場合（例：SをEに換算）
        let total = count;
        for (let i = fromIndex; i > toIndex; i--) {
            total *= 3;
        }
        return total;
    } else {
        // ランクが上がる場合（例：EをSに換算）
        let total = count;
        for (let i = toIndex; i > fromIndex; i--) {
            if (total % 3 !== 0) {
                return null; // 合成できない場合は換算不能
            }
            total /= 3;
        }
        return total;
    }
}

/**
 * 目的の剣のランクを達成するために必要な、指定したランクの剣の総数を計算します。
 * @param startRank 開始ランク
 * @param targetRank 目的のランク
 * @returns 必要な剣の総数
 */
export function calculateSwords(startRank: string, targetRank: string): number | null {
  const startIndex = swordRanks.indexOf(startRank.toLowerCase());
  const targetIndex = swordRanks.indexOf(targetRank.toLowerCase());

  if (startIndex === -1 || targetIndex === -1 || startIndex >= targetIndex) {
    return null;
  }

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
 * @param baseRank 基準となる換算ランク
 * @returns 不足している剣の数
 */
export function calculateRemainingSwords(targetRank: string, ownedSwords: { rank: string, count: number }[], baseRank: string): { needed: number } | null {
    const targetIndex = swordRanks.indexOf(targetRank.toLowerCase());
    const baseIndex = swordRanks.indexOf(baseRank.toLowerCase());
    if (targetIndex === -1 || baseIndex === -1) {
        return null; // 無効な目標ランクまたは基準ランク
    }

    // 目標ランクの剣1本を基準ランクに換算
    const neededTotalBase = convertFromTo(targetRank, baseRank, 1);
    if (neededTotalBase === null) {
        return null;
    }
    
    // 所持している剣をすべて基準ランクに換算して総数を計算
    let ownedTotalBase = 0;
    for (const sword of ownedSwords) {
        const baseCount = convertFromTo(sword.rank, baseRank, sword.count);
        if (baseCount === null) {
            return null; // 無効な所持ランク
        }
        ownedTotalBase += baseCount;
    }

    // 不足している基準ランクの剣の総数
    const remainingTotalBase = neededTotalBase - ownedTotalBase;
    
    // 不足分が0以下なら、達成可能
    if (remainingTotalBase <= 0) {
        return { needed: 0 };
    }

    return { needed: remainingTotalBase };
}
