# TrendCraft

金融データのテクニカル分析を行うTypeScriptライブラリ。インジケーターの計算、シグナル検出、マーケットトレンド分析ができます。

[English README](./README.md)

## 機能

### インジケーター
- **移動平均**: SMA, EMA, WMA
- **トレンド**: 一目均衡表, Supertrend, パラボリックSAR
- **モメンタム**: RSI, MACD, ストキャスティクス (Fast/Slow), DMI/ADX, Stoch RSI, CCI, Williams %R, ROC
- **ボラティリティ**: ボリンジャーバンド, ATR, ドンチャンチャネル, ケルトナーチャネル
- **出来高**: OBV, MFI, VWAP, 出来高移動平均, CMF, 出来高異常検出, Volume Profile, 出来高トレンド確認
- **価格**: 最高値/最安値, リターン, ピボットポイント

### シグナル検出
- **クロス検出**: ゴールデンクロス、デッドクロス、カスタムクロスオーバー
- **騙し検出**: 出来高・トレンド確認によるクロスシグナル検証
- **ダイバージェンス**: OBV、RSI、MACDのダイバージェンス検出
- **スクイーズ**: ボリンジャーバンドのスクイーズ検出
- **レンジ相場検出**: ボックス相場の検出、ブレイクアウトリスク判定

### バックテスト
- プリセット条件を使ったシンプルな戦略検証
- ストップロス、テイクプロフィット、トレーリングストップ対応
- 手数料・スリッページのシミュレーション
- パフォーマンス指標（シャープレシオ、最大ドローダウン、勝率）
- マルチタイムフレーム(MTF)条件（週足/月足RSI、SMA、トレンド）
- 高度な出来高条件（異常検出、Volume Profile）

### シグナルスコアリング
- 複数シグナルを重み付けで統合
- プリセット戦略: momentum, meanReversion, trendFollowing, balanced
- Fluent API (ScoreBuilder) でカスタムスコアリング
- スコアベースのバックテスト条件

### ポジションサイジング
- **リスクベース**: リスク額とストップ幅からサイズ計算
- **ATRベース**: ATRで動的なストップ幅を設定
- **ケリー基準**: 勝率とペイオフレシオから最適サイズ算出
- **固定比率**: シンプルな割合ベースの配分

### ATRリスク管理
- シャンデリアイグジット（トレーリングストップ）
- ATRベースの動的ストップ/利確レベル
- バックテストエンジンとの統合

### CLIツール
- **スクリーニングCLI**: 複数銘柄をエントリー/イグジット条件でスクリーニング
- **バックテストCLI**: 単一ファイルまたは複数ファイルの比較バックテスト
- 出力形式: table, JSON, CSV

### ユーティリティ
- データ正規化（様々な日付形式をタイムスタンプに変換）
- タイムフレーム変換（日足から週足/月足へ）
- Fluent API（メソッドチェーン）

## インストール

```bash
npm install trendcraft
```

## クイックスタート

```typescript
import { sma, rsi, bollingerBands, goldenCross } from 'trendcraft';

// ローソク足データ
const candles = [
  { time: 1700000000000, open: 100, high: 105, low: 99, close: 104, volume: 1000 },
  // ... 続き
];

// インジケーター計算
const sma20 = sma(candles, { period: 20 });
const rsi14 = rsi(candles, { period: 14 });
const bb = bollingerBands(candles, { period: 20, stdDev: 2 });

// シグナル検出
const crosses = goldenCross(candles, { short: 5, long: 25 });
```

## 使用例

### 移動平均

```typescript
import { sma, ema } from 'trendcraft';

// 単純移動平均
const sma20 = sma(candles, { period: 20 });
// 戻り値: [{ time: number, value: number | null }, ...]

// 指数移動平均
const ema12 = ema(candles, { period: 12 });
```

### RSI

```typescript
import { rsi } from 'trendcraft';

const rsi14 = rsi(candles, { period: 14 });

// 売られすぎ/買われすぎをチェック
rsi14.forEach(({ time, value }) => {
  if (value !== null) {
    if (value < 30) console.log(`${time}: 売られすぎ`);
    if (value > 70) console.log(`${time}: 買われすぎ`);
  }
});
```

### MACD

```typescript
import { macd } from 'trendcraft';

const macdData = macd(candles, { fast: 12, slow: 26, signal: 9 });

macdData.forEach(({ time, value }) => {
  const { macd: macdLine, signal, histogram } = value;
  // macdLine: MACDライン
  // signal: シグナルライン
  // histogram: MACD - シグナル
});
```

### ボリンジャーバンド

```typescript
import { bollingerBands } from 'trendcraft';

const bb = bollingerBands(candles, { period: 20, stdDev: 2 });

bb.forEach(({ time, value }) => {
  const { upper, middle, lower, percentB, bandwidth } = value;
  // upper: 上バンド
  // middle: 中央バンド (SMA)
  // lower: 下バンド
  // percentB: %Bインジケーター (0-1スケール)
  // bandwidth: バンド幅
});
```

### シグナル検出

```typescript
import { goldenCross, deadCross, rsiDivergence, bollingerSqueeze } from 'trendcraft';

// ゴールデンクロス / デッドクロス
const gc = goldenCross(candles, { short: 5, long: 25 });
const dc = deadCross(candles, { short: 5, long: 25 });

// RSIダイバージェンス
const divergences = rsiDivergence(candles);
divergences.forEach(signal => {
  console.log(`${signal.type} ダイバージェンス: ${signal.time}`);
  // type: 'bullish'（強気）または 'bearish'（弱気）
});

// ボリンジャースクイーズ
const squeezes = bollingerSqueeze(candles, { threshold: 10 });
// ボラティリティが低い期間を検出（ブレイクアウトの可能性）

// レンジ相場検出
import { rangeBound } from 'trendcraft';

const rb = rangeBound(candles);
const latest = rb[rb.length - 1].value;

if (latest.state === 'RANGE_CONFIRMED') {
  console.log(`レンジ確定: ${latest.rangeLow} - ${latest.rangeHigh}`);
}
if (latest.state === 'BREAKOUT_RISK_UP') {
  console.log('上方ブレイクアウトリスク！');
}
```

### タイムフレーム変換

```typescript
import { resample } from 'trendcraft';

// 日足を週足に変換
const weeklyCandles = resample(dailyCandles, 'weekly');

// 月足に変換
const monthlyCandles = resample(dailyCandles, 'monthly');
```

### Fluent API

```typescript
import { TrendCraft } from 'trendcraft';

const result = TrendCraft.from(candles)
  .sma(20)
  .ema(12)
  .rsi(14)
  .compute();

// 結果にアクセス
console.log(result.sma);
console.log(result.ema);
console.log(result.rsi);
```

### バックテスト

```typescript
import { TrendCraft, goldenCross, deadCross, and, rsiBelow } from 'trendcraft';

// プリセット条件でシンプルなバックテスト
const result = TrendCraft.from(candles)
  .strategy()
    .entry(goldenCross())        // ゴールデンクロスでエントリー
    .exit(deadCross())           // デッドクロスでイグジット
  .backtest({ capital: 1000000 });

console.log(result.totalReturnPercent);  // トータルリターン %
console.log(result.winRate);             // 勝率 %
console.log(result.maxDrawdown);         // 最大ドローダウン %
console.log(result.sharpeRatio);         // シャープレシオ

// AND/ORで条件を組み合わせ
const advancedResult = TrendCraft.from(candles)
  .strategy()
    .entry(and(goldenCross(), rsiBelow(30)))  // GC + RSI売られすぎ
    .exit(deadCross())
  .backtest({
    capital: 1000000,
    stopLoss: 5,       // 5%ストップロス
    takeProfit: 15,    // 15%利確
    commission: 0,
    commissionRate: 0.1,  // 0.1%手数料
  });
```

### 出来高分析

```typescript
import { volumeAnomaly, volumeProfile, volumeTrend } from 'trendcraft';

// 異常出来高を検出
const anomalies = volumeAnomaly(candles, { period: 20, highThreshold: 2.0 });
anomalies.forEach(({ time, value }) => {
  if (value.isAnomaly) {
    console.log(`${time}: ${value.level}出来高 (平均の${value.ratio.toFixed(1)}倍)`);
  }
});

// Volume Profile（POC、VAH、VAL）
const profile = volumeProfile(candles, { period: 20 });
console.log(`POC: ${profile.poc}`);      // Point of Control（最大出来高価格）
console.log(`VAH: ${profile.vah}`);      // Value Area High
console.log(`VAL: ${profile.val}`);      // Value Area Low

// 出来高トレンド確認
const trends = volumeTrend(candles);
trends.forEach(({ time, value }) => {
  if (value.isConfirmed) {
    console.log(`${time}: トレンド確認済み (信頼度${value.confidence}%)`);
  }
  if (value.hasDivergence) {
    console.log(`${time}: 出来高ダイバージェンス検出`);
  }
});
```

### マルチタイムフレーム（MTF）条件

```typescript
import { weeklyRsiAbove, weeklyPriceAboveSma, and, goldenCrossCondition } from 'trendcraft';

// 週足RSIフィルター付きバックテスト
const result = TrendCraft.from(dailyCandles)
  .withMtf(['weekly'])  // MTFを有効化（週足データ）
  .strategy()
    .entry(and(
      weeklyRsiAbove(50),        // 週足RSI > 50（強気バイアス）
      goldenCrossCondition()     // 日足ゴールデンクロス
    ))
    .exit(deadCrossCondition())
  .backtest({ capital: 1000000 });
```

### シグナルスコアリング

```typescript
import { ScoreBuilder, calculateScore, scoreAbove } from 'trendcraft';

// カスタムスコアリング戦略を構築
const config = ScoreBuilder.create()
  .addPOConfirmation(3.0)      // パーフェクトオーダー確認 (重み: 3.0)
  .addRsiOversold(30, 2.0)     // RSI < 30 (重み: 2.0)
  .addVolumeSpike(1.5, 1.5)    // 出来高 > 平均の1.5倍 (重み: 1.5)
  .addMacdBullish(1.5)         // MACDブリッシュクロスオーバー
  .setThresholds(70, 50, 30)   // strong, moderate, weak
  .build();

// 特定のインデックスでスコアを計算
const result = calculateScore(candles, candles.length - 1, config);
console.log(result.normalizedScore);  // 0-100のスコア
console.log(result.strength);         // "strong" | "moderate" | "weak" | "none"

// バックテストで使用
import { TrendCraft, deadCross } from 'trendcraft';

const backtestResult = TrendCraft.from(candles)
  .strategy()
    .entry(scoreAbove(70, "trendFollowing"))  // スコア > 70 でエントリー
    .exit(deadCross())
  .backtest({ capital: 1000000 });
```

### ポジションサイジング

```typescript
import { riskBasedSize, atrBasedSize, kellySize, fixedFractionalSize } from 'trendcraft';

// リスクベース: リスク額とストップ幅からサイズを計算
const riskResult = riskBasedSize({
  accountSize: 100000,
  entryPrice: 50,
  stopLossPrice: 48,
  riskPercent: 1,           // 口座の1%をリスク
  maxPositionPercent: 25,   // 最大25%のポジション
});
// { shares: 500, positionValue: 25000, riskAmount: 1000, ... }

// ATRベース: ATRで動的にストップを計算
const atrResult = atrBasedSize({
  accountSize: 100000,
  entryPrice: 50,
  atrValue: 2.5,
  atrMultiplier: 2,         // 2x ATR でストップ幅
  riskPercent: 1,
});
// { shares: 200, stopPrice: 45, ... }

// ケリー基準: 過去の勝率に基づく最適サイジング
const kellyResult = kellySize({
  accountSize: 100000,
  entryPrice: 50,
  winRate: 0.6,
  winLossRatio: 1.5,
  kellyFraction: 0.5,       // ハーフケリー（より安全）
});

// 固定比率: シンプルな割合ベース
const fixedResult = fixedFractionalSize({
  accountSize: 100000,
  entryPrice: 50,
  fractionPercent: 10,      // 口座の10%
});
```

### ATRリスク管理

```typescript
import { chandelierExit, calculateAtrStops, TrendCraft, goldenCross, deadCross } from 'trendcraft';

// シャンデリアイグジット（トレーリングストップ）
const chandelier = chandelierExit(candles, { period: 22, multiplier: 3 });
chandelier.forEach(({ time, value }) => {
  console.log(`ロングストップ: ${value.longStop}, ショートストップ: ${value.shortStop}`);
});

// ATRベースのストップ・利確レベルを計算
const stops = calculateAtrStops({
  entryPrice: 100,
  atrValue: 2.5,
  stopMultiplier: 2,        // 2x ATR でストップ
  takeProfitMultiplier: 3,  // 3x ATR で利確
  direction: 'long',
});
// { stopPrice: 95, takeProfitPrice: 107.5, riskRewardRatio: 1.5 }

// ATRベースのストップでバックテスト
const result = TrendCraft.from(candles)
  .strategy()
    .entry(goldenCross())
    .exit(deadCross())
  .backtest({
    capital: 1000000,
    atrRisk: {
      enabled: true,
      period: 14,
      stopMultiplier: 2,
      takeProfitMultiplier: 3,
    },
  });
```

## CLIツール

TrendCraftはスクリーニングとバックテストの2つのCLIツールを提供しています。

### スクリーニングCLI

複数銘柄をエントリー/イグジット条件でスクリーニングします。

```bash
# 基本的な使い方
npx trendcraft-screen ./data --entry "goldenCross"

# エントリーとイグジット条件を指定
npx trendcraft-screen ./data --entry "goldenCross,volumeAnomaly" --exit "deadCross"

# ATR%（ボラティリティ）でフィルタ
npx trendcraft-screen ./data --entry "perfectOrderBullish" --min-atr 2.3

# JSON出力
npx trendcraft-screen ./data --output json > results.json

# 全銘柄表示（シグナルなしも含む）
npx trendcraft-screen ./data --all

# 使用可能な条件一覧
npx trendcraft-screen --list
```

**出力例（table形式）:**
```
====================================================================
Stock Screening Results - 2025-12-25
====================================================================

Criteria: goldenCross + volumeAnomaly

Summary:
  Total Files: 19
  Entry Signals: 3
  Exit Signals: 1

--------------------------------------------------------------------
| Ticker       | Signal |     Price |    ATR% |   RSI | Vol Ratio |
--------------------------------------------------------------------
| 6920.T       | ENTRY  |     32500 |   4.52% |    38 |      2.31 |
| 4755.T       | ENTRY  |       850 |   3.21% |    42 |      1.87 |
| 6758.T       | EXIT   |     13200 |   2.34% |    68 |      1.12 |
--------------------------------------------------------------------
```

### バックテストCLI

単一ファイルまたは複数ファイルでバックテストを実行します。

```bash
# 単一ファイル（詳細出力）
npx trendcraft-backtest ./data/6758.T.csv --entry "goldenCross" --exit "deadCross"

# 複数ファイル（比較テーブル）
npx trendcraft-backtest ./data --entry "perfectOrderActiveBullish" --exit "perfectOrderCollapsed"

# リスク管理オプション付き
npx trendcraft-backtest ./data/6758.T.csv \
  --entry "goldenCross,volumeAnomaly" \
  --exit "deadCross" \
  --stop-loss 5 --take-profit 10

# 個別トレード表示
npx trendcraft-backtest ./data/6758.T.csv --trades

# JSON出力
npx trendcraft-backtest ./data --output json > results.json

# 使用可能な条件一覧
npx trendcraft-backtest --list
```

**単一ファイル出力:**
```
======================================================================
Backtest Result: 6758.T
======================================================================

Performance Summary:
  Total Return:     34.48%
  Trade Count:      311
  Win Rate:         34.4%
  Profit Factor:    1.01
  Max Drawdown:     86.88%
  Sharpe Ratio:     1.130

Capital:
  Initial:          1,000,000
  Final:            1,344,761
```

**複数ファイル出力:**
```
Summary:
  Total Stocks:     19
  Profitable:       7 (37%)
  Average Return:   417.90%

--------------------------------------------------------------------------------------------------------------
| Ticker       | Trades |  WinRate |     Return |    MaxDD |     PF |  Sharpe |
--------------------------------------------------------------------------------------------------------------
| 9984.T       |    166 |    41.0% |   7162.68% |   68.78% |   1.42 |   3.090 |
| 6920.T       |     83 |    37.4% |    818.02% |   73.30% |   1.74 |   3.410 |
| 6758.T       |    311 |    34.4% |     34.48% |   86.88% |   1.01 |   1.130 |
--------------------------------------------------------------------------------------------------------------
```

### 使用可能な条件プリセット

両方のCLIツールで以下のプリセット条件が使用できます：

| カテゴリ | 条件名 |
|----------|--------|
| 移動平均 | `goldenCross`, `deadCross`, `goldenCross25_75`, `deadCross25_75` |
| RSI | `rsiBelow30`, `rsiBelow40`, `rsiAbove60`, `rsiAbove70` |
| MACD | `macdCrossUp`, `macdCrossDown` |
| パーフェクトオーダー | `perfectOrderBullish`, `perfectOrderBearish`, `perfectOrderCollapsed`, `perfectOrderActiveBullish` |
| 出来高 | `volumeAnomaly`, `volumeAbove1_5x`, `volumeAbove2x`, `volumeConfirmsTrend` |
| ボリンジャー | `bollingerBreakoutUp`, `bollingerBreakoutDown` |
| ストキャスティクス | `stochBelow20`, `stochAbove80`, `stochCrossUp`, `stochCrossDown` |
| DMI/ADX | `dmiBullish`, `dmiBearish`, `adxStrong` |
| レンジ | `rangeBreakout`, `rangeConfirmed`, `inRangeBound` |
| ボラティリティ | `atrPercentAbove2_3`, `atrPercentAbove3` |

## APIリファレンス

詳細なAPIリファレンスは [APIドキュメント](./docs/API.ja.md) を参照してください。

## データ形式

### 入力: ローソク足データ

```typescript
interface Candle {
  time: number | string | Date;  // タイムスタンプ、日付文字列、またはDateオブジェクト
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### 出力: インジケーター値

```typescript
interface IndicatorValue<T> {
  time: number;   // Unixタイムスタンプ（ミリ秒）
  value: T;       // インジケーター値（型はインジケーターにより異なる）
}

type Series<T> = IndicatorValue<T>[];
```

## ライセンス

MIT
