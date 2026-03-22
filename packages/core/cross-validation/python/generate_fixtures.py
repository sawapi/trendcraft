"""
Generate cross-validation fixtures using TA-Lib.

Produces JSON fixture files containing expected indicator values
computed by the industry-standard TA-Lib (C-based) library.
These fixtures are consumed by vitest to verify TrendCraft accuracy.

Prerequisites:
  brew install ta-lib
  cd cross-validation/python && uv sync
"""

import json
import math
import random
from pathlib import Path

import numpy as np
import talib

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"


def generate_ohlcv(n: int = 200, seed: int = 42) -> dict:
    """Generate synthetic OHLCV data using Geometric Brownian Motion.

    Four phases: uptrend -> high volatility -> range -> downtrend.
    """
    random.seed(seed)
    np.random.seed(seed)

    phase_len = n // 4
    remainder = n - phase_len * 4

    # Phase parameters: (drift, volatility)
    phases = [
        (0.001, 0.015),   # Uptrend, normal vol
        (0.0005, 0.035),  # Slight up, high vol
        (0.0, 0.01),      # Range, low vol
        (-0.001, 0.02),   # Downtrend, moderate vol
    ]

    price = 100.0
    times = []
    opens = []
    highs = []
    lows = []
    closes = []
    volumes = []

    base_time = 1704067200000  # 2024-01-01T00:00:00Z

    idx = 0
    for phase_idx, (drift, vol) in enumerate(phases):
        count = phase_len + (1 if phase_idx < remainder else 0)
        for _ in range(count):
            t = base_time + idx * 86400000  # Daily bars
            times.append(t)

            o = price
            # Intraday simulation
            r1 = random.gauss(drift, vol)
            r2 = random.gauss(drift, vol)
            r3 = random.gauss(0, vol * 0.5)

            c = o * math.exp(r1)
            intra_high = max(o, c) * (1 + abs(r3))
            intra_low = min(o, c) * (1 - abs(random.gauss(0, vol * 0.5)))

            h = max(intra_high, o, c)
            l = min(intra_low, o, c)

            # Volume: higher on volatile days
            base_vol = 1_000_000
            vol_multiplier = 1 + abs(r1) * 20 + abs(r2) * 10
            v = int(base_vol * vol_multiplier * (1 + random.random() * 0.5))

            opens.append(round(o, 6))
            highs.append(round(h, 6))
            lows.append(round(l, 6))
            closes.append(round(c, 6))
            volumes.append(v)

            price = c
            idx += 1

    return {
        "length": n,
        "candles": [
            {
                "time": times[i],
                "open": opens[i],
                "high": highs[i],
                "low": lows[i],
                "close": closes[i],
                "volume": volumes[i],
            }
            for i in range(n)
        ],
    }


def to_json_safe(arr, length: int) -> list:
    """Convert TA-Lib output array to JSON-safe list with null padding."""
    if len(arr) == length:
        return [None if (isinstance(v, float) and np.isnan(v)) else round(float(v), 10) for v in arr]
    # TA-Lib returns shorter arrays for some functions; pad with nulls
    padded = [None] * (length - len(arr))
    padded.extend(
        [None if (isinstance(v, float) and np.isnan(v)) else round(float(v), 10) for v in arr]
    )
    return padded


def save_fixture(name: str, data: dict) -> None:
    """Save fixture JSON file."""
    path = FIXTURES_DIR / f"{name}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  -> {path.name}")


def generate_all(ohlcv: dict) -> None:
    """Generate all indicator fixtures."""
    n = ohlcv["length"]
    candles = ohlcv["candles"]
    close = np.array([c["close"] for c in candles], dtype=np.float64)
    high = np.array([c["high"] for c in candles], dtype=np.float64)
    low = np.array([c["low"] for c in candles], dtype=np.float64)
    volume = np.array([c["volume"] for c in candles], dtype=np.float64)

    # --- Phase 1: Direct-match indicators ---

    # SMA
    print("Generating SMA...")
    save_fixture("sma", {
        "indicator": "SMA",
        "talib_function": "SMA",
        "test_cases": [
            {
                "name": "sma_20",
                "params": {"period": 20},
                "values": to_json_safe(talib.SMA(close, timeperiod=20), n),
            },
            {
                "name": "sma_5",
                "params": {"period": 5},
                "values": to_json_safe(talib.SMA(close, timeperiod=5), n),
            },
        ],
    })

    # EMA
    print("Generating EMA...")
    save_fixture("ema", {
        "indicator": "EMA",
        "talib_function": "EMA",
        "test_cases": [
            {
                "name": "ema_12",
                "params": {"period": 12},
                "values": to_json_safe(talib.EMA(close, timeperiod=12), n),
            },
            {
                "name": "ema_26",
                "params": {"period": 26},
                "values": to_json_safe(talib.EMA(close, timeperiod=26), n),
            },
        ],
    })

    # WMA
    print("Generating WMA...")
    save_fixture("wma", {
        "indicator": "WMA",
        "talib_function": "WMA",
        "test_cases": [
            {
                "name": "wma_10",
                "params": {"period": 10},
                "values": to_json_safe(talib.WMA(close, timeperiod=10), n),
            },
            {
                "name": "wma_20",
                "params": {"period": 20},
                "values": to_json_safe(talib.WMA(close, timeperiod=20), n),
            },
        ],
    })

    # RSI
    print("Generating RSI...")
    save_fixture("rsi", {
        "indicator": "RSI",
        "talib_function": "RSI",
        "test_cases": [
            {
                "name": "rsi_14",
                "params": {"period": 14},
                "values": to_json_safe(talib.RSI(close, timeperiod=14), n),
            },
            {
                "name": "rsi_7",
                "params": {"period": 7},
                "values": to_json_safe(talib.RSI(close, timeperiod=7), n),
            },
        ],
    })

    # ATR
    print("Generating ATR...")
    save_fixture("atr", {
        "indicator": "ATR",
        "talib_function": "ATR",
        "test_cases": [
            {
                "name": "atr_14",
                "params": {"period": 14},
                "values": to_json_safe(talib.ATR(high, low, close, timeperiod=14), n),
            },
            {
                "name": "atr_7",
                "params": {"period": 7},
                "values": to_json_safe(talib.ATR(high, low, close, timeperiod=7), n),
            },
        ],
    })

    # CCI
    print("Generating CCI...")
    save_fixture("cci", {
        "indicator": "CCI",
        "talib_function": "CCI",
        "test_cases": [
            {
                "name": "cci_20",
                "params": {"period": 20},
                "values": to_json_safe(talib.CCI(high, low, close, timeperiod=20), n),
            },
            {
                "name": "cci_14",
                "params": {"period": 14},
                "values": to_json_safe(talib.CCI(high, low, close, timeperiod=14), n),
            },
        ],
    })

    # Williams %R
    print("Generating Williams %R...")
    save_fixture("williams-r", {
        "indicator": "WilliamsR",
        "talib_function": "WILLR",
        "test_cases": [
            {
                "name": "willr_14",
                "params": {"period": 14},
                "values": to_json_safe(talib.WILLR(high, low, close, timeperiod=14), n),
            },
            {
                "name": "willr_7",
                "params": {"period": 7},
                "values": to_json_safe(talib.WILLR(high, low, close, timeperiod=7), n),
            },
        ],
    })

    # Highest (MAX)
    print("Generating Highest...")
    save_fixture("highest", {
        "indicator": "Highest",
        "talib_function": "MAX",
        "test_cases": [
            {
                "name": "highest_20",
                "params": {"period": 20},
                "values": to_json_safe(talib.MAX(high, timeperiod=20), n),
            },
            {
                "name": "highest_10",
                "params": {"period": 10},
                "values": to_json_safe(talib.MAX(high, timeperiod=10), n),
            },
        ],
    })

    # Lowest (MIN)
    print("Generating Lowest...")
    save_fixture("lowest", {
        "indicator": "Lowest",
        "talib_function": "MIN",
        "test_cases": [
            {
                "name": "lowest_20",
                "params": {"period": 20},
                "values": to_json_safe(talib.MIN(low, timeperiod=20), n),
            },
            {
                "name": "lowest_10",
                "params": {"period": 10},
                "values": to_json_safe(talib.MIN(low, timeperiod=10), n),
            },
        ],
    })

    # ROC
    print("Generating ROC...")
    save_fixture("roc", {
        "indicator": "ROC",
        "talib_function": "ROC",
        "test_cases": [
            {
                "name": "roc_12",
                "params": {"period": 12},
                "values": to_json_safe(talib.ROC(close, timeperiod=12), n),
            },
            {
                "name": "roc_9",
                "params": {"period": 9},
                "values": to_json_safe(talib.ROC(close, timeperiod=9), n),
            },
        ],
    })

    # OBV
    print("Generating OBV...")
    obv_raw = talib.OBV(close, volume)
    # TA-Lib OBV starts with the first bar's volume; TrendCraft starts at 0
    # Normalize: subtract the first value so both start at 0
    obv_normalized = obv_raw - obv_raw[0]
    save_fixture("obv", {
        "indicator": "OBV",
        "talib_function": "OBV",
        "note": "TA-Lib OBV normalized by subtracting first value (TA-Lib starts at first volume, TrendCraft starts at 0)",
        "test_cases": [
            {
                "name": "obv",
                "params": {},
                "values": to_json_safe(obv_normalized, n),
            },
        ],
    })

    # --- Phase 2: Composite output indicators ---

    # MACD
    print("Generating MACD...")
    macd_line, macd_signal, macd_hist = talib.MACD(close, fastperiod=12, slowperiod=26, signalperiod=9)
    save_fixture("macd", {
        "indicator": "MACD",
        "talib_function": "MACD",
        "test_cases": [
            {
                "name": "macd_12_26_9",
                "params": {"fastPeriod": 12, "slowPeriod": 26, "signalPeriod": 9},
                "values": {
                    "macd": to_json_safe(macd_line, n),
                    "signal": to_json_safe(macd_signal, n),
                    "histogram": to_json_safe(macd_hist, n),
                },
            },
        ],
    })

    # Fast Stochastics
    print("Generating Fast Stochastics...")
    fastk, fastd = talib.STOCHF(high, low, close, fastk_period=14, fastd_period=3, fastd_matype=0)
    save_fixture("fast-stochastics", {
        "indicator": "FastStochastics",
        "talib_function": "STOCHF",
        "test_cases": [
            {
                "name": "fast_stoch_14_3",
                "params": {"kPeriod": 14, "dPeriod": 3},
                "values": {
                    "k": to_json_safe(fastk, n),
                    "d": to_json_safe(fastd, n),
                },
            },
        ],
    })

    # Slow Stochastics
    print("Generating Slow Stochastics...")
    slowk, slowd = talib.STOCH(
        high, low, close,
        fastk_period=14, slowk_period=3, slowk_matype=0,
        slowd_period=3, slowd_matype=0,
    )
    save_fixture("stochastics", {
        "indicator": "Stochastics",
        "talib_function": "STOCH",
        "test_cases": [
            {
                "name": "stoch_14_3_3",
                "params": {"kPeriod": 14, "dPeriod": 3, "slowing": 3},
                "values": {
                    "k": to_json_safe(slowk, n),
                    "d": to_json_safe(slowd, n),
                },
            },
        ],
    })

    # Donchian Channel (composite: MAX + MIN + middle)
    print("Generating Donchian Channel...")
    dc_upper = talib.MAX(high, timeperiod=20)
    dc_lower = talib.MIN(low, timeperiod=20)
    dc_middle = (dc_upper + dc_lower) / 2.0
    save_fixture("donchian-channel", {
        "indicator": "DonchianChannel",
        "talib_function": "MAX+MIN",
        "test_cases": [
            {
                "name": "donchian_20",
                "params": {"period": 20},
                "values": {
                    "upper": to_json_safe(dc_upper, n),
                    "middle": to_json_safe(dc_middle, n),
                    "lower": to_json_safe(dc_lower, n),
                },
            },
        ],
    })

    # StochRSI
    # TA-Lib STOCHRSI: timeperiod=RSI period, fastk_period=stochastic lookback,
    # fastd_period=D smoothing. The fastk_period maps to trendcraft's stochPeriod.
    # TA-Lib outputs "fastK" = SMA(rawStochRSI, 1) when fastk_period=stochPeriod,
    # and "fastD" = SMA(fastK, fastd_period).
    # To match trendcraft's (rsiPeriod=14, stochPeriod=14, kPeriod=3, dPeriod=3):
    #   timeperiod=14, fastk_period=14, fastd_period=3
    # TA-Lib fastK output = raw stochastic (unsmoothed) when kPeriod=1,
    # but trendcraft %K = SMA(rawStochRSI, kPeriod=3).
    # So we use STOCHRSI(timeperiod=14, fastk_period=14, fastd_period=3):
    #   fastK = unsmoothed stochastic RSI → trendcraft rawStochRSI
    #   fastD = SMA(fastK, 3) → BUT we need SMA(SMA(rawStochRSI,3), 3)
    # Actually for a direct match we need:
    #   TA-Lib STOCHRSI fastk_period=14 gives raw stochastic
    #   Then we manually apply SMA(3) for K and SMA(3) for D
    print("Generating StochRSI...")
    # Get raw stochastic RSI (fastk_period=stochPeriod, fastd_period=1 for no smoothing)
    stochrsi_raw_k, _ = talib.STOCHRSI(
        close, timeperiod=14, fastk_period=14, fastd_period=1, fastd_matype=0
    )
    # Apply SMA(3) to get %K
    stochrsi_k = talib.SMA(stochrsi_raw_k, timeperiod=3)
    # Apply SMA(3) to %K to get %D
    stochrsi_d = talib.SMA(stochrsi_k, timeperiod=3)
    save_fixture("stoch-rsi", {
        "indicator": "StochRSI",
        "talib_function": "STOCHRSI+SMA",
        "note": "TA-Lib STOCHRSI(14,14,1) gives raw StochRSI, then SMA(3) for K and SMA(3) for D",
        "test_cases": [
            {
                "name": "stochrsi_14_14_3_3",
                "params": {"rsiPeriod": 14, "stochPeriod": 14, "kPeriod": 3, "dPeriod": 3},
                "values": {
                    "k": to_json_safe(stochrsi_k, n),
                    "d": to_json_safe(stochrsi_d, n),
                },
            },
        ],
    })

    # Keltner Channel (composite: EMA + ATR)
    print("Generating Keltner Channel...")
    kc_ema = talib.EMA(close, timeperiod=20)
    kc_atr = talib.ATR(high, low, close, timeperiod=10)
    kc_upper = kc_ema + 2.0 * kc_atr
    kc_lower = kc_ema - 2.0 * kc_atr
    save_fixture("keltner-channel", {
        "indicator": "KeltnerChannel",
        "talib_function": "EMA+ATR",
        "test_cases": [
            {
                "name": "keltner_20_10_2",
                "params": {"emaPeriod": 20, "atrPeriod": 10, "multiplier": 2},
                "values": {
                    "upper": to_json_safe(kc_upper, n),
                    "middle": to_json_safe(kc_ema, n),
                    "lower": to_json_safe(kc_lower, n),
                },
            },
        ],
    })

    # MFI
    print("Generating MFI...")
    save_fixture("mfi", {
        "indicator": "MFI",
        "talib_function": "MFI",
        "test_cases": [
            {
                "name": "mfi_14",
                "params": {"period": 14},
                "values": to_json_safe(talib.MFI(high, low, close, volume, timeperiod=14), n),
            },
            {
                "name": "mfi_10",
                "params": {"period": 10},
                "values": to_json_safe(talib.MFI(high, low, close, volume, timeperiod=10), n),
            },
        ],
    })

    # DMI (ADX / +DI / -DI)
    print("Generating DMI...")
    adx_14 = talib.ADX(high, low, close, timeperiod=14)
    plus_di_14 = talib.PLUS_DI(high, low, close, timeperiod=14)
    minus_di_14 = talib.MINUS_DI(high, low, close, timeperiod=14)
    save_fixture("dmi", {
        "indicator": "DMI",
        "talib_function": "ADX+PLUS_DI+MINUS_DI",
        "test_cases": [
            {
                "name": "dmi_14",
                "params": {"period": 14},
                "values": {
                    "adx": to_json_safe(adx_14, n),
                    "plusDi": to_json_safe(plus_di_14, n),
                    "minusDi": to_json_safe(minus_di_14, n),
                },
            },
        ],
    })

    # --- Batch A: Trivial 1:1 mapping indicators ---

    # DEMA
    print("Generating DEMA...")
    save_fixture("dema", {
        "indicator": "DEMA",
        "talib_function": "DEMA",
        "test_cases": [
            {
                "name": "dema_20",
                "params": {"period": 20},
                "values": to_json_safe(talib.DEMA(close, timeperiod=20), n),
            },
            {
                "name": "dema_10",
                "params": {"period": 10},
                "values": to_json_safe(talib.DEMA(close, timeperiod=10), n),
            },
        ],
    })

    # TEMA
    print("Generating TEMA...")
    save_fixture("tema", {
        "indicator": "TEMA",
        "talib_function": "TEMA",
        "test_cases": [
            {
                "name": "tema_20",
                "params": {"period": 20},
                "values": to_json_safe(talib.TEMA(close, timeperiod=20), n),
            },
            {
                "name": "tema_10",
                "params": {"period": 10},
                "values": to_json_safe(talib.TEMA(close, timeperiod=10), n),
            },
        ],
    })

    # STDDEV
    print("Generating STDDEV...")
    save_fixture("stddev", {
        "indicator": "StandardDeviation",
        "talib_function": "STDDEV",
        "note": "TA-Lib STDDEV uses population variance (/N) by default, matching TrendCraft.",
        "test_cases": [
            {
                "name": "stddev_20",
                "params": {"period": 20},
                "values": to_json_safe(talib.STDDEV(close, timeperiod=20, nbdev=1), n),
            },
            {
                "name": "stddev_10",
                "params": {"period": 10},
                "values": to_json_safe(talib.STDDEV(close, timeperiod=10, nbdev=1), n),
            },
        ],
    })

    # MEDPRICE
    print("Generating MEDPRICE...")
    open_ = np.array([c["open"] for c in candles], dtype=np.float64)
    save_fixture("medprice", {
        "indicator": "MedianPrice",
        "talib_function": "MEDPRICE",
        "test_cases": [
            {
                "name": "medprice",
                "params": {},
                "values": to_json_safe(talib.MEDPRICE(high, low), n),
            },
        ],
    })

    # TYPPRICE
    print("Generating TYPPRICE...")
    save_fixture("typprice", {
        "indicator": "TypicalPrice",
        "talib_function": "TYPPRICE",
        "test_cases": [
            {
                "name": "typprice",
                "params": {},
                "values": to_json_safe(talib.TYPPRICE(high, low, close), n),
            },
        ],
    })

    # WCLPRICE
    print("Generating WCLPRICE...")
    save_fixture("wclprice", {
        "indicator": "WeightedClose",
        "talib_function": "WCLPRICE",
        "test_cases": [
            {
                "name": "wclprice",
                "params": {},
                "values": to_json_safe(talib.WCLPRICE(high, low, close), n),
            },
        ],
    })

    # AD (Accumulation/Distribution Line)
    print("Generating AD...")
    save_fixture("ad", {
        "indicator": "ADL",
        "talib_function": "AD",
        "test_cases": [
            {
                "name": "ad",
                "params": {},
                "values": to_json_safe(talib.AD(high, low, close, volume), n),
            },
        ],
    })

    # CMO (Chande Momentum Oscillator)
    print("Generating CMO...")
    save_fixture("cmo", {
        "indicator": "CMO",
        "talib_function": "CMO",
        "test_cases": [
            {
                "name": "cmo_14",
                "params": {"period": 14},
                "values": to_json_safe(talib.CMO(close, timeperiod=14), n),
            },
            {
                "name": "cmo_9",
                "params": {"period": 9},
                "values": to_json_safe(talib.CMO(close, timeperiod=9), n),
            },
        ],
    })

    # --- Batch B: Composite / parameter-mapping indicators ---

    # AROON
    print("Generating AROON...")
    aroon_down, aroon_up = talib.AROON(high, low, timeperiod=25)
    aroon_osc = talib.AROONOSC(high, low, timeperiod=25)
    save_fixture("aroon", {
        "indicator": "Aroon",
        "talib_function": "AROON+AROONOSC",
        "test_cases": [
            {
                "name": "aroon_25",
                "params": {"period": 25},
                "values": {
                    "up": to_json_safe(aroon_up, n),
                    "down": to_json_safe(aroon_down, n),
                    "oscillator": to_json_safe(aroon_osc, n),
                },
            },
        ],
    })

    # PPO (Percentage Price Oscillator)
    print("Generating PPO...")
    ppo_line = talib.PPO(close, fastperiod=12, slowperiod=26, matype=1)  # matype=1 = EMA
    # PPO signal = EMA(PPO, signalperiod)
    ppo_signal = talib.EMA(ppo_line, timeperiod=9)
    ppo_hist = ppo_line - ppo_signal
    # Replace NaN with None
    save_fixture("ppo", {
        "indicator": "PPO",
        "talib_function": "PPO+EMA",
        "note": "PPO signal and histogram computed from PPO + EMA(9). EMA seeding divergence expected.",
        "test_cases": [
            {
                "name": "ppo_12_26_9",
                "params": {"fastPeriod": 12, "slowPeriod": 26, "signalPeriod": 9},
                "values": {
                    "ppo": to_json_safe(ppo_line, n),
                    "signal": to_json_safe(ppo_signal, n),
                    "histogram": to_json_safe(ppo_hist, n),
                },
            },
        ],
    })

    # ADXR
    print("Generating ADXR...")
    save_fixture("adxr", {
        "indicator": "ADXR",
        "talib_function": "ADXR",
        "test_cases": [
            {
                "name": "adxr_14",
                "params": {"period": 14},
                "values": to_json_safe(talib.ADXR(high, low, close, timeperiod=14), n),
            },
        ],
    })

    # ULTOSC (Ultimate Oscillator)
    print("Generating ULTOSC...")
    save_fixture("ultosc", {
        "indicator": "UltimateOscillator",
        "talib_function": "ULTOSC",
        "test_cases": [
            {
                "name": "ultosc_7_14_28",
                "params": {"period1": 7, "period2": 14, "period3": 28},
                "values": to_json_safe(talib.ULTOSC(high, low, close, timeperiod1=7, timeperiod2=14, timeperiod3=28), n),
            },
        ],
    })

    # LINEARREG + LINEARREG_SLOPE
    print("Generating LINEARREG...")
    save_fixture("linearreg", {
        "indicator": "LinearRegression",
        "talib_function": "LINEARREG+LINEARREG_SLOPE",
        "test_cases": [
            {
                "name": "linearreg_14",
                "params": {"period": 14},
                "values": {
                    "value": to_json_safe(talib.LINEARREG(close, timeperiod=14), n),
                    "slope": to_json_safe(talib.LINEARREG_SLOPE(close, timeperiod=14), n),
                },
            },
        ],
    })

    # --- Phase 3: Known discrepancy indicators ---

    # Bollinger Bands
    print("Generating Bollinger Bands...")
    bb_upper, bb_middle, bb_lower = talib.BBANDS(close, timeperiod=20, nbdevup=2, nbdevdn=2, matype=0)
    save_fixture("bollinger-bands", {
        "indicator": "BollingerBands",
        "talib_function": "BBANDS",
        "note": "TrendCraft uses population stddev (/N), TA-Lib uses sample stddev (/(N-1)). Expect ~1 decimal precision.",
        "test_cases": [
            {
                "name": "bb_20_2",
                "params": {"period": 20, "stdDev": 2},
                "values": {
                    "upper": to_json_safe(bb_upper, n),
                    "middle": to_json_safe(bb_middle, n),
                    "lower": to_json_safe(bb_lower, n),
                },
            },
        ],
    })

    # Parabolic SAR
    print("Generating Parabolic SAR...")
    sar_values = talib.SAR(high, low, acceleration=0.02, maximum=0.2)
    save_fixture("parabolic-sar", {
        "indicator": "ParabolicSAR",
        "talib_function": "SAR",
        "note": "State machine implementation differences expected. ~2 decimal precision.",
        "test_cases": [
            {
                "name": "psar_002_02",
                "params": {"step": 0.02, "max": 0.2},
                "values": to_json_safe(sar_values, n),
            },
        ],
    })


def main() -> None:
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    print("Generating OHLCV data...")
    ohlcv = generate_ohlcv()
    save_fixture("ohlcv", ohlcv)

    print(f"\nGenerating indicator fixtures ({ohlcv['length']} candles)...")
    generate_all(ohlcv)

    print("\nDone! All fixtures saved to cross-validation/fixtures/")


if __name__ == "__main__":
    main()
