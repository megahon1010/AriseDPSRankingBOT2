// 単位定義
export const unitList = [
  { exp: 3,  symbol: "K" }, { exp: 6, symbol: "M" }, { exp: 9, symbol: "B" },
  { exp: 12, symbol: "T" }, { exp: 15, symbol: "Qa" }, { exp: 18, symbol: "Qi" },
  { exp: 21, symbol: "Sx" }, { exp: 24, symbol: "Sp" }, { exp: 27, symbol: "Oc" },
  { exp: 30, symbol: "No" }, { exp: 33, symbol: "De" }, { exp: 36, symbol: "Ud" },
  { exp: 39, symbol: "Dd" }, { exp: 42, symbol: "Td" }, { exp: 45, symbol: "Qad" },
  { exp: 48, symbol: "Qid" }, { exp: 51, symbol: "Sxd" }, { exp: 54, symbol: "Spd" },
  { exp: 57, symbol: "Ocd" }, { exp: 60, symbol: "Nod" }, { exp: 63, symbol: "Vg" },
  { exp: 66, symbol: "Uvg" }, { exp: 69, symbol: "Dvg" }, { exp: 72, symbol: "Tvg" },
  { exp: 75, symbol: "Qavg" }, { exp: 78, symbol: "Qivg" }, { exp: 81, symbol: "Sxvg" },
  { exp: 84, symbol: "Spvg" }, { exp: 87, symbol: "Ocvg" }, { exp: 90, symbol: "Novg" },
  { exp: 93, symbol: "Tg" }, { exp: 96, symbol: "Utg" }, { exp: 99, symbol: "Dtg" },
  { exp: 102, symbol: "Ttg" }, { exp: 105, symbol: "Qatg" }, { exp: 108, symbol: "Qitg" },
  { exp: 111, symbol: "Sxtg" }, { exp: 114, symbol: "Sptg" }, { exp: 117, symbol: "Octg" },
  { exp: 120, symbol: "Natg" },
];

// 単位→指数
export function unitToExp(symbol: string): number | null {
  const found = unitList.find(u => u.symbol === symbol);
  return found ? found.exp : null;
}

// DPS値＋単位→絶対値（数値×10^exp）
export function parseDps(value: number, unit: string): number {
  const exp = unitToExp(unit) ?? 0;
  return value * Math.pow(10, exp);
}

// DPS値＋単位→表示
export function formatDps(value: number, unit: string): string {
  return `${value}${unit}`;
}
