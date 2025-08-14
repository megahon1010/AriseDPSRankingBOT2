// 画像の単位表
export const units = [
  { exp: 3,  symbol: "K" },
  { exp: 6,  symbol: "M" },
  { exp: 9,  symbol: "B" },
  { exp: 12, symbol: "T" },
  { exp: 15, symbol: "Qa" },
  { exp: 18, symbol: "Qi" },
  { exp: 21, symbol: "Sx" },
  { exp: 24, symbol: "Sp" },
  { exp: 27, symbol: "Oc" },
  { exp: 30, symbol: "No" },
  { exp: 33, symbol: "De" },
  { exp: 36, symbol: "Ud" },
  { exp: 39, symbol: "Dd" },
  { exp: 42, symbol: "Td" },
  { exp: 45, symbol: "Qad" },
  { exp: 48, symbol: "Qid" },
  { exp: 51, symbol: "Sxd" },
  { exp: 54, symbol: "Spd" },
  { exp: 57, symbol: "Ocd" },
  { exp: 60, symbol: "Nod" },
  { exp: 63, symbol: "Vg" },
  { exp: 66, symbol: "Uvg" },
  { exp: 69, symbol: "Dvg" },
  { exp: 72, symbol: "Tvg" },
  { exp: 75, symbol: "Qavg" },
  { exp: 78, symbol: "Qivg" },
  { exp: 81, symbol: "Sxvg" },
  { exp: 84, symbol: "Spvg" },
  { exp: 87, symbol: "Ocvg" },
  // ... 必要ならさらに追加
];

export function formatDps(value: number): string {
  if (value < 1000) return value.toString();
  for (let i = units.length - 1; i >= 0; i--) {
    if (value >= Math.pow(10, units[i].exp)) {
      const num = value / Math.pow(10, units[i].exp);
      // 小数点2桁まで表示
      return `${num.toFixed(2)}${units[i].symbol}`;
    }
  }
  return value.toString();
}
