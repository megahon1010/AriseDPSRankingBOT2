// 25文字以内・25個まで（choices用）
export const unitList = [
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
];

// シンボル→指数
export function unitToExp(symbol: string): number | null {
  const found = unitList.find(u => u.symbol === symbol);
  return found ? found.exp : null;
}

// 表示用
export function formatDps(value: number, unit: string): string {
  return `${value}${unit}`;
}
