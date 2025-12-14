# TrendCraft

金融データのテクニカル分析を行うTypeScriptライブラリ。インジケーターの計算、シグナル検出、マーケットトレンド分析ができます。

[English README](./README.md)

## 機能

### インジケーター
- **移動平均**: SMA, EMA
- **モメンタム**: RSI, MACD, ストキャスティクス (Fast/Slow), DMI/ADX, Stoch RSI
- **ボラティリティ**: ボリンジャーバンド, ATR, ドンチャンチャネル
- **出来高**: OBV, MFI, 出来高移動平均
- **価格**: 最高値/最安値, リターン

### シグナル検出
- **クロス検出**: ゴールデンクロス、デッドクロス、カスタムクロスオーバー
- **ダイバージェンス**: OBV、RSI、MACDのダイバージェンス検出
- **スクイーズ**: ボリンジャーバンドのスクイーズ検出

### ユーティリティ
- データ正規化（様々な日付形式をタイムスタンプに変換）
- タイムフレーム変換（日足から週足/月足へ）

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
