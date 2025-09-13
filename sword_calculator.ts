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
