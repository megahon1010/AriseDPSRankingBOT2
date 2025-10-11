// dps_units.ts

// 単位リスト (画像に基づいて、K, M, B... c までのすべての単位を定義)
export const unitList = [
  // 標準単位
  { exp: 3, symbol: "K" }, { exp: 6, symbol: "M" }, { exp: 9, symbol: "B" }, { exp: 12, symbol: "T" },
  { exp: 15, symbol: "Qa" }, { exp: 18, symbol: "Qi" }, { exp: 21, symbol: "Sx" }, { exp: 24, symbol: "Sp" },
  { exp: 27, symbol: "Oc" }, { exp: 30, symbol: "No" },

  // dグループ
  { exp: 33, symbol: "Ud" }, { exp: 36, symbol: "Dd" }, { exp: 39, symbol: "Td" }, { exp: 42, symbol: "Qad" },
  { exp: 45, symbol: "Qid" }, { exp: 48, symbol: "Sxd" }, { exp: 51, symbol: "Spd" }, { exp: 54, symbol: "Ocd" },
  { exp: 57, symbol: "Nod" }, { exp: 60, symbol: "Vg" },

  // vgグループ
  { exp: 63, symbol: "Uvg" }, { exp: 66, symbol: "Dvg" }, { exp: 69, symbol: "Tvg" }, { exp: 72, symbol: "Qavg" },
  { exp: 75, symbol: "Qivg" }, { exp: 78, symbol: "Sxg" }, { exp: 81, symbol: "Spg" }, { exp: 84, symbol: "Ocg" },
  { exp: 87, symbol: "Nog" }, { exp: 90, symbol: "Tg" },

  // tgグループ
  { exp: 93, symbol: "Utg" }, { exp: 96, symbol: "Dtg" }, { exp: 99, symbol: "Ttg" }, { exp: 102, symbol: "Qatg" },
  { exp: 105, symbol: "Qitg" }, { exp: 108, symbol: "Sxtg" }, { exp: 111, symbol: "Sptg" }, { exp: 114, symbol: "Octg" },
  { exp: 117, symbol: "Notg" }, { exp: 120, symbol: "Qag" },
  
  // qagグループ
  { exp: 123, symbol: "Uqag" }, { exp: 126, symbol: "Dqag" }, { exp: 129, symbol: "Tqag" }, { exp: 132, symbol: "Qaqag" },
  { exp: 135, symbol: "Qiqag" }, { exp: 138, symbol: "Sxqag" }, { exp: 141, symbol: "Spqag" }, { exp: 144, symbol: "Ocqag" },
  { exp: 147, symbol: "Noqag" }, { exp: 150, symbol: "Qig" },

  // qigグループ
  { exp: 153, symbol: "Uqig" }, { exp: 156, symbol: "Dqig" }, { exp: 159, symbol: "Tqig" }, { exp: 162, symbol: "Qaqig" },
  { exp: 165, symbol: "Qiqig" }, { exp: 168, symbol: "Sxqig" }, { exp: 171, symbol: "Spqig" }, { exp: 174, symbol: "Ocqig" },
  { exp: 177, symbol: "Noqig" }, { exp: 180, symbol: "Sxg" },

  // sxgグループ
  { exp: 183, symbol: "Usxg" }, { exp: 186, symbol: "Dsxg" }, { exp: 189, symbol: "Tsxg" }, { exp: 192, symbol: "Qasxg" },
  { exp: 195, symbol: "Qisxg" }, { exp: 198, symbol: "Sxsxg" }, { exp: 201, symbol: "Spsxg" }, { exp: 204, symbol: "Ocsxg" },
  { exp: 207, symbol: "Nosxg" }, { exp: 210, symbol: "Spg" },

  // spgグループ
  { exp: 213, symbol: "Uspg" }, { exp: 216, symbol: "Dspg" }, { exp: 219, symbol: "Tspg" }, { exp: 222, symbol: "Qaspg" },
  { exp: 225, symbol: "Qispg" }, { exp: 228, symbol: "Sxslg" }, { exp: 231, symbol: "Spspg" }, { exp: 234, symbol: "Ocspg" },
  { exp: 237, symbol: "Nospg" }, { exp: 240, symbol: "Ocg" },

  // ocgグループ
  { exp: 243, symbol: "Uocg" }, { exp: 246, symbol: "Docg" }, { exp: 249, symbol: "Tocg" }, { exp: 252, symbol: "Qaocg" },
  { exp: 255, symbol: "Qiocg" }, { exp: 258, symbol: "Sxocg" }, { exp: 261, symbol: "Spocg" }, { exp: 264, symbol: "Ococg" },
  { exp: 267, symbol: "Noocg" }, { exp: 270, symbol: "Nog" },

  // nogグループ
  { exp: 273, symbol: "Unog" }, { exp: 276, symbol: "Dnog" }, { exp: 279, symbol: "Tnog" }, { exp: 282, symbol: "Qanog" },
  { exp: 285, symbol: "Qinog" }, { exp: 288, symbol: "Sxnogs" }, { exp: 291, symbol: "Spnog" }, { exp: 294, symbol: "Ocnog" },
  { exp: 297, symbol: "Nonog" }, { exp: 300, symbol: "c" },

  // cグループ
  { exp: 303, symbol: "Uc" }, { exp: 306, symbol: "Dc" },
];

/**
 * 単位シンボルを指数に変換します。
 * @param symbol 単位シンボル (例: "Uvg")
 * @returns 対応する指数 (例: 63)
 */
export function unitToExp(symbol: string): number | null {
  const found = unitList.find((u) => u.symbol.toLowerCase() === symbol.toLowerCase());
  return found ? found.exp : null;
}

/**
 * DPSの値を単位付きで整形します。
 * @param value DPSの数値
 * @param unit 単位シンボル
 * @returns 整形された文字列 (例: "123.45Qi")
 */
export function formatDps(value: number, unit: string): string {
  return `${value}${unit}`;
}
