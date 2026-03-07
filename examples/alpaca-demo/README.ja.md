# Alpaca Demo — マルチエージェント・ペーパートレードシステム

TrendCraftのストリーミングモジュールとAlpaca Marketsのペーパートレード APIを組み合わせたマルチエージェント売買システムです。LLM駆動の自己改善サイクルにより、トレードレベルのデータ分析・市場レジーム検出・推奨成果追跡を自動で行います。

## アーキテクチャ

```
レイヤー 1: バックテストトーナメント
  複数戦略 → 過去データ(Alpaca REST) → TrendCraftバックテスト → ランキング + モンテカルロ

レイヤー 2: ペーパートレード
  上位戦略 → Alpaca WebSocket → TrendCraft ManagedSession → Alpaca Paper注文

レイヤー 3: 自己改善サイクル
  トレード詳細 + 市場レジーム → LLMレビュー → 安全性検証 → 変更適用 → 成果追跡
```

### 自己改善サイクル

クローズドループのフィードバックサイクルで戦略パフォーマンスを継続的に改善します：

```
┌─────────────────────────────────────────────────────────────────┐
│                       自己改善サイクル                            │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ データ   │───>│  分析    │───>│  変更    │───>│  成果    │  │
│  │ 収集     │    │  (LLM)   │    │  適用    │    │  追跡    │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       ▲                                               │         │
│       └───────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

1. **収集** — トレードごとのMFE/MAE/決済理由、市場レジーム（ボラティリティ + トレンド）、集約メトリクス
2. **分析** — LLMが全コンテキストを受け取り、パラメータ調整・エージェント停止/復活・新戦略を提案
3. **適用** — 安全レイヤーが変更を検証（日次±20%制限、パレット範囲、累積ドリフト上限、戦略別クールダウン、週次上限）。新戦略にはWFA + モンテカルロゲートを適用
4. **追跡** — 5営業日後にベンチマーク相対評価で成果を判定。2回連続悪化で自動ロールバック

## セットアップ

### 前提条件

- Node.js 18以上
- pnpm
- Alpaca Marketsアカウント（ペーパートレード）
- Anthropic APIキー（LLMレビュー用）

### インストール

```bash
cd examples/alpaca-demo
pnpm install
```

### 設定

`.env.example` を `.env` にコピーし、認証情報を記入します：

```bash
cp .env.example .env
```

必要な環境変数：

| 変数 | 説明 | 取得先 |
|------|------|--------|
| `ALPACA_API_KEY` | Alpaca APIキー | [Alpaca Dashboard](https://app.alpaca.markets/signup) |
| `ALPACA_API_SECRET` | Alpaca APIシークレット | 同上 |
| `ALPACA_BASE_URL` | ペーパートレードエンドポイント | `https://paper-api.alpaca.markets` |
| `ALPACA_DATA_URL` | マーケットデータエンドポイント | `https://data.alpaca.markets` |
| `ALPACA_STREAM_URL` | WebSocketエンドポイント | `wss://stream.data.alpaca.markets/v2/iex` |
| `ANTHROPIC_API_KEY` | Anthropic APIキー（LLMレビュー用） | [Anthropic Console](https://console.anthropic.com/) |

## 使い方

### バックテストトーナメント

全戦略を過去データで実行し、ランキングを表示します：

```bash
# デフォルト: 6ヶ月、日足
pnpm run backtest

# カスタムオプション
pnpm run backtest -- --symbols AAPL,SPY --period 3 --capital 50000 --timeframe 1Hour
```

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `-s, --symbols <list>` | カンマ区切りの銘柄リスト | デフォルト銘柄 |
| `-p, --period <months>` | 遡及期間（月数） | `6` |
| `-c, --capital <amount>` | 戦略ごとの初期資金 | `100000` |
| `-t, --timeframe <tf>` | バーの時間足（`1Min`, `5Min`, `1Hour`, `1Day`） | `1Day` |

### ライブペーパートレード

WebSocketリアルタイムデータでペーパートレードを開始します：

```bash
# 単一戦略、ドライラン（注文なし）
pnpm run dev -- live --strategy rsi-mean-reversion --symbol AAPL --dry-run

# 全戦略、デフォルト銘柄
pnpm run dev -- live --all --dry-run

# ペーパートレード（Alpacaペーパーアカウントに実注文）
pnpm run dev -- live --all

# 自動日次レビューを無効化
pnpm run dev -- live --all --no-auto-review
```

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `-S, --strategy <id>` | 単一戦略ID | — |
| `-s, --symbol <symbol>` | 単一銘柄 | — |
| `--symbols <list>` | カンマ区切りの銘柄リスト | デフォルト銘柄の最初2つ |
| `-a, --all` | 全戦略を使用 | — |
| `-d, --dry-run` | ドライラン（注文なし） | `false` |
| `-c, --capital <amount>` | エージェントごとの資金 | `100000` |
| `--no-auto-review` | 自動日次レビューを無効化 | 有効 |

ライブモード実行中のシステム動作：
- エージェント状態を5分ごとに保存
- リーダーボードを1時間ごとに表示
- ポジションをAlpacaと15分ごとに照合（非ドライラン時）
- クラッシュ復旧用のハートビートを記録（デッドマンスイッチ）
- **16:05 ET（米国市場クローズ後5分）に自動日次レビューを実行**（`--no-auto-review` で無効化可能）

### 日次レビュー

パフォーマンスレポートを生成し、LLMから推奨を取得します：

```bash
# レポートのみ（LLM API呼び出しなし）
pnpm run dev -- review --report-only

# レポート生成 + LLMレビュー（プレビューモード）
pnpm run dev -- review

# レポート生成 + LLMレビュー + 変更適用
pnpm run dev -- review --apply

# バックテスト結果からレビュー（ライブ状態不要）
pnpm run dev -- review --from-backtest --symbols SPY --period 3

# より多くの履歴コンテキストをLLMに提供
pnpm run dev -- review --apply --days 14
```

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `--report-only` | レポートのみ生成（LLM API呼び出しなし） | — |
| `--apply` | 検証済みLLM推奨を適用 | プレビューのみ |
| `--days <n>` | LLMコンテキストに含めるレビュー履歴日数 | `7` |
| `--from-backtest` | ライブ状態の代わりにバックテスト結果をレビュー | — |
| `-s, --symbols <list>` | バックテストレビュー用の銘柄 | `SPY` |
| `-p, --period <months>` | バックテスト遡及期間 | `3` |
| `-t, --timeframe <tf>` | バックテスト時間足 | `1Day` |
| `-c, --capital <amount>` | バックテスト用資金 | `100000` |

### ステータスと管理

```bash
# 保存状態からエージェントリーダーボードを表示
pnpm run dev -- status

# エージェントのティアを手動で昇格/降格
pnpm run dev -- promote --agent rsi-mean-reversion:AAPL --tier live
```

## 自己改善サイクルの詳細

### トレードレベル分析

各エージェントは `getTrades()` でトレードごとのデータをLLMに公開します：

- **エントリー/エグジット価格と時刻**
- **決済理由**: `signal`, `stopLoss`, `takeProfit`, `trailing`, `breakeven`, `scaleOut`, `timeExit`, `endOfData`
- **MFE**（Max Favorable Excursion）: トレード中の最大含み益 %
- **MAE**（Max Adverse Excursion）: トレード中の最大含み損 %
- **MFE利用率**: `実際のリターン / MFE` — 利用可能な最大利益のうち、どれだけ獲得できたか

LLMに渡されるコンテキスト例：

```
Recent Trades:
  #1: LONG $150.00→$155.00 (+3.3%) exit:takeProfit MFE:4.1% MAE:-0.8% util:81% 5bars
  #2: LONG $148.50→$146.00 (-1.7%) exit:stopLoss MFE:0.5% MAE:-2.0% util:0% 2bars
  Analysis: exits=[takeProfit:1 stopLoss:1] avgMFEUtil:40%
```

### 市場レジーム検出

レビューシステムは60日以上の日足データを取得し、以下を計算します：

| メトリクス | 計算方法 | 分類 |
|-----------|---------|------|
| **ボラティリティレジーム** | ATR(14)の60日ルックバック内パーセンタイル | `low`（25%以下）、`normal`（25-75%）、`high`（75%以上） |
| **トレンド方向** | EMA(20) vs EMA(50) のスプレッド | `bullish`（+0.5%超）、`bearish`（-0.5%未満）、`sideways`（±0.5%以内） |
| **トレンド強度** | EMAスプレッドの絶対値 × 10（上限100） | 0-100スケール |

LLMに渡されるコンテキスト例：

```
Market Context:
- SPY: $520.30 (-0.85%) | Vol: high (ATR: 1.8%) | Trend: bearish (ADX: 35)
```

LLMはレジームに応じたアドバイスを行います：
- **高ボラティリティ** → ストップ拡大、ポジション縮小を推奨
- **低ボラティリティ** → タイトなストップ許容、トレンドフォロー非推奨
- **横ばい** → ミーンリバージョン戦略（RSI）が有利
- **強いトレンド** → トレンドフォロー推奨、トレイリングストップ拡大

### 成果追跡

LLM推奨の適用後、システムはパフォーマンスの改善/悪化を追跡します：

1. 各適用アクションは、適用時点の戦略スコアを記録
2. **5営業日**経過後に評価（市場ノイズの影響を低減）
3. **ベンチマーク相対評価**: スコア変動を市場全体の動きで調整し、市場下落局面での不当なペナルティを防止
4. 判定: `improved`（相対デルタ +3超）、`degraded`（-3未満）、`neutral`（それ以外）
5. 成果履歴は次回以降のレビューでLLMにフィードバック

LLMに渡されるコンテキスト例：

```
Outcomes:
  - adjust_params(rsi-mean-reversion): IMPROVED (score: 45→52) [relative: +5.2, mkt: +1.8%]
  - adjust_params(macd-trend): DEGRADED (score: 60→55) [relative: -6.1, mkt: +1.1%]
```

#### 自動ロールバック

戦略が**2回連続で「degraded」判定**を受けた場合、パラメータオーバーライドを自動的にオリジナルプリセットに戻します。LLMの誤った推奨が累積して悪化し続けることを防止します。

#### Buy & Hold ベンチマーク

バックテストレビューレポートには各銘柄のBuy & Holdリターンが併記され、ベースラインを提供します。戦略はリスク調整ベースでB&Hを上回ることが理想です。

LLMへの指示：
- **degraded** のアクションは取り消しを検討
- **improved** のアクションのパターンを他の低パフォーマンス戦略にも適用検討
- 戦略リターンをB&Hベンチマークと比較

### 自動レビュースケジューリング

`live` モードでは、**16:05 ET**（米国市場クローズ5分後）に日次レビューが自動スケジュールされます：

- 土日はスキップ
- 当日すでにレビュー実行済みの場合はスキップ
- `--apply` モードで自動的に検証済み変更を適用
- `--no-auto-review` フラグで無効化可能

## 戦略一覧

| ID | 名前 | 説明 |
|----|------|------|
| `rsi-mean-reversion` | RSIミーンリバージョン | RSI(14) < 30で買い、RSI(14) > 70で売り |
| `macd-trend` | MACDトレンドフォロー | MACDブリッシュクロスでエントリー、ベアリッシュクロスでエグジット |
| `bollinger-squeeze` | ボリンジャースクイーズ | 下限BB + RSI < 40で買い、上限BBまたはRSI > 70で売り |
| `vwap-bounce` | VWAPバウンス | VWAPサポート付近でRSI確認して買い、EMA(9)で売り |

LLMはインジケーター/コンディションパレットから**新しい戦略を作成**することもできます（バックテスト検証ゲート付き）。

### 高度なエグジット戦略

各戦略で以下のエグジットメカニズムを設定可能です：

| エグジット種別 | 説明 |
|---------------|------|
| ATRトレイリングストップ | ボラティリティ適応型トレイリングストップ（`atrTrailingStop: { period, multiplier }`） |
| 部分利確 | 閾値到達時に一部利確（`partialTakeProfit: { threshold, portion }`） |
| ブレイクイーブンストップ | トリガー後にストップをブレイクイーブンに移動（`breakEvenStop: { triggerPercent, offset }`） |
| シグナルライフサイクル | クールダウンバー、デバウンスバー、有効期限バーでウィップソーシグナルをフィルタ |

## 安全性と検証

すべてのLLM推奨は多層安全パイプラインを通過します：

| ゲート | 制約 |
|--------|------|
| パラメータ範囲 | すべての値がパレットのmin/max範囲内 |
| 日次変更制限 | パラメータ変更は日次±20%まで |
| 累積ドリフト上限 | オリジナルプリセットから±50%まで |
| レート制限 | kill 1回/日、revive 1回/日、create 1回/日 |
| 変更頻度制限 | 同一戦略の変更は3日以上の間隔が必要 |
| 週次上限 | パラメータ調整は週3回まで |
| 自動ロールバック | 2回連続「degraded」判定 → オリジナルプリセットに復帰 |
| バックテストゲート | 新戦略はスコア30以上が必要 |
| ウォークフォワード分析 | OOS Sharpe > 0 かつ WFA効率 > 0.5 |
| モンテカルロ | 統計的有意性の検証 |

## 昇格基準

| メトリクス | 昇格 | 降格 |
|-----------|------|------|
| Sharpe Ratio | ≥ 0.8 | — |
| 勝率 | ≥ 40% | — |
| 最大ドローダウン | ≤ 15% | > 25% |
| トレード数 | ≥ 15 | — |
| プロフィットファクター | ≥ 1.1 | — |
| 日次損失 | — | < -$10,000 |
| 評価期間 | ≥ 3日 | — |

## データファイル

システムは状態とレビューデータを `data/` ディレクトリに保存します：

| ファイル | 用途 |
|---------|------|
| `data/state.json` | エージェント状態、メトリクス、セッション状態 |
| `data/strategy-overrides.json` | LLMが適用したパラメータオーバーライド |
| `data/custom-strategies.json` | LLMが作成した戦略テンプレート |
| `data/heartbeat.json` | クラッシュ復旧用デッドマンスイッチ |
| `data/reviews/{date}.json` | 日次レポート（JSON） |
| `data/reviews/{date}.md` | 日次レポート（Markdown） |
| `data/reviews/{date}-review.json` | LLMレビュー記録（適用/却下アクション付き） |

## プロジェクト構成

```
src/
├── index.ts                    # CLIエントリーポイント (commander)
├── config/                     # 環境設定、銘柄、市場時間、昇格閾値
├── strategy/                   # 戦略定義、テンプレート、パレット、コンパイラ
│   ├── template.ts             # プリセットテンプレート + オーバーライドシステム
│   ├── palette.ts              # 利用可能なインジケーターとコンディション
│   ├── compiler.ts             # テンプレート → StrategyDefinition コンパイラ
│   └── factory.ts              # 戦略 → ManagedSession ファクトリ
├── agent/                      # エージェント（戦略 × 銘柄）とAgentManager
│   ├── agent.ts                # getTrades(), getMetrics()付きエージェントラッパー
│   └── manager.ts              # マルチエージェントオーケストレーター
├── alpaca/                     # RESTクライアント、WebSocket、過去データ、キャッシュ
├── executor/                   # ペーパー、ドライラン、照合エグゼキューター
├── backtest/                   # トーナメントランナー、スコアラー、WFA、モンテカルロ
├── tracker/                    # パフォーマンス追跡とリーダーボード
├── persistence/                # JSON状態永続化
├── review/                     # 自己改善サイクル
│   ├── report-generator.ts     # トレード詳細付き日次レポート
│   ├── llm-prompt.ts           # レジーム+トレード+成果付きシステム/ユーザープロンプト
│   ├── llm-client.ts           # Claude APIラッパー
│   ├── safety.ts               # 多層検証パイプライン
│   ├── applier.ts              # アクション適用 + WFA/MCゲート
│   ├── history.ts              # レビュー記録永続化
│   ├── outcome-tracker.ts      # 推奨成果評価
│   └── scheduler.ts            # 16:05 ET自動日次レビュー
└── commands/                   # CLIコマンドハンドラ
    ├── backtest.ts
    ├── live.ts                 # ライブトレード + 自動レビュースケジューラ
    ├── review.ts               # レビューサイクル + レジーム検出
    ├── status.ts
    └── promote.ts
```
