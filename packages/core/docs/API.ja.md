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
  - [S/Rゾーンクラスタリング](#srゾーンクラスタリング)
  - [フィボナッチリトレースメント](#フィボナッチリトレースメント)
  - [スマートマネーコンセプト (SMC)](#スマートマネーコンセプト-smc)
  - [セッション / キルゾーン](#セッション--キルゾーン)
  - [HMMレジーム検出](#hmmレジーム検出)
- [シグナル](#シグナル)
  - [クロス検出](#クロス検出)
  - [ダイバージェンス検出](#ダイバージェンス検出)
  - [CVDダイバージェンス](#cvdダイバージェンス)
  - [スクイーズ検出](#スクイーズ検出)
  - [レンジ相場検出](#レンジ相場検出)
  - [価格パターン](#価格パターン)
- [バックテスト](#バックテスト)
  - [バックテスト実行](#バックテスト実行)
  - [プリセット条件](#プリセット条件)
  - [条件の組み合わせ](#条件の組み合わせ)
- [ユーティリティ](#ユーティリティ)
  - [データ正規化](#データ正規化)
  - [価格ソースヘルパー](#価格ソースヘルパー)
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
- [シグナル説明性](#シグナル説明性)
- [合成可能なインジケーター代数](#合成可能なインジケーター代数)
- [アルファ減衰モニター](#アルファ減衰モニター)
- [適応型インジケーター](#適応型インジケーター)
- [戦略堅牢性スコア](#戦略堅牢性スコア)
- [ペアトレーディング](#ペアトレーディング)
- [クロスアセット相関分析](#クロスアセット相関分析)
- [ワイコフ / VSA](#ワイコフ--vsa)
- [リスク分析](#リスク分析)
  - [VaR / CVaR](#calculatevarreturns-options)
  - [ローリングVaR](#rollingvarreturns-options)
  - [リスクパリティ](#riskparityallocationreturnsseries-options)
  - [相関調整サイジング](#correlationadjustedsizecurrentreturns-portfolioreturns-options)
- [メタ戦略](#メタ戦略)
  - [エクイティカーブフィルター](#applyequitycurvefilterresult-options)
  - [戦略ローテーション](#rotatestrategiesresults-options)
- [ハーモニックパターン検出](#ハーモニックパターン検出)
- [GARCHボラティリティ](#garchボラティリティ)
- [パレート多目的最適化 (NSGA-II)](#パレート多目的最適化-nsga-ii)
- [バックテストリアリズム](#バックテストリアリズム)
- [ストレステスト](#ストレステスト)
- [戦略JSONシリアライゼーション](#戦略jsonシリアライゼーション)
  - [ビルトインレジストリ](#ビルトインレジストリ)
  - [ConditionRegistry](#conditionregistry)
  - [シリアライズ / パース](#serializestrategystrategy--parsestratejson)
  - [ハイドレーション / ロード](#hydrateconditionspec-registry--loadstrategyjson-registry)
  - [バリデーション](#validateconditionspecspec-registry--validatestrategyjsonjson)
- [ライブストリーミング & シリーズメタデータ](#ライブストリーミング--シリーズメタデータ)
  - [createLiveCandle](#createlivecandleoptions-fromstate)
  - [livePresets](#livepresets)
  - [indicatorPresets](#indicatorpresets)
  - [tagSeries / SeriesMeta](#tagseries--seriesmeta)
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
const custom = mcginleyDynamic(candles, { period: 14, k: 0.6 });
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
const custom = emaRibbon(candles, { periods: [8, 13, 21, 34, 55] });
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
  bullish: boolean | null;    // 短期EMA>長期EMA順で整列（warmup中はnull）
  expanding: boolean | null;  // スプレッド拡大中（warmup中はnull）
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
const result = macd(candles, { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `fastPeriod` | `number` | `12` | 短期EMA期間 |
| `slowPeriod` | `number` | `26` | 長期EMA期間 |
| `signalPeriod` | `number` | `9` | シグナル期間 |
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
// ストキャスティクス（デフォルト slowing: 3 = スロー相当）
const result = stochastics(candles, { kPeriod: 14, dPeriod: 3 });
// 生（未平滑）にする場合は slowing: 1 を明示
// const fastRaw = stochastics(candles, { kPeriod: 14, dPeriod: 3, slowing: 1 });

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
| `slowing` | `number` | `3` | %K平滑化（スローストキャスティクス用） |

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
  stochRsi: number | null; // 生のStochRSI値 (0-100)
  k: number | null;        // %Kライン（平滑化StochRSI）
  d: number | null;        // %Dライン（%KのSMA）
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

**計算式:** `(ADX[i] + ADX[i - (period - 1)]) / 2`（TA-Lib準拠のルックバック）

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
// セッションVWAP（UTC 0時リセット）
const result = vwap(candles);

// ローリングVWAP（20期間）
const rolling = vwap(candles, { resetPeriod: 'rolling', period: 20 });

// 取引セッションに紐付け：寄付でリセットし、時間外バーを除外
const nyVwap = vwap(candles, {
  session: { name: 'regular', startHour: 9, startMinute: 30, endHour: 16, endMinute: 0, timezone: 'America/New_York' },
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `resetPeriod` | `'session' \| 'rolling' \| number` | `'session'` | リセット期間タイプ。`session` と併用できるのは既定の `'session'` のみ |
| `period` | `number` | `20` | ローリングVWAP期間 |
| `bandMultipliers` | `number[]` | — | 追加σバンドの倍率（例：`[2, 3]` で±2σ、±3σ） |
| `session` | `SessionDefinition` | — | 取引セッションに紐付ける（下記参照） |

**セッション紐付け**

`session` を指定しない場合、平均はセッションの境界ではなく UTC 0時でリセットされます。通常取引時間のみの系列であれば両者はしばしば一致します（米国株の1日は1つの UTC 日に収まるため）。しかし時間外バーを含む系列では崩れます。UTC 0時はニューヨーク時間の 19:00 / 20:00、つまりポストマーケットの途中にあたるため、1つのリセット期間がそこから翌日のプレマーケット・通常取引・ポストマーケットまでを1つにまとめてしまい、時間外バーが混ざったまま寄付でリセットされません。UTC 0時を跨ぐセッションでは、データの内容にかかわらず一致しません。

`session` を指定すると、平均はセッションのタイムゾーンで、セッション開始時にリセットされ、セッション内のバーだけが対象になります。window 外のバーと break 内のバーは `null` を返し、累積値を変更しません。したがって昼休みは平均を「一時停止」させるだけでリセットしません。深夜を跨ぐセッションも、DST 切り替え日を跨ぐセッションも1つのまま保たれます。

`session` と `resetPeriod: 'rolling'` または本数指定の併用は、どちらかを黙って優先するのではなくエラーになります。

**戻り値:** `Series<VwapValue>`

```typescript
interface VwapValue {
  vwap: number | null;   // VWAP値
  upper: number | null;  // 上バンド（VWAP + 標準偏差）
  lower: number | null;  // 下バンド（VWAP - 標準偏差）
  bands?: VwapBand[];    // bandMultipliers指定時の追加バンド
}
interface VwapBand {
  upper: number;  // 上バンド値
  lower: number;  // 下バンド値
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
| `period` | `number` | 必須 | MA期間 |
| `type` | `'sma' \| 'ema'` | `'sma'` | MA種別 |

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
const custom = volumeProfile(candles, { period: 20, levels: 24, valueAreaPercent: 0.7 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | 全期間（省略時は全キャンドル対象） | 参照期間（末尾からのキャンドル数） |
| `levels` | `number` | `24` | 価格レベル数 |
| `valueAreaPercent` | `number` | `0.7` | Value Area計算の割合（0-1の小数） |

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
  priceLow: number;      // 価格レベル下限
  priceHigh: number;     // 価格レベル上限
  priceMid: number;      // 価格レベル中央値
  volume: number;        // このレベルの出来高
  volumePercent: number; // 総出来高に対する割合
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
const custom = elderForceIndex(candles, { shortPeriod: 2, longPeriod: 13 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `shortPeriod` | `number` | `2` | 短期EMA期間（エントリー） |
| `longPeriod` | `number` | `13` | 長期EMA期間（トレンド確認） |

**戻り値:** `Series<ElderForceIndexValue>` (`{ short: number | null; long: number | null }`)

**計算式:** `Force = (Close - Prev Close) × Volume → EMA平滑化`

---

#### `easeOfMovement(candles, options)`

Ease of Movement — 価格変化とボリューム効率の指標。

```typescript
const result = easeOfMovement(candles);
const custom = easeOfMovement(candles, { period: 14, volumeDivisor: 100_000_000 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `period` | `number` | `14` | 平滑化期間 |
| `volumeDivisor` | `number` | `100_000_000` | ボリューム除数 |

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
const fixed = twap(candles, { sessionResetPeriod: 30 });

// セッションVWAPと同様に取引セッションへ紐付け
const nyTwap = twap(candles, {
  session: { name: 'regular', startHour: 9, startMinute: 30, endHour: 16, endMinute: 0, timezone: 'America/New_York' },
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `sessionResetPeriod` | `'session' \| number` | `'session'` | セッションリセット期間。`session` と併用できるのは既定の `'session'` のみ |
| `session` | `SessionDefinition` | — | 取引セッションに紐付ける — 意味論は [`vwap`](#vwapcandles-options) と同じ |

**戻り値:** `Series<number | null>`

---

#### `weisWave(candles, options)`

Weis Wave Volume — 波動方向ごとにボリュームを累積。

```typescript
const result = weisWave(candles);
const custom = weisWave(candles, { method: 'highlow', threshold: 0.5 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `method` | `'close' \| 'highlow'` | `'close'` | 方向判定方法 |
| `threshold` | `number` | `0` | 方向転換の閾値 |

**戻り値:** `Series<WeisWaveValue>`

```typescript
interface WeisWaveValue {
  waveVolume: number;          // 波動の累積ボリューム
  direction: 'up' | 'down';    // 波動の方向
}
```

---

#### `marketProfile(candles, options)`

Market Profile / TPO — 価格帯ごとの滞在時間分析。POC・Value Area算出。

```typescript
const result = marketProfile(candles);
const custom = marketProfile(candles, { tickSize: 0.5, valueAreaPercent: 0.70 });
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
  poc: number | null;              // Point of Control（最頻出価格帯）
  valueAreaHigh: number | null;    // Value Area上限
  valueAreaLow: number | null;     // Value Area下限
  profile: Map<number, number> | null;  // 価格帯ごとのTPOカウント
}
```

---

#### `cvd(candles)`

Cumulative Volume Delta（累積出来高デルタ） — 各バーのレンジ内で終値がどこに位置するかから買い圧力・売り圧力を推定し、デルタを累積します。

```typescript
const cvdData = cvd(candles);
const current = cvdData[cvdData.length - 1].value;
const previous = cvdData[cvdData.length - 2].value;

// CVD上昇 = 買い圧力優勢
if (current !== null && previous !== null && current > previous) {
  // 買い圧力が優勢
}
```

**計算方法:**
- `buyVolume = volume × (close - low) / (high - low)`
- `sellVolume = volume - buyVolume`
- `delta = buyVolume - sellVolume`
- `CVD = デルタの累積和`

**戻り値:** `Series<number>`

**解釈:**
- CVD上昇: 買い圧力優勢（アキュミュレーション）
- CVD下降: 売り圧力優勢（ディストリビューション）
- CVDと価格のダイバージェンスは反転の可能性を示唆
- 同事線（レンジ = 0）: delta = 0

---

#### `cvdWithSignal(candles, options)`

EMA平滑化とシグナルラインをオプションで付加したCVD。

```typescript
const data = cvdWithSignal(candles, { smoothing: 5, signalPeriod: 9 });
const last = data[data.length - 1].value;

// CVDがシグナルを上抜け = 強気
if (last.cvd > last.signal!) {
  // 強気モメンタム
}
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `smoothing` | `number` | `1` | CVDのEMA平滑化期間（1 = 平滑化なし） |
| `signalPeriod` | `number` | `9` | シグナルラインのEMA期間 |

**戻り値:** `Series<CvdWithSignalValue>`

```typescript
interface CvdWithSignalValue {
  cvd: number;              // CVD値（平滑化されている場合あり）
  signal: number | null;    // シグナルライン（CVDのEMA）、ウォームアップ中はnull
}
```

---

### S/Rゾーンクラスタリング

#### `srZones(candles, options)`

複数のソースから価格レベルを収集し、K-means++でクラスタリングしてサポート/レジスタンスゾーンを特定します。各ゾーンはタッチ回数・ソース多様性・新しさでスコアリングされます。

```typescript
const result = srZones(candles);
console.log(result.zones[0]);
// { price: 100.5, low: 99.8, high: 101.2, touchCount: 5,
//   sourceDiversity: 3, sources: ['swing', 'pivot', 'round'], strength: 85 }
```

**収集されるソース:**
- **スイングポイント**: スイングハイ・スイングロー
- **ピボットポイント**: PP、R1、R2、S1、S2
- **VWAP**: 直近のVWAP値
- **ボリュームプロファイル**: POC、Value Area上限/下限
- **ラウンドナンバー**: 価格レンジに基づく自動検出間隔
- **カスタムレベル**: ユーザー指定の価格レベル

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `numZones` | `number` | `auto` | ゾーン数（auto: `min(max(3, levels/3), 15)`） |
| `zoneWidth` | `number` | `0.5` | ゾーン幅のATR倍率 |
| `includeRoundNumbers` | `boolean` | `true` | ラウンドナンバーを含める |
| `includeSwingPoints` | `boolean` | `true` | スイングポイントを含める |
| `includePivotPoints` | `boolean` | `true` | ピボットポイントを含める |
| `includeVwap` | `boolean` | `true` | VWAPレベルを含める |
| `includeVolumeProfile` | `boolean` | `true` | ボリュームプロファイルレベルを含める |
| `customLevels` | `number[]` | `[]` | カスタム価格レベル |
| `swingLookback` | `number` | `5` | スイングポイントのルックバック本数 |
| `maxIterations` | `number` | `50` | K-meansの最大反復回数 |

**戻り値:** `SrZonesResult`

```typescript
interface SrZonesResult {
  zones: SrZone[];              // 強度の降順でソートされたゾーン
  rawLevels: PriceLevelSource[];  // クラスタリング前の全生レベル
}

interface SrZone {
  price: number;          // 加重セントロイド
  low: number;            // 下限（セントロイド − zoneWidth × ATR）
  high: number;           // 上限（セントロイド + zoneWidth × ATR）
  touchCount: number;     // クラスタ内の生レベル数
  sourceDiversity: number; // ユニークなソース種別数
  sources: string[];      // ユニークなソース種別のリスト
  strength: number;       // スコア0-100（touchCount 40% + 多様性 40% + 新しさ 20%）
}
```

---

#### `srZonesSeries(candles, options)`

`srZones`のローリング版 — ルックバックウィンドウを使って各バーでゾーンを計算します。

```typescript
const series = srZonesSeries(candles, { numZones: 5 });
const currentZones = series[series.length - 1].value;
```

**戻り値:** `Series<SrZone[]>`

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
if (latest.value.rsRating !== null && latest.value.rsRating > 80 && latest.value.trend === 'up') {
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
  ['AAPL', aaplCandles],
  ['GOOGL', googlCandles],
  ['MSFT', msftCandles],
]);

const rankings = rankByRS(symbolsData, { period: 52 });
// [{ symbol: 'AAPL', rank: 1, percentile: 92, ... }, ...]

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
| `compareRS(symbol1Candles, symbol2Candles, period?)` | 2銘柄を直接比較 |

---

### 価格

#### `highest(candles, period)` / `lowest(candles, period)`

n期間の最高値/最安値。

```typescript
const highestHigh = highest(candles, 20);
const lowestLow = lowest(candles, 20);
```

**引数:**
| 引数 | 型 | デフォルト | 説明 |
|------|------|---------|------|
| `period` | `number` | 必須（位置引数） | 参照期間 |

（オプションオブジェクト版は `highestLowest(candles, { period })` のみで、戻り値は `Series<{highest, lowest}>`）

**戻り値:** `Series<number | null>`

---

#### `returns(candles, options)`

価格リターン計算。

```typescript
const simpleReturns = returns(candles, { period: 1 });
const logReturns = returns(candles, { period: 1, type: 'log' });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `1` | リターン期間 |
| `type` | `'simple' \| 'log'` | `'simple'` | リターン種別（対数リターンは 'log'） |

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

// UTC 暦日の最初のバーではなく、実際のセッション寄付から計測
const nyOrb = openingRange(candles, {
  minutes: 30,
  session: { name: 'regular', startHour: 9, startMinute: 30, endHour: 16, endMinute: 0, timezone: 'America/New_York' },
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `minutes` | `number` | `30` | オープニングレンジの時間（分） |
| `sessionResetPeriod` | `'day' \| number` | `'day'` | セッションリセット方式。`session` と併用できるのは既定の `'day'` のみ |
| `session` | `SessionDefinition` | — | 取引セッションの寄付からレンジを計測する（下記参照） |

**セッション紐付け**

`session` を指定しない場合、レンジは UTC 暦日の最初のバーから計測されます。通常取引時間のみのデータであれば、そのバーは通常は寄付なので両者は一致します。しかし時間外バーを含む系列では一致しません。UTC 0時はニューヨーク時間の 19:00 / 20:00 にあたるため、UTC 日はポストマーケットのバーから始まり、「オープニングレンジ」がそこから作られてしまいます。

`session` を指定すると、レンジはセッションのタイムゾーンにおける公式な寄付から `minutes` 分を対象にします。セッション外のバーと break 内のバーは `null` を返します。

寄付を観測していない日は、**レンジを一切報告しません**。系列が 09:45 から始まる場合、そこから改めて30分を計測することはしません。window の一部だけで作ったレンジを「オープニングレンジ」として提示すると、市場が実際には付けていない水準でブレイクアウトを判定することになるためです。翌日、寄付が観測されれば通常どおり機能します。

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
| `partialMitigation` | `boolean` | `false` | 部分的な接触をミティゲーションと見なす |

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

### セッション / キルゾーン

ICT標準のセッション検出、キルゾーン特定、セッション統計、セッションブレイクアウト検出。時刻はすべてUTC（ET = UTC-5、DSTは無視）。

#### `getIctSessions()`

UTCでの標準ICTセッション4つを返します。

```typescript
const sessions = getIctSessions();
// [{ name: 'Asia', startHour: 0, startMinute: 0, endHour: 5, endMinute: 0 },
//  { name: 'London', startHour: 7, ... }, { name: 'NY AM', ... }, { name: 'NY PM', ... }]
```

| セッション | UTC時刻 | ET時刻 | 特徴 |
|-----------|----------|---------|----------------|
| Asia | 00:00-05:00 | 19:00-00:00 | 低流動性、レンジ形成 |
| London | 07:00-10:00 | 02:00-05:00 | 欧州勢参入、だまし |
| NY AM | 13:30-16:00 | 08:30-11:00 | 最大流動性 |
| NY PM | 18:30-21:00 | 13:30-16:00 | 反転が起きやすい |

---

#### `defineSession(name, startHour, startMinute, endHour, endMinute)`

カスタムセッション定義を作成するファクトリ関数。

```typescript
const preMarket = defineSession('Pre-Market', 9, 0, 13, 30);
```

---

#### `detectSessions(candles, sessions?)`

各ローソク足がどのセッションに属するかを判定し、セッションOHLCを追跡します。

```typescript
const sessionData = detectSessions(candles);
const i = sessionData.length - 1; // 現在バーのインデックス
const bar = sessionData[i].value;
if (bar.inSession) {
  console.log(`セッション ${bar.session}、ここまでの高値: ${bar.sessionHigh}`);
}
```

**戻り値:** `Series<SessionInfo>`

```typescript
interface SessionInfo {
  session: string | null;       // セッション名（全セッション外はnull）
  inSession: boolean;           // 定義されたセッション内かどうか
  barIndex: number;             // 現在セッション内のバーインデックス（0始まり）
  sessionOpen: number | null;   // セッション始値
  sessionHigh: number | null;   // ここまでのセッション高値
  sessionLow: number | null;    // ここまでのセッション安値
}
```

---

#### `sessionStats(candles, options?)`

ルックバック期間にわたるセッション別の集計統計を計算します。

```typescript
const stats = sessionStats(candles, { lookback: 20 });
stats.forEach(s => {
  console.log(`${s.session}: avgRange=${s.avgRange.toFixed(2)}, bullish=${(s.bullishPercent * 100).toFixed(0)}%`);
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `sessions` | `SessionDefinition[]` | ICTセッション | セッション定義 |
| `lookback` | `number` | `20` | 分析するセッション出現回数 |

**戻り値:** `SessionStatsValue[]`

```typescript
interface SessionStatsValue {
  session: string;        // セッション名
  avgRange: number;       // セッション出現あたりの平均レンジ
  avgVolume: number;      // セッション出現あたりの平均出来高
  bullishPercent: number; // 陽線（close > open）の割合
  barCount: number;       // 全出現通算のバー数
}
```

---

#### `getIctKillZones()`

UTCでの標準ICTキルゾーン4つを特徴説明付きで返します。

```typescript
const zones = getIctKillZones();
// [{ name: 'Asian KZ', ..., characteristic: 'Range formation, accumulation' }, ...]
```

| キルゾーン | UTC時刻 | 特徴 |
|-----------|----------|---------------|
| Asian KZ | 00:00-05:00 | レンジ形成、アキュミュレーション |
| London Open KZ | 07:00-09:00 | だまし、ストップ狩り、初動 |
| NY Open KZ | 12:00-14:00 | 最大流動性、最も強い値動き |
| London Close KZ | 15:00-17:00 | 反転、利益確定 |

---

#### `killZones(candles, zones?)`

各ローソク足がキルゾーン内かどうかを判定します。

```typescript
const kz = killZones(candles);
const i = kz.length - 1; // 現在バーのインデックス
if (kz[i].value.inKillZone) {
  console.log(`${kz[i].value.zone} 内: ${kz[i].value.characteristic}`);
}
```

**戻り値:** `Series<KillZoneValue>`

```typescript
interface KillZoneValue {
  zone: string | null;             // キルゾーン名（外ならnull）
  inKillZone: boolean;             // いずれかのキルゾーン内かどうか
  characteristic: string | null;   // 期待される値動きの説明
}
```

---

#### `sessionBreakout(candles, options?)`

直近の完了セッションのレンジ上抜け/下抜けを検出します。

```typescript
const breakouts = sessionBreakout(candles);
const i = breakouts.length - 1; // 現在バーのインデックス
if (breakouts[i].value.breakout === 'above') {
  console.log(`${breakouts[i].value.fromSession} の高値 ${breakouts[i].value.rangeHigh} を上抜け`);
}
```

**戻り値:** `Series<SessionBreakoutValue>`

```typescript
interface SessionBreakoutValue {
  fromSession: string | null;             // 直前セッション名
  breakout: 'above' | 'below' | null;    // ブレイクアウト方向
  rangeHigh: number | null;              // 直前セッション高値
  rangeLow: number | null;               // 直前セッション安値
}
```

---

### HMMレジーム検出

確率的な市場レジーム分類のための隠れマルコフモデル。外部依存ゼロの純TypeScript実装（Baum-Welch / Viterbi）。

#### `hmmRegimes(candles, options?)`

ガウシアンHMMで市場レジームを検出。特徴量（リターン、ボラティリティ、出来高比率、レンジ、実体比率）を抽出し、EMでモデルをフィットして最尤状態系列をデコードします。

```typescript
const regimes = hmmRegimes(candles, { numStates: 3, seed: 42 });
const current = regimes[regimes.length - 1].value;
console.log(`レジーム: ${current.label}, P=${current.probabilities}`);
// レジーム: "trending-up", P=[0.02, 0.08, 0.90]
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `numStates` | `number` | `3` | レジーム状態数 |
| `maxIterations` | `number` | `100` | EMの最大反復回数 |
| `seed` | `number` | `42` | 再現性のための乱数シード |
| `numRestarts` | `number` | `5` | 局所最適回避のランダム再スタート回数 |
| `featureOptions` | `FeatureOptions` | `{}` | 特徴量抽出の設定 |

**特徴量オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `returnLookback` | `number` | `1` | リターン計算のルックバック |
| `volatilityWindow` | `number` | `20` | ローリングボラティリティのウィンドウ |
| `volumeWindow` | `number` | `20` | 出来高比率のウィンドウ |

**戻り値:** `Series<HmmRegimeValue>`

```typescript
interface HmmRegimeValue {
  regime: number;           // レジームインデックス（0始まり）
  label: string;            // "trending-up" | "ranging" | "trending-down"（3状態時）
  probabilities: number[];  // この時点での状態確率
  logLikelihood: number;    // フィット済みモデルの対数尤度
}
```

**ラベル（3状態モデル）:** 状態は平均リターンでソート — 最低 = "trending-down"、中間 = "ranging"、最高 = "trending-up"。N ≠ 3 の場合、ラベルは "state-0"、"state-1" など。

---

#### `fitHmm(candles, options?)`

デコードせずにHMMをフィット — 分析用の学習済みモデルを返します。

```typescript
const model = fitHmm(candles, { numStates: 3 });
console.log(`対数尤度: ${model.logLikelihood}`);
console.log(`収束: ${model.converged}`);
```

**戻り値:** `HmmModel`

```typescript
interface HmmModel {
  numStates: number;
  pi: number[];                    // 初期状態確率
  transitionMatrix: number[][];    // A[i][j] = P(state j | state i)
  emissionMeans: number[][];       // means[state][feature]
  emissionVariances: number[][];   // variances[state][feature]
  logLikelihood: number;
  converged: boolean;
}
```

---

#### `regimeTransitionMatrix(model, labels?)`

フィット済みモデルから遷移分析を抽出します。

```typescript
const model = fitHmm(candles);
const info = regimeTransitionMatrix(model);
console.log(`期待継続期間: ${info.expectedDurations}`);
console.log(`定常分布: ${info.stationaryDistribution}`);
```

**戻り値:** `RegimeTransitionInfo`

```typescript
interface RegimeTransitionInfo {
  matrix: number[][];             // 遷移確率行列
  labels: string[];               // 各状態のラベル
  expectedDurations: number[];    // 各状態の期待滞在バー数: 1 / (1 - 自己遷移確率)
  stationaryDistribution: number[]; // 長期的な状態確率
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

**戻り値:** `Series<boolean>`（クロスが発生したバーでtrue）

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
| `short` | `number` | `5` | 短期MA期間 |
| `long` | `number` | `25` | 長期MA期間 |

**戻り値:** `Series<boolean>` （バックテスト条件版は `goldenCrossCondition`/`deadCrossCondition`）

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
  score: number;               // 品質スコア (0-100)
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

### CVDダイバージェンス

#### `cvdDivergence(candles, options)`

価格とCumulative Volume Delta（CVD）のダイバージェンスを検出。内部で `detectDivergence()` を使用します。

```typescript
const signals = cvdDivergence(candles);
const bullish = signals.filter(s => s.type === 'bullish');
// 強気: 価格は安値更新、CVDは安値切り上げ → 買い圧力の蓄積
const bearish = signals.filter(s => s.type === 'bearish');
// 弱気: 価格は高値更新、CVDは高値切り下げ → 売り圧力の蓄積
```

---

**オプション（全ダイバージェンス関数共通）:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `swingLookback` | `number` | `5` | スイングポイント検出の参照期間 |
| `minSwingDistance` | `number` | `5` | スイング間の最小バー数 |
| `maxSwingDistance` | `number` | `60` | スイング間の最大バー数 |
| `kinds` | `DivergenceClass[]` | `['regular']` | 検出するダイバージェンス種別（`['regular','hidden']` でヒドゥンも検出） |

**戻り値:** `DivergenceSignal[]`

```typescript
interface DivergenceSignal {
  time: number;                  // 2番目のピボットの時刻（注記用。判断時刻ではない）
  confirmedAt: number;           // ダイバージェンスが実時間で判明する最初のバーの時刻
  confirmedIdx: number;          // confirmedAt のバーのインデックス
  type: 'bullish' | 'bearish';  // bullish: 強気, bearish: 弱気
  kind: 'regular' | 'hidden';   // regular: レギュラー（反転）/ hidden: ヒドゥン（継続）
  firstIdx: number;              // 最初のスイングポイントのインデックス
  secondIdx: number;             // 2番目のスイングポイントのインデックス
  price: { first: number; second: number };
  indicator: { first: number; second: number };
}
```

ピボットは発生から `swingLookback` 本後にならないと特定できないため、`time`
（2番目のピボット）はその時点では知り得ません。`confirmedAt` / `confirmedIdx`
はダイバージェンスを実際に行動に移せる最初のバー（価格側とインジケーター側の
ピボットの遅い方 + `swingLookback`）を指します。エントリー・アラート・他シグナル
との時刻合わせなど、因果性が必要な用途ではこちらを使ってください。

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

#### `rangeBound(candles, options?)`

レンジ相場（ボックス相場）を検出。複数の指標を組み合わせて、トレンドのない横ばい期間を識別します。

```typescript
const rb = rangeBound(candles, { persistBars: 3 });
```

**オプション:**

| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `dmiPeriod` | `number` | `14` | DMI/ADX期間 |
| `bbPeriod` | `number` | `20` | ボリンジャーバンド期間 |
| `donchianPeriod` | `number` | `20` | ドンチャンチャネル期間 |
| `atrPeriod` | `number` | `14` | ATR期間 |
| `adxWeight` | `number` | `0.50` | ADXスコアの重み |
| `bandwidthWeight` | `number` | `0.20` | バンド幅スコアの重み |
| `donchianWeight` | `number` | `0.20` | ドンチャン幅スコアの重み |
| `atrWeight` | `number` | `0.10` | ATRスコアの重み |
| `adxThreshold` | `number` | `20` | この値未満のADX = レンジ |
| `adxTrendThreshold` | `number` | `25` | この値超のADX = トレンド |
| `rangeScoreThreshold` | `number` | `70` | レンジ検出のスコア閾値 |
| `tightRangeThreshold` | `number` | `85` | タイトレンジ判定のスコア閾値 |
| `breakoutRiskZone` | `number` | `0.1` | 境界付近のブレイクアウトリスクゾーン（10%） |
| `persistBars` | `number` | `3` | 確定に必要なバー数 |
| `lookbackPeriod` | `number` | `100` | パーセンタイル計算のルックバック |
| `priceMovementPeriod` | `number` | `20` | 価格変動計算の期間 |
| `priceMovementThreshold` | `number` | `0.05` | 5%の価格変動 = トレンド |
| `diDifferenceThreshold` | `number` | `10` | トレンド判定の+DI/-DI差分 |
| `slopeThreshold` | `number` | `0.15` | 回帰傾き閾値（ATR比） |
| `consecutiveHHLLThreshold` | `number` | `3` | トレンド判定の連続HH/LL回数 |
| `hhllLookback` | `number` | `10` | HH/LL検出のルックバック |

**戻り値:** `Series<RangeBoundValue>`

**RangeBoundValueのプロパティ:**

| プロパティ | 型 | 説明 |
|----------|------|-------------|
| `state` | `RangeBoundState` | 現在の状態 |
| `rangeScore` | `number` | 複合スコア（0-100） |
| `confidence` | `number` | 信頼度（0-1） |
| `persistCount` | `number` | 現在の状態の連続バー数 |
| `isConfirmed` | `boolean` | persistCount >= persistBars でtrue |
| `rangeDetected` | `boolean` | イベント: レンジ条件を初検出 |
| `rangeConfirmed` | `boolean` | イベント: レンジを初確定 |
| `breakoutRiskDetected` | `boolean` | イベント: ブレイクアウトリスクを初検出 |
| `rangeBroken` | `boolean` | イベント: レンジからトレンドへの転換 |
| `adx` | `number \| null` | ADX値 |
| `rangeHigh` | `number \| null` | レンジ上限 |
| `rangeLow` | `number \| null` | レンジ下限 |
| `pricePosition` | `number \| null` | レンジ内の位置（0=下限、1=上限） |
| `trendReason` | `TrendReason` | トレンド判定の理由（デバッグ用） |

**RangeBoundStateの値:**

| 状態 | 説明 |
|-------|-------------|
| `NEUTRAL` | データ不足または混在シグナル |
| `RANGE_FORMING` | レンジ条件が出始めた |
| `RANGE_CONFIRMED` | persistBars経過後にレンジ確定 |
| `RANGE_TIGHT` | 非常にタイトなレンジ |
| `BREAKOUT_RISK_UP` | 価格が上限付近 |
| `BREAKOUT_RISK_DOWN` | 価格が下限付近 |
| `TRENDING` | トレンド中 |

**TrendReasonの値:**

| 理由 | 説明 |
|--------|-------------|
| `adx_high` | ADX >= adxTrendThreshold |
| `price_movement` | 価格変動 >= 閾値 |
| `di_diff` | +DI/-DI差分 >= 閾値 |
| `slope` | 回帰傾き >= 閾値 |
| `hhll` | 連続HHまたはLL >= 閾値 |
| `null` | トレンドではない |

**例:**

```typescript
import { rangeBound } from 'trendcraft';

const rb = rangeBound(candles);
const latest = rb[rb.length - 1].value;

// 現在の状態をチェック
console.log(`状態: ${latest.state}`);
console.log(`スコア: ${latest.rangeScore}/100`);

// レンジ境界をチェック
if (latest.rangeHigh && latest.rangeLow && latest.pricePosition !== null) {
  console.log(`レンジ: ${latest.rangeLow} - ${latest.rangeHigh}`);
  console.log(`位置: ${(latest.pricePosition * 100).toFixed(0)}%`);
}

// トレンド判定のデバッグ
if (latest.trendReason) {
  console.log(`トレンド理由: ${latest.trendReason}`);
}
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
  type: 'breakout';
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
  minRSquared: 0.3
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|------|
| `period` | `number` | `10` | 回帰計算期間 |
| `minSlope` | `number` | `0.05` | 最小正規化傾き（5%/日） |
| `minConsecutiveDays` | `number` | `3` | 最小連続日数 |
| `minRSquared` | `number` | `0.3` | 回帰品質の最小R² |

**戻り値:** `VolumeAccumulationSignal[]`

```typescript
interface VolumeAccumulationSignal {
  time: number;
  type: 'volume_accumulation';
  volume: number;          // 現在の出来高
  slope: number;           // 回帰の生の傾き
  normalizedSlope: number; // 正規化傾き（slope / 平均出来高、minSlope と比較される値）
  rSquared: number;        // R²品質スコア
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
| `minRatio` | `number` | `1.0` | クロス確定に必要な短期MA/長期MAの最小比率 |
| `bullishOnly` | `boolean` | `true` | 強気（上抜け）クロスのみ検知 |

**戻り値:** `VolumeMaCrossSignal[]`

```typescript
interface VolumeMaCrossSignal {
  time: number;
  type: 'volume_ma_cross';
  volume: number;                    // 現在の出来高
  shortMa: number;
  longMa: number;
  direction: 'bullish' | 'bearish';  // bullish: 短期MAが長期MAを上抜け
  ratio: number;                     // 短期MA / 長期MA
  daysSinceCross: number;            // クロス以降の連続日数
}
```

**注意:** デフォルトでは `bullishOnly: true` のため強気（上抜け）クロスのみ検知されます。弱気クロスも得るには `bullishOnly: false` を指定してください。

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
| `maxDistance` | `number` | `40` | ピーク/ボトム間の最大バー数 |
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
  console.log(`H&S発生 ${new Date(p.time)}, ネックライン: ${p.pattern.neckline?.currentPrice}`);
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

#### `detectTriangle(candles, options)`

対称・上昇・下降トライアングルパターンをOLSトレンドラインフィッティングで検出。

```typescript
import { detectTriangle } from 'trendcraft';

const patterns = detectTriangle(candles);
patterns.forEach(p => {
  console.log(`${p.type}, 信頼度: ${p.confidence}, 目標: ${p.pattern.target}`);
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `swingLookback` | `number` | `3` | スイングポイント検出ルックバック |
| `minPoints` | `number` | `2` | トレンドラインあたりの最小ポイント数 |
| `minRSquared` | `number` | `0.6` | トレンドラインフィット品質の最小R² |
| `flatTolerance` | `number` | `0.0003` | 水平判定の傾き閾値 |
| `minBars` | `number` | `15` | パターン形成の最小バー数 |
| `maxBreakoutBars` | `number` | `20` | ブレイクアウト検索の最大バー数 |

---

#### `detectWedge(candles, options)`

ライジングウェッジ（弱気）とフォーリングウェッジ（強気）パターンを検出。

```typescript
import { detectWedge } from 'trendcraft';

const patterns = detectWedge(candles);
const fallingWedges = patterns.filter(p => p.type === 'falling_wedge');
```

**オプション:** `detectTriangle`と同様（`flatTolerance`を除く）。ただし `minPoints` のデフォルトは `3`（トレンドラインあたり3タッチ）。

---

#### `detectChannel(candles, options)`

上昇・下降・水平チャネルパターンを検出。

```typescript
import { detectChannel } from 'trendcraft';

const patterns = detectChannel(candles);
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `swingLookback` | `number` | `3` | スイングポイント検出ルックバック |
| `minRSquared` | `number` | `0.6` | トレンドラインフィットの最小R² |
| `flatTolerance` | `number` | `0.0003` | 水平判定の傾き閾値 |
| `parallelTolerance` | `number` | `0.0003` | 平行判定の傾き差の最大値 |
| `minBars` | `number` | `20` | パターン形成の最小バー数 |

---

#### `detectFlag(candles, options)`

フラッグ・ペナント継続パターン（フラッグポール＋コンソリデーション）を検出。

```typescript
import { detectFlag } from 'trendcraft';

const patterns = detectFlag(candles);
const bullFlags = patterns.filter(p => p.type === 'bull_flag');
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `swingLookback` | `number` | `2` | スイングポイント検出ルックバック |
| `minAtrMultiple` | `number` | `2.0` | フラッグポールの最小サイズ（ATR倍数） |
| `maxPoleBars` | `number` | `8` | フラッグポールの最大バー数 |
| `minConsolidationBars` | `number` | `5` | コンソリデーションの最小バー数 |
| `maxConsolidationBars` | `number` | `20` | コンソリデーションの最大バー数 |

---

#### `filterPatterns(patterns, candles, options)`

パターンシグナルにコンテキストフィルタ（ATR比率、トレンド方向、ボリューム）を適用。

```typescript
import { doubleTop, filterPatterns } from 'trendcraft';

const raw = doubleTop(candles);
const filtered = filterPatterns(raw, candles, {
  minATRRatio: 2.0,
  trendContext: true,
  minConfidence: 60,
});
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `minATRRatio` | `number` | `1.5` | パターン高さ/ATRの最小比率 |
| `volumeConfirm` | `boolean` | `true` | ボリューム確認を要求 |
| `trendContext` | `boolean` | `true` | トレンド方向の整合性チェック |
| `minConfidence` | `number` | `50` | フィルタ後の最低信頼度 |

---

#### パターンシグナル構造

すべてのパターン検出関数は `PatternSignal[]` を返します：

```typescript
interface PatternSignal {
  time: number;              // パターン完成時刻（最終構造ピボット）
  detectableTime: number;    // リアルタイムで形成が判明する最初のバー
                             // （最終ピボット + swingLookback 確定バー）
  confirmTime?: number;      // ブレイクアウト確認が判明する最初のバー
                             // （confirmed が true の場合のみ設定）
  type: PatternType;         // 'double_top' | 'double_bottom' | 'head_shoulders' など
  pattern: {
    startTime: number;       // パターン開始
    endTime: number;         // パターン終了
    keyPoints: PatternKeyPoint[];  // キーポイント（ピーク、トラフ、ネックライン）
    neckline?: PatternNeckline;    // H&Sパターン用
    target?: number;         // 目標価格（メジャードムーブ）
    stopLoss?: number;       // 推奨ストップロス
    height?: number;          // パターン高さ（メジャードムーブ計算用、省略される場合あり）
  };
  confidence: number;        // 0-100 信頼度スコア
  confirmed: boolean;        // ブレイクアウト発生時true
  breakoutDirection?: "up" | "down"; // 実際のブレイク方向（triangle / channel / wedge）
}
```

| パターンタイプ | 方向 | 確認条件 |
|--------------|------|---------|
| `double_top` | 弱気 | 中間トラフを下抜け |
| `double_bottom` | 強気 | 中間ピークを上抜け |
| `head_shoulders` | 弱気 | ネックラインを下抜け |
| `inverse_head_shoulders` | 強気 | ネックラインを上抜け |
| `cup_handle` | 強気 | カップリムを上抜け |
| `triangle_symmetrical` | 中立 | トレンドラインを上抜けまたは下抜け |
| `triangle_ascending` | 強気 | 水平レジスタンスを上抜け |
| `triangle_descending` | 弱気 | 水平サポートを下抜け |
| `rising_wedge` | 弱気 | 下側トレンドラインを下抜け |
| `falling_wedge` | 強気 | 上側トレンドラインを上抜け |
| `channel_ascending` | 中立 | チャネルを上抜けまたは下抜け |
| `channel_descending` | 中立 | チャネルを上抜けまたは下抜け |
| `channel_horizontal` | 中立 | チャネルを上抜けまたは下抜け |
| `bull_flag` | 強気 | コンソリデーションを上抜け |
| `bear_flag` | 弱気 | コンソリデーションを下抜け |
| `bull_pennant` | 強気 | ペナントを上抜け |
| `bear_pennant` | 弱気 | ペナントを下抜け |

---

## バックテスト

### バックテスト実行

#### `runBacktest(candles, entryCondition, exitCondition, options)`

過去データでバックテストを実行。

```typescript
import { runBacktest, goldenCrossCondition, deadCrossCondition } from 'trendcraft';

const result = runBacktest(
  candles,
  goldenCrossCondition(5, 25),  // エントリー: ゴールデンクロス
  deadCrossCondition(5, 25),    // イグジット: デッドクロス
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
| `sizing` | `BacktestSizingConfig` | `{ method: 'full-capital' }` | エントリーごとのポジションサイジング（下記参照） |

#### ポジションサイジング

デフォルトでは各エントリーで利用可能な資金を全額投入します。`sizing`
オプションを指定すると、エントリーごとにサイズを計算します。ストリーミングの
ポジションマネージャーと同じ手法・同じ計算を使うため、バックテストとライブで
戦略のサイジングが一致します:

```typescript
// 5%ストップに対して現在資金の1%をリスクに取る
const result = runBacktest(candles, entry, exit, {
  capital: 1_000_000,
  stopLoss: 5,
  sizing: { method: 'risk-based', riskPercent: 1 },
});
```

| メソッド | 設定 | 動作 |
|----------|------|------|
| `'full-capital'` | — | 全額投入（デフォルト、従来動作） |
| `'fixed-fractional'` | `fractionPercent` | 現在資金の固定割合を投入 |
| `'risk-based'` | `riskPercent` | 設定済みストップ（`stopLoss` または `atrRisk.atrStopMultiplier`）に対して資金の一定割合をリスクに取る。ストップ未設定時は full-capital にフォールバック |
| `'atr-based'` | `riskPercent`, `atrMultiplier?` (2), `atrPeriod?` (14) | ATR由来のストップ距離に対してリスクを取る。ATRウォームアップ中のエントリーはスキップ |
| `'kelly'` | `winRate`, `winLossRatio`, `kellyFraction?` (0.5), `maxKellyPercent?` (25) | ユーザー指定の統計値によるケリー基準。エッジがない場合はエントリーをスキップ |
| `'custom'` | `calculate(ctx)` | エントリーごとのコールバック。`BacktestSizingContext`（現在資金、エントリー価格、全額投入時の株数、ATR、約定済みトレード）を受け取り株数を返す。0を返すとスキップ |

リスク量は常に現在の（複利の）現金資金を基準に計算され、結果は買付余力に
クランプされます。`margin` 設定時は `risk-based` / `atr-based` が買付余力
上限までレバレッジを使えます。株数は端数のまま扱われ、`volumeConstraint`
とも併用可能（より厳しい制限が優先）。使用したサイジング設定は再現性のため
`result.settings.sizing` に丸ごと記録されます（`custom` はメソッド名のみ）。
Strategy JSON では `backtest.sizing` に `custom` 以外のメソッドを指定
できます（コールバックはシリアライズ不可のため）。

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
  maxDrawdown: number;               // 最大ドローダウン: equityCurve の最大下落率 (%)
  sharpeRatio: number;               // シャープレシオ（エクイティカーブから年率化）
  sortinoRatio: number;              // ソルティノレシオ（年率化・下方偏差ベース）
  calmarRatio: number;               // CAGR ÷ 最大ドローダウン
  cagrPercent: number;               // 年平均成長率 (%)
  expectancyPercent: number;         // 1取引あたり平均リターン (%)
  exposurePercent: number;           // 市場エクスポージャー: ポジション保有時間比率 (%)
  avgWinPercent: number;             // 平均勝ちトレード (%)
  avgLossPercent: number;            // 平均負けトレード (%, 正の値)
  largestWinPercent: number;         // 最大勝ちトレード (%)
  largestLossPercent: number;        // 最大負けトレード (%, 正の値)
  firstBarTime: number;              // 最初のローソク足時刻 (エポックms)
  lastBarTime: number;               // 最後のローソク足時刻 (エポックms)
  profitFactor: number;              // プロフィットファクター
  avgHoldingDays: number;            // 平均保有日数
  trades: Trade[];                   // 取引詳細
  settings: BacktestSettings;        // 使用した設定（再現性のため）
  drawdownPeriods: DrawdownPeriod[]; // 個別ドローダウン期間
  equityCurve?: number[];            // ローソク足終値ごとの時価評価資産額
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
  direction?: PositionDirection; // ポジション方向（デフォルト: "long"）
  stopLoss?: number;           // ストップロス (%)
  takeProfit?: number;         // 利確 (%)
  trailingStop?: number;       // トレーリングストップ (%)
  slippage: number;            // スリッページ (%)
  commission: number;          // 固定手数料/取引
  commissionRate: number;      // 手数料率 (%)
  taxRate: number;             // 利益への税率 (%)
  sizing?: BacktestSizingConfigJSON | { method: "custom" }; // 使用したサイジング設定
}

interface Trade {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  return: number;
  returnPercent: number;
  holdingDays: number;
  direction?: PositionDirection; // ポジション方向（デフォルト: "long"）
  isPartial?: boolean;           // 部分利確による決済の場合 true
  exitPercent?: number;          // 元ポジションのうち今回売却した割合 (%)
  exitReason?: ExitReason;       // 決済理由
  mfe?: number;                  // 最大含み益 (%)
  mae?: number;                  // 最大含み損 (%)
  mfeUtilization?: number;       // 実現リターン ÷ MFE
}
```

---

### プリセット条件

#### 移動平均クロス

```typescript
goldenCrossCondition(shortPeriod = 5, longPeriod = 25)  // 短期MAが長期MAを上抜け
deadCrossCondition(shortPeriod = 5, longPeriod = 25)    // 短期MAが長期MAを下抜け
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
weeklyUptrend(adxThreshold = 20)    // 週足 +DI > -DI かつ ADX > 閾値（DMI/ADXベース）
weeklyDowntrend(adxThreshold = 20)  // 週足 -DI > +DI かつ ADX > 閾値（DMI/ADXベース）
mtfUptrend(timeframe, adxThreshold = 20)    // MTF上昇トレンド（+DI > -DI かつ ADX > 閾値）
mtfDowntrend(timeframe, adxThreshold = 20)  // MTF下降トレンド（-DI > +DI かつ ADX > 閾値）

// 強いトレンド（ADXベース）
weeklyTrendStrong(adxThreshold = 25)   // 週足ADX > 閾値
monthlyTrendStrong(adxThreshold = 25)  // 月足ADX > 閾値
mtfTrendStrong(timeframe, adxThreshold = 25)  // MTF ADX > 閾値

// カスタムMTF条件
mtfCondition(requiredTimeframes, name, evaluate)  // MTFデータでのカスタム条件（例: mtfCondition(['weekly'], 'myCond', (mtf, indicators, candle, index, candles) => boolean)）
```

**Fluent APIでの使用:**

```typescript
import { TrendCraft, weeklyRsiAbove, goldenCrossCondition, deadCrossCondition, and } from 'trendcraft';

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

RS条件は株式のパフォーマンスをベンチマークと比較します。ベンチマークのローソク足を `benchmark` バックテストオプションで渡します。

```typescript
import { rsAbove, rsRising, rsRatingAbove, and } from 'trendcraft';

const entry = and(
  rsAbove(1.0),       // ベンチマークをアウトパフォーム
  rsRising(),         // RS上昇トレンド
  rsRatingAbove(80),  // 過去比較で上位20%
);

// `benchmark` オプションでベンチマークを渡す
runBacktest(candles, entry, exit, {
  capital: 1000000,
  benchmark: sp500Candles,
});
```

ベンチマークは run ごとの入力なので、RS 条件を使う実行では毎回渡します。最適化時
（同じ candles・同じベンチマークで `IndicatorCache` を共有）は、派生 RS シリーズが
引き続きキャッシュされ再利用されます。

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
| `anyBullishPattern(options)` | 任意の強気パターン |
| `anyBearishPattern(options)` | 任意の弱気パターン |
| `patternConfidenceAbove(type, min, options)` | パターン信頼度 > 閾値 |
| `anyPatternConfidenceAbove(min, options)` | 任意のパターンで信頼度 > 閾値 |
| `patternWithinBars(type, lookback, options)` | 直近Nバー以内でパターン検出 |
| `doubleTopDetected(options)` | ダブルトップパターン |
| `doubleBottomDetected(options)` | ダブルボトムパターン |
| `headShouldersDetected(options)` | ヘッドアンドショルダーパターン |
| `inverseHeadShouldersDetected(options)` | 逆ヘッドアンドショルダーパターン |
| `cupHandleDetected(options)` | カップ・ウィズ・ハンドルパターン |
| `triangleDetected(subtype?, options)` | トライアングルパターン（全体またはサブタイプ指定） |
| `wedgeDetected(subtype?, options)` | ウェッジパターン（全体またはサブタイプ指定） |
| `channelDetected(subtype?, options)` | チャネルパターン（全体またはサブタイプ指定） |
| `flagDetected(subtype?, options)` | フラッグ/ペナントパターン（全体またはサブタイプ指定） |
| `bullFlagDetected(options)` | ブルフラッグパターン |
| `bearFlagDetected(options)` | ベアフラッグパターン |

---

### 条件の組み合わせ

論理演算子で複数条件を組み合わせ。

```typescript
import { and, or, not, goldenCrossCondition, rsiBelow, rsiAbove, deadCrossCondition } from 'trendcraft';

// エントリー: ゴールデンクロス AND RSI < 30
const entry = and(goldenCrossCondition(), rsiBelow(30));

// イグジット: デッドクロス OR RSI > 70
const exit = or(deadCrossCondition(), rsiAbove(70));

// エントリー: 買われすぎではない
const notOverbought = not(rsiAbove(70));

// 複雑な条件
const complexEntry = and(
  goldenCrossCondition(),
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

const result = runBacktest(candles, customCondition, deadCrossCondition(), { capital: 1000000 });
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

### 価格ソースヘルパー

正規化済みローソク足から特定の価格フィールドを取り出す純関数。`source?: PriceSource` オプションを持つインジケーターは内部でこれらを呼んでいるため、自前のリターン計算・回帰・フィルタなど **`source` を受け付けない処理に価格列を渡すとき** にだけ直接使う。

#### `getPrice(candle, source)`

1本の正規化済みローソク足から1つの価格値を取り出す。

```typescript
import { normalizeCandle, getPrice } from 'trendcraft';

const c = normalizeCandle({ time: '2024-01-01', open: 99, high: 102, low: 98, close: 101, volume: 1000 });
getPrice(c, 'close');  // 101
getPrice(c, 'hl2');    // 100        ((102 + 98) / 2)
getPrice(c, 'hlc3');   // 100.333... ((102 + 98 + 101) / 3)
getPrice(c, 'ohlc4');  // 100        ((99 + 102 + 98 + 101) / 4)
getPrice(c, 'volume'); // 1000
```

#### `getPriceSeries(candles, source)`

正規化済みローソク足配列から価格系列(`number[]`)を取り出す。実装は `candles.map((c) => getPrice(c, source))` と同等。

```typescript
import { normalizeCandles, getPriceSeries } from 'trendcraft';

const normalized = normalizeCandles(candles);
const closes = getPriceSeries(normalized, 'close');
const typical = getPriceSeries(normalized, 'hlc3');
```

**`source` オプションとの使い分け:**
- `source` オプションを持つインジケーター → 直接 `source: 'hlc3'` を渡す。事前抽出は不要
- 価格に対する自前計算（リターン、回帰、独自フィルタ等）→ `getPriceSeries` で `number[]` を取得
- コールバック内で1点だけ価格を取り出したい → `getPrice`

ストリーミング(incremental)側では `incremental.getSourcePrice(candle, source)` が同等の役割を果たす。`createSma` / `createRsi` などの `source` オプションが内部で呼んでいる。

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
- ショートハンド: `'1m'` / `'5m'` / `'15m'` / `'30m'` / `'1h'` / `'4h'` / `'1d'`（`'daily'`）/ `'1w'`（`'weekly'`）/ `'1M'`（`'monthly'`）
- または `{ value, unit }` 形式の `Timeframe` オブジェクト（unit: `'minute' | 'hour' | 'day' | 'week' | 'month'`）
- 例: `resample(hourlyCandles, '4h')` で1時間足 → 4時間足

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

**戻り値:** `ScoreBreakdown`

```typescript
interface ScoreBreakdown extends ScoreResult {
  contributions: SignalContribution[];
}

interface SignalContribution {
  name: string;
  displayName: string;
  rawValue: number;     // 0-1
  score: number;        // rawValue * weight
  weight: number;
  isActive: boolean;
  category?: string;
}
```

---

#### `calculateScoreSeries(candles, config, startIndex?, context?)`

全ローソク足のスコアを計算（チャート表示に便利）。

```typescript
const series = calculateScoreSeries(candles, config);
// [{ time: 1234567890, score: ScoreResult }, ...]
```

---

### スコアリングプリセット

一般的なトレーディングスタイル向けの事前設定済みスコアリング戦略。

```typescript
import { getPreset, listPresets } from 'trendcraft';

const config = getPreset('trendFollowing');
const available = listPresets();  // ['momentum', 'meanReversion', 'trendFollowing', 'balanced', 'aggressive', 'conservative']
```

| プリセット | フォーカス | 閾値 (S/M/W) | 説明 |
|------------|------------|--------------|------|
| `momentum` | RSI, MACD, Stoch | 70/50/30 | モメンタム重視 |
| `meanReversion` | 売られすぎシグナル | 75/55/35 | 押し目買い戦略 |
| `trendFollowing` | PO, 出来高 | 70/50/30 | トレンドフォロー |
| `balanced` | 混合 | 70/50/30 | バランス型 |
| `aggressive` | 低閾値 | 60/40/25 | 積極型（低スコア閾値） |
| `conservative` | 高閾値 | 80/60/40 | 保守型（高スコア閾値） |

**ファクトリ関数:**

```typescript
import {
  createMomentumPreset,
  createMeanReversionPreset,
  createTrendFollowingPreset,
  createBalancedPreset,
  createAggressivePreset,      // 低閾値: 60/40/25
  createConservativePreset,    // 高閾値: 80/60/40
} from 'trendcraft';
```

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
  maxPositionPercent: 25,   // 口座の最大25%
  minShares: 1,
  roundShares: true,
  direction: 'long',        // 'long' | 'short'
});

// 結果:
// {
//   shares: 500,
//   positionValue: 25000,
//   riskAmount: 1000,
//   riskPercent: 1,
//   stopPrice: 48,
//   method: 'risk-based'
// }
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
  direction: 'long',
});

// stopPrice: 45 (50 - 2.5 * 2)
// shares: 200 (1000 / 5)
```

**ユーティリティ関数:**

```typescript
import { calculateAtrStopDistance, recommendedAtrMultiplier } from 'trendcraft';

const stopDistance = calculateAtrStopDistance(2.5, 2);  // 5
const multiplier = recommendedAtrMultiplier('conservative');  // 3
```

---

### Kelly基準

勝率とペイオフ比率に基づく最適なベットサイジング。

```typescript
import { kellySize, calculateKellyPercent } from 'trendcraft';

// 最適Kellyパーセンテージを計算
const kellyPct = calculateKellyPercent(0.6, 1.5);  // 勝率60%、勝敗比1.5
// 33.3%（Kelly = winRate - (1 - winRate) / winLossRatio）

const result = kellySize({
  accountSize: 100000,
  entryPrice: 50,
  winRate: 0.6,
  winLossRatio: 1.5,
  kellyFraction: 0.5,     // ハーフKelly（より安全）
  maxKellyPercent: 25,    // 上限25%
});
```

---

### 固定比率

シンプルな固定比率配分。

```typescript
import { fixedFractionalSize, maxPositions, fractionForPositionCount } from 'trendcraft';

const result = fixedFractionalSize({
  accountSize: 100000,
  entryPrice: 50,
  fractionPercent: 10,      // 1ポジションあたり10%
  maxPositionPercent: 20,   // 上限
});

// ユーティリティ関数
const positions = maxPositions(100000, 10);  // 10%で10ポジション
const fraction = fractionForPositionCount(5);  // 5ポジションなら20%
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
import { atrStops } from 'trendcraft';

const stops = atrStops(candles, {
  period: 14,
  stopMultiplier: 2.5,
  takeProfitMultiplier: 4.0,
});

const latest = stops[stops.length - 1].value;
// {
//   atr, stopDistance, takeProfitDistance,
//   longStopLevel, longTakeProfitLevel,
//   shortStopLevel, shortTakeProfitLevel,
// }
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `period` | `number` | `14` | ATR期間 |
| `stopMultiplier` | `number` | `2.0` | ストップ距離のATR倍率 |
| `takeProfitMultiplier` | `number` | `3.0` | 利確距離のATR倍率 |

**バックテスト連携:**

```typescript
const result = runBacktest(candles, entry, exit, {
  capital: 1000000,
  atrRisk: {
    atrPeriod: 14,
    atrStopMultiplier: 2.5,
    atrTakeProfitMultiplier: 4.0,
    atrTrailingMultiplier: 2.0,
    useEntryAtr: true,  // エントリー時ATRを使用（動的でなく）
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
import {
  regimeIs, regimeNot, atrPercentAbove, and,
  goldenCrossCondition, rsiBelow, perfectOrderBullish,
} from 'trendcraft';

// 低ボラティリティ環境でのみエントリー
const lowVolEntry = and(
  regimeIs('low'),
  rsiBelow(30)
);

// 極端なボラティリティを避ける
const calmEntry = and(
  regimeNot('extreme'),
  goldenCrossCondition()
);

// トレンドフォロー用にATR%でフィルタ（ボラタイルな銘柄のみ）
const volatileEntry = and(
  atrPercentAbove(2.3),
  perfectOrderBullish()
);
```

---

## 最適化

### `gridSearch(candles, strategyFactory, paramRanges, options)`

最適な戦略パラメータのグリッドサーチ。

```typescript
import { gridSearch, param, constraint, goldenCrossCondition, deadCrossCondition } from 'trendcraft';

const result = gridSearch(
  candles,
  (params) => ({
    entry: goldenCrossCondition(params.short, params.long),
    exit: deadCrossCondition(params.short, params.long),
  }),
  [
    param('short', 5, 20, 5),
    param('long', 25, 75, 25),
  ],
  {
    metric: 'sharpe',
    constraints: [
      constraint('winRate', '>=', 40),
      constraint('maxDrawdown', '<=', 30),
    ],
  }
);

// results[] はベスト順にソート済み。上位 10 件は .slice(0, 10) で取得
const top10 = result.results.slice(0, 10);
console.log('最適パラメータ:', result.results[0].params);
console.log('シャープレシオ:', result.results[0].metrics.sharpe);
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `metric` | `OptimizationMetric` | `'sharpe'` | 最適化対象の指標 |
| `constraints` | `OptimizationConstraint[]` | `[]` | 結果をフィルタする制約条件 |
| `maxCombinations` | `number` | `10000` | テストするパラメータ組み合わせの最大数 |

**指標:** `'sharpe' | 'calmar' | 'mar' | 'profitFactor' | 'recoveryFactor' | 'returns' | 'winRate' | 'tradeCount' | 'maxDrawdown'`

**戻り値:** `GridSearchResult`

```typescript
interface GridSearchResult {
  results: OptimizationResultEntry[];
  totalCombinations: number;
  validCombinations: number;
  /** 制約を満たす組み合わせがない場合は null */
  bestParams: Record<string, number> | null;
  /** 制約を満たす組み合わせがない場合は null */
  bestScore: number | null;
  metric: OptimizationMetric;
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
    windowSize: 252,   // 学習ウィンドウ（日足で約1年）
    stepSize: 63,      // 約1四半期ずつ前進
    testSize: 63,      // アウト・オブ・サンプル検証期間（約1四半期）
    metric: 'sharpe',
  }
);

// aggregateMetrics.avgOutOfSample は指標ごとのレコード。periods[] に各ウィンドウが入る
console.log('OOS シャープ:', result.aggregateMetrics.avgOutOfSample.sharpe);
console.log('安定性:', result.aggregateMetrics.stabilityRatio);
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `windowSize` | `number` | `252` | 学習ウィンドウのサイズ（ローソク足本数） |
| `stepSize` | `number` | `63` | ウィンドウ間のステップサイズ（ローソク足本数） |
| `testSize` | `number` | `63` | アウト・オブ・サンプル検証期間のサイズ（ローソク足本数） |
| `purgeBars` | `number` | `0` | 学習とテストの間のパージギャップ（両ウィンドウから除外）。指標のlookbackや複数バーにまたがる出口ラベルが境界越しにリークするのを防ぐ。最長の指標期間/保有期間に合わせる。`anchoredWalkForwardAnalysis` でも利用可 |
| `metric` | `OptimizationMetric` | `'sharpe'` | 最適化する指標 |

---

### `pbo(returnsMatrix, options)`

CSCV（組合せ対称交差検証）によるバックテスト過学習確率（PBO）。
「イン・サンプルで最良のパラメーターを選んだとき、それがアウト・オブ・
サンプルで中央値を下回る頻度はどれだけか？」に答えます（正準の λ < 0
基準。タイは平均ランクを取るため、ちょうど中央値の勝者は過学習でなく
中立として扱います）。

```typescript
import { pbo } from 'trendcraft';

// comboReturns[t][n] = n番目のパラメーター組み合わせの期間tのリターン
const result = pbo(comboReturns, { blocks: 10 });

console.log(`PBO: ${(result.pbo * 100).toFixed(1)}%`);   // 50%以上 → 選択は偶然と同等
console.log(`評価したsplit数: ${result.combinations}`);   // C(10, 5) = 252
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `blocks` | `number` | `10` | 連続行ブロック数S（偶数）。C(S, S/2)通りのsplitを評価（S ≤ 20） |
| `metric` | `(returns: number[]) => number` | per-return Sharpe | 組み合わせごとのランキング指標 |

結果にはsplitごとのOOSランクlogitが含まれ、分布として可視化できます。
`pboSafe` はthrowせず `Result` を返します。`deflatedSharpe`（選択バイアス
込みの有意性）、`wfeRatio`（OOS効率）と併用してください — 3つは過学習の
異なる側面に答えます。

> **注:** 行列の構築は現状呼び出し側の責任です — 全組み合わせを同一の
> 期間グリッドで評価する必要があります（例: 組み合わせごとに `runBacktest`
> を実行し、揃ったper-barのequityリターンを導出）。grid-search結果から
> 行列を構築するadapterは今後提供予定です。

---

### `minTrackRecordLength(observedSharpe, benchmarkSharpe?, confidence?, skewness?, kurtosis?)`

`probabilisticSharpe` の厳密な逆関数: 観測Sharpeがベンチマークと統計的に
区別できるようになるまでに必要な最小観測数（デフォルト信頼度 0.95）。
Sharpeがベンチマークを超えない場合は `Infinity` を返します。

```typescript
import { minTrackRecordLength } from 'trendcraft';

// per-return Sharpe 0.1 — PSR(0) ≥ 95% に必要なバー数は？
const bars = Math.ceil(minTrackRecordLength(0.1)); // ≈ 273 （minTrackRecordLength(0.1) ≈ 272.9）
```

---

### JSON ファーストの最適化

手書きの `strategyFactory` の代わりに、シリアライズした `StrategyJSON` とパス指定のパラメーター範囲から同じ `gridSearch` / `walkForwardAnalysis` エンジンを駆動します。返される `bestParams` のキーはパス（例: `entry.0.params.period`）なので、そのまま `applyParamOverrides` に渡せます。登録済みのクロスパラメーター制約は param フィルターに AND され、構造的に無効な組み合わせはバックテスト前にスキップされます。

```typescript
import {
  gridSearchFromJSON,
  walkForwardAnalysisFromJSON,
  backtestRegistry,
  type PathParameterRange,
} from 'trendcraft';

const ranges: PathParameterRange[] = [
  { path: 'entry.0.params.period', min: 10, max: 30, step: 5 },
];

const grid = gridSearchFromJSON(candles, strategyJson, ranges, backtestRegistry, {
  metric: 'sharpe',
});

const wf = walkForwardAnalysisFromJSON(candles, strategyJson, ranges, backtestRegistry, {
  windowSize: 252,
  stepSize: 63,
  testSize: 63,
});
```

**シグネチャ:**

```typescript
function gridSearchFromJSON(
  candles: NormalizedCandle[],
  strategy: StrategyJSON,
  ranges: PathParameterRange[],
  registry: ConditionRegistry<Condition>,
  options?: GridSearchOptions,
): GridSearchResult;

function walkForwardAnalysisFromJSON(
  candles: NormalizedCandle[],
  strategy: StrategyJSON,
  ranges: PathParameterRange[],
  registry: ConditionRegistry<Condition>,
  options?: WalkForwardOptions,
): WalkForwardResult;
```

いずれも範囲パスが解決できない場合（不正な形式、範囲外のリーフ、未知または数値でない param）に throw します。`gridSearchFromJSONSafe` / `walkForwardAnalysisFromJSONSafe` は同じ引数を取り、throw せず `Result<…>` を返します（検証エラー → `INVALID_PARAMETER`、過大なグリッド → `TOO_MANY_COMBINATIONS`、短すぎるスライス → `INSUFFICIENT_DATA`、それ以外 → `OPTIMIZATION_FAILED`）。

---

### ウォークフォワードユーティリティ

```typescript
import { wfeRatio, stitchOosEquity } from 'trendcraft';

// 期間ごとのウォークフォワード効率（OOS年率 / IS年率）の平均。
// イン・サンプルのリターンが非正の期間はスキップされ、未定義のときは NaN を返す。
const wfe = wfeRatio(wf);
if (Number.isFinite(wfe) && wfe >= 0.5) console.log(`堅牢: WFE ${(wfe * 100).toFixed(0)}%`);

// 各期間のアウトオブサンプルトレードを 1 本の連続エクイティカーブに連結する。
// トレード 1 件につき 1 点（先頭に最初の期間の testStart のアンカー点を追加）。
const curve = stitchOosEquity(wf, 100_000); // -> Array<{ time: number; equity: number }>
```

`wfeRatio(result: WalkForwardResult): number` および `stitchOosEquity(result: WalkForwardResult, initialCapital = 100000)`。

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
  metric: 'sharpe',
});

// 探索が何も選ばなかった場合は null
if (result.bestResult === null) {
  console.log('組合せが選ばれなかった');
} else {
  console.log(result.bestResult.entryConditions, result.bestResult.metrics.sharpe);
}

// results[] はベスト順にソート済み。上位 20 件は .slice(0, 20) で取得
result.results.slice(0, 20).forEach((r) => {
  console.log(`エントリー: ${r.entryConditions.join(' + ')}, イグジット: ${r.exitConditions.join(' + ')}`);
  console.log(`シャープ: ${r.metrics.sharpe}`);
});
```

`result.bestResult` は勝った組合せそのもの。探索が何も選ばなかった場合は `null` になる（すべての組合せが制約に違反した / 取引が発生しなかった / スコアが非有限だった — Calmar・MAR・Recovery は最大ドローダウンが 0 のとき `NaN`）。「探索が何か見つけたか」を曖昧さなく表すのはこのフィールドで、`bestEntry` / `bestExit` / `bestScore` はその射影。代わりに `bestEntry.length === 0` を判定してはいけない。`minEntryConditions: 0`（または required 条件だけで下限を満たす場合）では空のエントリー組合せが正当な候補になり、それが勝つことがある。非有限スコアは `results` と `validCombinations` から除外される（`keepAllResults` 指定時のみ保持され、末尾にソートされる）。

---

### 最適化メトリクス

```typescript
import {
  calculateSharpeRatio,
  calculateCalmarRatio,
  calculateRecoveryFactor,
  annualizeReturn,
  calculateAllMetrics,
  extractTradeReturns
} from 'trendcraft';

// 個別メトリクスを計算
const sharpe = calculateSharpeRatio(dailyReturns, riskFreeRate);
const calmar = calculateCalmarRatio(annualizedReturnPercent, maxDrawdownPercent);
const recovery = calculateRecoveryFactor(netProfit, maxDrawdown);

// 全メトリクスを一度に計算（年率化のため candles が必須）
const metrics = calculateAllMetrics(backtestResult, candles);

// バックテスト結果からトレードごとのリターン（小数）を取得
const tradeReturns = extractTradeReturns(backtestResult); // number[]
```

`extractTradeReturns(result: BacktestResult): number[]` は各トレードの `returnPercent` を小数に変換します。

---

### `deflatedSharpe(params)` / `deflatedSharpeFromReturns(returns, trialSharpes)`

Deflated Sharpe Ratio —選択バイアス（N 試行）、非正規性、サンプル長を補正した後に、選択された戦略の真の Sharpe が正である確率。`[0, 1]` の確率を返し、~0.95 を超える値は Sharpe が多重検定のアーティファクトである可能性が低いことを示します。すべての Sharpe 入力は per-return（非年率化）単位である必要があります。

```typescript
import { deflatedSharpe, deflatedSharpeFromReturns, extractTradeReturns } from 'trendcraft';

// パラメーター明示形式
const dsr = deflatedSharpe({
  observedSharpe: 0.12,       // 選択された戦略の per-return Sharpe
  sampleSize: 500,            // リターン観測数（T >= 2）
  trials: 50,                 // 評価した独立構成の数（N）
  trialSharpeVariance: 0.0025,// N 試行にわたる per-return Sharpe の分散
  skewness: 0,                // 任意。デフォルト 0
  kurtosis: 3,                // 任意。デフォルト 3（非超過）
});
console.log(dsr < 0.95 ? 'オーバーフィットの可能性' : '信頼できるエッジ');

// 簡便形式: observedSharpe / sampleSize / skewness / kurtosis を `returns` から、
// trials / variance を `trialSharpes` から導出します。両配列は同じ per-return
// 単位である必要があります。未定義のとき（例: リターンが 2 未満）は NaN を返します。
const returns = extractTradeReturns(bestResult);
const dsr2 = deflatedSharpeFromReturns(returns, trialSharpes);
```

---

### モンテカルロシミュレーション

#### `runMonteCarloSimulation(result, options)`

トレードリストをリサンプリングして、バックテスト結果がどれだけ信頼できるかを推定します。

```typescript
import { runMonteCarloSimulation, formatMonteCarloResult } from 'trendcraft';

const mcResult = runMonteCarloSimulation(backtestResult, {
  simulations: 1000,
  seed: 42,
  confidenceLevel: 0.95,
  method: 'bootstrap',   // デフォルト。シーケンスリスクのみ見るなら 'shuffle'
  ruinThreshold: 50,     // 「破産」とみなすドローダウン（%）
});

console.log(formatMonteCarloResult(mcResult));

// ダウンサイドリスクをチェック
console.log('利益確率:', mcResult.downside.probProfit);
console.log('破産リスク:', mcResult.downside.riskOfRuin);
```

**仕組み:**

2つのリサンプリング手法があります（`method` オプション）:
1. `"bootstrap"`（デフォルト）: N件のトレードを復元抽出します。同じトレードが複数回現れたり、まったく現れなかったりするため、トータルリターン・Sharpe・プロフィットファクターがシミュレーションごとに変動します。結果の不確実性推定（リターン分布、損失確率、破産リスク）の基礎となります。
2. `"shuffle"`: 既存のトレードを並べ替えます（非復元）。リターンの多重集合は変わらないため、リターン・Sharpe・プロフィットファクターはシミュレーション間で同一となり、経路依存の最大ドローダウンのみが変動します。シーケンスリスク（連敗の偏り）の分析に使います。

各シミュレーションはリサンプリングしたトレードからエクイティカーブを再構築し、Sharpe・最大ドローダウン・トータルリターン・プロフィットファクターを再計算します。結果はこれらのメトリクスの分布に加え、`downside` サマリー（利益/損失確率、破産リスク）を返します。二値の有意性フラグはありません — `downside` の数値が判定結果です。

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `simulations` | `number` | `1000` | シミュレーション回数 |
| `seed` | `number` | `undefined` | 再現性のためのシード値 |
| `confidenceLevel` | `number` | `0.95` | 信頼区間レベル（0.90, 0.95, 0.99） |
| `method` | `"bootstrap" \| "shuffle"` | `"bootstrap"` | リサンプリング手法（「仕組み」参照） |
| `ruinThreshold` | `number` | `50` | `riskOfRuin` で「破産」とみなすドローダウン（正の%） |
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
  simulationCount: number;
  downside: {
    probProfit: number;    // 利益で終わったシミュレーションの割合
    probLoss: number;      // 損失で終わった割合 = 1 - probProfit
    riskOfRuin: number;    // 最大ドローダウンが ruinThreshold に達した割合
    ruinThreshold: number; // 破産しきい値として使ったドローダウン（%）
  };
  confidenceInterval: {
    sharpe: { lower: number; upper: number };
    returns: { lower: number; upper: number };
    maxDrawdown: { lower: number; upper: number };
  };
  assessment: {
    reason: string;          // 手法別の人間可読な解釈
    confidenceLevel: number;
  };
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
import { summarizeMonteCarloResult, calculateStatistics } from 'trendcraft';

// サマリー取得
const summary = summarizeMonteCarloResult(mcResult);
console.log(summary.probProfit);   // 0.92（利益となったリサンプルの割合）
console.log(summary.riskOfRuin);   // 0.03（破産しきい値に達した割合）
console.log(summary.sharpe95CI);   // { lower: 0.4, upper: 1.8 }

// 任意の配列の統計値を計算
const stats = calculateStatistics([1, 2, 3, 4, 5]);
console.log(stats.mean);    // 3
console.log(stats.median);  // 3
```

---

### Anchored Walk-Forward分析 (AWF)

#### `anchoredWalkForwardAnalysis(candles, entryConditions, exitConditions, options)`

固定起点から訓練期間を拡張するウォークフォワード分析。長期的な戦略の堅牢性を検証します。

```typescript
import { anchoredWalkForwardAnalysis, formatAWFResult } from 'trendcraft';

const awfResult = anchoredWalkForwardAnalysis(
  candles,
  entryConditions,
  exitConditions,
  {
    anchorDate: new Date('2015-01-01').getTime(),
    initialTrainSize: 504,   // 約2年
    expansionStep: 252,      // 1年ずつ拡張
    testSize: 252,           // 1年テスト
    metric: 'sharpe',
  }
);

console.log(formatAWFResult(awfResult));
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
| `initialTrainSize` | `number` | `504` | 初期訓練期間（バー数、約2年） |
| `expansionStep` | `number` | `252` | 拡張ステップ（バー数） |
| `testSize` | `number` | `252` | テスト期間（バー数） |
| `metric` | `OptimizationMetric` | `'sharpe'` | 最適化する指標 |
| `constraints` | `OptimizationConstraint[]` | `[]` | 制約条件 |

**戻り値:** `AWFResult`

```typescript
interface AWFResult {
  periods: AWFPeriod[];              // 組合せが選ばれた period
  skippedPeriods: AWFSkippedPeriod[]; // 何も選ばれず、テストされなかった period
  aggregateMetrics: {
    avgInSample: Record<OptimizationMetric, number>;
    avgOutOfSample: Record<OptimizationMetric, number>;
    stabilityRatio: number;      // OOS / IS パフォーマンス比率
    oosReturnStdDev: number;     // OOS リターンのボラティリティ
  };
  stabilityAnalysis: {
    conditionFrequency: Record<string, number>;  // 条件の出現率（%）
    stableEntryConditions: string[];   // 50%超の期間で出現
    stableExitConditions: string[];
    consistencyScore: number;          // 0-100
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
  trainCandleCount: number;
  testStart: number;
  testEnd: number;
  testCandleCount: number;
  bestEntryConditions: string[];
  bestExitConditions: string[];
  inSampleMetrics: Record<OptimizationMetric, number>;
  outOfSampleMetrics: Record<OptimizationMetric, number>;
  testBacktest: BacktestResult;
}

interface AWFSkippedPeriod {
  periodNumber: number;
  trainStart: number;
  trainEnd: number;
  trainCandleCount: number;
  testStart: number;
  testEnd: number;
  testCandleCount: number;
  combinationsTested: number;
  reason: string;
}
```

**何も選ばれなかった period:** 学習ウィンドウが組合せをひとつも選べないことがある（すべての候補が制約に違反した / 取引が発生しなかった / スコアが非有限だった — Calmar 系は最大ドローダウンが 0 のとき `NaN` になる）。その period は `skippedPeriods` に記録され、**アウトオブサンプルのバックテストは行われない**ため、`aggregateMetrics` / `stabilityAnalysis` / `recommendation` には一切寄与しない。`periodNumber` は全境界に通し番号で振られるので、`skippedPeriods` が空でないとき `periods` の番号は飛ぶ。どの period も組合せを選べなかった場合は throw する（`anchoredWalkForwardAnalysisSafe` は `OPTIMIZATION_FAILED` を返す）。

**ヘルパー関数:**

```typescript
import {
  generateAWFBoundaries,
  calculateAWFPeriodCount,
  summarizeAWFResult,
  getAWFEquityCurve
} from 'trendcraft';

// 期間数の事前計算（位置引数）
const anchorDate = new Date('2015-01-01').getTime();
const anchorIndex = candles.findIndex((c) => c.time >= anchorDate);
const count = calculateAWFPeriodCount(candles.length, anchorIndex, 504, 252, 252);
// オプションオブジェクトから求める場合: generateAWFBoundaries(candles, awfOptions).length

// フル分析を実行せずに期間境界を取得
const boundaries = generateAWFBoundaries(candles, awfOptions);

// サマリー取得
const summary = summarizeAWFResult(awfResult);
console.log(summary.stabilityRatio);        // 0.72（ISパフォーマンスの72%）
console.log(summary.profitablePeriods);     // 4（5期間中）
console.log(summary.recommendedEntry);      // ['gc', 'stochUp']

// OOS結果からエクイティカーブを取得
const curve = getAWFEquityCurve(awfResult, 1000000);
// [{ time: ..., equity: 1050000, periodNumber: 1 }, ...]
```

---

## 分割エントリー

### `runBacktestScaled(candles, entry, exit, options)`

分割エントリー戦略でのバックテスト。一度に全ポジションを建てる代わりに、資金を複数のトランシェに分割します。

結果には `runBacktest` と同じ時価評価ベースの `equityCurve` / `maxDrawdown` / `drawdownPeriods` が含まれます。未エントリーのトランシェ向けに留保している資金もエクイティとして数えるため、損失としては現れません。

```typescript
import { runBacktestScaled, goldenCrossCondition, deadCrossCondition } from 'trendcraft';

const result = runBacktestScaled(candles, goldenCrossCondition(), deadCrossCondition(), {
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
| `strategy` | `'equal' \| 'pyramid' \| 'reverse-pyramid'` | 必須 | 配分戦略 |
| `intervalType` | `'signal' \| 'price'` | 必須 | 追加エントリーのトリガー方法 |
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

**2トランシェ以上で未対応のオプション:**

マルチトランシェ経路は `runBacktest` とは別のエンジンで、そのオプションの一部しか実装していません。`scaledEntry.tranches >= 2` の場合、以下は黙って無視されるのではなくエラーになります:

`direction`, `atrTrailingStop`, `breakevenStop`, `scaleOut`, `timeExit`, `slippageModel`, `orderType`, `orderTTL`, `timeInForce`, `volumeConstraint`, `margin`, `sizing`, `fundamentals`, `validateData`

`ScaledBacktestOptions` 型はこれらを受け付けたままです。有効になるかどうかは `scaledEntry.tranches` という値に依存し、型では表現できないためです。使用したい場合は `runBacktest` を直接呼ぶか、`tranches: 1` で実行してください（`runBacktest` に委譲され、すべてのオプションが有効になります）。

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
import { streaming } from "trendcraft";
const { createCandleAggregator } = streaming;

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
import { streaming } from "trendcraft";
const { createCandleResampler } = streaming;

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
import { streaming } from "trendcraft";
const { createCrossOverDetector } = streaming;

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
import { streaming } from "trendcraft";
const { createCrossUnderDetector } = streaming;

const crossUnder = createCrossUnderDetector();
crossUnder.next(20, 10); // false（初回呼び出し）
crossUnder.next(9, 10);  // true （クロスアンダー発生）
```

メソッドは `createCrossOverDetector` と同じです。

---

#### `createThresholdDetector(threshold, fromState?)`

値が固定の閾値を上回ったり下回ったりしたことを検出します。

```typescript
import { streaming } from "trendcraft";
const { createThresholdDetector } = streaming;

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
import { streaming } from "trendcraft";
const { createSqueezeDetector } = streaming;

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
import { streaming } from "trendcraft";
const { createDivergenceDetector } = streaming;

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
import { streaming } from "trendcraft";
const { and, rsiBelow, smaGoldenCross } = streaming;

const entry = and(rsiBelow(30), smaGoldenCross());
```

---

#### `or(...conditions)`

OR論理で条件を組み合わせます（いずれかがtrueであればよい）。

```typescript
import { streaming } from "trendcraft";
const { or, rsiAbove, smaDeadCross } = streaming;

const exit = or(rsiAbove(70), smaDeadCross());
```

---

#### `not(condition)`

条件を否定します。

```typescript
import { streaming } from "trendcraft";
const { not, rsiAbove } = streaming;

const notOverbought = not(rsiAbove(70));
```

---

#### `evaluateStreamingCondition(condition, snapshot, candle)`

ストリーミング条件をスナップショットとキャンドルに対して評価します。

```typescript
import { streaming } from "trendcraft";
const { evaluateStreamingCondition } = streaming;

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
import { streaming } from "trendcraft";

// スナップショットの値は `unknown`（各インジケーターの snapshot 名がキー）
// のため、比較前にナローイングする。
const customCondition: streaming.StreamingConditionFn = (snapshot, candle) => {
  const rsi = snapshot.rsi as number | null;
  return candle.close > 100 && rsi !== null && rsi < 50;
};
```

---

### Layer 4: パイプライン & MTF

#### `createPipeline(options, fromState?)`

インクリメンタルなインジケーターとストリーミング条件を組み合わせてシグナル評価パイプラインを構築します。キャンドル1本あたりO(1)のコストで処理します。

```typescript
import { streaming } from "trendcraft";
const { createPipeline, rsiBelow, rsiAbove } = streaming;
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
import { streaming } from "trendcraft";
const { createStreamingMtf } = streaming;
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
import { streaming } from "trendcraft";
const { createTradingSession, rsiBelow, rsiAbove } = streaming;
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
import { streaming } from "trendcraft";
const { createRiskGuard } = streaming;

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
import { streaming } from "trendcraft";
const { createTimeGuard } = streaming;

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
import { streaming } from "trendcraft";
const { createGuardedSession, rsiBelow, rsiAbove } = streaming;
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
import { streaming } from "trendcraft";
const { createPositionTracker } = streaming;

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
import { streaming } from "trendcraft";
const { createManagedSession, rsiBelow, rsiAbove } = streaming;
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
const tradeSignals = signals.map(s => fromCrossSignal(s, candles.find(c => c.time === s.time)?.close)); // entryPrice は省略可能なので signals.map(s => fromCrossSignal(s)) でも可
// { action: "BUY", direction: "LONG", confidence: 85, ... }
```

#### `fromDivergenceSignal(signal, entryPrice?)`

```typescript
import { fromDivergenceSignal } from 'trendcraft';

const divSignals = rsiDivergence(candles);
// `confirmedAt`（ダイバージェンスが判明するバー）の時刻でスタンプされるため、
// エントリー価格もピボットではなくそのバーから取る
const tradeSignals = divSignals.map(s => fromDivergenceSignal(s, candles[s.confirmedIdx].close));
```

#### `fromSqueezeSignal(signal, direction?, entryPrice?)`

```typescript
import { fromSqueezeSignal } from 'trendcraft';

const squeezes = bollingerSqueeze(candles);
const tradeSignals = squeezes.map(s => fromSqueezeSignal(s, "LONG", candles.find(c => c.time === s.time)?.close)); // entryPrice は省略可能なので squeezes.map(s => fromSqueezeSignal(s)) でも可
```

#### `fromPatternSignal(signal, entryPrice?)`

パターンの`target`と`stopLoss`を`TradeSignal.prices`にマッピング。シグナルの時刻は
パターンが行動可能になるバー（confirmed なら `confirmTime`、そうでなければ
`detectableTime`）でスタンプされます。`PatternSignal.time` が指すピボットのバーでは
ありません（ピボット時刻は `metadata.patternTime` に保持）。

方向は `resolvePatternDirection` に従います。検出器が記録したブレイク方向
（`PatternSignal.breakoutDirection`）があればそれを優先し、無ければ形状の
`PATTERN_BIAS` を使います。下抜けした `channel_ascending` は SELL となり、検出器が
測定した `target` / `stopLoss` と整合します。`null` を返すのは、どちらでも方向が
決まらない場合——未ブレイクの中立形状——のみです。中立は `triangle_symmetrical` と
channel 3種（`channel_ascending` / `channel_descending` / `channel_horizontal`）で、
チャネルは両側を取引するレンジであり傾き自体は方向を決めないためです。

```typescript
import { fromPatternSignal, type TradeSignal } from 'trendcraft';

const patterns = doubleBottom(candles);
const tradeSignals = patterns
  .map(p => fromPatternSignal(p, 100))
  .filter((s): s is TradeSignal => s !== null);
// { prices: { entry: 100, takeProfit: 120, stopLoss: 90 }, ... }
```

#### `fromScoreResult(score, time, options?)`

`ScoreBreakdown`を`TradeSignal`に変換。閾値未満の場合`null`を返す。

```typescript
import { fromScoreResult } from 'trendcraft';

const breakdown = calculateScoreBreakdown(candles, candles.length - 1, config); // config: ScoringConfig（例: { signals: [...] }）
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
import { createRsi } from 'trendcraft/incremental';

const { createSignalEmitter, rsiBelow, rsiAbove } = streaming;

const emitter = createSignalEmitter({
  intervalMs: 60000,
  pipeline: {
    indicators: [{ name: 'rsi14', create: () => createRsi({ period: 14 }) }],
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
import { processSignalsBatch, type TradeSignal } from 'trendcraft';

const allSignals: TradeSignal[] = [/* バックテストのシグナル */];
const filtered = processSignalsBatch(allSignals, { cooldown: { bars: 3 } });
// 3バー以内の重複シグナルを除去
```

---

## ショートセリング

TrendCraftはバックテスト・ストリーミング両方でショートポジションをサポート。ショート関連フィールドはすべてオプショナルで、`direction`未指定時は`"long"`がデフォルト（完全後方互換）。

### バックテストでのショート

バックテストオプションに`direction: "short"`を指定。

```typescript
import { runBacktest, deadCrossCondition, goldenCrossCondition } from 'trendcraft';

const result = runBacktest(
  candles,
  deadCrossCondition(5, 25),     // エントリー: デッドクロス（ショートイン）
  goldenCrossCondition(5, 25),   // イグジット: ゴールデンクロス（ショートアウト）
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

tracker.openPosition(100, 1000, currentTime); // (価格, 株数, 時刻) の順

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
import { batchBacktest, portfolioBacktest, deadCrossCondition, goldenCrossCondition } from 'trendcraft';

// バッチバックテスト: direction をオプションに直接指定
const batchResult = batchBacktest(datasets, deadCrossCondition(5, 25), goldenCrossCondition(5, 25), {
  capital: 3_000_000,
  direction: 'short',
  stopLoss: 5,
  takeProfit: 10,
});

// ポートフォリオバックテスト: direction は tradeOptions 内に指定
const portfolioResult = portfolioBacktest(datasets, deadCrossCondition(5, 25), goldenCrossCondition(5, 25), {
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
  and, rsiAbove, rsiBelow, bollingerTouch, deadCrossCondition, goldenCrossCondition,
  dmiBearish, anyBearishPattern, stochAbove, stochBelow, runBacktest,
} from 'trendcraft';

// ミーンリバージョンショート: 買われすぎからの反転
const mrEntry = and(rsiAbove(70), bollingerTouch('upper'));
const mrExit  = rsiBelow(50);

// トレンドフォローショート: 下落トレンド確認
const tfEntry = and(deadCrossCondition(5, 25), dmiBearish());
const tfExit  = goldenCrossCondition(5, 25);

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

`PatternSignal[]` 用の便利ラッパー。方向は `resolvePatternDirection` に従うため、形状と逆にブレイクしたパターンは実際に解決した方向で測定される。方向がまだ決まらないシグナルは、恣意的な方向で採点せず射影から除外される。

```typescript
import { projectFromPatterns, doubleTop } from 'trendcraft';

const tops = doubleTop(candles);
const projection = projectFromPatterns(candles, tops); // bearish として下方向に測定
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
- **独自インジケーター**: 130以上の組み込みインジケーターに含まれない独自の計算式がある場合
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

// 動的なプラグイン選択 — 各ステップが自身のプラグインをクロージャで保持する
// ため、異種リストでもプラグインごとのオプション型チェックが維持される
const steps = [
  (t: TrendCraft) => t.use(plugins.sma),
  (t: TrendCraft) => t.use(plugins.rsi),
];
let tc: TrendCraft = TrendCraft.from(candles);
for (const step of steps) {
  tc = step(tc);
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

## シグナル説明性

シグナルが発火した理由をトレースし、どのインジケーターが寄与したか、その値、どの条件が成立/不成立だったかを人間が読めるナラティブ付きで提供します。

### `explainSignal(candles, index, entryCondition, exitCondition, options?, mtfContext?)`

特定のローソク足インデックスでシグナル評価を説明します。エントリーとイグジットの両条件をトレースします。

```typescript
import { explainSignal, rsiBelow, rsiAbove, and, goldenCrossCondition } from "trendcraft";

const entry = and(goldenCrossCondition(), rsiBelow(40));
const exit = rsiAbove(70);

const explanation = explainSignal(candles, 50, entry, exit);
console.log(explanation.fired);          // true/false
console.log(explanation.signalType);     // "entry" | "exit"
console.log(explanation.narrative);      // 人間が読めるテキスト
console.log(explanation.contributions);  // リーフ条件の詳細
console.log(explanation.trace);          // 完全な条件ツリー
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `includeValues` | `boolean` | `true` | トレースにインジケーター値を含める |
| `maxDepth` | `number` | `10` | 最大トレース再帰深度 |
| `language` | `'en' \| 'ja'` | `'en'` | ナラティブの出力言語 |

**戻り値:** `SignalExplanation`（`signalType`, `fired`, `time`, `candle`, `trace`, `contributions`, `narrative` を含む）

### `explainCondition(candles, index, condition, options?, mtfContext?)`

単一の条件評価をトレースします。

```typescript
import { explainCondition, rsiBelow } from "trendcraft";

const trace = explainCondition(candles, 50, rsiBelow(30));
console.log(trace.passed);          // true/false
console.log(trace.indicatorValues); // { rsi14: 28.5 }
```

**戻り値:** `ConditionTrace`（`name`, `passed`, `indicatorValues`, `reason`, `type`, `children?` を含む）

### `traceCondition(condition, indicators, candle, index, candles, mtfContext?, options?, depth?)`

低レベルの条件トレース。結合条件（and/or/not）を再帰的にトレースし、インジケーターキャッシュの状態をキャプチャします。

### `generateNarrative(trace, signalType, fired, candle, language?)`

条件トレースから人間が読めるナラティブ文字列を生成します。英語と日本語に対応。

```typescript
const narrative = generateNarrative(trace, "entry", true, candle, "ja");
// => "エントリーシグナルは終値=150で発火しました。rsiBelow(30): 成立 (rsi14 = 28.5)"
```

---

## 合成可能なインジケーター代数

`pipe()`、`compose()`、およびアダプター関数によるインジケーター計算のチェーニングを提供します。`Candle[]`を受け取るインジケーターと`Series<T>`を返すインジケーターを橋渡しします。

### `pipe(source, ...transforms)`

値を一連の変換関数に通します。

```typescript
import { pipe, through, extractField, rsi, ema, macd, bollingerBands } from "trendcraft";

// RSIのEMA
const smoothedRsi = pipe(
  candles,
  c => rsi(c, { period: 14 }),
  through(ema, { period: 9 }),
);

// MACDヒストグラムのボリンジャーバンド
const bbOfHist = pipe(
  candles,
  c => macd(c),
  s => extractField(s, "histogram"),
  through(bollingerBands, { period: 20 }),
);
```

### `compose(...fns)`

複数の変換を単一の関数に合成します（右から左の順序）。

```typescript
import { compose, applyIndicator, rsi, ema } from "trendcraft";

const smoothedRsi = compose(
  (s: Series<number|null>) => applyIndicator(s, ema, { period: 9 }),
  (c: NormalizedCandle[]) => rsi(c, { period: 14 }),
);
const result = smoothedRsi(candles);
```

### `through(indicator, options?)`

`pipe()`で使用するインジケーターステップを作成します。Seriesをローソク足に変換してインジケーターを適用します。

### `applyIndicator(series, indicator, options?)`

ローソク足を期待するインジケーター関数を`Series<number|null>`に適用します。内部的に`seriesToCandles`経由で変換します。

### `seriesToCandles(series, options?)`

`Series<number|null>`を擬似`NormalizedCandle[]`に変換してインジケーター関数の入力として使用します。非nullの値はOHLC全てに同じ値が入り、`null`は全価格が0になります。オプション: `fillMode` — open/high/lowに何を入れるか: シリーズの値（`"value"`、デフォルト）または0（`"zero"`）。`close`は常にシリーズの値を持ちます。

### `extractField(series, field)`

複合シリーズから数値フィールドを抽出して`Series<number|null>`を作成します。

```typescript
const histogram = extractField(macd(candles), "histogram");
```

### `mapValues(series, fn)`

シリーズの値を変換関数でマッピングします。

```typescript
const normalized = mapValues(rsiSeries, v => v !== null ? v / 100 : null);
```

### `combineSeries(a, b, fn)`

2つのシリーズをインデックスごとにポイント単位で結合します。

```typescript
const spread = combineSeries(seriesA, seriesB, (a, b) =>
  a !== null && b !== null ? a - b : null
);
```

---

## アルファ減衰モニター

戦略の予測力が時間とともに劣化するかを、ローリングIC（情報係数）、ヒットレート、CUSUM構造的ブレーク検出で追跡します。

### `analyzeAlphaDecay(observations, options?)`

シグナル/リターン観測のシーケンスからアルファ減衰を分析します。

```typescript
import { analyzeAlphaDecay, createObservationsFromTrades } from "trendcraft";

const observations = createObservationsFromTrades(result.trades);
const decay = analyzeAlphaDecay(observations);

console.log(decay.assessment.status);      // "healthy" | "warning" | "degraded" | "critical"
console.log(decay.assessment.reason);      // 人間が読める評価
console.log(decay.assessment.currentIC);   // 現在の情報係数
console.log(decay.assessment.halfLife);     // 推定半減期（バー数、またはnull）
console.log(decay.rollingIC);              // ローリングICシリーズ
console.log(decay.rollingHitRate);         // ローリングヒットレートシリーズ
console.log(decay.breaks);                 // CUSUM構造的ブレークポイント
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `window` | `number` | `60` | ローリングウィンドウサイズ |
| `cusumThreshold` | `number` | `4.0` | CUSUM検出閾値 |
| `minObservations` | `number` | `30` | 必要な最小観測数 |

### `createObservationsFromTrades(trades)`

バックテストのトレードを減衰観測に変換します。

### `createObservationsFromScores(scores, candles, forwardBars?)`

シグナルスコアとローソク足データからの実際の先行リターンをペアリングします。

```typescript
const observations = createObservationsFromScores(scoreSeries, candles, 5);
const decay = analyzeAlphaDecay(observations);
```

### `spearmanCorrelation(x, y)`

Spearman順位相関係数（p値付き）。

**戻り値:** `{ rho: number, pValue: number }`

---

## 適応型インジケーター

市場状況（ボラティリティ、トレンド強度）に基づいてパラメーターを動的に調整するインジケーターです。

### `adaptiveRsi(candles, options?)`

市場ボラティリティに基づいてピリオドが適応するRSI。高ボラティリティでは短いピリオド（高速応答）、低ボラティリティでは長いピリオド（スムーズ）を使用します。

```typescript
import { adaptiveRsi } from "trendcraft";

const result = adaptiveRsi(candles, { basePeriod: 14, minPeriod: 6, maxPeriod: 28 });
result.forEach(p => console.log(`RSI: ${p.value.rsi}, Period: ${p.value.effectivePeriod}`));
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `basePeriod` | `number` | `14` | ベースRSIピリオド |
| `minPeriod` | `number` | `6` | 最小ピリオド（高ボラティリティ） |
| `maxPeriod` | `number` | `28` | 最大ピリオド（低ボラティリティ） |
| `atrPeriod` | `number` | `14` | ボラティリティ測定用ATRピリオド |
| `volLookback` | `number` | `100` | 正規化用ボラティリティルックバック |

**戻り値:** `Series<{ rsi: number | null, effectivePeriod: number, volatilityPercentile: number | null }>`

### `adaptiveBollinger(candles, options?)`

ローリング尖度に基づいて標準偏差乗数が適応するボリンジャーバンド。ファットテール（高尖度）では広いバンドを生成します。

```typescript
const result = adaptiveBollinger(candles, { period: 20, baseStdDev: 2 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `period` | `number` | `20` | SMAピリオド |
| `baseStdDev` | `number` | `2` | ベース標準偏差乗数 |
| `kurtosisLookback` | `number` | `100` | 尖度計算のルックバック |
| `minMultiplier` | `number` | `1.5` | 最小バンド乗数 |
| `maxMultiplier` | `number` | `3.0` | 最大バンド乗数 |

**戻り値:** `Series<{ upper, middle, lower, bandwidth, effectiveMultiplier, kurtosis }>`

### `adaptiveMa(candles, options?)`

効率比（ER）に基づいてスムージング速度を調整する移動平均。トレンド市場では高速スムージング、レンジ市場では低速スムージングを使用します。

```typescript
const result = adaptiveMa(candles, { erPeriod: 10 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `erPeriod` | `number` | `10` | 効率比ルックバックピリオド |
| `fastConstant` | `number` | `0.6667` | 高速スムージング定数 |
| `slowConstant` | `number` | `0.0645` | 低速スムージング定数 |

**戻り値:** `Series<{ value: number | null, efficiencyRatio: number | null, smoothingConstant: number | null }>`

### `adaptiveStochastics(candles, options?)`

ADXトレンド強度に基づいてルックバックピリオドが適応するストキャスティクス。強いトレンドでは長いピリオド（ウィップソー回避）、弱いトレンドでは短いピリオド（応答性）を使用します。

```typescript
const result = adaptiveStochastics(candles, { basePeriod: 14, adxThreshold: 40 });
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `basePeriod` | `number` | `14` | ベースストキャスティクスルックバック |
| `minPeriod` | `number` | `5` | 最小ピリオド（低ADX） |
| `maxPeriod` | `number` | `21` | 最大ピリオド（高ADX） |
| `adxPeriod` | `number` | `14` | ADXピリオド |
| `adxThreshold` | `number` | `40` | 完全適応のADX閾値 |
| `kSmoothing` | `number` | `3` | Kラインスムージングピリオド |
| `dSmoothing` | `number` | `3` | Dラインスムージングピリオド |

**戻り値:** `Series<{ k: number | null, d: number | null, effectivePeriod: number, adx: number | null }>`

---

## 戦略堅牢性スコア

バックテスト戦略の複合的な堅牢性グレーディング（A+からF）。モンテカルロ生存性、トレード一貫性、ドローダウン耐性、パラメーター感度、ウォークフォワード効率、レジーム一貫性を評価します。

### `quickRobustnessScore(result, options?)`

単一のバックテスト結果からの簡易堅牢性評価。バックテストの再実行は不要です。

```typescript
import { quickRobustnessScore } from "trendcraft";

const robustness = quickRobustnessScore(result);
console.log(`Grade: ${robustness.grade} (${robustness.compositeScore}/100)`);
console.log(robustness.assessment);
console.log(robustness.recommendations);
console.log(robustness.dimensions); // { monteCarlo, tradeConsistency, drawdownResilience }
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `monteCarloSimulations` | `number` | `300` | モンテカルロシミュレーション回数 |
| `seed` | `number` | - | 再現性のためのランダムシード |

**戻り値:** `QuickRobustnessResult`（`compositeScore`（0-100）、`grade`（A+からF）、`dimensions`、`assessment`、`recommendations` を含む）

### `calculateRobustnessScore(candles, originalResult, createStrategy, parameterRanges, options?)`

完全な堅牢性分析。ローソク足、戦略定義、パラメーター範囲が必要です。4つの次元（モンテカルロ、パラメーター感度、ウォークフォワード効率、レジーム一貫性）すべてを評価します。

```typescript
import { calculateRobustnessScore } from "trendcraft";

const robustness = calculateRobustnessScore(
  candles,
  result,
  (params) => ({
    entry: and(rsiBelow(params.rsiThreshold), goldenCrossCondition(params.shortMA, params.longMA)),
    exit: rsiAbove(70),
    options: { capital: 1_000_000 },
  }),
  [
    { name: "rsiThreshold", min: 20, max: 40, step: 5 },
    { name: "shortMA", min: 3, max: 10, step: 1 },
    { name: "longMA", min: 20, max: 40, step: 5 },
  ],
);
console.log(`Grade: ${robustness.grade}`);
```

**戻り値:** `RobustnessResult`（`compositeScore`、`grade`、`dimensions`、`assessment`、`recommendations` を含む）

### `scoreToGrade(score)`

数値スコア（0-100）をレターグレードに変換します。

```typescript
scoreToGrade(92); // "A+"
scoreToGrade(75); // "B+"
scoreToGrade(30); // "D"
```

グレードスケール: A+（90+）、A（80+）、B+（70+）、B（60+）、C+（50+）、C（40+）、D（25+）、F（<25）

---

## ペアトレーディング

ペアトレーディングのための統計的裁定ツール。共和分検定（Engle-Granger法）、スプレッド計算、平均回帰分析、シグナル生成を含みます。

### `analyzePair(seriesA, seriesB, options?)`

2つの銘柄間の完全なペアトレーディング分析。

```typescript
import { analyzePair } from "trendcraft";

const result = analyzePair(
  candlesGOOG.map(c => ({ time: c.time, value: c.close })),
  candlesMSFT.map(c => ({ time: c.time, value: c.close })),
  { entryThreshold: 2.0, exitThreshold: 0.5 },
);

if (result.cointegration.isCointegrated) {
  console.log(`Hedge ratio: ${result.cointegration.hedgeRatio}`);
  console.log(`Half-life: ${result.meanReversion.halfLife} bars`);
  console.log(`Viable: ${result.assessment.isViable}`);
}
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `significanceLevel` | `number` | `0.05` | ADF検定の有意水準 |
| `entryThreshold` | `number` | `2.0` | シグナルエントリーのZスコア閾値 |
| `exitThreshold` | `number` | `0.5` | シグナルイグジットのZスコア閾値 |
| `maxHalfLife` | `number` | `100` | 平均回帰と見なす最大半減期 |
| `rollingWindow` | `number` | `0` | Zスコアのローリングウィンドウ（0=全サンプル） |

**戻り値:** `PairsAnalysisResult`（`cointegration`、`meanReversion`、`spreadSeries`、`signals`、`assessment` を含む）

### `adfTest(series, maxLag?)`

拡張Dickey-Fuller検定（定常性検定）。

```typescript
const result = adfTest(residuals);
if (result.adfStatistic < result.criticalValues["5%"]) {
  console.log("5%有意水準で定常です");
}
```

**戻り値:** `{ adfStatistic, pValue, criticalValues: { "1%", "5%", "10%" }, lag }`

### `calculateSpread(seriesY, seriesX, hedgeRatio, intercept, times, options?)`

ヘッジレシオを指定して2つの価格系列間のスプレッドとZスコアを計算します。

**戻り値:** `SpreadPoint[]`（`time`、`spread`、`zScore`、`mean`、`stdDev` を含む）

### `analyzeMeanReversion(spreads, maxHalfLife?)`

AR(1)半減期とHurst指数（R/S分析）を使用した平均回帰特性の分析。

**戻り値:** `{ halfLife, lambda, isMeanReverting, hurstExponent }`

### `olsRegression(x, y)`

最小二乗法回帰。

**戻り値:** `{ beta, intercept, rSquared, residuals }`

---

## クロスアセット相関分析

2つのアセット間の相関ダイナミクスを分析します。ローリング相関、レジーム検出、リードラグ関係、インターマーケットダイバージェンスを含みます。

### `analyzeCorrelation(seriesA, seriesB, options?)`

完全なクロスアセット相関分析。

```typescript
import { analyzeCorrelation } from "trendcraft";

const analysis = analyzeCorrelation(
  candlesSPY.map(c => ({ time: c.time, value: c.close })),
  candlesQQQ.map(c => ({ time: c.time, value: c.close })),
  { window: 60 },
);
console.log(`Average correlation: ${analysis.summary.avgCorrelation}`);
console.log(`Current regime: ${analysis.summary.currentRegime}`);
console.log(`Lead-lag: ${analysis.leadLag.assessment}`);
console.log(`Divergences: ${analysis.divergences.length}`);
```

**オプション:**
| オプション | 型 | デフォルト | 説明 |
|--------|------|---------|-------------|
| `window` | `number` | `60` | ローリング相関ウィンドウ |
| `maxLag` | `number` | `10` | リードラグ分析の最大ラグ |
| `regimeThresholds` | `object` | - | カスタムレジーム閾値 |
| `divergenceLookback` | `number` | `20` | ダイバージェンス検出のルックバック |
| `divergenceThreshold` | `number` | `2.0` | ダイバージェンスのZスコア閾値 |

**戻り値:** `CorrelationAnalysisResult`（`rollingCorrelation`、`regimes`、`leadLag`、`divergences`、`summary` を含む）

### `rollingCorrelation(returnsA, returnsB, times, window?)`

2つのリターン系列間のローリングPearson・Spearman相関を計算します。

**戻り値:** `CorrelationPoint[]`（`time`、`pearson`、`spearman` を含む）

### `pearsonCorrelation(x, y)`

Pearson相関係数。

**戻り値:** `number`（-1から1）

### `spearmanRankCorrelation(x, y)`

Spearman順位相関係数。

**戻り値:** `number`（-1から1）

### `detectCorrelationRegimes(correlationSeries, options?)`

ローリング相関系列の各ポイントをレジームに分類します: `strong_positive`、`positive`、`neutral`、`negative`、`strong_negative`。

**戻り値:** `CorrelationRegimePoint[]`（`time`、`regime`、`correlation`、`regimeDuration` を含む）

### `analyzeLeadLag(returnsA, returnsB, options?)`

クロス相関を使用したリードラグ関係の分析。正の最適ラグはAがBをリード、負はBがAをリードすることを意味します。

```typescript
const result = analyzeLeadLag(returnsA, returnsB, { maxLag: 5 });
console.log(`Optimal lag: ${result.optimalLag}`);
```

**戻り値:** `LeadLagResult`（`optimalLag`、`crossCorrelation`、`maxCorrelation`、`assessment` を含む）

### `detectIntermarketDivergence(pricesA, pricesB, times, options?)`

インターマーケットダイバージェンスを検出します。相関するアセットの一方が上昇し他方が下降する場合にシグナルを発します。

**戻り値:** `DivergencePoint[]`（`time`、`type`（`'bullish'` | `'bearish'`）、`returnA`、`returnB`、`returnSpread`、`significance` を含む）

---

## ライブストリーミング & シリーズメタデータ

リアルタイムのローソク足 / 指標処理、およびインジケーター出力にドメインメタデータを付与するためのインフラ API 群です。すべてオプトインで、これらのシンボルを使わなくてもライブラリは完全に動作します。

### `createLiveCandle(options, fromState?)`

プラグイン可能なインクリメンタル指標とイベントバスを持つ、統合型のティック/ローソク足アグリゲーター。**ティックモード**（生トレードを集約）と**ローソク足モード**（形成済みバーを受け付け）の両方をサポート。`getState()` / `fromState` で state は完全にシリアライズ可能。

```typescript
import { createLiveCandle, incremental } from "trendcraft";

const live = createLiveCandle({
  intervalMs: 60_000,
  indicators: [
    { name: "sma20", create: (s) => incremental.createSma({ period: 20 }, incremental.restoreState(s)) },
    { name: "rsi14", create: (s) => incremental.createRsi({ period: 14 }, incremental.restoreState(s)) },
  ],
  history: historicalCandles,
  maxHistory: 500,
});

live.on("tick", ({ candle, snapshot, isNewCandle }) => updateChart(candle, snapshot));
live.on("candleComplete", ({ candle, snapshot }) => {
  console.log("終値:", candle.close, "SMA20:", snapshot.sma20);
});

// ティックモード
ws.on("trade", (t) => live.addTick(t));

// ローソク足モード
live.addCandle(formedCandle);
live.addCandle(partialCandle, { partial: true });
```

**オプション:**

| オプション | 型 | 説明 |
|---|---|---|
| `intervalMs` | `number?` | ローソク足の間隔（ms）。ティックモードでは必須、ローソク足モードでは省略。 |
| `indicators` | `{ name: string; create: LiveIndicatorFactory; state?: unknown }[]?` | 初期登録する指標（`addIndicator` で後から追加可能）。 |
| `history` | `NormalizedCandle[]?` | コンテキストのみに使う過去ローソク足（emit されない）。 |
| `maxHistory` | `number?` | メモリに保持する完了ローソク足の上限。 |

**メソッド:**

| メソッド | 説明 |
|---|---|
| `addTick(trade)` | トレードを流し込む（ティックモード）。 |
| `addCandle(candle, opts?)` | ローソク足を流し込む。`opts.partial = true` で形成中バー。 |
| `addIndicator(name, create, state?)` | 構築後に指標ファクトリを登録。 |
| `removeIndicator(name)` | 指標を削除。 |
| `snapshot` | 現在の指標スナップショット（登録名キー）。read-only プロパティ（メソッドではない）。 |
| `completedCandles` | 開始以降の完了ローソク足配列（read-only）。 |
| `candle` | 進行中のローソク足、または `null`（read-only）。 |
| `on(event, handler)` | イベント購読。unsubscribe 関数を返す（`off` メソッドは無い）。events: `tick`, `candleComplete`。 |
| `getState()` | state をシリアライズ（aggregator + 指標 + 完了ローソク足）。 |

### `livePresets`

84 個のインクリメンタル指標プリセット（factory + メタデータ + デフォルトパラメータ + snapshot-name 規約）のレジストリ。文字列 ID で指標をゼロコンフィグに登録したい任意の利用者（UI フォーム、レンダラー、スクリーナー等）から利用できます。

```typescript
import { livePresets } from "trendcraft";

const sma = livePresets.sma;
// {
//   meta: { kind: 'sma', label: 'SMA', overlay: true, ... },
//   defaultParams: { period: 20 },
//   snapshotName: (p) => `sma_${p.source ?? "close"}_${p.period ?? 20}`,
//   createFactory: (params) => (fromState) => IncrementalIndicator,
// }

// レジストリから指標をインスタンス化
const factory = sma.createFactory({ period: 50 });
const rsiIndicator = factory(undefined); // 既存 state なし
```

**エントリー形式 (`LivePreset`):**

| フィールド | 型 | 説明 |
|---|---|---|
| `meta` | `SeriesMeta` | 描画メタデータ（kind, label, overlay, yRange, referenceLines）。 |
| `defaultParams` | `Record<string, unknown>` | ユーザーが `{}` を渡したときのデフォルトパラメータ。 |
| `snapshotName` | `string \| ((params) => string)` | このインスタンスの snapshot キー（文字列、または params から生成する関数。例: `"sma_close_20"`）。 |
| `createFactory` | `(params) => LiveIndicatorFactory` | 指定パラメータで closure したインクリメンタルファクトリを生成。 |

### `indicatorPresets`

`livePresets` に `compute(candles, params)` バッチ関数を加えた拡張版。104 エントリー。単一のレジストリで静的（一括計算）と ストリーミング（バーごと）の両モードに対応します。

```typescript
import { indicatorPresets } from "trendcraft";

const rsi = indicatorPresets.rsi;

// 静的モード — 一括計算。型上 `compute` はオプショナル（組み込みエントリーはすべて定義済み）
const series = rsi.compute!(candles, { period: 14 });

// ストリーミングモード — バッチ専用エントリーには `createFactory` がないため
// オプショナル呼び出し（または存在チェック）を使う
const factory = rsi.createFactory?.({ period: 14 });
```

**エントリー形式 (`IndicatorPreset`):** LivePreset と同形の `meta` / `defaultParams` / `snapshotName` を持つ独立型。`compute?` と `createFactory?` はともにオプショナル（少なくとも一方は定義。インクリメンタル未対応の指標は `compute` のみで、104 エントリー中 25 個は `createFactory` を持たない）。

| フィールド | 型 | 説明 |
|---|---|---|
| `meta` / `defaultParams` / `snapshotName` | — | `LivePreset` と同形。 |
| `compute` | `((candles, params) => Series<T>)?` | 静的モード用のバッチ計算。 |
| `createFactory` | `((params) => LiveIndicatorFactory)?` | ストリーミングモード用のインクリメンタルファクトリ。 |
| `category` | `IndicatorCategory?` | UI 用グルーピング。値は大文字始まり: `"Moving Averages"`, `"Momentum"`, `"Volatility"`, `"Trend"`, `"Volume"`, `"Price"`, `"Wyckoff"`, `"Adaptive"`, `"Session"`, `"SMC"`, `"Filter"`。 |
| `name` / `description` | `string?` | 指標のフルネーム / 短い説明。 |
| `paramSchema` | `ParamSchema[]?` | UI フォーム自動生成用のパラメータスキーマ配列（パラメータごとに 1 エントリー）。 |

### `tagSeries` / `SeriesMeta`

任意の `Series<T>` に `__meta` プロパティを付与してドメインメタデータを載せます。組み込み指標はすべて既に tag 済み。自作指標でも下流の利用者（レンダラー、UI ジェネレーター等）に同じ規約で解釈させたい場合に `tagSeries` を使います。

```typescript
import { tagSeries, rsi, type SeriesMeta, type TaggedSeries } from "trendcraft";

const r = rsi(candles, { period: 14 });
// 指標のシグネチャ上の型は Series<T>。実行時に付与されるメタデータを読むには
// TaggedSeries<T> にキャストします。
(r as TaggedSeries<number | null>).__meta;
// {
//   kind: "rsi",
//   label: "RSI(14)",
//   overlay: false,
//   yRange: [0, 100],
//   referenceLines: [30, 70],
// }

const myCustom = tagSeries(myData, {
  label: "Custom Score",
  overlay: false,
  yRange: [0, 1],
  referenceLines: [0.5],
});
```

**`SeriesMeta` のフィールド:**

| フィールド | 型 | 説明 |
|---|---|---|
| `kind` | `string?` | パラメータ非依存の識別子（例 `"sma"`, `"rsi"`, `"macd"`）。`indicatorPresets` のキーと一致。identity match に使う。 |
| `label` | `string` | 表示ラベル、通常はパラメータ化される（例 `"SMA(20)"`, `"MACD(12, 26, 9)"`）。パラメータ値で変化する。 |
| `overlay` | `boolean` | `true` = 価格スケールを共有（メインペインに重ね描画）。`false` = 独立スケール（サブペイン）が必要。 |
| `yRange` | `[min, max]?` | Y 軸の固定レンジ（オシレーターなら例えば `[0, 100]`）。 |
| `referenceLines` | `number[]?` | 水平参照線の値（RSI なら `[30, 70]` など）。 |

レンダラーは `overlay` をペイン配置に、`yRange` を軸設定に翻訳できます。描画を行わない利用者はメタデータを無視できます。

---

## 型定義

### ローソク足型

```typescript
// 入力用ローソク足（柔軟）
interface Candle {
  time: number | string;
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

type PriceSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'volume';
```

### シグナル型

```typescript
type SignalType = 'buy' | 'sell' | 'hold';

interface Signal {
  time: number;
  type: SignalType;
  name: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}
```

---

## エラーハンドリングガイド

TrendCraftはエラーハンドリングに2つのアプローチを提供しています：

### Throwバージョン（デフォルト）

すべてのインジケーター関数は無効なパラメータに対して例外をスローします。`try/catch` でエラーハンドリングを行います：

```typescript
import { rsi, sma } from "trendcraft";

try {
  const result = rsi(candles, { period: 14 });
} catch (error) {
  // strict 設定では `error` は `unknown` — 使用前にナローイングする
  console.error((error as Error).message);
}
```

最適な用途: 内部計算、パフォーマンス重視のパス、スクリプト。

### Safeバージョン（Result返却型）

すべてのインジケーターには `safe` 名前空間からアクセスできるSafe版があります。
例外をスローする代わりに `Result<T>` を返します：

```typescript
import { safe } from "trendcraft";

const result = safe.rsiSafe(candles, { period: 14 });
if (result.ok) {
  console.log(result.value); // Series<number | null>
} else {
  console.error(result.error.code);    // "INDICATOR_ERROR"
  console.error(result.error.message); // 人間可読なメッセージ
}
```

最適な用途: ユーザー向けアプリケーション、フォールバックロジックを持つパイプライン、バッチ処理。

### toResultユーティリティ

任意のスロー関数をResultに変換します：

```typescript
import { toResult } from "trendcraft";

const result = toResult(() => someThrowingFunction(), "INDICATOR_ERROR");
```

### エラーコード

| コード | 説明 |
|------|-------------|
| `INDICATOR_ERROR` | インジケーター計算エラー（無効なパラメータ等） |
| `INVALID_PARAMETER` | 無効なパラメータ値 |
| `INSUFFICIENT_DATA` | データポイント不足 |
| `NO_DATA` | 入力データが空 |
| `COMPUTATION_FAILED` | 一般的な計算エラー |
| `OPTIMIZATION_FAILED` | 最適化プロセスのエラー |
| `BACKTEST_FAILED` | バックテスト実行エラー |
| `SCREENING_FAILED` | スクリーニングプロセスのエラー |

### 推奨事項

- **ライブラリ利用者**: 堅牢性のためSafeバージョンを推奨
- **内部 / パフォーマンス重視のコード**: Throwバージョンを直接使用

---

## ワイコフ分析（VSA + フェーズ検出）

### `vsa(candles, options?)`

Volume Spread Analysis（出来高スプレッド分析） — 出来高・スプレッド・終値位置の関係から各バーを分類します。

```typescript
import { vsa } from "trendcraft";

const vsaBars = vsa(candles, { volumeMaPeriod: 20, atrPeriod: 14 });
const last = vsaBars[vsaBars.length - 1].value;
// last.barType: 'noSupply' | 'noDemand' | 'stoppingVolume' | 'climacticAction'
//             | 'test' | 'upthrust' | 'spring' | 'absorption'
//             | 'effortUp' | 'effortDown' | 'normal'
// last.spreadRelative: number（1.0 = 平均）
// last.closePosition: number（0 = 安値、1 = 高値）
// last.volumeRelative: number（1.0 = 平均）
// last.isEffortDivergence: boolean
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `volumeMaPeriod` | `20` | 出来高MA期間 |
| `atrPeriod` | `14` | スプレッド正規化のATR期間 |
| `highVolumeThreshold` | `1.5` | 「高出来高」の相対出来高閾値 |
| `lowVolumeThreshold` | `0.7` | 「低出来高」の相対出来高閾値 |
| `wideSpreadThreshold` | `1.2` | 「ワイドスプレッド」の相対スプレッド閾値 |
| `narrowSpreadThreshold` | `0.7` | 「ナロースプレッド」の相対スプレッド閾値 |

### `wyckoffPhases(candles, options?)`

ワイコフフェーズ検出 — VSA・スイングポイント・BOS/CHoCHで駆動されるステートマシンにより、アキュミュレーション/ディストリビューションのフェーズとスキマティックイベントを特定します。

```typescript
import { wyckoffPhases } from "trendcraft";

const phases = wyckoffPhases(candles, { swingPeriod: 5, minRangeBars: 20 });
const last = phases[phases.length - 1].value;
// last.phase: 'accumulation' | 'markup' | 'distribution' | 'markdown' | 'unknown'
// last.event: 'PS' | 'SC' | 'AR' | 'ST' | 'spring' | 'SOS' | 'LPS' | ... | null
// last.confidence: 0-100
// last.eventsDetected: WyckoffEvent[]
// last.rangeHigh / last.rangeLow: レンジ境界
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `swingPeriod` | `5` | スイングポイント検出期間 |
| `minRangeBars` | `20` | トレーディングレンジの最小バー数 |
| `atrPeriod` | `14` | ATR期間 |
| `volumeMaPeriod` | `20` | 出来高MA期間 |
| `rangeTolerance` | `0.5` | レンジ境界許容のATR倍率 |

---

## メタ戦略（エクイティカーブトレーディング）

### `applyEquityCurveFilter(result, options?)`

エクイティカーブの健全性を分析してバックテスト結果をフィルタリングします。エクイティがMAを下回る、過大なドローダウン中、勝率が低い場合にトレードをスキップまたは縮小します。

```typescript
import { runBacktest, applyEquityCurveFilter } from "trendcraft";

const result = runBacktest(candles, entry, exit, { capital: 100000 });
const analysis = applyEquityCurveFilter(result, {
  type: 'ma',
  maPeriod: 10,
  filteredSizeFactor: 0, // 0 = スキップ、0.5 = 半分のサイズ
});
console.log(analysis.tradesSkipped);
console.log(analysis.improvement.maxDrawdown); // 正の値 = 改善
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `type` | `'ma'` | フィルタータイプ: `'ma'`、`'drawdown'`、`'winRate'`、`'combined'` |
| `maPeriod` | `20` | MA期間（トレード数単位） |
| `maType` | `'sma'` | `'sma'` または `'ema'` |
| `maxDrawdown` | `15` | 一時停止するドローダウン閾値（%、15 = 15%） |
| `winRateWindow` | `20` | 勝率のローリングウィンドウ |
| `minWinRate` | `40` | 継続に必要な最小勝率（%、40 = 40%） |
| `filteredSizeFactor` | `0` | フィルター時のサイズ係数（0 = スキップ） |

### `equityCurveHealth(result, options?)`

戦略のエクイティカーブの現在の健全性を評価します。

```typescript
import { equityCurveHealth } from "trendcraft";

const health = equityCurveHealth(result, { maPeriod: 10 });
// health.aboveMa: boolean
// health.currentDrawdown: 0-100（%、BacktestResult.maxDrawdownと同じ単位）
// health.rollingWinRate: 0-100（%、BacktestResult.winRateと同じ単位）
// health.healthScore: 0-100
```

### `rotateStrategies(results, options?)`

複数の戦略を直近パフォーマンスでランク付けし、資金を配分します。

```typescript
import { rotateStrategies } from "trendcraft";

const rotation = rotateStrategies([resultA, resultB, resultC], {
  lookbackTrades: 20,
  rankingMetric: 'returnPercent',
  allocationMethod: 'proportional',
});
// rotation.allocations: [{ strategyIndex, weight, metricValue }]
// rotation.rankings: [bestIdx, ..., worstIdx]
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `lookbackTrades` | `20` | ランク付けに使う直近トレード数 |
| `rankingMetric` | `'returnPercent'` | `'returnPercent'`、`'sharpeRatio'`、`'profitFactor'`、`'winRate'` |
| `maxActiveStrategies` | 全戦略 | 配分する最大戦略数 |
| `minAllocation` | `0.05` | 戦略あたりの最小配分 |
| `allocationMethod` | `'proportional'` | `'equal'`、`'proportional'`、`'topN'` |

---

## リスク分析（VaR / CVaR / リスクパリティ）

### `calculateVaR(returns, options?)`

Value at Risk と Conditional VaR（期待ショートフォール）を計算します。

```typescript
import { calculateVaR } from "trendcraft";

const result = calculateVaR(dailyReturns, {
  confidence: 0.95,
  method: 'historical', // 'historical' | 'parametric' | 'cornishFisher'
});
// result.var: 0.025（2.5%の潜在損失）
// result.cvar: 0.035（VaR超過時の平均損失3.5%）
// result.skewness, result.kurtosis
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `confidence` | `0.95` | 信頼水準 |
| `method` | `'historical'` | `'historical'`、`'parametric'`、`'cornishFisher'` |

### `rollingVaR(returns, options?)`

ローリングウィンドウでのVaR/CVaR計算。

```typescript
import { rollingVaR } from "trendcraft";

const rolling = rollingVaR(dailyReturns, { window: 60, confidence: 0.95 });
// rolling[i]: { var: number, cvar: number }
```

### `riskParityAllocation(returnsSeries, options?)`

資産間のリスク寄与を均等化するリスクパリティ配分ウェイトを計算します。

```typescript
import { riskParityAllocation } from "trendcraft";

const result = riskParityAllocation({
  SPY: spyReturns,
  TLT: tltReturns,
  GLD: gldReturns,
});
// result.weights: { SPY: 0.20, TLT: 0.45, GLD: 0.35 }
// result.riskContributions: ほぼ均等
// result.portfolioVolatility: number
// result.correlationMatrix: number[][]
```

### `correlationAdjustedSize(currentReturns, portfolioReturns, options)`

既存ポートフォリオとの相関に基づいてポジションサイズを調整します。

```typescript
import { correlationAdjustedSize } from "trendcraft";

const result = correlationAdjustedSize(stockReturns, [pos1Returns, pos2Returns], {
  baseSize: 10000,
  lowCorrelationThreshold: 0.3,
  highCorrelationThreshold: 0.7,
  minSizeFactor: 0.25,
});
// result.adjustedSize: 7500
// result.sizeFactor: 0.75
// result.averageCorrelation: 0.5
```

---

## ワイコフ / VSA

### `vsa(candles, options?)`

ボリュームスプレッド分析 — スプレッド（値幅）、バー内のクローズ位置、相対出来高の関係に基づいて各バーを分類します。

```typescript
import { vsa } from "trendcraft";

const result = vsa(candles, {
  volumeMaPeriod: 20,
  atrPeriod: 14,
  highVolumeThreshold: 1.5,
  lowVolumeThreshold: 0.7,
  wideSpreadThreshold: 1.2,
  narrowSpreadThreshold: 0.7,
});
// result[]: { time, value: { barType, spreadRelative, closePosition, volumeRelative, isEffortDivergence } }
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `volumeMaPeriod` | `20` | 出来高移動平均の期間 |
| `atrPeriod` | `14` | ATR期間（スプレッド正規化用） |
| `highVolumeThreshold` | `1.5` | この比率以上 = 高出来高 |
| `lowVolumeThreshold` | `0.7` | この比率以下 = 低出来高 |
| `wideSpreadThreshold` | `1.2` | この比率以上 = 広いスプレッド |
| `narrowSpreadThreshold` | `0.7` | この比率以下 = 狭いスプレッド |

**バータイプ:** `noSupply`（供給なし）, `noDemand`（需要なし）, `stoppingVolume`（停止出来高）, `climacticAction`（クライマックス）, `test`（テスト）, `upthrust`（アップスラスト）, `spring`（スプリング）, `absorption`（吸収）, `effortUp`（上昇エフォート）, `effortDown`（下降エフォート）, `normal`（通常）

`Series<VsaValue>` を返します。

### `wyckoffPhases(candles, options?)`

ワイコフフェーズ検出 — アキュムレーション/ディストリビューションサイクル内のマーケットフェーズとキーイベントを識別します。

```typescript
import { wyckoffPhases } from "trendcraft";

const phases = wyckoffPhases(candles, {
  swingPeriod: 5,
  minRangeBars: 20,
  atrPeriod: 14,
  volumeMaPeriod: 20,
  rangeTolerance: 0.5,
});
// phases[]: { time, value: { phase, subPhase, event, confidence, rangeHigh, rangeLow, eventsDetected } }
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `swingPeriod` | `5` | スイングポイント検出のルックバック |
| `minRangeBars` | `20` | レンジ検出の最小バー数 |
| `atrPeriod` | `14` | ATR期間 |
| `volumeMaPeriod` | `20` | 出来高MA期間 |
| `rangeTolerance` | `0.5` | レンジ境界の許容誤差（ATR倍率） |

**フェーズ:** `accumulation`（蓄積）, `markup`（上昇）, `distribution`（分配）, `markdown`（下落）, `unknown`（不明）

**イベント:** `PS`（予備的サポート/供給）, `SC`（セリングクライマックス）, `AR`（自動的な反発）, `ST`（二次テスト）, `spring`（スプリング）, `test`（テスト）, `SOS`（強さの兆候）, `LPS`（最後のサポートポイント）, `BU`（バックアップ）, `PSY`（予備的供給）, `BC`（バイイングクライマックス）, `SOW`（弱さの兆候）, `LPSY`, `UT`（アップスラスト）, `UTAD`

`Series<WyckoffValue>` を返します。

---

## ハーモニックパターン検出

### `detectHarmonicPatterns(candles, options?)`

XABCDハーモニックパターンをフィボナッチ比率検証で検出します。Gartley、Butterfly、Bat、Crab、Sharkパターンの強気/弱気バリアントに対応。

```typescript
import { detectHarmonicPatterns } from "trendcraft";

const patterns = detectHarmonicPatterns(candles, {
  swingLookback: 5,
  tolerance: 0.05,
  minSwingPoints: 50,
  patterns: ["gartley", "butterfly", "bat", "crab", "shark"],
});
// patterns[]: PatternSignal（type, confidence, pattern.keyPoints (X, A, B, C, D), target, stopLoss）
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `swingLookback` | `5` | スイングポイント検出期間 |
| `tolerance` | `0.05` | フィボナッチ比率の許容誤差（5%） |
| `minSwingPoints` | `50` | スキャンするスイングポイント（高値/安値の転換点）の最小個数 |
| `patterns` | すべて | 検出するパターンタイプ |

**パターンタイプ:** `gartley_bullish`, `gartley_bearish`, `butterfly_bullish`, `butterfly_bearish`, `bat_bullish`, `bat_bearish`, `crab_bullish`, `crab_bearish`, `shark_bullish`, `shark_bearish`

`PatternSignal[]` を返します（`confidence` (0-100), `confirmed`, `pattern.target`, `pattern.stopLoss`, `pattern.keyPoints` (X, A, B, C, Dポイント)）。

---

## GARCHボラティリティ

### `garch(returns, options?)`

GARCH(1,1)ボラティリティモデル — 最尤推定（MLE）により条件付き分散の時系列を推定します。ボラティリティ予測とリスク管理に有用です。

```typescript
import { garch, returns } from "trendcraft";

const dailyReturns = returns(candles).map((s) => s.value ?? 0);
const result = garch(dailyReturns, {
  p: 1,
  q: 1,
  maxIterations: 100,
  tolerance: 1e-6,
});
// result.volatilityForecast — 次期間の年率ボラティリティ（%）
// result.conditionalVariance — Series<number> 条件付き分散の時系列
// result.params — { omega, alpha, beta }
// result.logLikelihood — モデル適合度
// result.converged — 最適化が収束したか
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `p` | `1` | GARCHラグ次数 — 将来の拡張用。現在は `1` のみサポート（それ以外の値は例外をスロー） |
| `q` | `1` | ARCHラグ次数 — 将来の拡張用。現在は `1` のみサポート（それ以外の値は例外をスロー） |
| `maxIterations` | `100` | MLE最大反復回数 |
| `tolerance` | `1e-6` | 収束許容誤差 |

`GarchResult` を返します。

### `ewmaVolatility(returns, options?)`

EWMA（指数加重移動平均）ボラティリティ — RiskMetrics標準のリアルタイムボラティリティ推定手法。

```typescript
import { ewmaVolatility } from "trendcraft";

const vol = ewmaVolatility(dailyReturns, { lambda: 0.94 });
// vol: Series<number>（各点が年率ボラティリティ %）
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `lambda` | `0.94` | 減衰係数（RiskMetrics標準） |
| `calendar` | `US_EQUITY_CALENDAR` | 年率化に用いる取引カレンダープリセット |
| `periodsPerYear` | `252` | 年率化期間の直接指定（`calendar` が指定されている場合は `calendar` が優先） |

`Series<number>`（年率ボラティリティ、%）を返します。

### `ewmaVolatilityFromCandles(candles, options?)`

`ewmaVolatility` のキャンドル受け取り版。内部でログリターンを計算し、各出力点をキャンドルの `time` に揃えるため、他のキャンドルベースのインジケーターと同一タイムライン上で合成可能です。先頭キャンドルには直前リターンが無いため出力から除外されます（長さは `candles.length - 1`）。

```typescript
import { ewmaVolatilityFromCandles, JPX_CALENDAR } from "trendcraft";

const vol = ewmaVolatilityFromCandles(candles, {
  lambda: 0.94,
  source: "close",
  calendar: JPX_CALENDAR,
});
// vol[i].time === candles[i + 1].time
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `lambda` | `0.94` | 減衰係数 |
| `source` | `"close"` | ログリターンの価格ソース（`"close" \| "hl2" \| "hlc3" \| "ohlc4"` 等） |
| `calendar` | `US_EQUITY_CALENDAR` | 年率化カレンダー |
| `periodsPerYear` | `252` | 年率化期間の直接指定 |

`Series<number>`（年率ボラティリティ、%）を返します。

---

## 取引カレンダー (Trading Calendar)

市場別の年率化ヘルパー。プリセットは `name` と `tradingDaysPerYear` のみを保持し、休場テーブルは内蔵しません。バー単位の休場ギャップ検出が必要な場合は独自の `isTradingDay(date)` 述語を渡してください。

```typescript
import {
  US_EQUITY_CALENDAR, // 252
  JPX_CALENDAR,        // 245
  HKEX_CALENDAR,       // 247
  CRYPTO_CALENDAR,     // 365
  FX_CALENDAR,         // 260
  annualizationFactor,
  stressTest,
  PRESET_SCENARIOS,
} from "trendcraft";

// 日本株戦略のSharpeは年245バーで計算
const result = stressTest(dailyReturns, PRESET_SCENARIOS.covidCrash2020, 100_000, {
  calendar: JPX_CALENDAR,
});

// 単一の情報源 — ボラティリティにはsqrt(N)、リターン指数にはN
const N = annualizationFactor({ calendar: JPX_CALENDAR }); // 245
```

`AnnualizationOptions`（`{ calendar?, periodsPerYear? }`）は次の API が受け付けます：
`calculateMetricsFromReturns`, `stressTest`, `runAllStressTests`, `ulcerPerformanceIndex`, `garch`, `ewmaVolatility`, `ewmaVolatilityFromCandles`, `volatilityRegime`。デフォルト動作は従来と互換です。なお `calculateRuntimeMetrics` は `calendar` を受け付けますが、数値での直接指定は `periodsPerYear` ではなく `annualizationFactor` キーです。

---

## パレート多目的最適化 (NSGA-II)

### `paretoOptimization(candles, strategyFactory, paramRanges, options)`

NSGA-II多目的最適化 — 競合する目的関数をバランスするパレート最適なパラメータセットを発見します（例：シャープレシオ最大化とドローダウン最小化の両立）。高速非支配ソートとクラウディングディスタンスで多様性を維持。

```typescript
import { paretoOptimization, param, constraint, summarizeParetoResult, goldenCrossCondition, deadCrossCondition } from "trendcraft";

const result = paretoOptimization(
  candles,
  (params) => ({
    entry: goldenCrossCondition(params.short, params.long),
    exit: deadCrossCondition(params.short, params.long),
  }),
  [param("short", 5, 20, 5), param("long", 25, 100, 25)],
  {
    objectives: [
      { metric: "sharpe", direction: "maximize" },
      { metric: "maxDrawdown", direction: "minimize" },
    ],
    constraints: [constraint("winRate", ">=", 35)],
    maxCombinations: 10000,
  },
);
// result.paretoFront — 効率的フロンティア上の非支配解
// result.allResults — 全評価済み組み合わせ
// result.totalCombinations, result.validCombinations

console.log(summarizeParetoResult(result));
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `objectives` | 必須 | 2-4個の目的関数（metricとdirection） |
| `constraints` | `[]` | メトリクス制約 |
| `maxCombinations` | `10000` | 評価するパラメータ組み合わせの最大数 |
| `progressCallback` | - | 進捗報告コールバック |

**利用可能なメトリクス:** `sharpe`, `calmar`, `mar`, `profitFactor`, `recoveryFactor`, `returns`, `winRate`, `tradeCount`, `maxDrawdown`

`ParetoResult` を返します（`paretoFront: ParetoResultEntry[]`、各エントリに `frontIndex`, `crowdingDistance` 付き）。

**ヘルパー関数:**
- `fastNonDominatedSort(entries, objectives)` — NSGA-II非支配ソート
- `crowdingDistance(entries, frontIndices, objectives)` — クラウディングディスタンス計算
- `summarizeParetoResult(result)` — 人間が読みやすいサマリー文字列

---

## バックテストリアリズム

### `calculateDynamicSlippage(model, candle, atr?)`

市場状況に基づくコンテキストアウェアなスリッページを計算します。リアルなバックテストシミュレーションのための複数モデルに対応。

```typescript
import { runBacktest, calculateDynamicSlippage } from "trendcraft";

// バックテストオプションで使用
const result = runBacktest(candles, entry, exit, {
  capital: 1000000,
  slippageModel: {
    type: "composite",
    atrMultiplier: 0.1,
    impactCoeff: 0.1,
    volatilityWeight: 0.7,
  },
});

// スタンドアロンで使用
const slippage = calculateDynamicSlippage(
  { type: "volatility", atrMultiplier: 0.1 },
  candle,
  atrValue,
);
```

**スリッページモデルタイプ:**

| タイプ | パラメータ | 説明 |
|------|-----------|-------------|
| `fixed` | `percent` | 固定パーセンテージスリッページ |
| `volatility` | `atrMultiplier` | ATR比例スリッページ（ボラティリティが高い市場で拡大） |
| `volume` | `impactCoeff` | 出来高ベースのマーケットインパクト |
| `composite` | `atrMultiplier`, `impactCoeff`, `volatilityWeight?` | ボラティリティ＋出来高の複合モデル |

### `resolveSlippageModel(slippage?, model?)`

固定パーセンテージまたはモデル設定から `SlippageModel` を解決します。`SlippageModel | undefined` を返します。

---

## ストレステスト

### `stressTest(returns, scenario, initialCapital?)`

単一のストレスシナリオに対する戦略のレジリエンスをテストします。リターン系列に合成的なショックを適用し、主要メトリクスへの影響を測定します。

```typescript
import { stressTest, runAllStressTests, PRESET_SCENARIOS } from "trendcraft";

const result = stressTest(dailyReturns, PRESET_SCENARIOS.lehman2008, 1_000_000);
// result.scenario — シナリオ名
// result.originalMetrics — { totalReturn, maxDrawdown, sharpe }
// result.stressedMetrics — { totalReturn, maxDrawdown, sharpe }
// result.worstCase — { drawdown, duration, recoveryDays }
// result.survivalRate — ストレス適用後のエクイティが一度もゼロ以下にならなければ 1.0、なれば 0.0（生存/破綻の二値フラグ）
// result.capitalAtRisk — リスク資本額
// result.stressedVaR, result.stressedCVaR
```

### `runAllStressTests(returns, initialCapital?)`

すべてのプリセットストレスシナリオを一括実行します。

```typescript
const summary = runAllStressTests(dailyReturns, 1_000_000);
// summary.results — 各シナリオのStressTestResult[]
// summary.worstScenario — 最悪パフォーマンスのシナリオ名
// summary.overallSurvivalRate — 全シナリオの生存率の平均（生存したシナリオの割合）
// summary.maxStressedDrawdown — 全シナリオ中の最大ドローダウン
```

### `generateShockedReturns(baseReturns, shock)`

ショックを適用してストレスリターン系列を生成します。

**ショックタイプ:**

| タイプ | パラメータ | 説明 |
|------|-----------|-------------|
| `drawdown` | `magnitude`, `days`, `recoveryDays` | シミュレートされたドローダウンイベント |
| `volatilitySpike` | `multiplier`, `days` | ボラティリティ倍率 |
| `correlationBreakdown` | `targetCorrelation` | 相関レジーム変化 |
| `absolute` | `returns` | 特定のリターン系列を注入 |

**プリセットシナリオ:** `lehman2008`, `covidCrash2020`, `flashCrash2010`, `volmageddon2018`, `blackMonday1987`, `svbCrisis2023`

### `calculateMetricsFromReturns(returns)`

リターン系列から基本的なパフォーマンスメトリクスを計算します。`{ totalReturn, maxDrawdown, sharpe }` を返します。

---

## 戦略JSONシリアライゼーション

戦略を宣言的なJSONで表現し、保存・共有・バージョン管理を可能にする層です。

### 概念

- **`ConditionSpec`** — JSONで安全な条件表現（`{ name, params }` または `{ op: "and"|"or"|"not", conditions }`）
- **`ConditionRegistry`** — 条件名 → ファクトリ関数 + パラメータスキーマのマッピング
- **`StrategyJSON`** — バージョン付き戦略スキーマ（entry/exit条件 + バックテスト設定）

### ビルトインレジストリ

- **`backtestRegistry`** — 105+個のバックテスト条件（trend, momentum, volume, volatility, pattern, smc, range, fundamental）
- **`streamingRegistry`** — 60+個のストリーミング条件（リアルタイムスナップショット用）

### `backtestRegistry` / `streamingRegistry`

```typescript
import { backtestRegistry, streamingRegistry } from "trendcraft";

// 全条件一覧
const all = backtestRegistry.list();

// カテゴリ別フィルタ
const trendConditions = backtestRegistry.list("trend");

// 条件の存在確認
backtestRegistry.has("goldenCross"); // true

// パラメータスキーマ取得（UI構築用）
const entry = backtestRegistry.get("rsiBelow");
// entry.params = { threshold: { type: "number", default: 30, min: 0, max: 100 }, ... }
```

**カテゴリ:** `trend`, `momentum`, `volume`, `volatility`, `pattern`, `smc`, `range`, `fundamental`

### `ConditionRegistry`

```typescript
import { ConditionRegistry } from "trendcraft";

const registry = new ConditionRegistry<Condition>();
registry.register({
  name: "myCondition",
  displayName: "My Condition",
  category: "trend",
  params: {
    period: { type: "number", default: 14, min: 1, max: 200 },
  },
  create: (p) => myConditionFactory((p.period as number) ?? 14),
});
```

**メソッド:**
- `register(entry)` — 条件を登録（重複名はエラー）
- `get(name)` → `ConditionRegistryEntry | undefined`
- `has(name)` → `boolean`
- `list(category?)` → `ConditionRegistryEntry[]`
- `names()` → `string[]`
- `size` → `number`
- `hydrate(spec, combinators)` → `T` — ConditionSpecを実行可能な条件に変換

### `serializeStrategy(strategy)` / `parseStrategy(json)`

```typescript
import { serializeStrategy, parseStrategy } from "trendcraft";
import type { StrategyJSON } from "trendcraft";

const strategy: StrategyJSON = {
  $schema: "trendcraft/strategy",
  version: 1,
  id: "golden-cross-rsi",
  name: "Golden Cross + RSI",
  entry: {
    op: "and",
    conditions: [
      { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
      { name: "rsiBelow", params: { threshold: 30 } },
    ],
  },
  exit: { name: "rsiAbove", params: { threshold: 70 } },
  backtest: { capital: 1_000_000, stopLoss: 5, fillMode: "next-bar-open" },
};

// JSON文字列にシリアライズ
const jsonString = serializeStrategy(strategy);

// パースして復元
const restored = parseStrategy(jsonString);
```

`parseStrategy`は`$schema`と`version`フィールドを検証し、不一致の場合はエラーをスローします。

### `hydrateCondition(spec, registry)` / `loadStrategy(json, registry)`

```typescript
import { hydrateCondition, loadStrategy, backtestRegistry, runBacktest } from "trendcraft";

// 単一条件のハイドレーション
const condition = hydrateCondition(
  { name: "goldenCross", params: { shortPeriod: 10 } },
  backtestRegistry,
);

// 戦略全体を読み込み → 実行可能なentry/exit + オプション
const { entry, exit, backtestOptions } = loadStrategy(strategyJson, backtestRegistry);
const result = runBacktest(candles, entry, exit, { capital: 1_000_000, ...backtestOptions });
```

### `validateConditionSpec(spec, registry)` / `validateStrategyJSON(json)`

```typescript
import { validateConditionSpec, validateStrategyJSON, backtestRegistry } from "trendcraft";

// 条件スペックをレジストリに対してバリデーション（型・範囲・enum・必須チェック）
const result = validateConditionSpec(
  { name: "rsiBelow", params: { threshold: "文字列" } },
  backtestRegistry,
);
// { valid: false, errors: ["rsiBelow.threshold: expected number, got string"] }

// 戦略JSON構造のバリデーション
const structResult = validateStrategyJSON(strategyJson);
// { valid: boolean, errors: string[] }
```

`array: true` を持つ `ParamDef` は `type` の配列を受け取り、`min` / `max` /
`enum` は各要素に適用される。要素のエラーはインデックス付きで報告され、
`minItems` / `maxItems` が長さを制約する:

```typescript
validateConditionSpec(
  { name: "perfectOrderBullish", params: { periods: [5, "25", 75] } },
  backtestRegistry,
);
// { valid: false, errors: ["perfectOrderBullish.periods[1]: expected number, got string"] }
```

`minItems` / `maxItems` は長さを、`minDistinct` は**異なる値の個数**を制約する
（重複除去してから数える factory があるため）。`integer: true` は検証で強制され、
配列 param では要素ごとに適用される。`params` 自体も、存在する場合はオブジェクトで
なければならない。

結合子の子要素がオブジェクトでない場合は throw でなく報告されるので、壊れた戦略でも
`parseStrategySafe` は `Result` の契約を守る — `{ "op": "and", "conditions": ["goldenCross"] }`
（オブジェクトを置くべき場所に条件名だけを書いたもの）は `TypeError` でなく
`and[0]: expected condition object, got string` を返す。

`hydrate` はエントリが宣言していないパラメータを黙って捨てず拒否するので、あるレジストリ
向けに書いたチューニングが別のレジストリで無言のうちに失われることはない。

### StrategyJSON スキーマ

```typescript
type StrategyJSON = {
  $schema: "trendcraft/strategy";
  version: 1;
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  entry: ConditionSpec;
  exit: ConditionSpec;
  backtest?: {
    capital?: number;
    direction?: "long" | "short";
    stopLoss?: number;
    takeProfit?: number;
    trailingStop?: number;
    commission?: number;
    commissionRate?: number;
    slippage?: number;
    fillMode?: "same-bar-close" | "next-bar-open";
    sizing?: BacktestSizingConfigJSON; // JSON-safe なポジションサイジング設定（カスタムコールバック型は非対応）
  };
  metadata?: Record<string, unknown>;
};
```

### ConditionSpec

```typescript
// 葉条件
type ConditionSpec =
  | { name: string; params?: Record<string, unknown> }
  | { op: "and" | "or" | "not"; conditions: ConditionSpec[] };

// 例: and(goldenCrossCondition(5,25), rsiBelow(30))
const example: ConditionSpec = {
  "op": "and",
  "conditions": [
    { "name": "goldenCross", "params": { "shortPeriod": 5, "longPeriod": 25 } },
    { "name": "rsiBelow", "params": { "threshold": 30 } }
  ]
};
```

### 型

`ConditionSpec`, `StrategyJSON`, `ParamDef`, `ConditionParamSchema`, `ConditionCategory`, `ConditionRegistryEntry`, `StrategyValidationResult`
