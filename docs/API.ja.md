# TrendCraft APIリファレンス

## 目次

- [インジケーター](#インジケーター)
  - [移動平均](#移動平均)
  - [トレンド](#トレンド)
  - [モメンタム](#モメンタム)
  - [ボラティリティ](#ボラティリティ)
  - [出来高](#出来高)
  - [相対強度（RS）](#相対強度rs)
  - [価格](#価格)
  - [フィボナッチリトレースメント](#フィボナッチリトレースメント)
  - [スマートマネーコンセプト (SMC)](#スマートマネーコンセプト-smc)
- [シグナル](#シグナル)
  - [クロス検出](#クロス検出)
  - [ダイバージェンス検出](#ダイバージェンス検出)
  - [スクイーズ検出](#スクイーズ検出)
  - [レンジ相場検出](#レンジ相場検出)
  - [価格パターン](#価格パターン)
- [バックテスト](#バックテスト)
  - [バックテスト実行](#バックテスト実行)
  - [プリセット条件](#プリセット条件)
  - [条件の組み合わせ](#条件の組み合わせ)
- [ユーティリティ](#ユーティリティ)
  - [データ正規化](#データ正規化)
  - [リサンプリング](#リサンプリング)
- [シグナルスコアリング](#シグナルスコアリング)
  - [ScoreBuilder](#scorebuilder)
  - [スコア計算](#スコア計算)
  - [プリセット](#スコアリングプリセット)
  - [バックテスト条件](#スコアリングバックテスト条件)
- [ポジションサイジング](#ポジションサイジング)
  - [リスクベース](#リスクベースサイジング)
  - [ATRベース](#atrベースサイジング)
  - [Kelly基準](#kelly基準)
  - [固定比率](#固定比率)
- [ATRリスク管理](#atrリスク管理)
  - [シャンデリアエグジット](#シャンデリアエグジット)
  - [ATRストップ](#atrストップ)
- [ボラティリティレジーム](#ボラティリティレジーム)
- [最適化](#最適化)
  - [グリッドサーチ](#gridsearchcandles-strategyfactory-paramranges-options)
  - [ウォークフォワード分析](#walkforwardanalysiscandles-strategyfactory-paramranges-options)
  - [組み合わせ検索](#combinationsearchcandles-entrypool-exitpool-options)
  - [モンテカルロシミュレーション](#モンテカルロシミュレーション)
  - [Anchored Walk-Forward分析](#anchored-walk-forward分析-awf)
- [分割エントリー](#分割エントリー)
- [ストリーミング](#ストリーミング)
  - [Layer 1: キャンドル集約](#layer-1-キャンドル集約)
  - [Layer 2: シグナル検出](#layer-2-シグナル検出)
  - [Layer 3: 条件](#layer-3-条件)
  - [Layer 4: パイプライン & MTF](#layer-4-パイプライン--mtf)
  - [Layer 5: セッション & ガード](#layer-5-セッション--ガード)
  - [Layer 6: ポジション管理](#layer-6-ポジション管理)
- [トレードシグナル](#トレードシグナル)
  - [TradeSignal型](#tradesignal型)
  - [シグナルコンバーター](#シグナルコンバーター)
  - [シグナルエミッター](#シグナルエミッター)
- [シグナルライフサイクル](#シグナルライフサイクル)
  - [SignalManager](#signalmanager)
  - [バッチ処理](#バッチ処理)
- [ショートセリング](#ショートセリング)
  - [バックテストでのショート](#バックテストでのショート)
  - [ストリーミングでのショート](#ストリーミングでのショート)
  - [ポートフォリオ / バッチでのショート](#ポートフォリオ--バッチでのショート)
  - [ショート戦略レシピ](#ショート戦略レシピ)
- [トレード分析](#トレード分析)
  - [analyzeDrawdowns](#analyzedrawdownsperiods)
  - [パターンプロジェクション](#パターンプロジェクション)
- [データ品質バリデーション](#データ品質バリデーション)
  - [validateCandles](#validatecandles)
  - [normalizeAndValidate](#normalizeandvalidate)
  - [個別検出関数](#個別検出関数)
- [カスタムインジケーター（プラグインシステム）](#カスタムインジケータープラグインシステム)
  - [defineIndicator](#defineindicator)
  - [TrendCraft.use()](#trendcraftuse)
  - [組み込みプラグイン](#組み込みプラグイン)
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

#### `hma(candles, options)`

ハル移動平均線 — ネストされたWMA計算によりラグを軽減しつつ滑らかさを維持。

```typescript
const result = hma(candles);
const custom = hma(candles, { period: 20, source: 'close' });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `period` | `number` | `9` | HMA期間（2以上） |
| `source` | `PriceSource` | `'close'` | 価格ソース |

**戻り値:** `Series<number | null>`

**計算式:** `HMA(n) = WMA(2 * WMA(n/2) - WMA(n), sqrt(n))`

---

#### `mcginleyDynamic(candles, options)`

McGinley Dynamic — 市場速度に自動適応するMA。速い市場でのラグを軽減。

```typescript
const result = mcginleyDynamic(candles);
const custom = mcginleyDynamic(candles, { period: 20, k: 0.6, source: 'close' });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `period` | `number` | `14` | 期間 |
| `k` | `number` | `0.6` | 平滑化定数 |
| `source` | `PriceSource` | `'close'` | 価格ソース |

**戻り値:** `Series<number | null>`

**計算式:** `MD[i] = MD[i-1] + (Close - MD[i-1]) / (k × period × (Close/MD[i-1])^4)`

**シード:** SMA(period)

---

#### `emaRibbon(candles, options)`

EMAリボン — 複数EMAの束でトレンド強度・方向を可視化。

```typescript
const result = emaRibbon(candles);
const custom = emaRibbon(candles, { periods: [8, 13, 21, 34, 55], source: 'close' });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `periods` | `number[]` | `[8, 13, 21, 34, 55]` | EMA期間の配列 |
| `source` | `PriceSource` | `'close'` | 価格ソース |

**戻り値:** `Series<EmaRibbonValue>`

```typescript
interface EmaRibbonValue {
  values: (number | null)[];  // 各EMAの値
  bullish: boolean;           // 短期EMA>長期EMA順で整列
  expanding: boolean;         // スプレッド拡大中
}
```

**解釈:**
- `bullish` = 短期EMAが長期EMAより上に整列している状態
- `expanding` = EMA間のスプレッドが拡大中（トレンド加速）

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

#### `parabolicSar(candles, options)`

パラボリックSAR（Stop and Reverse）トレンドフォロー指標。

```typescript
const result = parabolicSar(candles);
const custom = parabolicSar(candles, { step: 0.01, max: 0.1 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `step` | `number` | `0.02` | 加速係数（AF）の増分 |
| `max` | `number` | `0.2` | 加速係数の最大値 |

**戻り値:** `Series<ParabolicSarValue>`

```typescript
interface ParabolicSarValue {
  sar: number | null;       // SAR値
  direction: 1 | -1 | 0;    // 1 = 強気（SAR下）, -1 = 弱気（SAR上）, 0 = 未定義
  isReversal: boolean;      // トレンド転換時にtrue
  af: number | null;        // 現在の加速係数
  ep: number | null;        // 極値（最高高値または最安値）
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

#### `connorsRsi(candles, options)`

コナーズRSI — RSI、ストリークRSI、ROCパーセンタイルランクを組み合わせた複合モメンタムオシレーター。

```typescript
const result = connorsRsi(candles);
const custom = connorsRsi(candles, { rsiPeriod: 3, streakPeriod: 2, rocPeriod: 100 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `rsiPeriod` | `number` | `3` | 価格のRSI期間 |
| `streakPeriod` | `number` | `2` | 連騰/連落ストリークのRSI期間 |
| `rocPeriod` | `number` | `100` | ROCパーセントランクのルックバック期間 |

**戻り値:** `Series<ConnorsRsiValue>`

```typescript
interface ConnorsRsiValue {
  crsi: number | null;          // コナーズRSI（3要素の平均）
  rsi: number | null;           // 価格のRSI
  streakRsi: number | null;     // 連騰/連落ストリークのRSI
  rocPercentile: number | null; // 1期間ROCのパーセントランク
}
```

**解釈:**
- 10未満: 強い売られすぎ（ミーンリバージョンの買いシグナル）
- 90超: 強い買われすぎ（ミーンリバージョンの売りシグナル）
- CRSI = (RSI + StreakRSI + PercentRank) / 3

---

#### `imi(candles, options)`

Intraday Momentum Index — Open-Closeベースの RSI変種。ローリングサム方式。

```typescript
const result = imi(candles);
const custom = imi(candles, { period: 14 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `period` | `number` | `14` | 期間 |

**戻り値:** `Series<number | null>` (0-100)

**計算式:** `100 × SUM(gains, n) / (SUM(gains, n) + SUM(losses, n))`

- gain = Close - Open（Close > Open時）
- loss = Open - Close（Open > Close時）

**解釈:**
- 70超: 過熱（買われすぎ）
- 30未満: 売られすぎ

---

#### `adxr(candles, options)`

ADXR — ADXの平滑版。トレンド強度の遅行確認。

```typescript
const result = adxr(candles);
const custom = adxr(candles, { period: 14, dmiPeriod: 14, adxPeriod: 14 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `period` | `number` | `14` | ADXR平滑化期間 |
| `dmiPeriod` | `number` | `14` | DMI期間 |
| `adxPeriod` | `number` | `14` | ADX期間 |

**戻り値:** `Series<number | null>`

**計算式:** `(ADX[i] + ADX[i - period]) / 2`

**解釈:**
- 25超: トレンドあり
- 20未満: レンジ相場

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

#### `keltnerChannel(candles, options)`

ケルトナーチャネル（EMAとATRを使用したボラティリティエンベロープ）。

```typescript
const result = keltnerChannel(candles);
const custom = keltnerChannel(candles, { emaPeriod: 20, atrPeriod: 10, multiplier: 2 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `emaPeriod` | `number` | `20` | 中心線のEMA期間 |
| `atrPeriod` | `number` | `10` | バンド計算のATR期間 |
| `multiplier` | `number` | `2` | バンド幅のATR倍率 |

**戻り値:** `Series<KeltnerChannelValue>`

```typescript
interface KeltnerChannelValue {
  upper: number | null;   // 上バンド（EMA + 倍率 × ATR）
  middle: number | null;  // 中心線（EMA）
  lower: number | null;   // 下バンド（EMA - 倍率 × ATR）
}
```

---

#### `choppinessIndex(candles, options)`

チョッピネスインデックス — 市場がチョッピー（レンジ相場）かトレンド相場かを計測。

```typescript
const result = choppinessIndex(candles);
const custom = choppinessIndex(candles, { period: 7 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `period` | `number` | `14` | ルックバック期間 |

**戻り値:** `Series<number | null>`（0-100スケール）

**計算式:** `CHOP = 100 * LOG10(SUM(ATR(1), period) / (最高値 - 最安値)) / LOG10(period)`

**解釈:**
- 61.8超: チョッピー/保ち合い — トレンドフォロー戦略を避ける
- 38.2未満: 強いトレンド — トレンドフォローに適している

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
| `bandMultipliers` | `number[]` | — | 追加σバンドの倍率（例：`[2, 3]` で±2σ、±3σ） |

**戻り値:** `Series<VwapValue>`

```typescript
interface VwapValue {
  vwap: number | null;   // VWAP値
  upper: number | null;  // 上バンド（VWAP + 標準偏差）
  lower: number | null;  // 下バンド（VWAP - 標準偏差）
  bands?: VwapBand[];    // bandMultipliers指定時の追加バンド
}
interface VwapBand { upper: number; lower: number; }
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

#### `cmf(candles, options)`

チャイキンマネーフロー - 一定期間の買い圧力と売り圧力を測定。

```typescript
const result = cmf(candles);
const custom = cmf(candles, { period: 21 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `20` | CMF期間 |

**戻り値:** `Series<number | null>` (-1 〜 +1 スケール)

**解釈:**
- 正の値: 買い圧力（アキュムレーション）
- 負の値: 売り圧力（ディストリビューション）
- +0.1以上: 強い買い圧力を示唆
- -0.1以下: 強い売り圧力を示唆

---

#### `volumeAnomaly(candles, options)`

統計的手法で異常な出来高スパイクを検出。

```typescript
const result = volumeAnomaly(candles);
const custom = volumeAnomaly(candles, { period: 20, highThreshold: 2.0, extremeThreshold: 3.0 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `20` | 平均出来高計算期間 |
| `highThreshold` | `number` | `2.0` | 「高」出来高の比率閾値 |
| `extremeThreshold` | `number` | `3.0` | 「極端」出来高の比率閾値 |

**戻り値:** `Series<VolumeAnomalyValue>`

```typescript
interface VolumeAnomalyValue {
  volume: number;           // 現在の出来高
  avgVolume: number;        // 期間平均出来高
  ratio: number;            // 現在/平均 比率
  isAnomaly: boolean;       // 閾値超過でtrue
  level: 'normal' | 'high' | 'extreme' | null;  // 異常レベル
  zScore: number | null;    // 統計的有意性のZスコア
}
```

---

#### `volumeProfile(candles, options)`

Volume Profile（POC、Value Area）を計算。

```typescript
const result = volumeProfile(candles);
const custom = volumeProfile(candles, { period: 20, numLevels: 24, valueAreaPercent: 70 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `20` | 参照期間 |
| `numLevels` | `number` | `24` | 価格レベル数 |
| `valueAreaPercent` | `number` | `70` | Value Area計算の割合 |

**戻り値:** `VolumeProfileValue`

```typescript
interface VolumeProfileValue {
  levels: VolumePriceLevel[];  // 各価格レベルの出来高
  poc: number;                 // Point of Control（最大出来高価格）
  vah: number;                 // Value Area High
  val: number;                 // Value Area Low
  periodHigh: number;          // 期間高値
  periodLow: number;           // 期間安値
}

interface VolumePriceLevel {
  priceMin: number;
  priceMax: number;
  volume: number;
  percentage: number;  // 総出来高に対する割合
}
```

---

#### `volumeProfileSeries(candles, options)`

Volume Profileを時系列で計算（ローリングウィンドウ）。

```typescript
const result = volumeProfileSeries(candles, { period: 20 });
```

**戻り値:** `Series<VolumeProfileValue | null>`

---

#### `volumeTrend(candles, options)`

出来高が価格トレンドを確認/乖離しているかを分析。

```typescript
const result = volumeTrend(candles);
const custom = volumeTrend(candles, { pricePeriod: 10, volumePeriod: 10, maPeriod: 20 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `pricePeriod` | `number` | `10` | 価格トレンド検出期間 |
| `volumePeriod` | `number` | `10` | 出来高トレンド検出期間 |
| `maPeriod` | `number` | `20` | 出来高MA基準期間 |
| `minPriceChange` | `number` | `2.0` | トレンド判定の最小価格変動率 |

**戻り値:** `Series<VolumeTrendValue>`

```typescript
interface VolumeTrendValue {
  priceTrend: 'up' | 'down' | 'neutral';    // 価格の方向
  volumeTrend: 'up' | 'down' | 'neutral';   // 出来高の方向
  isConfirmed: boolean;                      // 出来高がトレンドを確認
  hasDivergence: boolean;                    // 出来高が価格と乖離
  confidence: number;                        // 信頼度スコア（0-100）
}
```

**解釈:**
- **確認済み上昇トレンド**: 価格上昇 + 出来高増加
- **確認済み下降トレンド**: 価格下落 + 出来高増加（強い売り）
- **強気ダイバージェンス**: 価格下落 + 出来高減少（売り枯れ）
- **弱気ダイバージェンス**: 価格上昇 + 出来高減少（弱い上昇）

---

#### `anchoredVwap(candles, options)`

アンカードVWAP — 任意の起点タイムスタンプからVWAPを計算。機関投資家のコストベース把握に使用。

```typescript
const result = anchoredVwap(candles, { anchorTime: Date.parse('2024-01-15') });
const withBands = anchoredVwap(candles, { anchorTime: Date.parse('2024-01-15'), bands: 2 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `anchorTime` | `number` | 必須 | アンカータイムスタンプ（エポックからのms） |
| `bands` | `number` | `0` | 標準偏差バンド数（0, 1, 2） |

**戻り値:** `Series<AnchoredVwapValue>`

```typescript
interface AnchoredVwapValue {
  vwap: number | null;
  upper1?: number | null;  // +1σバンド
  lower1?: number | null;  // -1σバンド
  upper2?: number | null;  // +2σバンド
  lower2?: number | null;  // -2σバンド
}
```

---

#### `elderForceIndex(candles, options)`

Elder's Force Index — 価格変化×ボリュームをEMAで平滑化。

```typescript
const result = elderForceIndex(candles);
const custom = elderForceIndex(candles, { period: 13 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `period` | `number` | `13` | EMA平滑化期間 |

**戻り値:** `Series<number | null>`

**計算式:** `Force = (Close - Prev Close) × Volume → EMA平滑化`

---

#### `easeOfMovement(candles, options)`

Ease of Movement — 価格変化とボリューム効率の指標。

```typescript
const result = easeOfMovement(candles);
const custom = easeOfMovement(candles, { period: 14, volumeDivisor: 10000 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `period` | `number` | `14` | 平滑化期間 |
| `volumeDivisor` | `number` | `10000` | ボリューム除数 |

**戻り値:** `Series<number | null>`

**計算式:** `((H+L)/2 - (prevH+prevL)/2) / ((Volume/divisor) / (H-L))`

---

#### `klinger(candles, options)`

Klinger Volume Oscillator — Volume Forceの短期-長期EMA差分。

```typescript
const result = klinger(candles);
const custom = klinger(candles, { shortPeriod: 34, longPeriod: 55, signalPeriod: 13 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `shortPeriod` | `number` | `34` | 短期EMA期間 |
| `longPeriod` | `number` | `55` | 長期EMA期間 |
| `signalPeriod` | `number` | `13` | シグナルライン期間 |

**戻り値:** `Series<KlingerValue>`

```typescript
interface KlingerValue {
  kvo: number | null;        // Klinger Volume Oscillator
  signal: number | null;     // シグナルライン
  histogram: number | null;  // KVO - Signal
}
```

---

#### `twap(candles, options)`

TWAP（時間加重平均価格） — セッション内のTypical Priceの均等加重平均。

```typescript
const result = twap(candles);
const custom = twap(candles, { sessionResetPeriod: 'session' });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `sessionResetPeriod` | `'session' \| number` | `'session'` | セッションリセット期間 |

**戻り値:** `Series<number | null>`

---

#### `weisWave(candles, options)`

Weis Wave Volume — 波動方向ごとにボリュームを累積。

```typescript
const result = weisWave(candles);
const custom = weisWave(candles, { method: 'close', threshold: 0 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `method` | `'close' \| 'highlow'` | `'close'` | 方向判定方法 |
| `threshold` | `number` | `0` | 方向転換の閾値 |

**戻り値:** `Series<WeisWaveValue>`

```typescript
interface WeisWaveValue {
  waveVolume: number;   // 波動の累積ボリューム
  direction: 1 | -1;   // 波動の方向（1=上昇, -1=下降）
}
```

---

#### `marketProfile(candles, options)`

Market Profile / TPO — 価格帯ごとの滞在時間分析。POC・Value Area算出。

```typescript
const result = marketProfile(candles);
const custom = marketProfile(candles, {
  tickSize: 0.01,
  sessionResetPeriod: 'session',
  valueAreaPercent: 0.70
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `tickSize` | `number` | `auto` | 価格帯のティックサイズ |
| `sessionResetPeriod` | `'session' \| number` | `'session'` | セッションリセット期間 |
| `valueAreaPercent` | `number` | `0.70` | Value Areaの割合 |

**戻り値:** `Series<MarketProfileValue>`

```typescript
interface MarketProfileValue {
  poc: number;              // Point of Control（最頻出価格帯）
  valueAreaHigh: number;    // Value Area上限
  valueAreaLow: number;     // Value Area下限
  profile: Map<number, number>;  // 価格帯ごとのTPOカウント
}
```

---

### 相対強度（RS）

#### `benchmarkRS(candles, benchmark, options)`

株式のパフォーマンスをベンチマーク（S&P 500、日経225など）と比較する相対強度を計算します。

```typescript
import { benchmarkRS } from 'trendcraft';

// 株式を市場指数と比較
const rs = benchmarkRS(stockCandles, sp500Candles, { period: 52 });

// アウトパフォームしている銘柄を探す
const latest = rs[rs.length - 1];
if (latest.value.rsRating > 80 && latest.value.trend === 'up') {
  console.log('相対強度が強い！');
}
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `period` | `number` | `52` | パフォーマンス計算期間 |
| `smaPeriod` | `number` | `52` | Mansfield RS用SMA期間 |
| `rankingLookback` | `number` | `252` | パーセンタイルランキング期間 |
| `flatThreshold` | `number` | `0.01` | フラットトレンドの閾値 |

**戻り値:** `Series<RSValue>`

```typescript
interface RSValue {
  rs: number;                    // 生のRS比率（>1 = アウトパフォーム）
  rsRating: number | null;       // パーセンタイルランク 0-100
  trend: 'up' | 'down' | 'flat'; // RSトレンド方向
  mansfieldRS: number | null;    // SMAからの乖離（%）
  outperformance: number;        // ベンチマーク対比の超過リターン（%）
}
```

**解釈:**
- **RS > 1.0**: ベンチマークをアウトパフォーム
- **RS Rating > 80**: 過去の比較で上位20%
- **Mansfield RS > 0**: RSが移動平均を上回る（強まっている）

---

#### `calculateRSRating(candles, benchmark, period)`

RS Ratingのみを簡単に計算。

```typescript
const rating = calculateRSRating(stockCandles, sp500Candles, 52);
// 戻り値: 85（上位15%）
```

---

#### `isOutperforming(candles, benchmark, period, minOutperformance)`

ベンチマークをアウトパフォームしているかチェック。

```typescript
if (isOutperforming(stockCandles, sp500Candles, 52, 10)) {
  console.log('ベンチマークを10%以上アウトパフォーム');
}
```

---

#### 複数銘柄RSランキング

複数の株式間で相対強度を比較。

```typescript
import { rankByRS, topByRS, filterByRSPercentile } from 'trendcraft';

// 全銘柄をRSでランキング
const symbolsData = new Map([
  ['トヨタ', toyotaCandles],
  ['ソニー', sonyCandles],
  ['任天堂', nintendoCandles],
]);

const rankings = rankByRS(symbolsData, { benchmarkSymbol: 'TOPIX' });
// [{ symbol: 'トヨタ', rank: 1, rsRating: 92, ... }, ...]

// 上位5銘柄を取得
const top5 = topByRS(symbolsData, 5);

// 上位20%の銘柄をフィルタ
const leaders = filterByRSPercentile(symbolsData, 80);
```

| 関数 | 説明 |
|------|------|
| `rankByRS(symbolsData, options)` | 全銘柄をRSでランキング |
| `topByRS(symbolsData, n, options)` | RS上位N銘柄を取得 |
| `bottomByRS(symbolsData, n, options)` | RS下位N銘柄を取得 |
| `filterByRSPercentile(symbolsData, minPercentile, options)` | RSパーセンタイルでフィルタ |
| `compareRS(symbol1, symbol2, candles1, candles2, options)` | 2銘柄を直接比較 |

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

#### `autoTrendLine(candles, options)`

スイングポイントを使った自動トレンドライン検出。直近のスイングハイ・スイングローを通るレジスタンスラインとサポートラインを描画します。

```typescript
const tl = autoTrendLine(candles, { leftBars: 10, rightBars: 10 });
const last = tl[tl.length - 1].value;
console.log(`Resistance: ${last.resistance}, Support: ${last.support}`);
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `leftBars` | `number` | `10` | スイング確認の左バー数 |
| `rightBars` | `number` | `10` | スイング確認の右バー数 |

**戻り値:** `Series<AutoTrendLineValue>`

```typescript
interface AutoTrendLineValue {
  resistance: number | null;  // レジスタンスライン（補間値）
  support: number | null;     // サポートライン（補間値）
}
```

---

#### `channelLine(candles, options)`

スイングポイントを使ったチャネルラインインジケーター。上限・下限・中央のチャネルラインを描画します。

```typescript
const ch = channelLine(candles, { leftBars: 10, rightBars: 10 });
const last = ch[ch.length - 1].value;
console.log(`Upper: ${last.upper}, Lower: ${last.lower}, Dir: ${last.direction}`);
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `leftBars` | `number` | `10` | スイング確認の左バー数 |
| `rightBars` | `number` | `10` | スイング確認の右バー数 |

**戻り値:** `Series<ChannelLineValue>`

```typescript
interface ChannelLineValue {
  upper: number | null;                   // 上限チャネルライン
  lower: number | null;                   // 下限チャネルライン
  middle: number | null;                  // 中央チャネルライン（平均）
  direction: "up" | "down" | null;        // チャネル方向
}
```

---

#### `fibonacciExtension(candles, options)`

3つのスイングポイント（A-B-Cパターン）から算出するフィボナッチエクステンションレベル。

```typescript
const ext = fibonacciExtension(candles, { leftBars: 10, rightBars: 10 });
const last = ext[ext.length - 1].value;
if (last.levels) {
  console.log(`161.8%ターゲット: ${last.levels["1.618"]}`);
}
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `leftBars` | `number` | `10` | スイング確認の左バー数 |
| `rightBars` | `number` | `10` | スイング確認の右バー数 |
| `levels` | `number[]` | `[0, 0.618, 1, 1.272, 1.618, 2, 2.618]` | エクステンション比率レベル |

**戻り値:** `Series<FibonacciExtensionValue>`

```typescript
interface FibonacciExtensionValue {
  levels: Record<string, number> | null;           // 比率別エクステンションレベル
  pointA: number | null;                           // 初動の起点
  pointB: number | null;                           // 初動の終点
  pointC: number | null;                           // 戻りの終点
  direction: "bullish" | "bearish" | null;         // エクステンション方向
}
```

---

#### `andrewsPitchfork(candles, options)`

アンドリューズ・ピッチフォークインジケーター。中央線・上限ハンドル線・下限ハンドル線を描画します。

```typescript
const pf = andrewsPitchfork(candles, { leftBars: 10, rightBars: 10 });
const last = pf[pf.length - 1].value;
console.log(`Median: ${last.median}, Upper: ${last.upper}, Lower: ${last.lower}`);
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `leftBars` | `number` | `10` | スイング確認の左バー数 |
| `rightBars` | `number` | `10` | スイング確認の右バー数 |

**戻り値:** `Series<AndrewsPitchforkValue>`

```typescript
interface AndrewsPitchforkValue {
  median: number | null;  // 中央線
  upper: number | null;   // 上限ハンドル線
  lower: number | null;   // 下限ハンドル線
}
```

---

### フィボナッチリトレースメント

#### `fibonacciRetracement(candles, options)`

スイングポイントに基づくフィボナッチリトレースメントレベルの計算。直近のスイングハイとスイングローを検出し、その間のリトレースメントレベルを計算します。

```typescript
const fib = fibonacciRetracement(candles, { leftBars: 10, rightBars: 10 });
const last = fib[fib.length - 1].value;
if (last.levels) {
  console.log(`61.8%レベル: ${last.levels["0.618"]}`);
  console.log(`トレンド: ${last.trend}`);
}
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `leftBars` | `number` | `10` | スイングポイント確認の左バー数 |
| `rightBars` | `number` | `10` | スイングポイント確認の右バー数 |
| `levels` | `number[]` | `[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]` | 計算するフィボナッチ比率レベル |

**戻り値:** `Series<FibonacciRetracementValue>`

```typescript
interface FibonacciRetracementValue {
  levels: Record<string, number> | null;  // 比率文字列→価格のマッピング
  swingHigh: number | null;               // 使用したスイングハイ価格
  swingLow: number | null;                // 使用したスイングロー価格
  trend: "up" | "down" | null;            // スイングハイが直近なら "up"
}
```

---

#### `openingRange(candles, options)`

オープニングレンジブレイクアウト（ORB） — セッションのオープニングレンジを検出し、ブレイクアウトを判定。

```typescript
const result = openingRange(candles);
const custom = openingRange(candles, { minutes: 15, sessionResetPeriod: 'day' });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `minutes` | `number` | `30` | オープニングレンジの時間（分） |
| `sessionResetPeriod` | `'day' \| number` | `'day'` | セッションリセット方式 |

**戻り値:** `Series<OpeningRangeValue>`

```typescript
interface OpeningRangeValue {
  high: number | null;
  low: number | null;
  breakout: 'above' | 'below' | null;
}
```

---

#### `gapAnalysis(candles, options)`

ギャップ分析 — 連続するローソク足間の価格ギャップを検出・分類し、フィル状況を追跡。

```typescript
const result = gapAnalysis(candles);
const custom = gapAnalysis(candles, { minGapPercent: 1.0 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `minGapPercent` | `number` | `0.5` | ギャップと認定する最小パーセンテージ |

**戻り値:** `Series<GapValue>`

```typescript
interface GapValue {
  type: 'up' | 'down' | null;
  gapPercent: number;
  classification: 'full' | 'partial' | 'unfilled' | null;
  filled: boolean;
}
```

**分類:**
- **フルギャップアップ**: 始値 > 前日高値
- **パーシャルギャップアップ**: 始値 > 前日終値 かつ ≤ 前日高値
- **フルギャップダウン**: 始値 < 前日安値
- **パーシャルギャップダウン**: 始値 < 前日終値 かつ ≥ 前日安値

---

### スマートマネーコンセプト (SMC)

#### `breakOfStructure(candles, options)`

ブレイクオブストラクチャー（BOS）の検出。価格が直近のスイングハイを上回って引けると強気BOS、スイングローを下回ると弱気BOSとなります。

```typescript
const bos = breakOfStructure(candles, { swingPeriod: 5 });
const lastBos = bos[bos.length - 1].value;
if (lastBos.bullishBos) {
  console.log(`強気BOS！ ${lastBos.brokenLevel} を上抜け`);
}
console.log(`現在のトレンド: ${lastBos.trend}`);
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `swingPeriod` | `number` | `5` | スイング検出期間（左右のバー数） |

**戻り値:** `Series<BosValue>`

```typescript
interface BosValue {
  bullishBos: boolean;                            // 強気ブレイクオブストラクチャー
  bearishBos: boolean;                            // 弱気ブレイクオブストラクチャー
  brokenLevel: number | null;                     // ブレイクしたレベル
  trend: "bullish" | "bearish" | "neutral";       // 現在のマーケットトレンド
  swingHighLevel: number | null;                  // 直近のスイングハイレベル
  swingLowLevel: number | null;                   // 直近のスイングローレベル
}
```

---

#### `changeOfCharacter(candles, options)`

チェンジオブキャラクター（CHoCH）の検出。BOSと同様ですが、逆方向への最初のブレイクを特に検出し、トレンド転換の可能性を示します。

```typescript
const choch = changeOfCharacter(candles, { swingPeriod: 5 });
const last = choch[choch.length - 1].value;
if (last.bullishBos) {
  console.log("強気CHoCH - 上昇トレンドへの転換の可能性");
}
```

**オプション:** `breakOfStructure`と同じ。

**戻り値:** `Series<BosValue>`（`breakOfStructure`と同じ構造）

---

#### `orderBlock(candles, options)`

オーダーブロックの検出。BOSの直前の反対方向のローソク足がオーダーブロックとなります。これらのゾーンは価格が戻りやすいサポート/レジスタンスとして機能します。

```typescript
const obs = orderBlock(candles, { swingPeriod: 5, minVolumeRatio: 1.2 });
const lastOb = obs[obs.length - 1].value;

if (lastOb.newOrderBlock) {
  console.log(`新規 ${lastOb.newOrderBlock.type} OB: ${lastOb.newOrderBlock.low}-${lastOb.newOrderBlock.high}`);
}
if (lastOb.atBullishOB) {
  console.log("強気オーダーブロック付近 - サポートの可能性");
}
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `swingPeriod` | `number` | `5` | BOS検出のスイング期間 |
| `volumePeriod` | `number` | `20` | 強度計算用の出来高MA期間 |
| `minVolumeRatio` | `number` | `1.0` | 有効なOBの最低出来高倍率 |
| `maxActiveOBs` | `number` | `10` | 追跡するアクティブOBの最大数 |
| `partialMitigation` | `boolean` | `true` | 部分的な接触をミティゲーションと見なす |

**戻り値:** `Series<OrderBlockValue>`

```typescript
interface OrderBlockValue {
  newOrderBlock: OrderBlock | null;      // このバーで作成された新規OB
  activeOrderBlocks: OrderBlock[];       // アクティブ（未ミティゲート）OB
  mitigatedThisBar: OrderBlock[];        // このバーでミティゲートされたOB
  atBullishOB: boolean;                  // 強気OBゾーンにいるか
  atBearishOB: boolean;                  // 弱気OBゾーンにいるか
}

interface OrderBlock {
  type: "bullish" | "bearish";
  high: number;                          // 上限境界
  low: number;                           // 下限境界
  open: number;                          // OBローソク足の始値
  close: number;                         // OBローソク足の終値
  startIndex: number;                    // OB作成インデックス
  startTime: number;                     // OB作成時刻
  strength: number;                      // 強度スコア (0-100)
  mitigated: boolean;                    // ミティゲート済みかどうか
  mitigatedIndex: number | null;         // ミティゲートインデックス
  mitigatedTime: number | null;          // ミティゲート時刻
}
```

---

#### `getActiveOrderBlocks(candles, options)`

現在アクティブな（未ミティゲートの）オーダーブロックを取得。

```typescript
const { bullish, bearish } = getActiveOrderBlocks(candles, { swingPeriod: 5 });
console.log(`強気OB: ${bullish.length}個, 弱気OB: ${bearish.length}個`);
```

**オプション:** `orderBlock`と同じ。

**戻り値:** `{ bullish: OrderBlock[]; bearish: OrderBlock[] }`

---

#### `getNearestOrderBlock(candles, options)`

現在価格に最も近いオーダーブロックを取得。

```typescript
const nearest = getNearestOrderBlock(candles);
if (nearest) {
  console.log(`最寄りOB: ${nearest.type} (${nearest.low}-${nearest.high})`);
}
```

**オプション:** `orderBlock`と同じ。

**戻り値:** `OrderBlock | null`

---

#### `liquiditySweep(candles, options)`

流動性スイープの検出。価格がスイングハイ/ローを一時的にブレイクしてストップロスをトリガーし、すぐに反転するパターンです。機関投資家によく見られるパターンです。

```typescript
const sweeps = liquiditySweep(candles, { swingPeriod: 5 });
const last = sweeps[sweeps.length - 1].value;

if (last.recoveredThisBar.length > 0) {
  const sweep = last.recoveredThisBar[0];
  if (sweep.type === "bullish") {
    console.log("強気スイープ回復 - ロングエントリーの可能性");
  }
}
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `swingPeriod` | `number` | `5` | スイング検出期間 |
| `maxRecoveryBars` | `number` | `3` | 回復を待つ最大バー数 |
| `maxTrackedSweeps` | `number` | `10` | 追跡する直近スイープの最大数 |
| `minSweepDepth` | `number` | `0` | 有効と見なす最小スイープ深度（%） |

**戻り値:** `Series<LiquiditySweepValue>`

```typescript
interface LiquiditySweepValue {
  isSweep: boolean;                        // このバーで新規スイープ発生
  sweep: LiquiditySweep | null;            // 新規スイープの詳細
  recentSweeps: LiquiditySweep[];          // 直近のスイープ
  recoveredThisBar: LiquiditySweep[];      // このバーで回復したスイープ
}

interface LiquiditySweep {
  type: "bullish" | "bearish";
  sweptLevel: number;                      // スイープされたスイングレベル
  sweepExtreme: number;                    // スイープ中の極値
  sweepIndex: number;                      // スイープ発生インデックス
  sweepTime: number;                       // スイープ発生時刻
  recovered: boolean;                      // 価格が回復したか
  recoveredIndex: number | null;           // 回復インデックス
  recoveredTime: number | null;            // 回復時刻
  sweepDepthPercent: number;               // スイングレベルからの深度（%）
}
```

---

#### `getRecoveredSweeps(candles, options)`

全ての回復済みスイープを取得。

```typescript
const { bullish, bearish } = getRecoveredSweeps(candles, { swingPeriod: 5 });
console.log(`強気回復: ${bullish.length}件, 弱気回復: ${bearish.length}件`);
```

**オプション:** `liquiditySweep`と同じ。

**戻り値:** `{ bullish: LiquiditySweep[]; bearish: LiquiditySweep[] }`

---

#### `hasRecentSweepSignal(candles, type, options)`

現在のバーで直近のスイープシグナルがあるかチェック。

```typescript
if (hasRecentSweepSignal(candles, "bullish")) {
  console.log("強気スイープシグナル検出！");
}
```

**パラメータ:**
| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `candles` | `Candle[]` | 必須 | ローソク足データ |
| `type` | `"bullish" \| "bearish" \| "both"` | `"both"` | チェックするスイープタイプ |
| `options` | `LiquiditySweepOptions` | `{}` | 流動性スイープオプション |

**戻り値:** `boolean`

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

### 出来高シグナル

#### `volumeBreakout(candles, options)`

N日間の最高出来高を突破した時を検知。

```typescript
const signals = volumeBreakout(candles, { period: 20 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `20` | 最高出来高のルックバック期間 |

**戻り値:** `VolumeBreakoutSignal[]`

```typescript
interface VolumeBreakoutSignal {
  time: number;
  type: 'volume_breakout';
  volume: number;
  previousHigh: number;
  ratio: number;
}
```

---

#### `volumeAccumulation(candles, options)`

線形回帰の傾きを使用して出来高蓄積フェーズを検知。

```typescript
const signals = volumeAccumulation(candles, {
  period: 10,
  minSlope: 0.05,
  minConsecutiveDays: 3,
  minR2: 0.5
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `10` | 回帰計算期間 |
| `minSlope` | `number` | `0.05` | 最小正規化傾き（5%/日） |
| `minConsecutiveDays` | `number` | `3` | 最小連続日数 |
| `minR2` | `number` | `0.5` | 回帰品質の最小R² |

**戻り値:** `VolumeAccumulationSignal[]`

```typescript
interface VolumeAccumulationSignal {
  time: number;
  type: 'volume_accumulation';
  slope: number;           // 正規化傾き
  r2: number;              // R²品質スコア
  consecutiveDays: number; // 蓄積日数
}
```

---

#### `volumeAboveAverage(candles, options)`

N日移動平均を超える出来高が連続する期間を検知。

```typescript
const signals = volumeAboveAverage(candles, {
  period: 20,
  minRatio: 1.2,
  minConsecutiveDays: 3
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `20` | 平均計算のルックバック期間 |
| `minRatio` | `number` | `1.0` | 現在/平均の最小比率 |
| `minConsecutiveDays` | `number` | `3` | 平均を超える最小連続日数 |

**戻り値:** `VolumeAboveAverageSignal[]`

```typescript
interface VolumeAboveAverageSignal {
  time: number;
  type: 'volume_above_average';
  volume: number;           // 現在の出来高
  averageVolume: number;    // N日平均出来高
  ratio: number;            // 現在/平均（例: 1.5 = 150%）
  consecutiveDays: number;  // 平均を超えた日数
}
```

**注意:** `volumeAboveAverage`は単純な比率比較を使用し、`volumeAccumulation`は線形回帰で出来高の増加トレンドを検出します。持続的な高活動の検出には`volumeAboveAverage`を、加速する出来高パターンの検出には`volumeAccumulation`を使用してください。

---

#### `volumeMaCross(candles, options)`

出来高移動平均のクロスオーバーを検知。

```typescript
const signals = volumeMaCross(candles, {
  shortPeriod: 5,
  longPeriod: 20
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `shortPeriod` | `number` | `5` | 短期MA期間 |
| `longPeriod` | `number` | `20` | 長期MA期間 |

**戻り値:** `VolumeMaCrossSignal[]`

```typescript
interface VolumeMaCrossSignal {
  time: number;
  type: 'volume_ma_cross_up' | 'volume_ma_cross_down';
  shortMa: number;
  longMa: number;
}
```

---

### 価格パターン

反転・継続シグナルのためのクラシックなチャートパターンを検出します。

#### `doubleTop(candles, options)` / `doubleBottom(candles, options)`

ダブルトップ（弱気反転）とダブルボトム（強気反転）パターンを検出。

```typescript
import { doubleTop, doubleBottom } from 'trendcraft';

const bearishPatterns = doubleTop(candles, { tolerance: 0.02 });
const bullishPatterns = doubleBottom(candles);

bearishPatterns.forEach(p => {
  if (p.confirmed) {
    console.log(`ダブルトップ確認、目標価格: ${p.pattern.target}`);
  }
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `tolerance` | `number` | `0.02` | ピーク/ボトム間の最大価格差（2%） |
| `minDistance` | `number` | `10` | ピーク/ボトム間の最小バー数 |
| `maxDistance` | `number` | `60` | ピーク/ボトム間の最大バー数 |
| `minMiddleDepth` | `number` | `0.1` | 中間トラフ/ピークの最小深さ（10%） |
| `swingLookback` | `number` | `5` | スイングポイント検出ルックバック |

---

#### `headAndShoulders(candles, options)` / `inverseHeadAndShoulders(candles, options)`

ヘッドアンドショルダー（弱気）と逆ヘッドアンドショルダー（強気）パターンを検出。

```typescript
import { headAndShoulders, inverseHeadAndShoulders } from 'trendcraft';

const bearish = headAndShoulders(candles);
const bullish = inverseHeadAndShoulders(candles);

bearish.forEach(p => {
  console.log(`H&S発生 ${new Date(p.time)}, ネックライン: ${p.pattern.neckline.currentPrice}`);
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `shoulderTolerance` | `number` | `0.05` | 肩間の最大差（5%） |
| `maxNecklineSlope` | `number` | `0.1` | ネックラインの最大傾き（10%） |
| `minHeadHeight` | `number` | `0.03` | ヘッドの最小突出度（3%） |
| `swingLookback` | `number` | `5` | スイングポイント検出ルックバック |

---

#### `cupWithHandle(candles, options)`

カップ・ウィズ・ハンドル強気継続パターン（William O'Neil）を検出。

```typescript
import { cupWithHandle } from 'trendcraft';

const patterns = cupWithHandle(candles, {
  minCupDepth: 0.15,
  maxCupDepth: 0.35
});

patterns.forEach(p => {
  if (p.confirmed) {
    console.log(`カップ・ウィズ・ハンドルブレイクアウト！目標: ${p.pattern.target}`);
  }
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `minCupDepth` | `number` | `0.12` | カップの最小深さ（12%） |
| `maxCupDepth` | `number` | `0.35` | カップの最大深さ（35%） |
| `minCupLength` | `number` | `30` | カップの最小バー数 |
| `maxHandleDepth` | `number` | `0.12` | ハンドルの最大プルバック（12%） |
| `minHandleLength` | `number` | `5` | ハンドルの最小バー数 |
| `swingLookback` | `number` | `5` | スイングポイント検出ルックバック |

---

#### パターンシグナル構造

すべてのパターン検出関数は `PatternSignal[]` を返します：

```typescript
interface PatternSignal {
  time: number;              // パターン完成時刻
  type: PatternType;         // 'double_top' | 'double_bottom' | 'head_shoulders' など
  pattern: {
    startTime: number;       // パターン開始
    endTime: number;         // パターン終了
    keyPoints: PatternKeyPoint[];  // キーポイント（ピーク、トラフ、ネックライン）
    neckline?: PatternNeckline;    // H&Sパターン用
    target?: number;         // 目標価格（メジャードムーブ）
    stopLoss?: number;       // 推奨ストップロス
    height: number;          // パターン高さ
  };
  confidence: number;        // 0-100 信頼度スコア
  confirmed: boolean;        // ブレイクアウト発生時true
}
```

| パターンタイプ | 方向 | 確認条件 |
|--------------|------|---------|
| `double_top` | 弱気 | 中間トラフを下抜け |
| `double_bottom` | 強気 | 中間ピークを上抜け |
| `head_shoulders` | 弱気 | ネックラインを下抜け |
| `inverse_head_shoulders` | 強気 | ネックラインを上抜け |
| `cup_handle` | 強気 | カップリムを上抜け |

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
| `fillMode` | `FillMode` | `'next-bar-open'` | 約定タイミング（下記参照） |
| `slTpMode` | `SlTpMode` | `'close-only'` | SL/TP判定方法（下記参照） |
| `direction` | `PositionDirection` | `'long'` | ポジション方向（`'long'` or `'short'`）。[ショートセリング](#ショートセリング)参照 |

#### 先読みバイアス対策

TrendCraftはバックテストにおける先読みバイアスを防ぐオプションを提供します:

**FillMode** - 約定タイミングの制御:
| モード | 説明 | 先読みバイアス |
|--------|------|----------------|
| `'next-bar-open'` | 次の足の始値で約定（デフォルト、推奨） | なし |
| `'same-bar-close'` | シグナル発生足の終値で約定（レガシー） | あり |

**SlTpMode** - ストップロス/利確の判定方法:
| モード | 説明 | 先読みバイアス |
|--------|------|----------------|
| `'close-only'` | 終値のみで判定（デフォルト、推奨） | なし |
| `'intraday'` | 高値/安値で判定（レガシー） | あり |

**先読みバイアス対策設定の例:**

```typescript
const result = runBacktest(candles, entry, exit, {
  capital: 1000000,
  stopLoss: 5,
  takeProfit: 10,
  // 推奨設定（デフォルト）
  fillMode: 'next-bar-open',
  slTpMode: 'close-only',
});

// レガシーモード（古い戦略との比較用）
const legacyResult = runBacktest(candles, entry, exit, {
  capital: 1000000,
  stopLoss: 5,
  takeProfit: 10,
  fillMode: 'same-bar-close',
  slTpMode: 'intraday',
});
```

**戻り値:** `BacktestResult`

```typescript
interface BacktestResult {
  initialCapital: number;            // 初期資金
  finalCapital: number;              // 最終資金
  totalReturn: number;               // 総リターン額
  totalReturnPercent: number;        // 総リターン率
  tradeCount: number;                // 取引回数
  winRate: number;                   // 勝率 (%)
  maxDrawdown: number;               // 最大ドローダウン (%)
  sharpeRatio: number;               // シャープレシオ（年率化）
  profitFactor: number;              // プロフィットファクター
  avgHoldingDays: number;            // 平均保有日数
  trades: Trade[];                   // 取引詳細
  settings: BacktestSettings;        // 使用した設定（再現性のため）
  drawdownPeriods: DrawdownPeriod[]; // 個別ドローダウン期間
}

interface DrawdownPeriod {
  startTime: number;         // ドローダウン開始タイムスタンプ（ピーク時点）
  peakEquity: number;        // 開始時のピーク資産額
  troughTime: number;        // 最大深度のタイムスタンプ
  troughEquity: number;      // 最大深度時の資産額
  recoveryTime?: number;     // 回復タイムスタンプ（未回復の場合undefined）
  maxDepthPercent: number;   // 最大ドローダウン深度 (%)
  durationBars: number;      // 期間（バー数）
  recoveryBars?: number;     // 底値から回復までのバー数
}

interface BacktestSettings {
  fillMode: FillMode;          // 約定タイミングモード
  slTpMode: SlTpMode;          // SL/TP判定モード
  stopLoss?: number;           // ストップロス (%)
  takeProfit?: number;         // 利確 (%)
  trailingStop?: number;       // トレーリングストップ (%)
  slippage: number;            // スリッページ (%)
  commission: number;          // 固定手数料/取引
  commissionRate: number;      // 手数料率 (%)
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

#### レンジ相場条件

```typescript
inRangeBound()       // 任意のレンジ状態
rangeForming()       // レンジ形成中
rangeConfirmed()     // レンジ確定
rangeBreakout()      // レンジからトレンドへの転換
tightRange()         // 非常にタイトなレンジ
breakoutRiskUp()     // 価格が上限付近
breakoutRiskDown()   // 価格が下限付近
rangeScoreAbove(70)  // レンジスコアが閾値以上
```

#### 高度な出来高条件

```typescript
// 出来高異常条件
volumeAnomalyCondition(threshold = 2.0)  // 出来高異常検出
volumeExtreme()                           // 極端な出来高スパイク
volumeRatioAbove(ratio)                   // 出来高比率が閾値以上

// Volume Profile条件
nearPoc(tolerance = 0.02)     // 価格がPOC付近（デフォルト2%）
inValueArea()                 // 価格がValue Area内（VAL-VAH）
breakoutVah()                 // 価格がVAHを上抜け
breakdownVal()                // 価格がVALを下抜け
priceAbovePoc()               // 価格がPOCより上
priceBelowPoc()               // 価格がPOCより下

// 出来高トレンド条件
volumeConfirmsTrend()                    // 出来高が価格トレンドを確認
volumeDivergence()                       // 出来高が価格と乖離
bullishVolumeDivergence()                // 強気の出来高ダイバージェンス
bearishVolumeDivergence()                // 弱気の出来高ダイバージェンス
volumeTrendConfidence(minConfidence)     // 信頼度が閾値以上

// CMF（チャイキンマネーフロー）条件
cmfAbove(threshold = 0, period = 20)     // CMF > 閾値（買い圧力）
cmfBelow(threshold = 0, period = 20)     // CMF < 閾値（売り圧力）

// OBV（オンバランスボリューム）条件
obvRising(period = 10)                   // N期間でOBV上昇
obvFalling(period = 10)                  // N期間でOBV下降
obvCrossUp(shortPeriod = 5, longPeriod = 20)   // OBV短期MAが長期MAを上抜け
obvCrossDown(shortPeriod = 5, longPeriod = 20) // OBV短期MAが長期MAを下抜け
```

**CMF（チャイキンマネーフロー）条件:**

CMFは、高値-安値レンジ内での終値位置に基づき、出来高で重み付けした買い/売り圧力を測定します。値の範囲は-1〜+1です。

| 関数 | 説明 | トレーディング用途 |
|------|------|-------------------|
| `cmfAbove(threshold, period)` | CMFが閾値以上 | 蓄積フェーズ、買い圧力 |
| `cmfBelow(threshold, period)` | CMFが閾値以下 | 分配フェーズ、売り圧力 |

```typescript
// 蓄積フェーズの検出
const entry = and(
  cmfAbove(0),           // 買い圧力が優勢
  priceAboveSma(50),     // 上昇トレンド
);

// 強い買い圧力（CMF > 0.1）
const strongBuy = cmfAbove(0.1, 20);
```

**OBV（オンバランスボリューム）条件:**

OBVは上昇/下降終値に応じて出来高を累積します。OBV上昇 = 買い手優勢、OBV下降 = 売り手優勢。

| 関数 | 説明 | トレーディング用途 |
|------|------|-------------------|
| `obvRising(period)` | N期間でOBVが上昇トレンド | 蓄積シグナル |
| `obvFalling(period)` | N期間でOBVが下降トレンド | 分配シグナル |
| `obvCrossUp(short, long)` | OBV短期MAが長期MAを上抜け | 強気モメンタム転換 |
| `obvCrossDown(short, long)` | OBV短期MAが長期MAを下抜け | 弱気モメンタム転換 |

```typescript
// 複数の出来高指標で蓄積を確認
const entry = and(
  cmfAbove(0),         // CMFがプラス
  obvRising(10),       // OBVが上昇トレンド
  volumeRatioAbove(1.2), // 出来高が平均以上
);

// OBVモメンタムが強気に転換
const obvBullish = obvCrossUp(5, 20);
```

---

#### マルチタイムフレーム（MTF）条件

MTF条件により、上位足の指標でトレードをフィルターできます。

```typescript
// 週足RSI条件
weeklyRsiAbove(threshold, period = 14)   // 週足RSI > 閾値
weeklyRsiBelow(threshold, period = 14)   // 週足RSI < 閾値

// 月足RSI条件
monthlyRsiAbove(threshold, period = 14)  // 月足RSI > 閾値
monthlyRsiBelow(threshold, period = 14)  // 月足RSI < 閾値

// 汎用MTF RSI
mtfRsiAbove(timeframe, threshold, period = 14)  // MTF RSI > 閾値
mtfRsiBelow(timeframe, threshold, period = 14)  // MTF RSI < 閾値

// 週足SMA条件
weeklyPriceAboveSma(period)   // 価格 > 週足SMA
weeklyPriceBelowSma(period)   // 価格 < 週足SMA

// 月足SMA条件
monthlyPriceAboveSma(period)  // 価格 > 月足SMA
monthlyPriceBelowSma(period)  // 価格 < 月足SMA

// 汎用MTF SMA
mtfPriceAboveSma(timeframe, period)  // 価格 > MTF SMA
mtfPriceBelowSma(timeframe, period)  // 価格 < MTF SMA

// 週足EMA条件
weeklyPriceAboveEma(period)   // 価格 > 週足EMA
mtfPriceAboveEma(timeframe, period)  // 価格 > MTF EMA

// トレンド条件
weeklyUptrend(smaPeriod = 20)    // 週足価格 > 週足SMA
weeklyDowntrend(smaPeriod = 20)  // 週足価格 < 週足SMA
mtfUptrend(timeframe, smaPeriod = 20)    // MTF上昇トレンド
mtfDowntrend(timeframe, smaPeriod = 20)  // MTF下降トレンド

// 強いトレンド（ADXベース）
weeklyTrendStrong(adxThreshold = 25)   // 週足ADX > 閾値
monthlyTrendStrong(adxThreshold = 25)  // 月足ADX > 閾値
mtfTrendStrong(timeframe, adxThreshold = 25)  // MTF ADX > 閾値

// カスタムMTF条件
mtfCondition(timeframe, conditionFn)  // MTFデータでのカスタム条件
```

**Fluent APIでの使用:**

```typescript
import { TrendCraft, weeklyRsiAbove, goldenCrossCondition, and } from 'trendcraft';

const result = TrendCraft.from(dailyCandles)
  .withMtf(['weekly'])  // 週足タイムフレームを有効化
  .strategy()
    .entry(and(
      weeklyRsiAbove(50),        // 週足RSI > 50
      goldenCrossCondition()     // 日足ゴールデンクロス
    ))
    .exit(deadCrossCondition())
  .backtest({ capital: 1000000 });
```

---

#### 相対強度（RS）条件

RS条件は株式のパフォーマンスをベンチマークと比較します。ベンチマークデータの設定が必要です。

```typescript
import { rsAbove, rsRising, rsRatingAbove, setBenchmark, and } from 'trendcraft';

// バックテスト前にベンチマークを設定
const entry = and(
  rsAbove(1.0),       // ベンチマークをアウトパフォーム
  rsRising(),         // RS上昇トレンド
  rsRatingAbove(80),  // 過去比較で上位20%
);

// バックテストでの使用
runBacktest(candles, entry, exit, {
  capital: 1000000,
  setup: (indicators) => {
    setBenchmark(indicators, sp500Candles);
  }
});
```

| 関数 | 説明 |
|------|------|
| `rsAbove(threshold, options)` | RS比率 > 閾値（>1.0 = アウトパフォーム） |
| `rsBelow(threshold, options)` | RS比率 < 閾値 |
| `rsRising(options)` | RS上昇トレンド |
| `rsFalling(options)` | RS下降トレンド |
| `rsNewHigh(lookback, options)` | RSがN期間高値 |
| `rsNewLow(lookback, options)` | RSがN期間安値 |
| `rsRatingAbove(rating, options)` | RS Ratingパーセンタイル > 閾値 |
| `rsRatingBelow(rating, options)` | RS Ratingパーセンタイル < 閾値 |
| `mansfieldRSAbove(threshold, options)` | Mansfield RS > 閾値 |
| `mansfieldRSBelow(threshold, options)` | Mansfield RS < 閾値 |
| `outperformanceAbove(percent, options)` | N%以上アウトパフォーム |
| `outperformanceBelow(percent, options)` | N%以下アウトパフォーム |

---

#### 価格パターン条件

チャートパターン検出をバックテスト条件として使用。

```typescript
import { patternDetected, anyBullishPattern, patternConfidenceAbove, and } from 'trendcraft';

// ダブルトップでイグジット
const exit = patternDetected('double_top');

// 高信頼度の確認済み強気パターンでエントリー
const entry = and(
  anyBullishPattern({ confirmedOnly: true }),
  patternConfidenceAbove('double_bottom', 70)
);

// 直近5バー以内のカップ・ウィズ・ハンドルでエントリー
const cupEntry = patternWithinBars('cup_handle', 5, { confirmedOnly: true });
```

| 関数 | 説明 |
|------|------|
| `patternDetected(type, options)` | 現在のバーでパターン検出 |
| `patternConfirmed(type, options)` | 確認済みパターン（ブレイクアウト発生） |
| `anyBullishPattern(options)` | 任意の強気パターン（ダブルボトム、逆H&S、カップハンドル） |
| `anyBearishPattern(options)` | 任意の弱気パターン（ダブルトップ、H&S） |
| `patternConfidenceAbove(type, min, options)` | パターン信頼度 > 閾値 |
| `anyPatternConfidenceAbove(min, options)` | 任意のパターンで信頼度 > 閾値 |
| `patternWithinBars(type, lookback, options)` | 直近Nバー以内でパターン検出 |
| `doubleTopDetected(options)` | ダブルトップパターン |
| `doubleBottomDetected(options)` | ダブルボトムパターン |
| `headShouldersDetected(options)` | ヘッドアンドショルダーパターン |
| `inverseHeadShouldersDetected(options)` | 逆ヘッドアンドショルダーパターン |
| `cupHandleDetected(options)` | カップ・ウィズ・ハンドルパターン |

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

## シグナルスコアリング

複数のテクニカルシグナルを重み付けして統合し、0-100の複合スコアを算出します。

### ScoreBuilder

スコアリング設定を構築するFluent API。

```typescript
import { ScoreBuilder, calculateScore } from 'trendcraft';

const config = ScoreBuilder.create()
  .addPOConfirmation(3.0)      // 重み: 3.0
  .addRsiOversold(30, 2.0)     // 閾値: 30, 重み: 2.0
  .addVolumeSpike(1.5, 1.5)    // 閾値: 1.5倍, 重み: 1.5
  .addMacdBullish(1.5)
  .setThresholds(70, 50, 30)   // strong, moderate, weak
  .build();
```

**ビルダーメソッド:**

| カテゴリ | メソッド | パラメータ | 説明 |
|----------|----------|------------|------|
| **モメンタム** | `addRsiOversold` | threshold?, weight?, period? | RSI売られすぎ |
| | `addRsiOverbought` | threshold?, weight?, period? | RSI買われすぎ |
| | `addMacdBullish` | weight? | MACD強気クロス |
| | `addMacdBearish` | weight? | MACD弱気クロス |
| | `addStochOversold` | threshold?, weight? | ストキャス売られすぎ |
| | `addStochBullishCross` | threshold?, weight? | ストキャス%Kが%Dをクロス |
| **トレンド** | `addPerfectOrderBullish` | weight? | パーフェクトオーダー強気 |
| | `addPOConfirmation` | weight? | PO+確認シグナル |
| | `addPullbackEntry` | maPeriod?, weight? | MAへの押し目 |
| | `addGoldenCross` | short?, long?, weight? | ゴールデンクロス |
| | `addPriceAboveEma` | period?, weight? | 価格がEMA上 |
| **出来高** | `addVolumeSpike` | threshold?, weight? | 出来高急増 |
| | `addVolumeAnomaly` | zThreshold?, weight? | 統計的異常値 |
| | `addBullishVolumeTrend` | weight? | 出来高がトレンド確認 |
| | `addCmfPositive` | threshold?, weight? | CMFプラス |
| **設定** | `setThresholds` | strong, moderate, weak | スコア閾値 |
| | `addSignal` | SignalDefinition | カスタムシグナル |
| | `addSignals` | SignalDefinition[] | 複数シグナル |

---

### スコア計算

#### `calculateScore(candles, index, config, context?)`

特定のインデックスで複合スコアを計算。

```typescript
const result = calculateScore(candles, candles.length - 1, config);

console.log(result.normalizedScore);  // 0-100
console.log(result.strength);         // 'strong' | 'moderate' | 'weak' | 'none'
console.log(result.activeSignals);    // アクティブなシグナル数
```

**戻り値:** `ScoreResult`

```typescript
interface ScoreResult {
  rawScore: number;         // 重み付けスコアの合計
  normalizedScore: number;  // 0-100正規化スコア
  maxScore: number;         // 最大可能スコア
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  activeSignals: number;    // 0より大きいシグナル数
  totalSignals: number;     // 全シグナル数
}
```

---

#### `calculateScoreBreakdown(candles, index, config, context?)`

各シグナルの貢献度の詳細を取得。

```typescript
const breakdown = calculateScoreBreakdown(candles, index, config);

for (const c of breakdown.contributions) {
  if (c.isActive) {
    console.log(`${c.displayName}: +${c.score.toFixed(1)}`);
  }
}
```

---

### スコアリングプリセット

一般的なトレーディングスタイル向けの事前設定済みスコアリング戦略。

```typescript
import { getPreset, listPresets } from 'trendcraft';

const config = getPreset('trendFollowing');
const available = listPresets();  // ['momentum', 'meanReversion', 'trendFollowing', 'balanced']
```

| プリセット | フォーカス | 閾値 (S/M/W) | 説明 |
|------------|------------|--------------|------|
| `momentum` | RSI, MACD, Stoch | 70/50/30 | モメンタム重視 |
| `meanReversion` | 売られすぎシグナル | 75/55/35 | 押し目買い戦略 |
| `trendFollowing` | PO, 出来高 | 70/50/30 | トレンドフォロー |
| `balanced` | 混合 | 70/50/30 | バランス型 |

---

### スコアリングバックテスト条件

バックテストでスコアをエントリー/イグジット条件として使用。

```typescript
import { scoreAbove, scoreBelow, runBacktest } from 'trendcraft';

const entry = scoreAbove(70, config);  // またはプリセット名: scoreAbove(70, 'trendFollowing')
const exit = scoreBelow(30, config);

const result = runBacktest(candles, entry, exit, { capital: 1000000 });
```

**条件関数:**

| 関数 | パラメータ | 説明 |
|------|------------|------|
| `scoreAbove` | threshold, config | スコア >= 閾値 |
| `scoreBelow` | threshold, config | スコア <= 閾値 |
| `scoreStrength` | 'strong'\|'moderate'\|'weak', config | 強度マッチ |
| `minActiveSignals` | count, config | 最小アクティブシグナル数 |

---

## ポジションサイジング

リスク管理ルールに基づいて最適なポジションサイズを計算。

### リスクベースサイジング

リスク額とストップ距離からポジションサイズを計算。

```typescript
import { riskBasedSize } from 'trendcraft';

const result = riskBasedSize({
  accountSize: 100000,
  entryPrice: 50,
  stopLossPrice: 48,
  riskPercent: 1,           // 口座の1%をリスク
  maxPositionPercent: 25,   // 最大25%
});

// 結果: { shares: 500, positionValue: 25000, riskAmount: 1000, ... }
```

**計算式:** `株数 = リスク額 / ストップ幅`

---

### ATRベースサイジング

ATRを使ってストップ距離を動的に設定。

```typescript
import { atrBasedSize } from 'trendcraft';

const result = atrBasedSize({
  accountSize: 100000,
  entryPrice: 50,
  atrValue: 2.5,
  atrMultiplier: 2,     // 2倍ATRでストップ
  riskPercent: 1,
});
// stopPrice: 45, shares: 200
```

---

### Kelly基準

勝率とペイオフ比率に基づく最適なベットサイジング。

```typescript
import { kellySize, calculateKellyPercent } from 'trendcraft';

const kellyPct = calculateKellyPercent(0.6, 1.5);  // 33.3%

const result = kellySize({
  accountSize: 100000,
  entryPrice: 50,
  winRate: 0.6,
  winLossRatio: 1.5,
  kellyFraction: 0.5,     // ハーフKelly
});
```

---

### 固定比率

シンプルな固定比率配分。

```typescript
import { fixedFractionalSize } from 'trendcraft';

const result = fixedFractionalSize({
  accountSize: 100000,
  entryPrice: 50,
  fractionPercent: 10,      // 1ポジションあたり10%
});
```

---

## ATRリスク管理

ATRに基づく動的なストップロスと利確レベル。

### シャンデリアエグジット

高値からATRを引いたトレーリングストップ指標。

```typescript
import { chandelierExit } from 'trendcraft';

const result = chandelierExit(candles, {
  period: 22,
  multiplier: 3.0,
});

const latest = result[result.length - 1].value;
// { longExit: 95.5, shortExit: 105.2, direction: 1, isCrossover: false }
```

---

### ATRストップ

ATRからストップと利確レベルを計算。

```typescript
import { calculateAtrStops } from 'trendcraft';

const stops = calculateAtrStops(candles, {
  atrPeriod: 14,
  stopMultiplier: 2.5,
  takeProfitMultiplier: 4.0,
});
```

**バックテスト連携:**

```typescript
const result = runBacktest(candles, entry, exit, {
  capital: 1000000,
  atrRisk: {
    atrPeriod: 14,
    atrStopMultiplier: 2.5,
    atrTakeProfitMultiplier: 4.0,
  },
});
```

---

## ボラティリティレジーム

#### `volatilityRegime(candles, options)`

ATRパーセンタイルとボリンジャーバンド幅パーセンタイルを使用して、市場のボラティリティをレジームに分類します。

```typescript
const regimes = volatilityRegime(candles);
const currentRegime = regimes[regimes.length - 1].value.regime;

if (currentRegime === 'low') {
  // レンジ相場戦略を検討
} else if (currentRegime === 'high' || currentRegime === 'extreme') {
  // ストップ幅を広げ、ポジションサイズを縮小
}
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `atrPeriod` | `number` | `14` | ATR期間 |
| `bbPeriod` | `number` | `20` | ボリンジャーバンド期間 |
| `lookbackPeriod` | `number` | `100` | パーセンタイル計算のルックバック期間 |
| `thresholds.low` | `number` | `25` | 低ボラティリティ閾値（パーセンタイル） |
| `thresholds.high` | `number` | `75` | 高ボラティリティ閾値（パーセンタイル） |
| `thresholds.extreme` | `number` | `95` | 極端なボラティリティ閾値（パーセンタイル） |

**戻り値:** `Series<VolatilityRegimeValue>`

```typescript
type VolatilityRegime = 'low' | 'normal' | 'high' | 'extreme';

interface VolatilityRegimeValue {
  regime: VolatilityRegime;           // 現在のレジーム分類
  atrPercentile: number | null;       // ATRパーセンタイル (0-100)
  bandwidthPercentile: number | null; // ボリンジャーバンド幅パーセンタイル (0-100)
  historicalVol: number | null;       // 年率換算ヒストリカルボラティリティ (%)
  atr: number | null;                 // 現在のATR値
  bandwidth: number | null;           // 現在のボリンジャーバンド幅
  confidence: number;                 // 信頼度 (0-1)
}
```

---

### ボラティリティレジーム条件

市場のボラティリティ環境でトレードをフィルタリングするための条件です。

| 条件 | 説明 |
|-----------|-------------|
| `regimeIs(regime)` | 現在のレジームが指定したレジームと一致 |
| `regimeNot(regime)` | 現在のレジームが指定したレジームと一致しない |
| `volatilityAbove(percentile)` | 平均パーセンタイル >= 閾値 |
| `volatilityBelow(percentile)` | 平均パーセンタイル <= 閾値 |
| `atrPercentileAbove(percentile)` | ATRパーセンタイル >= 閾値 |
| `atrPercentileBelow(percentile)` | ATRパーセンタイル <= 閾値 |
| `regimeConfidenceAbove(confidence)` | レジーム分類の信頼度 >= 閾値 |
| `volatilityExpanding(threshold, lookback)` | ボラティリティが直近から拡大中 |
| `volatilityContracting(threshold, lookback)` | ボラティリティが直近から縮小中 |
| `atrPercentAbove(threshold)` | ATR% >= 閾値（デフォルト: 2.3） |
| `atrPercentBelow(threshold)` | ATR% <= 閾値 |

**使用例:**

```typescript
import { regimeIs, regimeNot, atrPercentAbove, and, goldenCross } from 'trendcraft';

// 低ボラティリティ環境でのみエントリー
const entry = and(
  regimeIs('low'),
  rsiBelow(30)
);

// 極端なボラティリティを避ける
const entry = and(
  regimeNot('extreme'),
  goldenCross()
);

// トレンドフォロー用にATR%でフィルタ（ボラタイルな銘柄のみ）
const entry = and(
  atrPercentAbove(2.3),
  perfectOrderBullish()
);
```

---

## 最適化

### `gridSearch(candles, strategyFactory, paramRanges, options)`

最適な戦略パラメータのグリッドサーチ。

```typescript
import { gridSearch, param, constraint, goldenCross, deadCross } from 'trendcraft';

const result = gridSearch(
  candles,
  (params) => ({
    entry: goldenCross(params.short, params.long),
    exit: deadCross(params.short, params.long),
  }),
  [
    param('short', [5, 10, 15, 20]),
    param('long', [25, 50, 75]),
  ],
  {
    metric: 'sharpeRatio',
    constraints: [
      constraint('winRate', '>=', 40),
      constraint('maxDrawdown', '<=', 30),
    ],
    topN: 10,
  }
);

console.log('最適パラメータ:', result.results[0].parameters);
console.log('シャープレシオ:', result.results[0].metrics.sharpeRatio);
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `metric` | `OptimizationMetric` | `'sharpeRatio'` | 最適化対象の指標 |
| `constraints` | `OptimizationConstraint[]` | `[]` | 結果をフィルタする制約条件 |
| `topN` | `number` | `10` | 返す上位結果の数 |
| `capital` | `number` | `1000000` | バックテスト用の初期資金 |

**指標:** `'sharpeRatio' | 'calmarRatio' | 'recoveryFactor' | 'totalReturn' | 'winRate' | 'profitFactor'`

**戻り値:** `GridSearchResult`

```typescript
interface GridSearchResult {
  results: OptimizationResultEntry[];
  totalCombinations: number;
  passedConstraints: number;
  bestParameters: Record<string, number>;
  bestMetrics: Record<string, number>;
}
```

---

### `walkForwardAnalysis(candles, strategyFactory, paramRanges, options)`

アウトオブサンプル検証のためのウォークフォワード分析。

```typescript
import { walkForwardAnalysis, param } from 'trendcraft';

const result = walkForwardAnalysis(
  candles,
  strategyFactory,
  paramRanges,
  {
    inSampleRatio: 0.7,    // 70%をイン・サンプル、30%をアウト・オブ・サンプル
    periods: 5,            // 5つのウォークフォワード期間
    metric: 'sharpeRatio',
  }
);

console.log('アウトオブサンプル結果:', result.outOfSampleResults);
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `inSampleRatio` | `number` | `0.7` | イン・サンプル最適化に使用するデータの割合 |
| `periods` | `number` | `5` | ウォークフォワード期間の数 |
| `metric` | `OptimizationMetric` | `'sharpeRatio'` | 最適化する指標 |

---

### `combinationSearch(candles, entryPool, exitPool, options)`

最適なエントリー/イグジット条件の組み合わせを探索。

```typescript
import {
  combinationSearch,
  createEntryConditionPool,
  createExitConditionPool
} from 'trendcraft';

const entryPool = createEntryConditionPool();  // デフォルトのエントリー条件
const exitPool = createExitConditionPool();    // デフォルトのイグジット条件

const result = combinationSearch(candles, entryPool, exitPool, {
  metric: 'sharpeRatio',
  topN: 20,
});

result.results.forEach((r) => {
  console.log(`エントリー: ${r.entryName}, イグジット: ${r.exitName}`);
  console.log(`シャープ: ${r.metrics.sharpeRatio}`);
});
```

---

### 最適化メトリクス

```typescript
import {
  calculateSharpeRatio,
  calculateCalmarRatio,
  calculateRecoveryFactor,
  annualizeReturn,
  calculateAllMetrics
} from 'trendcraft';

// 個別メトリクスを計算
const sharpe = calculateSharpeRatio(returns, riskFreeRate);
const calmar = calculateCalmarRatio(totalReturn, maxDrawdown, years);
const recovery = calculateRecoveryFactor(totalReturn, maxDrawdown);

// 全メトリクスを一度に計算
const metrics = calculateAllMetrics(backtestResult);
```

---

### モンテカルロシミュレーション

#### `runMonteCarloSimulation(result, options)`

バックテスト結果の統計的有意性を検証。トレード順序をシャッフルして「運が良かっただけか」を判定します。

```typescript
import { runMonteCarloSimulation, formatMonteCarloResult } from 'trendcraft';

const mcResult = runMonteCarloSimulation(backtestResult, {
  simulations: 1000,
  seed: 42,
  confidenceLevel: 0.95,
});

console.log(formatMonteCarloResult(mcResult));
// => p=0.023, 有意（元のSharpeはランダムより優れている）

// 結果をチェック
if (mcResult.assessment.isSignificant) {
  console.log('戦略は統計的に有意です');
} else {
  console.log('結果は偶然の可能性があります:', mcResult.assessment.reason);
}
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `simulations` | `number` | `1000` | シャッフルシミュレーション回数 |
| `seed` | `number` | `undefined` | 再現性のためのシード値 |
| `confidenceLevel` | `number` | `0.95` | 信頼区間レベル（0.90, 0.95, 0.99） |
| `progressCallback` | `function` | `undefined` | 進捗コールバック |

**戻り値:** `MonteCarloResult`

```typescript
interface MonteCarloResult {
  originalResult: {
    sharpe: number;
    maxDrawdown: number;
    totalReturnPercent: number;
    profitFactor: number;
  };
  statistics: {
    sharpe: MetricStatistics;
    maxDrawdown: MetricStatistics;
    totalReturnPercent: MetricStatistics;
    profitFactor: MetricStatistics;
  };
  pValue: {
    sharpe: number;    // Sharpeがランダムで達成される確率
    returns: number;   // リターンがランダムで達成される確率
  };
  confidenceInterval: {
    sharpe: { lower: number; upper: number };
    returns: { lower: number; upper: number };
    maxDrawdown: { lower: number; upper: number };
  };
  assessment: {
    isSignificant: boolean;  // p < 0.05 なら true
    reason: string;
    confidenceLevel: number;
  };
  simulationCount: number;
}

interface MetricStatistics {
  mean: number;
  median: number;
  stdDev: number;
  percentile5: number;
  percentile25: number;
  percentile75: number;
  percentile95: number;
  min: number;
  max: number;
}
```

**ヘルパー関数:**

```typescript
// 結果のフォーマット
const formatted = formatMonteCarloResult(mcResult);

// サマリー取得
const summary = summarizeMonteCarloResult(mcResult);
// => { isSignificant, pValueSharpe, pValueReturns, expectedSharpe, sharpe95CI }

// 統計値の計算（直接使用可能）
const stats = calculateStatistics([1, 2, 3, 4, 5]);
// => { mean: 3, median: 3, stdDev: 1.41, ... }
```

---

### Anchored Walk-Forward分析 (AWF)

#### `anchoredWalkForwardAnalysis(candles, entryConditions, exitConditions, options)`

固定起点から訓練期間を拡張するウォークフォワード分析。長期的な戦略の堅牢性を検証します。

```typescript
import {
  anchoredWalkForwardAnalysis,
  formatAWFResult,
  createEntryConditionPool,
  createExitConditionPool
} from 'trendcraft';

const entryPool = createEntryConditionPool();
const exitPool = createExitConditionPool();

const awfResult = anchoredWalkForwardAnalysis(
  candles,
  entryPool,
  exitPool,
  {
    anchorDate: new Date('2015-01-01').getTime(),
    initialTrainSize: 500,   // 約2年
    expansionStep: 252,      // 1年ずつ拡張
    testSize: 252,           // 1年テスト
    metric: 'sharpe',
  }
);

console.log(formatAWFResult(awfResult));
// => Stability: 72%, Recommended: GC + Stoch↑ / VolDiv
```

**期間分割の例:**
```
Period 1: Train 2015-01-01〜2017-12-31 → Test 2018
Period 2: Train 2015-01-01〜2018-12-31 → Test 2019
Period 3: Train 2015-01-01〜2019-12-31 → Test 2020
...
```

**Rolling WFとの違い:**
| 項目 | Rolling WF | Anchored WF |
|------|------------|-------------|
| 訓練開始 | スライド | **固定** |
| 訓練終了 | スライド | **拡張** |
| 用途 | 短期パターン | **長期トレンドの堅牢性** |

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `anchorDate` | `number` | 必須 | 固定起点（epoch ms） |
| `initialTrainSize` | `number` | `252` | 初期訓練期間（バー数） |
| `expansionStep` | `number` | `252` | 拡張ステップ（バー数） |
| `testSize` | `number` | `252` | テスト期間（バー数） |
| `metric` | `OptimizationMetric` | `'sharpe'` | 最適化する指標 |
| `constraints` | `OptimizationConstraint[]` | `[]` | 制約条件 |

**戻り値:** `AWFResult`

```typescript
interface AWFResult {
  periods: AWFPeriod[];
  aggregateMetrics: {
    avgInSampleSharpe: number;
    avgOutOfSampleSharpe: number;
    avgInSampleReturn: number;
    avgOutOfSampleReturn: number;
    stabilityRatio: number;      // OOS / IS Sharpe 比率
    consistency: number;         // プラスリターン期間の割合
  };
  stabilityAnalysis: {
    entryConditionFrequency: Record<string, number>;
    exitConditionFrequency: Record<string, number>;
    stableEntryConditions: string[];  // 50%以上で選択
    stableExitConditions: string[];
    consistencyScore: number;         // 0-100
  };
  recommendation: {
    useOptimized: boolean;
    entryConditions: string[];
    exitConditions: string[];
    reason: string;
  };
}

interface AWFPeriod {
  periodNumber: number;
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
  bestEntryConditions: string[];
  bestExitConditions: string[];
  inSampleMetrics: Record<OptimizationMetric, number>;
  outOfSampleMetrics: Record<OptimizationMetric, number>;
  testBacktest: BacktestResult;
}
```

**ヘルパー関数:**

```typescript
// 結果のフォーマット
const formatted = formatAWFResult(awfResult);

// サマリー取得
const summary = summarizeAWFResult(awfResult);

// 期間数の事前計算
const count = calculateAWFPeriodCount(candles, {
  anchorDate: new Date('2015-01-01').getTime(),
  initialTrainSize: 500,
  expansionStep: 252,
  testSize: 252,
});

// 期間境界の生成
const boundaries = generateAWFBoundaries(candles, options);

// エクイティカーブの取得
const equity = getAWFEquityCurve(awfResult, 1000000);
```

---

## 分割エントリー

### `runBacktestScaled(candles, entry, exit, options)`

分割エントリー戦略でのバックテスト。一度に全ポジションを建てる代わりに、資金を複数のトランシェに分割します。

```typescript
import { runBacktestScaled, goldenCross, deadCross } from 'trendcraft';

const result = runBacktestScaled(candles, goldenCross(), deadCross(), {
  capital: 1000000,
  scaledEntry: {
    tranches: 3,
    strategy: 'pyramid',      // 50%, 33%, 17%
    intervalType: 'price',
    priceInterval: -2,        // 2%下落でトランシェ追加
  },
});
```

**ScaledEntryConfig:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `tranches` | `number` | 必須 | エントリートランシェ数 (2-10) |
| `strategy` | `'equal' \| 'pyramid' \| 'reverse-pyramid'` | `'equal'` | 配分戦略 |
| `intervalType` | `'signal' \| 'price'` | `'signal'` | 追加エントリーのトリガー方法 |
| `priceInterval` | `number` | `-2` | 次のトランシェの価格変動 %（負の値 = 下落） |

**戦略:**
| 戦略 | 説明 | 例（3トランシェ） |
|----------|-------------|---------------------|
| `equal` | 各トランシェ均等配分 | 33%, 33%, 33% |
| `pyramid` | 早いトランシェに大きい配分 | 50%, 33%, 17% |
| `reverse-pyramid` | 後のトランシェに大きい配分 | 17%, 33%, 50% |

**インターバルタイプ:**
| タイプ | トリガー |
|------|---------|
| `signal` | 各エントリーシグナルでトランシェ追加 |
| `price` | 最初のエントリーから `priceInterval` % 価格変動でトランシェ追加 |

---

## ストリーミング

リアルタイムの市場データを処理するためのレイヤード・パイプライン基盤です。すべてのコンポーネントは**ステートフル**、**シリアライズ可能**（`getState()`）、**復元可能**（`fromState` パラメータ）です。ほとんどのオブジェクトは `next()` で状態を進め、`peek()` で副作用なしにプレビューできます。

### アーキテクチャ

```
Layer 1 — キャンドル集約
  トレードティック  →  createCandleAggregator  →  NormalizedCandle
  キャンドル       →  createCandleResampler   →  上位時間足キャンドル

Layer 2 — シグナル検出
  CrossOver / CrossUnder / Threshold / Squeeze / Divergence

Layer 3 — 条件
  and() / or() / not() コンビネータ + プリセット条件 (rsiBelow, priceAbove 等)

Layer 4 — パイプライン & MTF
  createPipeline     →  インジケーター + 条件 → エントリー/エグジットシグナル
  createStreamingMtf →  マルチタイムフレーム・インジケータースナップショット

Layer 5 — セッション & ガード
  createTradingSession  →  ティック→シグナル（アグリゲーター + パイプライン）
  createGuardedSession  →  + リスクガード（サーキットブレーカー）+ タイムガード

Layer 6 — ポジション管理
  createPositionTracker →  SL / TP / トレーリングストップ / P&L
  createManagedSession  →  フルE2E: ティック → シグナル → ポジション → P&L
```

---

### Layer 1: キャンドル集約

#### `createCandleAggregator(options, fromState?)`

トレードティックのストリームを、固定時間間隔でグループ化してOHLCVキャンドルに変換します。

```typescript
import { createCandleAggregator } from "trendcraft/streaming";

const agg = createCandleAggregator({ intervalMs: 60_000 }); // 1分足

for (const tick of tickStream) {
  const candle = agg.addTrade(tick);
  if (candle) {
    console.log("完成したキャンドル:", candle);
  }
}

// セッション終了時に最後の部分キャンドルをフラッシュ
const last = agg.flush();
```

| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `intervalMs` | `number` | — (必須) | キャンドルの間隔（ミリ秒、例: `60000` = 1分足） |

**`Trade` 型:**

| フィールド | 型 | 説明 |
|-----------|------|-------------|
| `time` | `number` | エポックミリ秒タイムスタンプ |
| `price` | `number` | 約定価格 |
| `volume` | `number` | 取引量（株数/コントラクト/ユニット） |
| `side` | `'buy' \| 'sell'` | 取引サイド（オプション、オーダーフロー分析用） |

**メソッド:**

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `addTrade(trade)` | `NormalizedCandle \| null` | トレードを処理。期間が切り替わると完成したキャンドルを返す |
| `getCurrentCandle()` | `NormalizedCandle \| null` | 作成中の（未完成の）キャンドルを取得 |
| `flush()` | `NormalizedCandle \| null` | 現在のキャンドルを強制クローズ |
| `getState()` | `CandleAggregatorState` | 内部状態をシリアライズ |

---

#### `createCandleResampler(options, fromState?)`

下位時間足のキャンドルを上位時間足にインクリメンタルにリサンプリングします（例: 1分足 → 5分足）。

```typescript
import { createCandleResampler } from "trendcraft/streaming";

const resampler = createCandleResampler({ targetIntervalMs: 300_000 }); // 5分足

for (const candle1m of stream) {
  const candle5m = resampler.addCandle(candle1m);
  if (candle5m) {
    console.log("5分足キャンドル:", candle5m);
  }
}
```

| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `targetIntervalMs` | `number` | — (必須) | ターゲットの上位時間足間隔（ミリ秒） |

**メソッド:**

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `addCandle(candle)` | `NormalizedCandle \| null` | キャンドルを処理。期間が切り替わると完成した上位TFキャンドルを返す |
| `getCurrentCandle()` | `NormalizedCandle \| null` | 作成中の上位TFキャンドルを取得 |
| `flush()` | `NormalizedCandle \| null` | 現在の上位TFキャンドルを強制クローズ |
| `getState()` | `CandleResamplerState` | 内部状態をシリアライズ |

---

### Layer 2: シグナル検出

1データポイントずつ処理するインクリメンタルなシグナル検出器です。各検出器は `next()` / `peek()` / `getState()` パターンに従います。

#### `createCrossOverDetector(fromState?)`

valueA が valueB を下から上に交差したことを検出します。

```typescript
import { createCrossOverDetector } from "trendcraft/streaming";

const crossOver = createCrossOverDetector();
crossOver.next(10, 20); // false（初回呼び出し、前の値なし）
crossOver.next(21, 20); // true （クロスオーバー発生）
crossOver.next(22, 20); // false（既に上にいる、新しいクロスなし）
```

**メソッド:**

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `next(valueA, valueB)` | `boolean` | 状態を進めてクロスオーバーが発生したか返す |
| `peek(valueA, valueB)` | `boolean` | 状態を変えずにプレビュー |
| `getState()` | `CrossDetectorState` | 内部状態をシリアライズ |

---

#### `createCrossUnderDetector(fromState?)`

valueA が valueB を上から下に交差したことを検出します。

```typescript
import { createCrossUnderDetector } from "trendcraft/streaming";

const crossUnder = createCrossUnderDetector();
crossUnder.next(20, 10); // false（初回呼び出し）
crossUnder.next(9, 10);  // true （クロスアンダー発生）
```

メソッドは `createCrossOverDetector` と同じです。

---

#### `createThresholdDetector(threshold, fromState?)`

値が固定の閾値を上回ったり下回ったりしたことを検出します。

```typescript
import { createThresholdDetector } from "trendcraft/streaming";

const detector = createThresholdDetector(70);
detector.next(65); // { crossAbove: false, crossBelow: false }
detector.next(72); // { crossAbove: true, crossBelow: false }
detector.next(68); // { crossAbove: false, crossBelow: true }
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `threshold` | `number` | クロスを検出する閾値 |

**メソッド:**

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `next(value)` | `{ crossAbove: boolean; crossBelow: boolean }` | 状態を進めてクロスイベントを返す |
| `peek(value)` | `{ crossAbove: boolean; crossBelow: boolean }` | 状態を変えずにプレビュー |
| `getState()` | `ThresholdDetectorState` | 内部状態をシリアライズ |

---

#### `createSqueezeDetector(options?, fromState?)`

ボリンジャーバンドのスクイーズ状態（低ボラティリティ）とその解放を検出します。

```typescript
import { createSqueezeDetector } from "trendcraft/streaming";

const squeeze = createSqueezeDetector({ bandwidthThreshold: 0.05 });
squeeze.next(0.08); // { squeezeStart: false, squeezeEnd: false, inSqueeze: false }
squeeze.next(0.04); // { squeezeStart: true, squeezeEnd: false, inSqueeze: true }
squeeze.next(0.06); // { squeezeStart: false, squeezeEnd: true, inSqueeze: false }
```

| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `bandwidthThreshold` | `number` | `0.1` | スクイーズがアクティブになるバンド幅の閾値 |

**メソッド:**

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `next(bandwidth)` | `{ squeezeStart, squeezeEnd, inSqueeze }` | 状態を進めてスクイーズイベントを返す |
| `peek(bandwidth)` | `{ squeezeStart, squeezeEnd, inSqueeze }` | 状態を変えずにプレビュー |
| `getState()` | `SqueezeDetectorState` | 内部状態をシリアライズ |

---

#### `createDivergenceDetector(options?, fromState?)`

価格とインジケーター間のブリッシュ/ベアリッシュ・ダイバージェンスを検出します。

```typescript
import { createDivergenceDetector } from "trendcraft/streaming";

const divergence = createDivergenceDetector({ lookback: 14 });
for (const candle of stream) {
  const rsi = rsiIndicator.next(candle).value;
  const { bullish, bearish } = divergence.next(candle.close, rsi);
  if (bullish) console.log("ブリッシュ・ダイバージェンス検出");
}
```

| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `lookback` | `number` | `14` | ダイバージェンス検出のルックバック期間 |

**メソッド:**

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `next(price, indicatorValue)` | `{ bullish: boolean; bearish: boolean }` | 状態を進めてダイバージェンスイベントを返す |
| `peek(price, indicatorValue)` | `{ bullish: boolean; bearish: boolean }` | 状態を変えずにプレビュー |
| `getState()` | `DivergenceDetectorState` | 内部状態をシリアライズ |

---

### Layer 3: 条件

コンビネータ（`and`、`or`、`not`）とプリセット条件を備えたストリーミング条件システムです。`IndicatorSnapshot`（インジケーター値のキー・バリューマップ）と `NormalizedCandle` を受け取ります。

#### `and(...conditions)`

AND論理で条件を組み合わせます（すべてtrueである必要があります）。

```typescript
import { and, rsiBelow, smaGoldenCross } from "trendcraft/streaming";

const entry = and(rsiBelow(30), smaGoldenCross());
```

---

#### `or(...conditions)`

OR論理で条件を組み合わせます（いずれかがtrueであればよい）。

```typescript
import { or, rsiAbove, smaDeadCross } from "trendcraft/streaming";

const exit = or(rsiAbove(70), smaDeadCross());
```

---

#### `not(condition)`

条件を否定します。

```typescript
import { not, rsiAbove } from "trendcraft/streaming";

const notOverbought = not(rsiAbove(70));
```

---

#### `evaluateStreamingCondition(condition, snapshot, candle)`

ストリーミング条件をスナップショットとキャンドルに対して評価します。

```typescript
import { evaluateStreamingCondition } from "trendcraft/streaming";

const isEntry = evaluateStreamingCondition(entryCondition, snapshot, candle);
```

---

#### プリセット条件

| 関数 | 説明 | デフォルトキー |
|----------|-------------|-------------|
| `rsiBelow(threshold, key?)` | RSIが閾値以下 | `"rsi"` |
| `rsiAbove(threshold, key?)` | RSIが閾値以上 | `"rsi"` |
| `smaGoldenCross(key?)` | 短期SMAが長期SMAを上抜け | `"goldenCross"` |
| `smaDeadCross(key?)` | 短期SMAが長期SMAを下抜け | `"deadCross"` |
| `macdPositive(key?)` | MACDヒストグラムがプラス | `"macd"` |
| `macdNegative(key?)` | MACDヒストグラムがマイナス | `"macd"` |
| `priceAbove(indicatorKey)` | 価格（終値）がインジケーター値より上 | — |
| `priceBelow(indicatorKey)` | 価格（終値）がインジケーター値より下 | — |
| `indicatorAbove(key, threshold)` | インジケーター値が閾値より上 | — |
| `indicatorBelow(key, threshold)` | インジケーター値が閾値より下 | — |

プレーンな関数を条件として渡すこともできます:

```typescript
const customCondition = (snapshot, candle) => {
  return candle.close > 100 && snapshot.rsi < 50;
};
```

---

### Layer 4: パイプライン & MTF

#### `createPipeline(options, fromState?)`

インクリメンタルなインジケーターとストリーミング条件を組み合わせてシグナル評価パイプラインを構築します。キャンドル1本あたりO(1)のコストで処理します。

```typescript
import { createPipeline, rsiBelow, rsiAbove } from "trendcraft/streaming";
import { createRsi, createSma } from "trendcraft/incremental";

const pipeline = createPipeline({
  indicators: [
    { name: "rsi", create: () => createRsi({ period: 14 }) },
    { name: "sma20", create: () => createSma({ period: 20 }) },
  ],
  entry: rsiBelow(30),
  exit: rsiAbove(70),
  signals: [
    { name: "oversold", condition: rsiBelow(20) },
  ],
});

for (const candle of stream) {
  const result = pipeline.next(candle);
  if (result.entrySignal) console.log("買い", result.snapshot);
}
```

| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `indicators` | `PipelineIndicatorConfig[]` | — (必須) | インジケーター定義（`name` + `create` ファクトリ） |
| `entry` | `StreamingCondition` | — | エントリー条件 |
| `exit` | `StreamingCondition` | — | エグジット条件 |
| `signals` | `{ name, condition }[]` | — | 名前付きシグナル検出器 |

**`PipelineResult` の戻り値:**

| フィールド | 型 | 説明 |
|-----------|------|-------------|
| `snapshot` | `IndicatorSnapshot` | 現在のインジケーター値のキー・バリューマップ |
| `entrySignal` | `boolean` | エントリー条件が満たされたか |
| `exitSignal` | `boolean` | エグジット条件が満たされたか |
| `signals` | `string[]` | トリガーされたシグナル検出器の名前 |

---

#### `createStreamingMtf(options, fromState?)`

ベース時間足のキャンドルストリームを複数の上位時間足にリサンプリングし、各時間足でインジケーターを実行するマルチタイムフレームコンテキストです。

```typescript
import { createStreamingMtf } from "trendcraft/streaming";
import { createSma, createRsi } from "trendcraft/incremental";

const mtf = createStreamingMtf({
  timeframes: [
    {
      intervalMs: 300_000, // 5分足
      indicators: [
        { name: "sma20", create: () => createSma({ period: 20 }) },
      ],
    },
    {
      intervalMs: 900_000, // 15分足
      indicators: [
        { name: "rsi14", create: () => createRsi({ period: 14 }) },
      ],
    },
  ],
});

// 1分足キャンドルを投入
for (const candle of stream) {
  const snapshot = mtf.next(candle);
  console.log(snapshot["5m"].sma20, snapshot["15m"].rsi14);
}
```

| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `timeframes` | `StreamingMtfTimeframeConfig[]` | — (必須) | 上位時間足の定義 |

各 `StreamingMtfTimeframeConfig`:

| フィールド | 型 | 説明 |
|-----------|------|-------------|
| `intervalMs` | `number` | 時間足の間隔（ミリ秒） |
| `indicators` | `PipelineIndicatorConfig[]` | この時間足のインジケーター定義 |

**`MtfSnapshot` の戻り値:** 自動生成されたタイムフレームラベル（例: `"5m"`、`"15m"`、`"1h"`）をキーとするオブジェクト。各値は `IndicatorSnapshot` です。

---

### Layer 5: セッション & ガード

#### `createTradingSession(options, fromState?)`

エンドツーエンドのパイプライン: ティック → キャンドル → インジケーター → シグナル → イベント。`CandleAggregator` と `StreamingPipeline` を単一のエントリーポイントに統合します。

```typescript
import { createTradingSession, rsiBelow, rsiAbove } from "trendcraft/streaming";
import { createRsi } from "trendcraft/incremental";

const session = createTradingSession({
  intervalMs: 60_000,
  pipeline: {
    indicators: [
      { name: "rsi", create: () => createRsi({ period: 14 }) },
    ],
    entry: rsiBelow(30),
    exit: rsiAbove(70),
  },
  warmUp: historicalCandles, // オプション: インジケーターのウォームアップ
});

ws.on("trade", (data) => {
  const events = session.onTrade({
    time: data.timestamp,
    price: data.price,
    volume: data.quantity,
  });
  for (const event of events) {
    if (event.type === "entry") placeOrder(event);
  }
});

// セッション終了
const closeEvents = session.close();
```

| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `intervalMs` | `number` | — (必須) | キャンドルの間隔（ミリ秒） |
| `pipeline` | `PipelineOptions` | — (必須) | パイプライン設定（インジケーター + 条件） |
| `emitPartial` | `boolean` | `false` | 各トレードで部分的な（未完成の）キャンドルイベントを発行 |
| `warmUp` | `NormalizedCandle[]` | — | インジケーターウォームアップ用のヒストリカルキャンドル |

**`SessionEvent` タイプ:**

| タイプ | 説明 | 主要フィールド |
|------|-------------|------------|
| `candle` | キャンドルが完成した | `candle` |
| `signal` | 名前付きシグナルがトリガーされた | `name`, `candle` |
| `entry` | エントリー条件が満たされた | `snapshot`, `candle` |
| `exit` | エグジット条件が満たされた | `snapshot`, `candle` |
| `partial` | 部分キャンドル更新（`emitPartial` 有効時） | `candle`, `snapshot` |
| `blocked` | ガードによりエントリーがブロックされた | `reason`, `candle` |
| `force-close` | タイムガードによる強制決済 | `reason`, `candle`, `snapshot` |

---

#### `createRiskGuard(options, fromState?)`

日次損失制限、取引回数制限、連続負け後のクールダウンを適用するサーキットブレーカーです。

```typescript
import { createRiskGuard } from "trendcraft/streaming";

const guard = createRiskGuard({
  maxDailyLoss: -50000,
  maxDailyTrades: 20,
  maxConsecutiveLosses: 3,
  cooldownMs: 30 * 60_000,
});

const { allowed, reason } = guard.check(Date.now());
if (!allowed) console.log("ブロック:", reason);

// 取引結果を報告
guard.reportTrade(-200, Date.now());
```

| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `maxDailyLoss` | `number` | — | 日次最大損失額（例: `-50000`）。`dailyPnl <= この値` で取引ブロック |
| `maxDailyTrades` | `number` | — | 1日あたりの最大取引回数 |
| `maxConsecutiveLosses` | `number` | — | 連続負けの最大回数 |
| `cooldownMs` | `number` | — | 連続負け制限後のクールダウン期間（ミリ秒） |
| `resetTimeOffsetMs` | `number` | `0` | UTC深夜からの日次リセット時刻オフセット（ミリ秒） |

**メソッド:**

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `check(time)` | `{ allowed, reason? }` | 現在取引が許可されているか確認 |
| `reportTrade(pnl, time)` | `void` | 完了した取引結果を報告 |
| `reset()` | `void` | すべてのカウンターをリセット |
| `getState()` | `RiskGuardState` | 内部状態をシリアライズ |

---

#### `createTimeGuard(options, fromState?)`

取引時間枠、強制決済タイミング、ブラックアウト期間を管理します。

```typescript
import { createTimeGuard } from "trendcraft/streaming";

const guard = createTimeGuard({
  tradingWindows: [
    { startMs: 9 * 3600_000, endMs: 11.5 * 3600_000 },   // 9:00-11:30
    { startMs: 12.5 * 3600_000, endMs: 15 * 3600_000 },   // 12:30-15:00
  ],
  timezoneOffsetMs: 9 * 3600_000, // JST
  forceCloseBeforeEndMs: 5 * 60_000,
});

const result = guard.check(Date.now());
if (!result.allowed) console.log("取引時間外:", result.reason);
if (result.shouldForceClose) closeAllPositions();

// ブラックアウト期間を動的に追加
guard.addBlackout({
  startTime: Date.parse("2024-01-31T19:00:00Z"),
  endTime: Date.parse("2024-01-31T19:30:00Z"),
  reason: "FOMC発表",
});
```

| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `tradingWindows` | `TradingWindow[]` | — (必須) | 取引時間枠（`{ startMs, endMs }` ローカル深夜からのオフセット） |
| `forceCloseBeforeEndMs` | `number` | `0` | 各ウィンドウ終了のNミリ秒前にポジションを強制決済 |
| `timezoneOffsetMs` | `number` | `0` | UTCからのタイムゾーンオフセット（ミリ秒、例: JST = `9 * 3600_000`） |
| `blackoutPeriods` | `BlackoutPeriod[]` | `[]` | 絶対ブラックアウト期間（例: 経済指標発表） |

**メソッド:**

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `check(time)` | `{ allowed, shouldForceClose, reason? }` | 指定時刻で取引が許可されているか確認 |
| `addBlackout(period)` | `void` | ブラックアウト期間を動的に追加 |
| `getState()` | `TimeGuardState` | 内部状態をシリアライズ |

---

#### `createGuardedSession(sessionOptions, guardOptions, fromState?)`

`TradingSession` をリスクガードとタイムガードでラップします。エントリーシグナルはガードによるチェック後に発行され、取引時間枠の終了が近づくと強制決済イベントが挿入されます。

```typescript
import { createGuardedSession, rsiBelow, rsiAbove } from "trendcraft/streaming";
import { createRsi } from "trendcraft/incremental";

const session = createGuardedSession(
  {
    intervalMs: 60_000,
    pipeline: {
      indicators: [
        { name: "rsi", create: () => createRsi({ period: 14 }) },
      ],
      entry: rsiBelow(30),
      exit: rsiAbove(70),
    },
  },
  {
    riskGuard: { maxDailyLoss: -50000, maxDailyTrades: 20 },
    timeGuard: {
      tradingWindows: [{ startMs: 9 * 3600_000, endMs: 15 * 3600_000 }],
      timezoneOffsetMs: 9 * 3600_000,
      forceCloseBeforeEndMs: 5 * 60_000,
    },
  },
);

const events = session.onTrade({ time: Date.now(), price: 100, volume: 10 });
for (const e of events) {
  if (e.type === "blocked") console.log("ブロック:", e.reason);
  if (e.type === "force-close") closeAllPositions();
}

// リスク追跡のために取引結果を報告
session.riskGuard?.reportTrade(-200, Date.now());
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sessionOptions` | `SessionOptions` | 標準セッション設定 |
| `guardOptions` | `GuardedSessionOptions` | ガード設定 |
| `guardOptions.riskGuard` | `RiskGuardOptions` | リスクガード設定（省略で無効化） |
| `guardOptions.timeGuard` | `TimeGuardOptions` | タイムガード設定（省略で無効化） |

**返されるセッションの追加プロパティ:**

| プロパティ | 型 | 説明 |
|----------|------|-------------|
| `riskGuard` | `RiskGuard \| null` | RiskGuardインスタンス（未設定時はnull） |
| `timeGuard` | `TimeGuard \| null` | TimeGuardインスタンス（未設定時はnull） |

---

### Layer 6: ポジション管理

#### `createPositionTracker(options, fromState?)`

SL/TP/トレーリングストップ検出とP&L計算を備えたステートフルなポジション・アカウント管理です。

```typescript
import { createPositionTracker } from "trendcraft/streaming";

const tracker = createPositionTracker({
  capital: 1_000_000,
  stopLoss: 2,
  takeProfit: 6,
  trailingStop: 3,
  commissionRate: 0.1,
  slippage: 0.05,
});

// ポジションを建てる
const pos = tracker.openPosition(100, 50, Date.now());

// 各キャンドルでSL/TP/トレーリングをチェック
const { triggered } = tracker.updatePrice(candle);
if (triggered) {
  console.log(`${triggered.reason} トリガー @ ${triggered.price}`);
}

// 手動決済
const { trade } = tracker.closePosition(105, Date.now(), "exit-signal");
console.log("P&L:", trade.return);
```

| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `capital` | `number` | — (必須) | 初期資金 |
| `stopLoss` | `number` | `0` | ストップロス（%、例: `2` = -2%で決済） |
| `takeProfit` | `number` | `0` | テイクプロフィット（%、例: `6` = +6%で決済） |
| `trailingStop` | `number` | `0` | トレーリングストップ（%、例: `3` = ピークから3%下落で決済） |
| `commission` | `number` | `0` | 1取引あたりの固定手数料 |
| `commissionRate` | `number` | `0` | 手数料率（%、例: `0.1` = 0.1%） |
| `taxRate` | `number` | `0` | 利益に対する税率（%） |
| `slippage` | `number` | `0` | スリッページ（%） |
| `maxTradeHistory` | `number` | `1000` | メモリに保持する最大取引履歴数 |

**メソッド:**

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `openPosition(price, shares, time, opts?)` | `ManagedPosition` | 新しいポジションを建てる（`opts` でSL/TPを個別指定可） |
| `updatePrice(candle)` | `{ position, triggered }` | 価格を更新しSL/TP/トレーリングのトリガーをチェック |
| `closePosition(price, time, reason)` | `{ trade, fill }` | 現在のポジションを決済 |
| `getPosition()` | `ManagedPosition \| null` | 現在のオープンポジションを取得 |
| `getAccount()` | `AccountState` | 現在のアカウント状態を取得 |
| `getTrades()` | `Trade[]` | すべての決済済み取引レコードを取得 |
| `updateStopLoss(price)` | `void` | 現在のポジションのストップロス価格を更新 |
| `updateTakeProfit(price)` | `void` | 現在のポジションのテイクプロフィット価格を更新 |
| `getState()` | `PositionTrackerState` | 内部状態をシリアライズ |

---

#### `createManagedSession(sessionOptions, guardOptions, positionOptions, fromState?)`

フルE2Eのマネージドトレーディングセッション: ティック → キャンドル → インジケーター → シグナル → ポジション → P&L。`GuardedSession` に自動ポジション管理（サイジング、SL/TP/トレーリング、RiskGuardへの自動レポート）を統合します。

```typescript
import { createManagedSession, rsiBelow, rsiAbove } from "trendcraft/streaming";
import { createRsi, createAtr } from "trendcraft/incremental";

const session = createManagedSession(
  {
    intervalMs: 60_000,
    pipeline: {
      indicators: [
        { name: "rsi", create: () => createRsi({ period: 14 }) },
        { name: "atr14", create: () => createAtr({ period: 14 }) },
      ],
      entry: rsiBelow(30),
      exit: rsiAbove(70),
    },
  },
  {
    riskGuard: { maxDailyLoss: -50000, maxDailyTrades: 20 },
    timeGuard: {
      tradingWindows: [{ startMs: 9 * 3600_000, endMs: 15 * 3600_000 }],
      timezoneOffsetMs: 9 * 3600_000,
      forceCloseBeforeEndMs: 5 * 60_000,
    },
  },
  {
    capital: 1_000_000,
    sizing: { method: "risk-based", riskPercent: 1 },
    stopLoss: 2,
    takeProfit: 6,
    trailingStop: 3,
    commissionRate: 0.1,
    slippage: 0.05,
  },
);

ws.on("trade", (data) => {
  const events = session.onTrade({
    time: data.timestamp,
    price: data.price,
    volume: data.quantity,
  });
  for (const e of events) {
    if (e.type === "position-opened") console.log("建玉:", e.position.shares);
    if (e.type === "position-closed") console.log("P&L:", e.trade.return);
    if (e.type === "position-update") console.log("評価額:", e.equity);
  }
});
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `sessionOptions` | `SessionOptions` | 標準セッション設定 |
| `guardOptions` | `GuardedSessionOptions` | ガード設定（リスク / タイム） |
| `positionOptions` | `PositionManagerOptions` | ポジション管理設定（下記参照） |

**`PositionManagerOptions`:**

| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `capital` | `number` | — (必須) | 初期資金 |
| `sizing` | `PositionSizingConfig` | `{ method: 'full-capital' }` | ポジションサイジング方式 |
| `stopLoss` | `number` | `0` | ストップロス（%） |
| `takeProfit` | `number` | `0` | テイクプロフィット（%） |
| `trailingStop` | `number` | `0` | トレーリングストップ（%） |
| `commission` | `number` | `0` | 1取引あたりの固定手数料 |
| `commissionRate` | `number` | `0` | 手数料率（%） |
| `taxRate` | `number` | `0` | 利益に対する税率（%） |
| `slippage` | `number` | `0` | スリッページ（%） |
| `maxTradeHistory` | `number` | `1000` | 保持する最大取引履歴数 |

**`PositionSizingConfig` バリアント:**

| 方式 | フィールド | 説明 |
|--------|--------|-------------|
| `full-capital` | — | 利用可能な全資金を使用 |
| `fixed-fractional` | `fractionPercent` | 資金の固定割合を投資 |
| `risk-based` | `riskPercent` | 1取引あたり資金の一定割合をリスク（`stopLoss` 必要） |
| `atr-based` | `riskPercent`, `atrKey`, `atrMultiplier?` | ATRベースのサイジング（デフォルト乗数: `2`） |

**`ManagedEvent` タイプ**（すべての `SessionEvent` タイプに加えて）:

| タイプ | 説明 | 主要フィールド |
|------|-------------|------------|
| `position-opened` | ポジションが建てられた | `position`, `fill`, `candle` |
| `position-closed` | ポジションが決済された | `trade`, `fill`, `account`, `candle` |
| `position-update` | ポジションのP&L更新 | `unrealizedPnl`, `equity`, `candle` |

**`ManagedSession` の追加メソッド:**

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `getPosition()` | `ManagedPosition \| null` | 現在のオープンポジションを取得 |
| `getAccount()` | `AccountState` | 現在のアカウント状態を取得 |
| `getTrades()` | `Trade[]` | すべての決済済み取引レコードを取得 |
| `closePosition(time, price)` | `ManagedEvent[]` | 手動でポジションを決済 |
| `updateStopLoss(price)` | `void` | ストップロス価格を更新 |
| `updateTakeProfit(price)` | `void` | テイクプロフィット価格を更新 |

---

## トレードシグナル

自動売買スクリプトが利用しやすい統一シグナルフォーマット。

### TradeSignal型

```typescript
type TradeSignal = {
  id: string;              // 一意のシグナルID
  time: number;            // タイムスタンプ (epoch ms)
  action: TradeAction;     // "BUY" | "SELL" | "CLOSE"
  direction: TradeDirection; // "LONG" | "SHORT"
  confidence: number;      // 0-100
  prices?: PriceLevels;    // { entry, stopLoss?, takeProfit? }
  reasons: SignalReason[];  // [{ source, name, detail? }]
  timeframe?: string;      // 例: "1d", "4h"
  metadata?: Record<string, unknown>;
};
```

### シグナルコンバーター

既存のTrendCraftシグナル型を統一`TradeSignal`フォーマットに変換。

#### `fromCrossSignal(signal, entryPrice?)`

```typescript
import { fromCrossSignal } from 'trendcraft';

const signals = validateCrossSignals(candles);
const tradeSignals = signals.map(s => fromCrossSignal(s, candles[i].close));
// { action: "BUY", direction: "LONG", confidence: 85, ... }
```

#### `fromDivergenceSignal(signal, entryPrice?)`

```typescript
import { fromDivergenceSignal } from 'trendcraft';

const divSignals = rsiDivergence(candles);
const tradeSignals = divSignals.map(s => fromDivergenceSignal(s, candles[s.secondIdx].close));
```

#### `fromSqueezeSignal(signal, direction?, entryPrice?)`

```typescript
import { fromSqueezeSignal } from 'trendcraft';

const squeezes = bollingerSqueeze(candles);
const tradeSignals = squeezes.map(s => fromSqueezeSignal(s, "LONG", candles[i].close));
```

#### `fromPatternSignal(signal, entryPrice?)`

パターンの`target`と`stopLoss`を`TradeSignal.prices`にマッピング。

```typescript
import { fromPatternSignal } from 'trendcraft';

const patterns = doubleBottom(candles);
const tradeSignals = patterns.map(p => fromPatternSignal(p, 100));
// { prices: { entry: 100, takeProfit: 120, stopLoss: 90 }, ... }
```

#### `fromScoreResult(score, time, options?)`

`ScoreBreakdown`を`TradeSignal`に変換。閾値未満の場合`null`を返す。

```typescript
import { fromScoreResult } from 'trendcraft';

const breakdown = calculateScoreBreakdown(candles, signals, i);
const signal = fromScoreResult(breakdown, candle.time, { minScore: 50, entryPrice: 100 });
```

**オプション:**

| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `minScore` | `number` | `0` | 最低スコア閾値 |
| `direction` | `'LONG' \| 'SHORT'` | `'LONG'` | ポジション方向 |
| `entryPrice` | `number` | - | エントリー価格 |

#### `fromPipelineResult(result, time, entryPrice?)`

ストリーミングの`PipelineResult`を`TradeSignal`に変換。シグナルなしの場合`null`を返す。

```typescript
import { fromPipelineResult } from 'trendcraft';

const result = pipeline.next(candle);
const signal = fromPipelineResult(result, candle.time, candle.close);
```

### シグナルエミッター

ストリーミングパイプラインをラップし、`TradeSignal`イベントを自動発火。

#### `createSignalEmitter(options)`

```typescript
import { streaming } from 'trendcraft';

const emitter = streaming.createSignalEmitter({
  intervalMs: 60000,
  pipeline: {
    indicators: [{ name: 'rsi14', create: () => streaming.incremental.rsi({ period: 14 }) }],
    entry: rsiBelow(30),
    exit: rsiAbove(70),
  },
  onSignal: (signal) => {
    console.log(`${signal.action} at confidence ${signal.confidence}`);
  },
});

for (const trade of trades) {
  emitter.onTrade(trade);
}
emitter.close();
```

**オプション:**

| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `intervalMs` | `number` | 必須 | ローソク足間隔 (ms) |
| `pipeline` | `PipelineOptions` | 必須 | パイプライン設定 |
| `onSignal` | `(signal: TradeSignal) => void` | 必須 | シグナル発火コールバック |
| `emitPartial` | `boolean` | `false` | 部分ローソク足を発火 |
| `warmUp` | `NormalizedCandle[]` | - | ウォームアップ用ヒストリカルデータ |

---

## シグナルライフサイクル

トレードシグナルの重複排除とライフサイクル管理。

### SignalManager

#### `createSignalManager(options?, state?)`

クールダウン、デバウンス、有効期限ルールでシグナルをフィルタリングするマネージャーを作成。

```typescript
import { createSignalManager } from 'trendcraft';

const manager = createSignalManager({
  cooldown: { bars: 5 },    // 5バー間、同一シグナルを抑制
  debounce: { bars: 3 },    // 3バー連続で初めて発火
  expiry: { bars: 10 },     // 10バー後に期限切れ
});

// バーごとにシグナルを処理
const activated = manager.onBar(incomingSignals, barTime);
// 新たにアクティブ化されたシグナルのみ返される

// シグナルを約定済み/キャンセルに設定
manager.fill(signal.id);
manager.cancel(signal.id);

// 状態の問い合わせ
manager.getActiveCount();        // アクティブシグナル数
manager.getSignals('FILLED');    // 約定済みシグナルを取得
manager.getState();              // 永続化用にシリアライズ
```

**オプション:**

| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `cooldown` | `CooldownConfig` | - | 重複抑制期間 (バー数 or ms) |
| `debounce` | `DebounceConfig` | - | 連続バー数の要件 |
| `expiry` | `ExpiryConfig` | - | アクティブシグナルの自動期限切れ |
| `signalKey` | `SignalKeyFn` | デフォルト | シグナル同一判定のカスタム関数 |

**CooldownConfig:** `{ bars?: number; ms?: number }`
**DebounceConfig:** `{ bars: number }`
**ExpiryConfig:** `{ bars?: number; ms?: number }`

**シグナル状態遷移:** `PENDING` → `ACTIVE` → `EXPIRED` / `FILLED` / `CANCELLED`

**状態の保存・復元:**

```typescript
const state = manager.getState();
// 状態を永続化 (例: ファイル)
const restored = createSignalManager(options, state);
```

### バッチ処理

#### `processSignalsBatch(signals, options?)`

シグナル配列にライフサイクルルールを一括適用。バックテスト後のポスト処理に便利。

```typescript
import { processSignalsBatch } from 'trendcraft';

const allSignals = [/* バックテストのシグナル */];
const filtered = processSignalsBatch(allSignals, { cooldown: { bars: 3 } });
// 3バー以内の重複シグナルを除去
```

---

## ショートセリング

TrendCraftはバックテスト・ストリーミング両方でショートポジションをサポート。ショート関連フィールドはすべてオプショナルで、`direction`未指定時は`"long"`がデフォルト（完全後方互換）。

### バックテストでのショート

バックテストオプションに`direction: "short"`を指定。

```typescript
import { runBacktest, deadCross, goldenCross } from 'trendcraft';

const result = runBacktest(
  candles,
  deadCross(5, 25),     // エントリー: デッドクロス（ショートイン）
  goldenCross(5, 25),   // イグジット: ゴールデンクロス（ショートアウト）
  {
    capital: 1000000,
    direction: 'short',  // ショートセリング有効化
    stopLoss: 5,         // entry * 1.05 で発動（価格上昇時）
    takeProfit: 5,       // entry * 0.95 で発動（価格下落時）
    trailingStop: 3,     // 最安値（トラフ）から追跡
  }
);

// ショートP&Lは方向を考慮
console.log(result.totalReturnPercent); // 価格下落時にプラス
console.log(result.trades[0].direction); // "short"
```

**ショートポジションの動作:**

| 項目 | ロング（デフォルト） | ショート |
|------|---------------------|----------|
| 利益 | 価格上昇 | 価格下落 |
| ストップロス | `entry * (1 - sl%)` | `entry * (1 + sl%)` |
| テイクプロフィット | `entry * (1 + tp%)` | `entry * (1 - tp%)` |
| トレーリングストップ | 最高値から下落で発動 | 最安値から上昇で発動 |
| MFE | 価格上昇による最大含み益 | 価格下落による最大含み益 |
| MAE | 価格下落による最大含み損 | 価格上昇による最大含み損 |

### ストリーミングでのショート

ポジショントラッカーもショートポジションをサポート。

```typescript
import { streaming } from 'trendcraft';

const tracker = streaming.createPositionTracker({
  capital: 100000,
  direction: 'short',
  stopLoss: 5,        // SL: entry * 1.05
  takeProfit: 10,     // TP: entry * 0.90
  trailingStop: 3,    // トラフから追跡
});

tracker.openPosition(100, currentTime, 1000);

// 含み損益は方向を考慮
const account = tracker.getAccount();
console.log(account.unrealizedPnl); // 価格 < entry でプラス

// 自動発動: 価格上昇でSL、価格下落でTP
const result = tracker.updatePrice(candle);
if (result.triggered) {
  console.log(result.triggered.reason); // "stop-loss" | "take-profit" | "trailing-stop"
}
```

### ポートフォリオ / バッチでのショート

`batchBacktest()` と `portfolioBacktest()` も同じ `direction` オプションでショートセリングに対応。

```typescript
import { batchBacktest, deadCross, goldenCross } from 'trendcraft';

// バッチバックテスト: direction をオプションに直接指定
const batchResult = batchBacktest(datasets, deadCross(5, 25), goldenCross(5, 25), {
  capital: 3_000_000,
  direction: 'short',
  stopLoss: 5,
  takeProfit: 10,
});

// ポートフォリオバックテスト: direction は tradeOptions 内に指定
const portfolioResult = portfolioBacktest(datasets, deadCross(5, 25), goldenCross(5, 25), {
  capital: 3_000_000,
  allocation: { type: 'equal' },
  maxPositions: 5,
  tradeOptions: {
    direction: 'short',
    stopLoss: 5,
    takeProfit: 10,
  },
});
```

### ショート戦略レシピ

組み込み条件を使った代表的なショート戦略パターン:

```typescript
import {
  and, rsiAbove, rsiBelow, bollingerTouch, deadCross, goldenCross,
  dmiBearish, anyBearishPattern, stochAbove, stochBelow,
} from 'trendcraft';

// ミーンリバージョンショート: 買われすぎからの反転
const mrEntry = and(rsiAbove(70), bollingerTouch('upper'));
const mrExit  = rsiBelow(50);

// トレンドフォローショート: 下落トレンド確認
const tfEntry = and(deadCross(5, 25), dmiBearish());
const tfExit  = goldenCross(5, 25);

// パターンベースショート: 弱気パターン + ストキャスティクス買われすぎ
const ptEntry = and(anyBearishPattern(), stochAbove(80));
const ptExit  = stochBelow(20);

const result = runBacktest(candles, tfEntry, tfExit, {
  capital: 1_000_000,
  direction: 'short',
  stopLoss: 5,
  takeProfit: 15,
});
```

---

## トレード分析

### `analyzeDrawdowns(periods)`

バックテスト結果のドローダウン期間を分析し、サマリー統計を生成します。

```typescript
import { runBacktest, analyzeDrawdowns } from 'trendcraft';

const result = runBacktest(candles, entry, exit, { capital: 1_000_000 });
const summary = analyzeDrawdowns(result.drawdownPeriods);

console.log(`ドローダウン回数: ${summary.count}`);
console.log(`最大ドローダウン: ${summary.maxDepth}%`);
console.log(`平均回復期間: ${summary.avgRecoveryBars} バー`);
console.log(`回復率: ${summary.recoveryRate}%`);
```

**戻り値:** `DrawdownSummary`

| プロパティ | 型 | 説明 |
|-----------|------|------|
| `count` | `number` | ドローダウン期間の総数 |
| `avgDepth` | `number` | 平均ドローダウン深度 (%) |
| `maxDepth` | `number` | 最大ドローダウン深度 (%) |
| `avgDurationBars` | `number` | 平均ドローダウン期間（バー数） |
| `maxDurationBars` | `number` | 最大ドローダウン期間（バー数） |
| `avgRecoveryBars` | `number` | 平均回復時間（バー数） |
| `maxRecoveryBars` | `number` | 最大回復時間（バー数） |
| `recoveryRate` | `number` | 回復したドローダウンの割合 (%) |
| `worstDrawdown` | `DrawdownPeriod \| null` | 最も深いドローダウン期間 |
| `longestRecovery` | `DrawdownPeriod \| null` | 最も長い回復期間 |

---

### パターンプロジェクション

パターン/イベント発生後の価格推移を統計分析し、信頼区間付きの将来リターンを予測します。

#### `projectPatternOutcome(candles, events, extractor, options?)`

任意のイベントタイプに対応する汎用プロジェクション関数。

```typescript
import { projectPatternOutcome, doubleBottom } from 'trendcraft';

const patterns = doubleBottom(candles);
const projection = projectPatternOutcome(
  candles,
  patterns,
  (p) => ({ time: p.time, direction: 'bullish' }),
  { horizon: 30, confidenceLevel: 0.95, thresholds: [1, 2, 5, 10] },
);

console.log(`有効イベント数: ${projection.validCount}`);
console.log(`10バー後の平均リターン: ${projection.avgReturnByBar[9]}%`);
console.log(`5%ヒット率: ${projection.hitRates.find(h => h.threshold === 5)?.rate}%`);
```

**オプション:**

| オプション | 型 | デフォルト | 説明 |
|-----------|------|---------|------|
| `horizon` | `number` | `20` | 前方投影するバー数 |
| `confidenceLevel` | `number` | `0.95` | 上限/下限の信頼水準 |
| `thresholds` | `number[]` | `[1,2,5,10]` | ヒット率計算用のリターン閾値 |

**戻り値:** `PatternProjection`

| プロパティ | 型 | 説明 |
|-----------|------|------|
| `patternCount` | `number` | 検出されたイベント総数 |
| `validCount` | `number` | 十分な前方データがあるイベント数 |
| `avgReturnByBar` | `number[]` | 各バーオフセットでの平均リターン |
| `medianReturnByBar` | `number[]` | 各バーオフセットでの中央値リターン |
| `upperBound` | `number[]` | 信頼区間上限 |
| `lowerBound` | `number[]` | 信頼区間下限 |
| `hitRates` | `HitRate[]` | 各閾値に対するヒット率 |

#### `projectFromPatterns(candles, signals, options?)`

`PatternSignal[]` 用の便利ラッパー。パターンタイプから方向を自動検出（double_top/head_shoulders → bearish、その他 → bullish）。

```typescript
import { projectFromPatterns, doubleTop } from 'trendcraft';

const tops = doubleTop(candles);
const projection = projectFromPatterns(candles, tops); // 自動でbearish
```

#### `projectFromSeries(candles, series, options?)`

任意の `Series<T>` からプロジェクション。truthy値をイベントとして扱います。

```typescript
import { projectFromSeries, crossOver, sma } from 'trendcraft';

const crosses = crossOver(sma(candles, { period: 5 }), sma(candles, { period: 25 }));
const projection = projectFromSeries(candles, crosses, { horizon: 20 });
```

---

## データ品質バリデーション

インジケーター計算やバックテスト前にデータ品質を検証。

### `validateCandles(candles, options?)`

有効な全検出チェックを実行し、統一された結果を返す。

```typescript
import { validateCandles } from 'trendcraft';

const result = validateCandles(candles);

if (!result.valid) {
  console.log('エラー:', result.errors);
}
console.log('警告:', result.warnings);
console.log('情報:', result.info);
```

**オプション:**

| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `gaps` | `boolean \| GapDetectionOptions` | `true` | 時間ギャップ検出 |
| `duplicates` | `boolean` | `true` | 重複タイムスタンプ検出 |
| `ohlc` | `boolean` | `true` | OHLC整合性チェック |
| `spikes` | `boolean \| SpikeDetectionOptions` | `true` | 価格スパイク検出 |
| `volumeAnomalies` | `boolean \| VolumeAnomalyOptions` | `true` | 出来高異常検出 |
| `stale` | `boolean \| StaleDetectionOptions` | `true` | データ停滞検出 |
| `splits` | `boolean` | `false` | 株式分割ヒント検出 |
| `autoClean` | `boolean` | `false` | クリーニング済みデータを返す（重複除去＋ソート） |

**検出オプション:**

| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `GapDetectionOptions.maxGapMultiplier` | `number` | `3` | 予想間隔の倍数としての最大ギャップ |
| `GapDetectionOptions.skipWeekends` | `boolean` | `true` | ギャップ計算で週末をスキップ |
| `SpikeDetectionOptions.maxPriceChangePercent` | `number` | `20` | 1バーの最大価格変動 (%) |
| `VolumeAnomalyOptions.zScoreThreshold` | `number` | `4` | Zスコア閾値 |
| `VolumeAnomalyOptions.lookback` | `number` | `20` | 平均/標準偏差の計算期間 |
| `StaleDetectionOptions.minConsecutive` | `number` | `5` | 同一終値の最小連続バー数 |

**検出結果:**

| カテゴリ | 重要度 | 説明 |
|----------|--------|------|
| `duplicate` | error | 重複タイムスタンプ |
| `ohlc` | error | OHLC不整合（例: high < low） |
| `gap` | warning | 閾値を超える時間ギャップ |
| `spike` | warning | 閾値を超える1バー価格変動 |
| `volume` | warning | 閾値を超えるZスコア |
| `stale` | warning | 同一終値の連続 |
| `split` | info | 一般的な分割比率に一致（1:2, 1:3等） |

**autoCleanの例:**

```typescript
const result = validateCandles(candles, { autoClean: true });
if (result.cleanedCandles) {
  // クリーニング済みデータを使用（重複除去・ソート済み）
  const indicators = sma(result.cleanedCandles, { period: 20 });
}
```

### `normalizeAndValidate(candles, validation?)`

正規化とバリデーションを一括で行うラッパー。

```typescript
import { normalizeAndValidate } from 'trendcraft';

const { candles: normalized, validation } = normalizeAndValidate(rawCandles, {
  gaps: true,
  duplicates: true,
  autoClean: true,
});

if (validation && !validation.valid) {
  console.warn('データ品質に問題あり:', validation.errors);
}
```

### 個別検出関数

各バリデーションチェックはスタンドアロン関数としても利用可能:

```typescript
import {
  detectGaps,
  detectDuplicates,
  removeDuplicates,
  detectOhlcErrors,
  detectPriceSpikes,
  detectVolumeAnomalies,
  detectStaleData,
  detectSplitHints,
} from 'trendcraft';

const gaps = detectGaps(candles, { maxGapMultiplier: 5 });
const dupes = detectDuplicates(candles);
const cleaned = removeDuplicates(candles); // 重複除去済み配列を返す
const ohlcErrors = detectOhlcErrors(candles);
const spikes = detectPriceSpikes(candles, { maxPriceChangePercent: 15 });
const volumeIssues = detectVolumeAnomalies(candles, { zScoreThreshold: 3 });
const stale = detectStaleData(candles, { minConsecutive: 10 });
const splits = detectSplitHints(candles);
```

---

## カスタムインジケーター（プラグインシステム）

カスタムインジケーターをプラグインとして定義し、TrendCraftのFluent APIパイプラインに追加できます。

### いつ使うべきか

プラグインシステムは以下の場合に使用してください：
- **独自インジケーター**: 45以上の組み込みインジケーターに含まれない独自の計算式がある場合
- **複合インジケーター**: 複数の組み込みインジケーターを1つのシリーズに統合する場合（例：SMAスプレッド、マルチファクタースコア）
- **動的パイプライン**: 設定ファイルやユーザー入力から実行時にインジケーターセットを構築する場合

通常のユースケースでは、組み込みショートハンドメソッド（`.sma()`、`.rsi()` 等）で十分です。

### defineIndicator

型安全なインジケータープラグインを定義するヘルパー関数です。

```typescript
import { defineIndicator, sma } from "trendcraft";
import type { IndicatorPlugin } from "trendcraft";

const customSma = defineIndicator({
  name: "customSma" as const,
  compute: (candles, opts) => sma(candles, { period: opts.period, source: opts.source }),
  defaultOptions: { period: 20, source: "close" as const },
  buildKey: (opts) => `customSma_${opts.period}`,
});
```

**プラグインインターフェース:**

| プロパティ | 型 | 説明 |
|----------|------|-------------|
| `name` | `string` (const) | キャッシュキーのプレフィックスとして使用される一意な名前 |
| `compute` | `(candles, options) => Series<T>` | 計算関数 |
| `defaultOptions` | `TOptions` | デフォルトのオプション値 |
| `buildKey` | `(options) => string` (省略可) | カスタムキャッシュキー生成関数。省略時は `name_JSON(options)` |

### TrendCraft.use()

プラグインを計算パイプラインに追加します。

```typescript
import { defineIndicator, TrendCraft, sma, ema } from "trendcraft";

// カスタムスプレッドインジケーターを定義
const spread = defineIndicator({
  name: "spread" as const,
  compute: (candles, opts) => {
    const fast = sma(candles, { period: opts.fastPeriod });
    const slow = sma(candles, { period: opts.slowPeriod });
    return fast.map((f, i) => ({
      time: f.time,
      value:
        f.value != null && slow[i].value != null
          ? f.value - slow[i].value
          : null,
    }));
  },
  defaultOptions: { fastPeriod: 5, slowPeriod: 20 },
  buildKey: (opts) => `spread_${opts.fastPeriod}_${opts.slowPeriod}`,
});

// Fluent APIで使用
const result = TrendCraft.from(candles)
  .sma(20)                                 // 組み込みショートハンド
  .use(spread, { fastPeriod: 10 })         // カスタムプラグイン（slowPeriodはデフォルト20）
  .rsi(14)                                 // 組み込みショートハンド
  .compute();

console.log(result.indicators.sma20);
console.log(result.indicators.spread_10_20);
console.log(result.indicators.rsi14);
```

**パラメータ:**

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `plugin` | `IndicatorPlugin<K, O, V>` | プラグイン定義 |
| `options` | `Partial<O>` (省略可) | デフォルトとマージされる部分オプション |

**戻り値:** `TrendCraft`（チェーン可能）

### 組み込みプラグイン

すべての組み込みショートハンドメソッド（`.sma()`、`.rsi()` 等）はプラグインで実装されています。
`.use()` で直接使用することで、プログラム的・動的なインジケーター追加が可能です：

```typescript
import { TrendCraft, plugins } from "trendcraft";

// .sma(50) と同等
TrendCraft.from(candles).use(plugins.sma, { period: 50 });

// 動的なプラグイン選択
const selected = [plugins.sma, plugins.rsi];
let tc = TrendCraft.from(candles);
for (const p of selected) {
  tc = tc.use(p);
}
const result = tc.compute();
```

**利用可能な組み込みプラグイン:**

| プラグイン | ショートハンド | デフォルトオプション |
|--------|-----------|-----------------|
| `plugins.sma` | `.sma()` | `{ period: 20, source: "close" }` |
| `plugins.ema` | `.ema()` | `{ period: 20, source: "close" }` |
| `plugins.rsi` | `.rsi()` | `{ period: 14 }` |
| `plugins.macd` | `.macd()` | `{ fast: 12, slow: 26, signal: 9 }` |
| `plugins.bollingerBands` | `.bollingerBands()` | `{ period: 20, stdDev: 2, source: "close" }` |
| `plugins.atr` | `.atr()` | `{ period: 14 }` |
| `plugins.volumeMa` | `.volumeMa()` | `{ period: 20, maType: "sma" }` |
| `plugins.highest` | `.highest()` | `{ period: 20 }` |
| `plugins.lowest` | `.lowest()` | `{ period: 20 }` |
| `plugins.returns` | `.returns()` | `{ period: 1, returnType: "simple" }` |
| `plugins.parabolicSar` | `.parabolicSar()` | `{ step: 0.02, max: 0.2 }` |
| `plugins.keltnerChannel` | `.keltnerChannel()` | `{ emaPeriod: 20, atrPeriod: 10, multiplier: 2 }` |
| `plugins.cmf` | `.cmf()` | `{ period: 20 }` |
| `plugins.volumeAnomaly` | `.volumeAnomalyIndicator()` | `{ period: 20, highThreshold: 2.0 }` |
| `plugins.volumeProfileSeries` | `.volumeProfileIndicator()` | `{ period: 20 }` |
| `plugins.volumeTrend` | `.volumeTrendIndicator()` | `{ pricePeriod: 10, volumePeriod: 10 }` |

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
