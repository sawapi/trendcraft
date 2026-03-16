/**
 * Minimal 2D Tensor class for CandleFormer
 *
 * Supports only the operations needed for a 1-layer Transformer:
 * matmul, softmax, gelu, layerNorm, cross-entropy loss.
 * Uses Mulberry32 PRNG for reproducible initialization.
 */

// ============================================
// PRNG (Mulberry32)
// ============================================

/**
 * Mulberry32 PRNG - deterministic random number generator
 * Returns a function that produces values in [0, 1)
 */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform for normal distribution
 */
export function randNormal(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
}

// ============================================
// Tensor class
// ============================================

export class Tensor {
  readonly rows: number;
  readonly cols: number;
  readonly data: Float64Array;

  constructor(rows: number, cols: number, data?: Float64Array) {
    this.rows = rows;
    this.cols = cols;
    this.data = data ?? new Float64Array(rows * cols);
  }

  /**
   * Get value at (row, col)
   */
  get(row: number, col: number): number {
    return this.data[row * this.cols + col];
  }

  /**
   * Set value at (row, col)
   */
  set(row: number, col: number, value: number): void {
    this.data[row * this.cols + col] = value;
  }

  /**
   * Get a row as a new Tensor (1 × cols)
   */
  row(r: number): Tensor {
    const out = new Tensor(1, this.cols);
    const offset = r * this.cols;
    for (let j = 0; j < this.cols; j++) {
      out.data[j] = this.data[offset + j];
    }
    return out;
  }

  /**
   * Create a clone of this tensor
   */
  clone(): Tensor {
    return new Tensor(this.rows, this.cols, new Float64Array(this.data));
  }

  // ============================================
  // Factory methods
  // ============================================

  static zeros(rows: number, cols: number): Tensor {
    return new Tensor(rows, cols);
  }

  static ones(rows: number, cols: number): Tensor {
    const t = new Tensor(rows, cols);
    t.data.fill(1);
    return t;
  }

  /**
   * Random normal initialization with Xavier scaling
   */
  static randn(rows: number, cols: number, rng: () => number, scale?: number): Tensor {
    const s = scale ?? Math.sqrt(2 / (rows + cols));
    const t = new Tensor(rows, cols);
    for (let i = 0; i < t.data.length; i++) {
      t.data[i] = randNormal(rng) * s;
    }
    return t;
  }

  /**
   * Create from 2D array
   */
  static fromArray(arr: number[][]): Tensor {
    const rows = arr.length;
    const cols = arr[0].length;
    const t = new Tensor(rows, cols);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        t.data[i * cols + j] = arr[i][j];
      }
    }
    return t;
  }

  /**
   * Create from 1D array as a row vector (1 × n)
   */
  static fromVec(arr: number[]): Tensor {
    const t = new Tensor(1, arr.length);
    for (let i = 0; i < arr.length; i++) {
      t.data[i] = arr[i];
    }
    return t;
  }

  /**
   * Serialize to 2D array
   */
  toArray(): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < this.cols; j++) {
        row.push(this.data[i * this.cols + j]);
      }
      out.push(row);
    }
    return out;
  }

  /**
   * Serialize to 1D array (for bias vectors)
   */
  toVec(): number[] {
    return Array.from(this.data);
  }

  // ============================================
  // Operations
  // ============================================

  /**
   * Matrix multiplication: this (m×k) × other (k×n) → result (m×n)
   */
  matmul(other: Tensor): Tensor {
    const m = this.rows;
    const k = this.cols;
    const n = other.cols;
    const out = new Tensor(m, n);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let p = 0; p < k; p++) {
          sum += this.data[i * k + p] * other.data[p * n + j];
        }
        out.data[i * n + j] = sum;
      }
    }
    return out;
  }

  /**
   * Element-wise addition
   */
  add(other: Tensor): Tensor {
    const out = new Tensor(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) {
      out.data[i] = this.data[i] + other.data[i];
    }
    return out;
  }

  /**
   * Add bias vector to each row: this (m×n) + bias (1×n) → result (m×n)
   */
  addBias(bias: Tensor): Tensor {
    const out = new Tensor(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        out.data[i * this.cols + j] = this.data[i * this.cols + j] + bias.data[j];
      }
    }
    return out;
  }

  /**
   * Transpose
   */
  transpose(): Tensor {
    const out = new Tensor(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        out.data[j * this.rows + i] = this.data[i * this.cols + j];
      }
    }
    return out;
  }

  /**
   * Scale all elements by a scalar
   */
  scale(s: number): Tensor {
    const out = new Tensor(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) {
      out.data[i] = this.data[i] * s;
    }
    return out;
  }

  /**
   * Element-wise multiply (Hadamard product)
   */
  mul(other: Tensor): Tensor {
    const out = new Tensor(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) {
      out.data[i] = this.data[i] * other.data[i];
    }
    return out;
  }

  /**
   * Element-wise subtract
   */
  sub(other: Tensor): Tensor {
    const out = new Tensor(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) {
      out.data[i] = this.data[i] - other.data[i];
    }
    return out;
  }

  // ============================================
  // Activation functions
  // ============================================

  /**
   * Row-wise softmax with numerical stability
   */
  softmax(): Tensor {
    const out = new Tensor(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      const offset = i * this.cols;
      let max = Number.NEGATIVE_INFINITY;
      for (let j = 0; j < this.cols; j++) {
        if (this.data[offset + j] > max) max = this.data[offset + j];
      }
      let sum = 0;
      for (let j = 0; j < this.cols; j++) {
        const e = Math.exp(this.data[offset + j] - max);
        out.data[offset + j] = e;
        sum += e;
      }
      for (let j = 0; j < this.cols; j++) {
        out.data[offset + j] /= sum;
      }
    }
    return out;
  }

  /**
   * GELU activation (approximate)
   */
  gelu(): Tensor {
    const out = new Tensor(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) {
      const x = this.data[i];
      out.data[i] = 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
    }
    return out;
  }

  // ============================================
  // Normalization
  // ============================================

  /**
   * Layer normalization (row-wise)
   * @param gamma - Scale parameter (1×cols)
   * @param beta - Shift parameter (1×cols)
   * @param eps - Numerical stability (default: 1e-5)
   */
  layerNorm(gamma: Tensor, beta: Tensor, eps = 1e-5): Tensor {
    const out = new Tensor(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      const offset = i * this.cols;
      // Mean
      let mean = 0;
      for (let j = 0; j < this.cols; j++) {
        mean += this.data[offset + j];
      }
      mean /= this.cols;
      // Variance
      let variance = 0;
      for (let j = 0; j < this.cols; j++) {
        const diff = this.data[offset + j] - mean;
        variance += diff * diff;
      }
      variance /= this.cols;
      const std = Math.sqrt(variance + eps);
      // Normalize + affine
      for (let j = 0; j < this.cols; j++) {
        out.data[offset + j] =
          gamma.data[j] * ((this.data[offset + j] - mean) / std) + beta.data[j];
      }
    }
    return out;
  }

  // ============================================
  // Loss functions
  // ============================================

  /**
   * Cross-entropy loss
   * @param targets - Array of class indices, one per row
   * @returns Scalar loss value
   */
  crossEntropyLoss(targets: number[]): number {
    let loss = 0;
    for (let i = 0; i < this.rows; i++) {
      const offset = i * this.cols;
      // Log-softmax for numerical stability
      let max = Number.NEGATIVE_INFINITY;
      for (let j = 0; j < this.cols; j++) {
        if (this.data[offset + j] > max) max = this.data[offset + j];
      }
      let logSumExp = 0;
      for (let j = 0; j < this.cols; j++) {
        logSumExp += Math.exp(this.data[offset + j] - max);
      }
      logSumExp = max + Math.log(logSumExp);
      loss -= this.data[offset + targets[i]] - logSumExp;
    }
    return loss / this.rows;
  }

  /**
   * Apply causal mask: set upper triangle to -Infinity
   * For attention: prevents attending to future tokens
   */
  causalMask(): Tensor {
    const out = this.clone();
    for (let i = 0; i < this.rows; i++) {
      for (let j = i + 1; j < this.cols; j++) {
        out.data[i * this.cols + j] = Number.NEGATIVE_INFINITY;
      }
    }
    return out;
  }

  /**
   * Gather rows by indices (for embedding lookup)
   * @param indices - Array of row indices to gather
   * @returns New tensor with gathered rows
   */
  static gather(source: Tensor, indices: number[]): Tensor {
    const out = new Tensor(indices.length, source.cols);
    for (let i = 0; i < indices.length; i++) {
      const srcOffset = indices[i] * source.cols;
      const dstOffset = i * source.cols;
      for (let j = 0; j < source.cols; j++) {
        out.data[dstOffset + j] = source.data[srcOffset + j];
      }
    }
    return out;
  }

  /**
   * Slice rows [start, end)
   */
  sliceRows(start: number, end: number): Tensor {
    const numRows = end - start;
    const out = new Tensor(numRows, this.cols);
    const srcOffset = start * this.cols;
    for (let i = 0; i < numRows * this.cols; i++) {
      out.data[i] = this.data[srcOffset + i];
    }
    return out;
  }

  /**
   * Slice columns [start, end)
   */
  sliceCols(start: number, end: number): Tensor {
    const numCols = end - start;
    const out = new Tensor(this.rows, numCols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < numCols; j++) {
        out.data[i * numCols + j] = this.data[i * this.cols + (start + j)];
      }
    }
    return out;
  }

  /**
   * Create a dropout mask tensor (values are 0 or 1)
   * @param rows - Number of rows
   * @param cols - Number of columns
   * @param rate - Probability of dropping (setting to 0)
   * @param rng - Random number generator
   */
  static dropoutMask(rows: number, cols: number, rate: number, rng: () => number): Tensor {
    const t = new Tensor(rows, cols);
    for (let i = 0; i < t.data.length; i++) {
      t.data[i] = rng() >= rate ? 1 : 0;
    }
    return t;
  }

  /**
   * Concatenate tensors along columns
   */
  static concatCols(tensors: Tensor[]): Tensor {
    const rows = tensors[0].rows;
    const totalCols = tensors.reduce((s, t) => s + t.cols, 0);
    const out = new Tensor(rows, totalCols);
    for (let i = 0; i < rows; i++) {
      let colOffset = 0;
      for (const t of tensors) {
        for (let j = 0; j < t.cols; j++) {
          out.data[i * totalCols + colOffset + j] = t.data[i * t.cols + j];
        }
        colOffset += t.cols;
      }
    }
    return out;
  }
}
