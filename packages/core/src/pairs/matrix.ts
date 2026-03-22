/**
 * Basic matrix operations for ADF test
 *
 * These are intentionally simple implementations for small matrices (< 20x20).
 *
 * @module pairs/matrix
 */

/**
 * Transpose a matrix
 */
export function transpose(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0].length;
  const result: number[][] = [];

  for (let j = 0; j < cols; j++) {
    const row: number[] = [];
    for (let i = 0; i < rows; i++) {
      row.push(m[i][j]);
    }
    result.push(row);
  }

  return result;
}

/**
 * Multiply two matrices
 */
export function matMul(a: number[][], b: number[][]): number[][] {
  const rowsA = a.length;
  const colsA = a[0].length;
  const colsB = b[0].length;
  const result: number[][] = [];

  for (let i = 0; i < rowsA; i++) {
    const row: number[] = [];
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += a[i][k] * b[k][j];
      }
      row.push(sum);
    }
    result.push(row);
  }

  return result;
}

/**
 * Multiply matrix by vector (matrix columns x vector)
 * Returns a vector (as number[])
 */
export function matVecMul(m: number[][], v: number[]): number[] {
  const rows = m.length;
  const cols = m[0].length;
  const result: number[] = [];

  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      sum += m[i][j] * v[j];
    }
    result.push(sum);
  }

  return result;
}

/**
 * Invert a matrix using Gauss-Jordan elimination
 * Returns null if the matrix is singular
 */
export function invertMatrix(m: number[][]): number[][] | null {
  const n = m.length;

  // Create augmented matrix [m | I]
  const aug: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(m[i][j]);
    }
    for (let j = 0; j < n; j++) {
      row.push(i === j ? 1 : 0);
    }
    aug.push(row);
  }

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) return null; // Singular

    // Swap rows
    if (maxRow !== col) {
      const temp = aug[col];
      aug[col] = aug[maxRow];
      aug[maxRow] = temp;
    }

    // Scale pivot row
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] /= pivot;
    }

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Extract inverse
  const inv: number[][] = [];
  for (let i = 0; i < n; i++) {
    inv.push(aug[i].slice(n));
  }

  return inv;
}
