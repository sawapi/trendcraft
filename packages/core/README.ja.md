# TrendCraft

依存ゼロのTypeScriptテクニカル分析ライブラリ。130以上のインジケーター、シグナル検出、バックテスト、最適化、ライブストリーミングを提供します。

[English README](./README.md)

TrendCraftは、生のOHLCVローソク足をインジケーター・トレーディングシグナル・バックテスト済み戦略へと変換します。すべて純粋なTypeScriptで実装され、ランタイム依存はありません。すべてのインジケーターは同じ`Series<T>`形式（`{ time, value }[]`）を返すため、結果はきれいに合成でき、任意のチャートライブラリやデータパイプラインで利用できます。Node・ブラウザの両方で動作します。

## インストール

```bash
pnpm add trendcraft
# または
npm install trendcraft
```

## クイックスタート

```typescript
import { sma, rsi, bollingerBands } from 'trendcraft';
import { TrendCraft, goldenCrossCondition, deadCrossCondition, and, rsiBelow } from 'trendcraft';

const candles = [
  { time: 1700000000000, open: 100, high: 105, low: 99, close: 104, volume: 1000 },
  // ... さらにローソク足（OHLCV形式）
];

// インジケーターの計算 — 各関数は Series<T> = { time, value }[] を返す
const sma20 = sma(candles, { period: 20 });
const rsi14 = rsi(candles, { period: 14 });
const bb    = bollingerBands(candles, { period: 20, stdDev: 2 });

// Fluent APIで戦略をバックテスト
const result = TrendCraft.from(candles)
  .strategy()
    .entry(and(goldenCrossCondition(), rsiBelow(50)))
    .exit(deadCrossCondition())
  .backtest({ capital: 1_000_000, stopLoss: 5, takeProfit: 15 });

console.log(`Return: ${result.totalReturnPercent.toFixed(2)}%  Sharpe: ${result.sharpeRatio.toFixed(3)}`);
```

実行可能なスクリプトは [`examples/quick-start/`](./examples/quick-start/) にあります（インジケーター、バックテスト、最適化、スクリーニング、ストリーミング）。

## 主な機能

- **インジケーター（130以上）** — 移動平均（SMA, EMA, KAMA, T3, HMA…）、トレンド（一目均衡表, Supertrend, パラボリックSAR）、モメンタム（RSI, MACD, ストキャスティクス, DMI/ADX, Connors RSI…）、ボラティリティ（ボリンジャーバンド, ATR, ケルトナー, ドンチャン, Choppiness）、出来高（OBV, MFI, VWAP, CMF, ボリュームプロファイル, CVD…）、価格構造（ピボット, スイング, FVG, BOS/CHoCH, S/Rゾーン）、さらにSmart Money Concepts、Wyckoff/VSA、ICTセッション、HMMレジーム、アダプティブ系、相対強度。
- **シグナル検出** — ゴールデン/デッドクロス、RSI/MACD/OBVダイバージェンス、ボリンジャースクイーズ、レンジ相場検出、チャートパターン（ダブルトップ/ボトム、ヘッドアンドショルダー、トライアングル、ウェッジ、フラッグ）。
- **バックテスト** — プリセット条件による戦略構築、ストップロス・テイクプロフィット・トレーリングストップ、手数料/スリッページ、マルチタイムフレーム条件、各種パフォーマンス指標（シャープレシオ、最大ドローダウン、勝率、プロフィットファクター）。
- **最適化** — 制約付きグリッドサーチ、アウトオブサンプル検証のウォークフォワード分析、組み合わせ探索。
- **シグナルスコアリング** — 重み付きマルチシグナルスコアリング、プリセット、Fluentな`ScoreBuilder`。
- **ポジションサイジング & リスク** — リスクベース・ATRベース・ケリー・固定比率サイジング、ATRストップとシャンデリアエグジット、VaR/CVaR、リスクパリティ、相関調整サイジング。
- **ストリーミング** — `createLiveCandle()` がティックやローソク足を集約し、90以上のインクリメンタルなインジケーターファクトリをバーごとに駆動。再開可能なセッションのための状態保存/復元に対応。
- **高度な分析** — ペアトレード/共和分、クロスアセット相関、アルファ減衰モニタリング、戦略ロバストネススコアリング、シグナル説明可能性。

48個のインジケーターはTA-Libと相互検証済みです — [`cross-validation/`](./cross-validation/) を参照してください。

## エントリーポイント

```typescript
// インジケーター
import { sma, ema, rsi, macd, bollingerBands, atr } from 'trendcraft';

// シグナル検出
import { goldenCross, deadCross, rsiDivergence, bollingerSqueeze } from 'trendcraft';

// バックテスト（Fluent API + プリセット条件）
import { TrendCraft, and, or, goldenCrossCondition, rsiBelow } from 'trendcraft';

// 最適化
import { gridSearch, walkForwardAnalysis } from 'trendcraft';

// ストリーミング
import { createLiveCandle, incremental } from 'trendcraft';

// サブパス
import { ... } from 'trendcraft/safe';        // Result型インジケーター
import { ... } from 'trendcraft/incremental';  // バーごとのファクトリ
import { ... } from 'trendcraft/screening';    // 銘柄スクリーニング
import { ... } from 'trendcraft/manifest';     // インジケーターメタデータ
```

`Candle`の`time`はUnixタイムスタンプ・日付文字列・`Date`を受け付け、すべてのインジケーターは`Series<T> = { time: number, value: T }[]`を返します。

3つのCLIツールが同梱されています: `trendcraft-screen`、`trendcraft-backtest`、`trendcraft-analyze`（`npx`で実行。screen/backtest は `--list` で利用可能な条件を確認できます）。

## ドキュメント

- [ガイド](./docs/GUIDE.ja.md) — 使い方と概念の解説（[English](./docs/GUIDE.md)）
- [APIリファレンス](./docs/API.ja.md) — 全API（[English](./docs/API.md)）
- [クックブック](./docs/COOKBOOK.md) — 実践的なレシピ
- [マイグレーション: 0.3 → 0.4](./docs/migration-0.3-to-0.4.md)
- [CHANGELOG](./CHANGELOG.md)
- [llms.txt](./llms.txt) / [llms-full.txt](./llms-full.txt) — LLM向けサマリー

## 免責事項

`trendcraft` は情報提供および教育目的のテクニカル分析プリミティブを提供するものです。インジケーターの値・シグナル・バックテスト結果は投資助言ではなく、いかなる金融商品の売買・保有を推奨するものでもありません。本ソフトウェアを用いた取引判断の責任はすべて利用者にあります。

## ライセンス

MIT
