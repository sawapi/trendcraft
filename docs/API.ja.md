# TrendCraft APIリファレンス

## 目次

- [インジケーター](#インジケーター)
  - [移動平均](#移動平均)
  - [トレンド](#トレンド)
  - [モメンタム](#モメンタム)
  - [ボラティリティ](#ボラティリティ)
  - [出来高](#出来高)
  - [価格](#価格)
- [シグナル](#シグナル)
  - [クロス検出](#クロス検出)
  - [ダイバージェンス検出](#ダイバージェンス検出)
  - [スクイーズ検出](#スクイーズ検出)
  - [レンジ相場検出](#レンジ相場検出)
- [バックテスト](#バックテスト)
  - [バックテスト実行](#バックテスト実行)
  - [プリセット条件](#プリセット条件)
  - [条件の組み合わせ](#条件の組み合わせ)
- [ユーティリティ](#ユーティリティ)
  - [データ正規化](#データ正規化)
  - [リサンプリング](#リサンプリング)
- [型定義](#型定義)

---

## インジケーター

### 移動平均

#### `sma(candles, options)`

単純移動平均。

```typescript
const result = sma(candles, { period: 20 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | 必須 | 期間 |
| `source` | `PriceSource` | `'close'` | 価格ソース（`'open'`, `'high'`, `'low'`, `'close'`, `'hl2'`, `'hlc3'`, `'ohlc4'`） |

**戻り値:** `Series<number | null>`

---

#### `wma(candles, options)`

加重移動平均。

```typescript
const result = wma(candles, { period: 20 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | 必須 | 期間 |
| `source` | `PriceSource` | `'close'` | 価格ソース |

**戻り値:** `Series<number | null>`

---

#### `ema(candles, options)`

指数移動平均。

```typescript
const result = ema(candles, { period: 12 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | 必須 | 期間 |
| `source` | `PriceSource` | `'close'` | 価格ソース |

**戻り値:** `Series<number | null>`

---

### トレンド

#### `ichimoku(candles, options)`

一目均衡表。

```typescript
const result = ichimoku(candles);
const custom = ichimoku(candles, { tenkanPeriod: 7, kijunPeriod: 22, senkouBPeriod: 44 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `tenkanPeriod` | `number` | `9` | 転換線期間 |
| `kijunPeriod` | `number` | `26` | 基準線期間 |
| `senkouBPeriod` | `number` | `52` | 先行スパンB期間 |
| `displacement` | `number` | `26` | 雲と遅行スパンのずらし期間 |

**戻り値:** `Series<IchimokuValue>`

```typescript
interface IchimokuValue {
  tenkan: number | null;   // 転換線
  kijun: number | null;    // 基準線
  senkouA: number | null;  // 先行スパンA
  senkouB: number | null;  // 先行スパンB
  chikou: number | null;   // 遅行スパン
}
```

---

#### `supertrend(candles, options)`

スーパートレンド（トレンドフォロー指標）。

```typescript
const result = supertrend(candles);
const custom = supertrend(candles, { period: 7, multiplier: 2 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `10` | ATR期間 |
| `multiplier` | `number` | `3` | ATR倍率 |

**戻り値:** `Series<SupertrendValue>`

```typescript
interface SupertrendValue {
  supertrend: number | null;  // スーパートレンド値（サポート/レジスタンス）
  direction: 1 | -1 | 0;      // 1 = 強気, -1 = 弱気, 0 = 未定義
  upperBand: number | null;   // 上バンド
  lowerBand: number | null;   // 下バンド
}
```

---

### モメンタム

#### `rsi(candles, options)`

相対力指数（Wilder方式）。

```typescript
const result = rsi(candles, { period: 14 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `14` | RSI期間 |
| `source` | `PriceSource` | `'close'` | 価格ソース |

**戻り値:** `Series<number | null>` (0-100スケール)

---

#### `macd(candles, options)`

移動平均収束拡散法。

```typescript
const result = macd(candles, { fast: 12, slow: 26, signal: 9 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `fast` | `number` | `12` | 短期EMA期間 |
| `slow` | `number` | `26` | 長期EMA期間 |
| `signal` | `number` | `9` | シグナル期間 |
| `source` | `PriceSource` | `'close'` | 価格ソース |

**戻り値:** `Series<MacdValue>`

```typescript
interface MacdValue {
  macd: number | null;      // MACDライン
  signal: number | null;    // シグナルライン
  histogram: number | null; // MACD - シグナル
}
```

---

#### `stochastics(candles, options)`

ストキャスティクス。

```typescript
// 生のストキャスティクス
const raw = stochastics(candles, { kPeriod: 14, dPeriod: 3 });

// ファストストキャスティクス
const fast = fastStochastics(candles, { kPeriod: 14, dPeriod: 3 });

// スローストキャスティクス
const slow = slowStochastics(candles, { kPeriod: 14, dPeriod: 3 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `kPeriod` | `number` | `14` | %K期間 |
| `dPeriod` | `number` | `3` | %D平滑化期間 |
| `smoothK` | `number` | `3` | %K平滑化（スローストキャスティクス用） |

**戻り値:** `Series<StochasticsValue>`

```typescript
interface StochasticsValue {
  k: number | null;  // %Kライン
  d: number | null;  // %Dライン
}
```

---

#### `dmi(candles, options)`

方向性指数とADX。

```typescript
const result = dmi(candles, { period: 14, adxPeriod: 14 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `14` | DI期間 |
| `adxPeriod` | `number` | `14` | ADX平滑化期間 |

**戻り値:** `Series<DmiValue>`

```typescript
interface DmiValue {
  plusDi: number | null;   // +DI
  minusDi: number | null;  // -DI
  adx: number | null;      // ADX
}
```

---

#### `stochRsi(candles, options)`

ストキャスティクスRSI。

```typescript
const result = stochRsi(candles, {
  rsiPeriod: 14,
  stochPeriod: 14,
  kPeriod: 3,
  dPeriod: 3
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `rsiPeriod` | `number` | `14` | RSI期間 |
| `stochPeriod` | `number` | `14` | ストキャスティクス期間 |
| `kPeriod` | `number` | `3` | %K平滑化 |
| `dPeriod` | `number` | `3` | %D平滑化 |

**戻り値:** `Series<StochRsiValue>`

```typescript
interface StochRsiValue {
  k: number | null;  // %Kライン
  d: number | null;  // %Dライン
}
```

---

#### `cci(candles, options)`

コモディティチャネルインデックス。

```typescript
const result = cci(candles);
const custom = cci(candles, { period: 14 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `20` | CCI期間 |
| `constant` | `number` | `0.015` | 定数倍率 |

**戻り値:** `Series<number | null>` (通常 -100 〜 +100、超過可能)

---

#### `williamsR(candles, options)`

ウィリアムズ%R。

```typescript
const result = williamsR(candles);
const custom = williamsR(candles, { period: 7 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `14` | Williams %R期間 |

**戻り値:** `Series<number | null>` (-100 〜 0 スケール)

---

#### `roc(candles, options)`

変化率。

```typescript
const result = roc(candles);
const custom = roc(candles, { period: 9 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `12` | ROC期間 |
| `source` | `PriceSource` | `'close'` | 価格ソース |

**戻り値:** `Series<number | null>` (パーセント)

---

### ボラティリティ

#### `bollingerBands(candles, options)`

ボリンジャーバンド。

```typescript
const result = bollingerBands(candles, { period: 20, stdDev: 2 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `20` | SMA期間 |
| `stdDev` | `number` | `2` | 標準偏差の倍率 |
| `source` | `PriceSource` | `'close'` | 価格ソース |

**戻り値:** `Series<BollingerBandsValue>`

```typescript
interface BollingerBandsValue {
  upper: number | null;     // 上バンド
  middle: number | null;    // 中央バンド (SMA)
  lower: number | null;     // 下バンド
  percentB: number | null;  // %Bインジケーター
  bandwidth: number | null; // バンド幅
}
```

---

#### `atr(candles, options)`

平均真の範囲（Wilder方式）。

```typescript
const result = atr(candles, { period: 14 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `14` | ATR期間 |

**戻り値:** `Series<number | null>`

---

#### `donchianChannel(candles, options)`

ドンチャンチャネル。

```typescript
const result = donchianChannel(candles, { period: 20 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `20` | 参照期間 |

**戻り値:** `Series<DonchianValue>`

```typescript
interface DonchianValue {
  upper: number | null;   // 最高高値
  middle: number | null;  // (上 + 下) / 2
  lower: number | null;   // 最低安値
}
```

---

### 出来高

#### `vwap(candles, options)`

出来高加重平均価格。

```typescript
// セッションVWAP（日次リセット）
const result = vwap(candles);

// ローリングVWAP（20期間）
const rolling = vwap(candles, { resetPeriod: 'rolling', period: 20 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `resetPeriod` | `'session' \| 'rolling' \| number` | `'session'` | リセット期間タイプ |
| `period` | `number` | `20` | ローリングVWAP期間 |

**戻り値:** `Series<VwapValue>`

```typescript
interface VwapValue {
  vwap: number | null;   // VWAP値
  upper: number | null;  // 上バンド（VWAP + 標準偏差）
  lower: number | null;  // 下バンド（VWAP - 標準偏差）
}
```

---

#### `obv(candles)`

オンバランス出来高。

```typescript
const result = obv(candles);
```

**戻り値:** `Series<number>`

---

#### `mfi(candles, options)`

マネーフローインデックス。

```typescript
const result = mfi(candles, { period: 14 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `14` | MFI期間 |

**戻り値:** `Series<number | null>` (0-100スケール)

---

#### `volumeMa(candles, options)`

出来高移動平均。

```typescript
const result = volumeMa(candles, { period: 20 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `20` | MA期間 |

**戻り値:** `Series<number | null>`

---

### 価格

#### `highest(candles, options)` / `lowest(candles, options)`

n期間の最高値/最安値。

```typescript
const highestHigh = highest(candles, { period: 20 });
const lowestLow = lowest(candles, { period: 20 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | 必須 | 参照期間 |

**戻り値:** `Series<number | null>`

---

#### `returns(candles, options)`

価格リターン計算。

```typescript
const simpleReturns = returns(candles, { period: 1 });
const logReturns = returns(candles, { period: 1, log: true });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `1` | リターン期間 |
| `log` | `boolean` | `false` | 対数リターンを使用 |

**戻り値:** `Series<number | null>`

---

#### `pivotPoints(candles, options)`

ピボットポイント（サポート・レジスタンスレベル）。

```typescript
const result = pivotPoints(candles);
const fib = pivotPoints(candles, { method: 'fibonacci' });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `method` | `'standard' \| 'fibonacci' \| 'woodie' \| 'camarilla' \| 'demark'` | `'standard'` | 計算方式 |

**戻り値:** `Series<PivotPointsValue>`

```typescript
interface PivotPointsValue {
  pivot: number | null;  // ピボットポイント（中心レベル）
  r1: number | null;     // レジスタンス1
  r2: number | null;     // レジスタンス2
  r3: number | null;     // レジスタンス3
  s1: number | null;     // サポート1
  s2: number | null;     // サポート2
  s3: number | null;     // サポート3
}
```

---

## シグナル

### クロス検出

#### `crossOver(series1, series2)` / `crossUnder(series1, series2)`

あるシリーズが別のシリーズを上抜け/下抜けした時を検出。

```typescript
const crosses = crossOver(shortMA, longMA);
```

**戻り値:** `Signal[]`

```typescript
interface Signal {
  time: number;
  type: 'bullish' | 'bearish';
}
```

---

#### `goldenCross(candles, options)` / `deadCross(candles, options)`

ゴールデンクロス（強気）とデッドクロス（弱気）を検出。

```typescript
const gc = goldenCross(candles, { short: 5, long: 25 });
const dc = deadCross(candles, { short: 5, long: 25 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `short` | `number` | 必須 | 短期MA期間 |
| `long` | `number` | 必須 | 長期MA期間 |

**戻り値:** `Signal[]`

---

#### `validateCrossSignals(candles, options)`

品質評価付きでクロスシグナルを検出。

```typescript
const signals = validateCrossSignals(candles, {
  short: 5,
  long: 25,
  volumeMaPeriod: 20,
  trendPeriod: 5,
});
```

**戻り値:** `CrossSignalQuality[]`

```typescript
interface CrossSignalQuality {
  time: number;
  type: 'golden' | 'dead';
  isFake: boolean;             // だましの可能性
  details: {
    volumeConfirmed: boolean;  // 出来高確認
    trendConfirmed: boolean;   // トレンド確認
    holdingConfirmed: boolean | null;  // 5日間維持確認
    pricePositionConfirmed: boolean;   // 価格位置確認
    daysUntilReverse: number | null;   // 反転までの日数
  };
}
```

---

### ダイバージェンス検出

#### `obvDivergence(candles, options)`

OBVダイバージェンスを検出。

```typescript
const signals = obvDivergence(candles);
```

---

#### `rsiDivergence(candles, options)`

RSIダイバージェンスを検出。

```typescript
const signals = rsiDivergence(candles);
```

---

#### `macdDivergence(candles, options)`

MACDダイバージェンスを検出。

```typescript
const signals = macdDivergence(candles);
```

---

**オプション（全ダイバージェンス関数共通）:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `swingLookback` | `number` | `5` | スイングポイント検出の参照期間 |
| `minSwingDistance` | `number` | `5` | スイング間の最小バー数 |
| `maxSwingDistance` | `number` | `60` | スイング間の最大バー数 |

**戻り値:** `DivergenceSignal[]`

```typescript
interface DivergenceSignal {
  time: number;
  type: 'bullish' | 'bearish';  // bullish: 強気, bearish: 弱気
  firstIdx: number;              // 最初のスイングポイントのインデックス
  secondIdx: number;             // 2番目のスイングポイントのインデックス
  price: { first: number; second: number };
  indicator: { first: number; second: number };
}
```

---

### スクイーズ検出

#### `bollingerSqueeze(candles, options)`

ボリンジャーバンドのスクイーズ（低ボラティリティ期間）を検出。

```typescript
const signals = bollingerSqueeze(candles, { threshold: 10 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `20` | ボリンジャーバンド期間 |
| `stdDev` | `number` | `2` | 標準偏差の倍率 |
| `lookback` | `number` | `120` | パーセンタイル計算の参照期間 |
| `threshold` | `number` | `5` | パーセンタイル閾値（例: 5 = 下位5%） |

**戻り値:** `SqueezeSignal[]`

```typescript
interface SqueezeSignal {
  time: number;
  type: 'squeeze';
  bandwidth: number;   // 検出時のバンド幅
  percentile: number;  // パーセンタイル順位
}
```

---

### レンジ相場検出

#### `rangeBound(candles, options)`

レンジ相場（ボックス相場）を検出。複数の指標を組み合わせて、トレンドのない横ばい期間を識別します。

```typescript
const result = rangeBound(candles);
const custom = rangeBound(candles, {
  adxPeriod: 14,
  adxTrendThreshold: 25,
  donchianPeriod: 20,
  persistBars: 3,
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `adxPeriod` | `number` | `14` | ADX計算期間 |
| `adxTrendThreshold` | `number` | `25` | トレンド判定のADX閾値 |
| `donchianPeriod` | `number` | `20` | ドンチャンチャネル期間 |
| `atrPeriod` | `number` | `14` | ATR計算期間 |
| `tightThreshold` | `number` | `80` | タイトレンジ判定のスコア閾値 |
| `confirmedThreshold` | `number` | `60` | レンジ確定のスコア閾値 |
| `formingThreshold` | `number` | `40` | レンジ形成中のスコア閾値 |
| `breakoutProximity` | `number` | `0.02` | ブレイクアウト近接判定（2%） |
| `persistBars` | `number` | `3` | 状態維持の最小バー数 |
| `adxWeight` | `number` | `0.4` | ADXスコアの重み |
| `channelWeight` | `number` | `0.35` | チャネル幅スコアの重み |
| `volatilityWeight` | `number` | `0.25` | ボラティリティスコアの重み |
| `diDifferenceThreshold` | `number` | `10` | +DI/-DI差分閾値 |
| `slopeThreshold` | `number` | `0.15` | 線形回帰傾き閾値（ATR比） |
| `consecutiveHHLLThreshold` | `number` | `3` | 連続HH/LL回数閾値 |
| `slopePeriod` | `number` | `10` | 線形回帰期間 |
| `hhllLookback` | `number` | `10` | HH/LL判定の参照期間 |
| `priceMovementThreshold` | `number` | `0.05` | 価格変動閾値（5%） |
| `priceMovementPeriod` | `number` | `20` | 価格変動判定期間 |

**戻り値:** `Series<RangeBoundValue>`

```typescript
interface RangeBoundValue {
  state: RangeBoundState;     // 現在の状態
  rangeScore: number;         // レンジスコア (0-100)
  rangeHigh: number | null;   // レンジ上限
  rangeLow: number | null;    // レンジ下限
  adx: number | null;         // ADX値
  plusDi: number | null;      // +DI値
  minusDi: number | null;     // -DI値
  donchianUpper: number | null;  // ドンチャン上限
  donchianLower: number | null;  // ドンチャン下限
  atr: number | null;         // ATR値
  adxScore: number;           // ADXスコア成分 (0-100)
  channelScore: number;       // チャネルスコア成分 (0-100)
  volatilityScore: number;    // ボラティリティスコア成分 (0-100)
  rangeBroken: boolean;       // レンジブレイク検出
  trendReason: TrendReason;   // トレンド判定理由
}

type RangeBoundState =
  | 'NEUTRAL'           // 中立
  | 'RANGE_FORMING'     // レンジ形成中
  | 'RANGE_CONFIRMED'   // レンジ確定
  | 'RANGE_TIGHT'       // タイトレンジ
  | 'BREAKOUT_RISK_UP'  // 上方ブレイクアウトリスク
  | 'BREAKOUT_RISK_DOWN'// 下方ブレイクアウトリスク
  | 'TRENDING';         // トレンド中

type TrendReason =
  | 'adx_high'          // ADX >= 25
  | 'price_movement'    // 20日で5%以上の価格変動
  | 'di_diff'           // +DI/-DI差分 >= 10
  | 'slope'             // 線形回帰傾き >= 0.15 ATR
  | 'hhll'              // 連続HH/LL >= 3
  | null;               // トレンドではない
```

#### レンジ相場条件（バックテスト用）

```typescript
// レンジブレイクアウトでエントリー
rangeBreakout()

// レンジ相場ではない時のみエントリー（フィルター）
notInRange()

// レンジ形成中にイグジット
rangeForming()

// レンジ確定中にのみエントリー
inRangeBound()

// 上方ブレイクアウトリスク
breakoutRiskUp()

// 下方ブレイクアウトリスク
breakoutRiskDown()

// タイトレンジ検出
tightRange()

// トレンド中
isTrending()
```

---

## バックテスト

### バックテスト実行

#### `runBacktest(candles, entryCondition, exitCondition, options)`

過去データでバックテストを実行。

```typescript
import { runBacktest, goldenCross, deadCross } from 'trendcraft';

const result = runBacktest(
  candles,
  goldenCross(5, 25),  // エントリー: ゴールデンクロス
  deadCross(5, 25),    // イグジット: デッドクロス
  {
    capital: 1000000,
    commission: 0,
    commissionRate: 0.1,  // 0.1%
    slippage: 0.05,       // 0.05%
    stopLoss: 5,          // 5% ストップロス
    takeProfit: 10,       // 10% 利確
    trailingStop: 3,      // 3% トレーリングストップ
    taxRate: 20.315,      // 日本の税率
  }
);
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `capital` | `number` | 必須 | 初期資金 |
| `commission` | `number` | `0` | 固定手数料/取引 |
| `commissionRate` | `number` | `0` | 手数料率 (%) |
| `slippage` | `number` | `0` | スリッページ率 (%) |
| `stopLoss` | `number` | - | ストップロス (%) |
| `takeProfit` | `number` | - | 利確 (%) |
| `trailingStop` | `number` | - | トレーリングストップ (%) |
| `taxRate` | `number` | `0` | 利益に対する税率 (%) |

**戻り値:** `BacktestResult`

```typescript
interface BacktestResult {
  totalReturn: number;         // 総リターン額
  totalReturnPercent: number;  // 総リターン率
  tradeCount: number;          // 取引回数
  winRate: number;             // 勝率 (%)
  maxDrawdown: number;         // 最大ドローダウン (%)
  sharpeRatio: number;         // シャープレシオ（年率化）
  profitFactor: number;        // プロフィットファクター
  avgHoldingDays: number;      // 平均保有日数
  trades: Trade[];             // 取引詳細
}

interface Trade {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  return: number;
  returnPercent: number;
  holdingDays: number;
}
```

---

### プリセット条件

#### 移動平均クロス

```typescript
goldenCross(shortPeriod = 5, longPeriod = 25)  // 短期MAが長期MAを上抜け
deadCross(shortPeriod = 5, longPeriod = 25)    // 短期MAが長期MAを下抜け
```

#### RSI条件

```typescript
rsiBelow(threshold = 30, period = 14)  // RSI < 閾値（売られすぎ）
rsiAbove(threshold = 70, period = 14)  // RSI > 閾値（買われすぎ）
```

#### MACD条件

```typescript
macdCrossUp(fast = 12, slow = 26, signal = 9)   // MACDがシグナルを上抜け
macdCrossDown(fast = 12, slow = 26, signal = 9) // MACDがシグナルを下抜け
```

#### ボリンジャーバンド条件

```typescript
bollingerBreakout('upper', period = 20, stdDev = 2)  // 上バンドをブレイク
bollingerBreakout('lower', period = 20, stdDev = 2)  // 下バンドをブレイク
bollingerTouch('upper', period = 20, stdDev = 2)     // 上バンドにタッチ
bollingerTouch('lower', period = 20, stdDev = 2)     // 下バンドにタッチ
```

#### 価格 vs SMA

```typescript
priceAboveSma(period)  // 価格がSMAより上
priceBelowSma(period)  // 価格がSMAより下
```

#### 検証付きクロス（だまし検出付き）

```typescript
validatedGoldenCross({
  shortPeriod: 5,
  longPeriod: 25,
  volumeMaPeriod: 20,
  trendPeriod: 5,
  minScore: 50
})

validatedDeadCross({
  shortPeriod: 5,
  longPeriod: 25,
  volumeMaPeriod: 20,
  trendPeriod: 5,
  minScore: 50
})
```

---

### 条件の組み合わせ

論理演算子で複数条件を組み合わせ。

```typescript
import { and, or, not, goldenCross, rsiBelow, rsiAbove, deadCross } from 'trendcraft';

// エントリー: ゴールデンクロス AND RSI < 30
const entry = and(goldenCross(), rsiBelow(30));

// イグジット: デッドクロス OR RSI > 70
const exit = or(deadCross(), rsiAbove(70));

// エントリー: 買われすぎではない
const notOverbought = not(rsiAbove(70));

// 複雑な条件
const complexEntry = and(
  goldenCross(),
  rsiBelow(40),
  not(rsiAbove(60))
);

const result = runBacktest(candles, entry, exit, { capital: 1000000 });
```

#### カスタム条件関数

```typescript
// カスタム条件関数
const customCondition = (
  indicators: Record<string, unknown>,
  candle: NormalizedCandle,
  index: number,
  candles: NormalizedCandle[]
) => {
  // カスタムロジックをここに記述
  return candle.volume > 1000000 && candle.close > candle.open;
};

const result = runBacktest(candles, customCondition, deadCross(), { capital: 1000000 });
```

---

## ユーティリティ

### データ正規化

#### `normalizeCandles(candles)`

様々な日付形式のローソク足を正規化形式に変換。

```typescript
import { normalizeCandles } from 'trendcraft';

const normalized = normalizeCandles(candles);
// すべてのタイムスタンプがUnixミリ秒に変換される
```

---

### リサンプリング

#### `resample(candles, timeframe)`

ローソク足を異なるタイムフレームにリサンプリング。

```typescript
import { resample } from 'trendcraft';

const weekly = resample(dailyCandles, 'weekly');
const monthly = resample(dailyCandles, 'monthly');
```

**サポートされるタイムフレーム:**
- `'weekly'` または `'1w'`
- `'monthly'` または `'1M'`

---

## 型定義

### ローソク足型

```typescript
// 入力用ローソク足（柔軟）
interface Candle {
  time: number | string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 正規化されたローソク足
interface NormalizedCandle {
  time: number;  // Unixタイムスタンプ (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### インジケーター型

```typescript
interface IndicatorValue<T> {
  time: number;
  value: T;
}

type Series<T> = IndicatorValue<T>[];

type PriceSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
```

### シグナル型

```typescript
type SignalType = 'bullish' | 'bearish';

interface Signal {
  time: number;
  type: SignalType;
}
```
