# TrendCraft

金融データのテクニカル分析を行うTypeScriptライブラリ。インジケーターの計算、シグナル検出、マーケットトレンド分析ができます。

[English README](./README.md)

## 機能

### インジケーター (130+)
- **移動平均**: SMA, EMA, WMA, VWMA, KAMA, T3, HMA（ハル移動平均）, McGinley Dynamic, EMA Ribbon, DEMA, TEMA, ZLEMA, FRAMA, ALMA
- **トレンド**: 一目均衡表, Supertrend, パラボリックSAR, Vortex, Schaff Trend Cycle, Linear Regression
- **モメンタム**: RSI, MACD, ストキャスティクス (Fast/Slow), DMI/ADX, ADXR, Stoch RSI, CCI, Williams %R, ROC, TRIX, Aroon, DPO, Hurst Exponent, コナーズRSI, IMI, Ultimate Oscillator, Awesome Oscillator, Mass Index, KST, Coppock Curve, TSI, PPO, CMO, Balance of Power, QStick
- **ボラティリティ**: ボリンジャーバンド, ATR, ドンチャンチャネル, ケルトナーチャネル, シャンデリアイグジット, ボラティリティレジーム, チョッピネスインデックス, Ulcer Index, Historical Volatility, Garman-Klass, Standard Deviation, ATR Stops, ATR Percent, EWMA Volatility
- **出来高**: OBV, MFI, VWAP（バンド対応）, 出来高移動平均, CMF, 出来高異常検出, Volume Profile, 出来高トレンド確認, ADL, アンカードVWAP, Elder Force Index, Ease of Movement, Klinger, TWAP, Weis Wave, Market Profile, PVT, NVI, CVD（+ シグナル / ダイバージェンス）
- **価格**: Highest/Lowest, 最高値, 最安値, リターン, 累積リターン, ピボットポイント, スイングポイント, フラクタル, Zigzag, フィボナッチリトレースメント/エクステンション, アンドリュースピッチフォーク, オートトレンドライン, チャネルライン, 平均足, オープニングレンジブレイクアウト, ギャップ分析, Median Price, Typical Price, Weighted Close, BOS / CHoCH, FVG, S/Rゾーンクラスタリング
- **スマートマネーコンセプト (SMC)**: Order Block, Liquidity Sweep
- **フィルター (Ehlers)**: Super Smoother, Roofing Filter
- **適応型**: Adaptive RSI, Adaptive Bollinger, Adaptive MA (ER連動), Adaptive Stochastics (ADX連動)
- **セッション / ICT**: セッション検出, キルゾーン（アジア / ロンドン / NY）, セッション統計, セッションブレイクアウト
- **Wyckoff**: VSA (Volume Spread Analysis), Wyckoffフェーズ検出
- **レジーム**: HMMレジーム検出 (Baum-Welch / Viterbi), レジーム遷移行列
- **相対力**: Benchmark RS, RS Rating, RS Ranking, マルチシンボルRS (`rankByRS` / `topByRS` / `filterByRSPercentile` / `compareRS`)

### シグナル検出
- **クロス検出**: ゴールデンクロス、デッドクロス、カスタムクロスオーバー
- **騙し検出**: 出来高・トレンド確認によるクロスシグナル検証
- **ダイバージェンス**: OBV、RSI、MACDのダイバージェンス検出
- **スクイーズ**: ボリンジャーバンドのスクイーズ検出
- **レンジ相場検出**: ボックス相場の検出、ブレイクアウトリスク判定
- **チャートパターン**: ダブルトップ/ボトム, ヘッドアンドショルダー, カップウィズハンドル, トライアングル（対称/上昇/下降）, ウェッジ（上昇/下降）, チャネル（上昇/下降/水平）, フラッグ/ペナント
- **パターンフィルター**: ATR比率、トレンドコンテキスト、出来高確認フィルター

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

### 戦略最適化
- **グリッドサーチ**: 制約付きパラメータチューニング
- **ウォークフォワード分析**: アウトオブサンプル検証
- **組み合わせ探索**: 最適なエントリー/イグジット条件の組み合わせを発見

### 分割エントリー
- 分割エントリー戦略（equal, pyramid, reverse-pyramid）
- シグナルベースまたは価格ベースの間隔
- 部分利確サポート

### ボラティリティレジーム検出
- 市場ボラティリティを分類（low, normal, high, extreme）
- ボラティリティ環境によるトレードフィルタリング
- スクリーニング用ATR%フィルタ

### CLIツール
- **スクリーニングCLI**: 複数銘柄をエントリー/イグジット条件でスクリーニング
- **バックテストCLI**: 単一ファイルまたは複数ファイルの比較バックテスト
- 出力形式: table, JSON, CSV

### ユーティリティ
- データ正規化（様々な日付形式をタイムスタンプに変換）
- タイムフレーム変換（日足から週足/月足へ）
- Fluent API（メソッドチェーン）

### シグナル説明エンジン
- シグナル発火理由を構造化されたトレースで確認
- 評価時点のインジケーター値をキャプチャ
- 英語・日本語での人間可読なナラティブ
- プリセット・複合・MTF条件の任意の組み合わせに対応

### インジケーター合成
- `pipe()` / `compose()` / `through()` APIでインジケーターをチェーン
- 任意のインジケーターの出力に別のインジケーターを適用: `ema(rsi(candles, 14), 9)`
- 複合インジケーターからフィールドを抽出（MACDヒストグラム、ボリンジャー%B）
- `mapValues()`、`combineSeries()`でシリーズを変換・結合

### アルファ減衰モニター
- 戦略の予測力低下を経時的に追跡
- ローリング情報係数（IC）とヒット率
- CUSUM構造変化検出
- 4段階評価: healthy, warning, degraded, critical

### 適応型インジケーター
- **適応型RSI**: ATRボラティリティパーセンタイルに基づいて期間を調整
- **適応型ボリンジャーバンド**: 尖度に基づいて標準偏差倍率を調整
- **適応型MA**: 効率比（トレンド vs レンジ）で平滑化を適応
- **適応型ストキャスティクス**: ADXトレンド強度に基づいて期間を調整

### 戦略ロバストネススコア
- 複数の次元からA+〜Fの総合グレード
- モンテカルロ生存率、トレード一貫性、ドローダウン耐性
- パラメータ感度とウォークフォワード効率による完全分析
- 改善のための具体的な推奨事項

### ペアトレーディング / 共和分
- Engle-Granger共和分検定（ADF）
- zスコアによるスプレッド計算（全サンプルまたはローリングウィンドウ）
- 平均回帰ハーフライフ推定（AR(1)モデル）
- 再スケール範囲分析によるハースト指数
- 自動ペアトレーディングシグナル生成

### クロスアセット相関
- ローリングピアソン相関とスピアマン相関
- 相関レジーム検出（5レジーム、期間トラッキング付き）
- 複数ラグでのクロス相関によるリードラグ分析
- zスコア有意性によるインターマーケット・ダイバージェンス検出

### ライブストリーミングパイプライン
- `createLiveCandle()` — ティック/ローソク足アグリゲーターとインクリメンタル指標を統合
- 160+ のインクリメンタル指標ファクトリでバーごとに更新
- イベント駆動API（`tick`, `candleComplete`）でライブフィードに対応
- state の保存/復元でセッション再開が可能

### シリーズメタデータ
- `tagSeries()` / `SeriesMeta` — インジケーター出力に非列挙の `__meta` プロパティでドメインメタデータ（ラベル、overlay、Y軸レンジ、参照線）を付与
- `livePresets` / `indicatorPresets` — メタデータ・デフォルトパラメータ・ファクトリ/compute のペアを束ねたインジケーターレジストリ。UI・スクリーナー・レンダラー等へのゼロコンフィグ配線に利用可能
- 完全にオプトイン: メタデータを使わない利用者は単に無視できる

## TA-Lib クロスバリデーション

36個のインジケーターを [TA-Lib](https://ta-lib.org/)（Python ta-lib 0.6.8）と照合検証しています。4つのマーケットフェーズ（上昇トレンド → 高ボラティリティ → レンジ → 下降トレンド）をカバーする200本の合成OHLCVデータを使用。テストコードとフィクスチャは `cross-validation/` ディレクトリにあります。

| 精度 | インジケーター | 小数桁 |
|------|---------------|--------|
| **完全一致** | SMA, Highest, Lowest, Donchian Channel, Median Price, Typical Price, Weighted Close, OBV, ADL, Standard Deviation | 9+ |
| **高精度** | EMA, WMA, RSI, CCI, Williams %R, ROC, ATR, MFI, DMI/ADX, Keltner Channel, Bollinger Bands, KAMA, Parabolic SAR, DEMA, TEMA, CMO, Aroon, ADXR, Ultimate Oscillator, Linear Regression | 6–8 |
| **良好** | MACD, Stochastics (Fast/Slow), T3, StochRSI, PPO | 3–4 |

> **良好ティアの注記**: 微小な差異は実装の違い（MACD の EMA シード、T3 のカスケード EMA ウォームアップなど）に起因します。系列が長くなると収束します。

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
import { chandelierExit, calculateAtrStop, TrendCraft, goldenCross, deadCross } from 'trendcraft';

// シャンデリアイグジット（トレーリングストップ）
const chandelier = chandelierExit(candles, { period: 22, multiplier: 3 });
chandelier.forEach(({ time, value }) => {
  console.log(`ロングストップ: ${value.longStop}, ショートストップ: ${value.shortStop}`);
});

// ATRベースのストップ・利確レベルを計算
const stops = calculateAtrStop({
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

### シグナル説明エンジン

```typescript
import { explainSignal, rsiBelow, goldenCrossCondition } from 'trendcraft';

const explanation = explainSignal(candles, 50, rsiBelow(30), goldenCrossCondition());

console.log(explanation.fired);       // true/false
console.log(explanation.narrative);   // "Entry signal fired because rsiBelow(30): passed..."
console.log(explanation.contributions);  // [{ name: "rsiBelow(30)", passed: true, indicatorValues: { rsi14: 28.5 } }]
```

### インジケーター合成

```typescript
import { pipe, through, extractField, rsi, ema, macd, bollingerBands } from 'trendcraft';

// RSIのEMA（平滑化RSI）
const smoothedRsi = pipe(
  candles,
  c => rsi(c, { period: 14 }),
  through(ema, { period: 9 }),
);

// MACDヒストグラムのボリンジャーバンド
const histBands = pipe(
  candles,
  c => macd(c),
  s => extractField(s, "histogram"),
  through(bollingerBands, { period: 20 }),
);
```

### アルファ減衰モニター

```typescript
import { analyzeAlphaDecay, createObservationsFromTrades, runBacktest } from 'trendcraft';

const result = runBacktest(candles, entry, exit, options);
const observations = createObservationsFromTrades(result.trades);
const decay = analyzeAlphaDecay(observations);

console.log(decay.assessment.status);    // "healthy" | "warning" | "degraded" | "critical"
console.log(decay.assessment.halfLife);  // ICが半減するまでの推定バー数
```

### 適応型インジケーター

```typescript
import { adaptiveRsi, adaptiveBollinger } from 'trendcraft';

// 高ボラティリティ時に短い期間を使うRSI
const arsi = adaptiveRsi(candles, { basePeriod: 14, minPeriod: 6, maxPeriod: 28 });
arsi.forEach(({ value }) => {
  console.log(`RSI: ${value.rsi}, Period: ${value.effectivePeriod}`);
});

// 尖度に基づいて倍率が適応するボリンジャーバンド
const abb = adaptiveBollinger(candles, { period: 20 });
```

### 戦略ロバストネススコア

```typescript
import { quickRobustnessScore, runBacktest } from 'trendcraft';

const result = runBacktest(candles, entry, exit, options);
const robustness = quickRobustnessScore(result);

console.log(robustness.grade);          // "A+" to "F"
console.log(robustness.compositeScore); // 0-100
console.log(robustness.recommendations); // ["Strategy passes all robustness checks..."]
```

### ペアトレーディング

```typescript
import { analyzePair } from 'trendcraft';

const result = analyzePair(
  candlesA.map(c => ({ time: c.time, value: c.close })),
  candlesB.map(c => ({ time: c.time, value: c.close })),
);

if (result.cointegration.isCointegrated) {
  console.log(`Hedge ratio: ${result.cointegration.hedgeRatio}`);
  console.log(`Half-life: ${result.meanReversion.halfLife} bars`);
  console.log(`Signals: ${result.signals.length}`);
}
```

### クロスアセット相関

```typescript
import { analyzeCorrelation } from 'trendcraft';

const analysis = analyzeCorrelation(
  seriesSPY.map(c => ({ time: c.time, value: c.close })),
  seriesQQQ.map(c => ({ time: c.time, value: c.close })),
  { window: 60 },
);

console.log(`Current regime: ${analysis.summary.currentRegime}`);
console.log(`Lead-lag: ${analysis.leadLag.assessment}`);
console.log(`Divergences: ${analysis.divergences.length}`);
```

### `createLiveCandle` によるライブストリーミング

```typescript
import { createLiveCandle, incremental } from 'trendcraft';

const live = createLiveCandle({
  intervalMs: 60_000,
  indicators: [
    { name: 'sma20', create: (s) => incremental.createSma({ period: 20 }, { fromState: s }) },
    { name: 'rsi14', create: (s) => incremental.createRsi({ period: 14 }, { fromState: s }) },
  ],
  history: historicalCandles,
});

live.on('candleComplete', ({ candle, snapshot }) => {
  console.log('終値:', candle.close, 'SMA20:', snapshot.sma20, 'RSI14:', snapshot.rsi14);
});

// ティックモード — WebSocket からトレードを流し込む
ws.on('trade', (t) => live.addTick(t));

// またはローソク足モード — 形成済みのバーを流し込む
live.addCandle(bar);
```

`livePresets` と `indicatorPresets` は、これらのファクトリの 76 / 95 個をメタデータとバンドルしたレジストリで、任意の利用者（UI・スクリーナー・レンダラーなど）がゼロコンフィグで指標を登録できます:

```typescript
import { livePresets, indicatorPresets } from 'trendcraft';

const sma = livePresets.sma;  // { meta, defaultParams, snapshotName, createFactory }
const rsi = indicatorPresets.rsi; // 静的モード用の .compute() も持つ
```

### シリーズメタデータ

組み込みインジケーターの出力はすべて、ドメイン特性（ラベル、価格スケールを共有するか、固定 Y 軸レンジ、参照線）を示す非列挙の `__meta` プロパティを持ちます。データとしてのプレーンなオブジェクトなので、利用者は必要なら読めばよく、不要なら無視すれば済みます。

```typescript
import { tagSeries, rsi } from 'trendcraft';

const r = rsi(candles, { period: 14 });
r.__meta; // { label: 'RSI', overlay: false, yRange: [0, 100], referenceLines: [30, 70] }

// 自作 Series に同じ形式でメタデータを付与
const my = tagSeries(myData, {
  label: 'Custom Score',
  overlay: false,
  yRange: [0, 1],
  referenceLines: [0.5],
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

# 最小データポイント数を指定
npx trendcraft-screen ./data --entry "goldenCross" --min-data 200
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

# カスタム資金と手数料
npx trendcraft-backtest ./data/6758.T.csv \
  --entry "goldenCross" --exit "deadCross" \
  --capital 500000 --commission 500

# トレーリングストップ付き
npx trendcraft-backtest ./data/6758.T.csv \
  --entry "goldenCross" --exit "deadCross" \
  --trailing-stop 3
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
| 検証済みクロス | `validatedGoldenCross`, `validatedDeadCross` |
| RSI | `rsiBelow30`, `rsiBelow40`, `rsiAbove60`, `rsiAbove70` |
| MACD | `macdCrossUp`, `macdCrossDown` |
| パーフェクトオーダー | `perfectOrderBullish`, `perfectOrderBearish`, `perfectOrderCollapsed`, `perfectOrderActiveBullish`, `perfectOrderActiveBearish`, `perfectOrderBullishConfirmed`, `perfectOrderBearishConfirmed`, `perfectOrderConfirmationFormed`, `perfectOrderBreakdown`, `perfectOrderMaCollapsed`, `perfectOrderPreBullish`, `perfectOrderPreBearish`, `perfectOrderPullbackEntry`, `perfectOrderPullbackSellEntry` |
| PO拡張 | `poPlusEntry`, `pbEntry`, `poPlusPbEntry` |
| 価格 | `priceAboveSma25`, `priceBelowSma25`, `priceDroppedAtr` |
| ボリンジャー | `bollingerBreakoutUp`, `bollingerBreakoutDown` |
| ストキャスティクス | `stochBelow20`, `stochAbove80`, `stochCrossUp`, `stochCrossDown` |
| DMI/ADX | `dmiBullish`, `dmiBearish`, `adxStrong` |
| 出来高 | `volumeAnomaly`, `volumeAbove1_5x`, `volumeAbove2x`, `volumeConfirmsTrend` |
| 出来高拡張 | `volumeExtreme`, `volumeDivergence`, `bullishVolumeDivergence`, `bearishVolumeDivergence`, `volumeTrendConfidence`, `nearPoc`, `inValueArea`, `breakoutVah`, `breakdownVal`, `priceAbovePoc`, `priceBelowPoc`, `cmfAbove`, `cmfBelow`, `obvRising`, `obvFalling`, `obvCrossUp`, `obvCrossDown` |
| レンジ | `rangeBreakout`, `rangeConfirmed`, `inRangeBound`, `tightRange` |
| レンジ拡張 | `rangeForming`, `breakoutRiskUp`, `breakoutRiskDown`, `rangeScoreAbove` |
| ボラティリティ | `atrPercentAbove2_3`, `atrPercentAbove3` |
| ボラティリティレジーム | `volatilityExpanding`, `volatilityContracting`, `volatilityAbove`, `volatilityBelow`, `atrPercentileAbove`, `atrPercentileBelow`, `atrPercentBelow` |
| パターン | `anyBullishPattern`, `anyBearishPattern`, `doubleTopDetected`, `doubleBottomDetected`, `headShouldersDetected`, `inverseHeadShouldersDetected`, `cupHandleDetected` |
| SMC | `priceAtBullishOrderBlock`, `priceAtBearishOrderBlock`, `orderBlockCreated`, `liquiditySweepDetected`, `liquiditySweepRecovered`, `hasRecentSweeps` |

詳細なパラメータと使用例は [APIリファレンス](./docs/API.md#preset-conditions) を参照してください。

## クックブック

実用的なレシピ集は [Cookbook](./docs/COOKBOOK.md) を参照してください：
- ゴールデンクロス + RSI バックテスト
- ADX + ボリュームによるトレンドフォロー
- ボリンジャーバンドによるミーンリバージョン
- マルチタイムフレーム戦略
- ATRリスク管理 + ポジションサイジング
- ウォークフォワード検証によるパラメータ最適化
- リアルタイムストリーミングパイプライン
- スコアリングベースのエントリー戦略
- 銘柄スクリーニング
- スケールドエントリー + 部分利確
- シグナル説明エンジンによる戦略デバッグ
- インジケーター合成パイプライン
- アルファ減衰モニタリング
- 共和分によるペアトレーディング
- クロスアセット相関分析

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
