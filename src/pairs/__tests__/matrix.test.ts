import { describe, expect, it } from "vitest";
import { invertMatrix, matMul, matVecMul, transpose } from "../matrix";

describe("transpose", () => {
  it("transposes a 2x3 matrix", () => {
    const m = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const result = transpose(m);
    expect(result).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it("transposes a square matrix", () => {
    const m = [
      [1, 2],
      [3, 4],
    ];
    expect(transpose(m)).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });

  it("transposes a 1x1 matrix", () => {
    expect(transpose([[42]])).toEqual([[42]]);
  });

  it("double-transpose returns original", () => {
    const m = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    expect(transpose(transpose(m))).toEqual(m);
  });
});

describe("matMul", () => {
  it("identity times any matrix returns same matrix", () => {
    const I = [
      [1, 0],
      [0, 1],
    ];
    const A = [
      [3, 7],
      [2, 5],
    ];
    expect(matMul(I, A)).toEqual(A);
    expect(matMul(A, I)).toEqual(A);
  });

  it("multiplies 2x2 matrices with known result", () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const B = [
      [5, 6],
      [7, 8],
    ];
    expect(matMul(A, B)).toEqual([
      [19, 22],
      [43, 50],
    ]);
  });

  it("multiplies non-square matrices", () => {
    // 2x3 * 3x2 = 2x2
    const A = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const B = [
      [7, 8],
      [9, 10],
      [11, 12],
    ];
    expect(matMul(A, B)).toEqual([
      [58, 64],
      [139, 154],
    ]);
  });
});

describe("matVecMul", () => {
  it("multiplies matrix by vector with known result", () => {
    const m = [
      [1, 2],
      [3, 4],
    ];
    const v = [5, 6];
    expect(matVecMul(m, v)).toEqual([17, 39]);
  });

  it("identity matrix times vector returns same vector", () => {
    const I = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const v = [3, 7, 11];
    expect(matVecMul(I, v)).toEqual(v);
  });
});

describe("invertMatrix", () => {
  it("inverts a 2x2 matrix and verifies A * A^-1 = I", () => {
    const A = [
      [4, 7],
      [2, 6],
    ];
    const inv = invertMatrix(A);
    expect(inv).not.toBeNull();

    const product = matMul(A, inv!);
    // Should be close to identity
    expect(product[0][0]).toBeCloseTo(1, 10);
    expect(product[0][1]).toBeCloseTo(0, 10);
    expect(product[1][0]).toBeCloseTo(0, 10);
    expect(product[1][1]).toBeCloseTo(1, 10);
  });

  it("inverts a 3x3 matrix and verifies A * A^-1 = I", () => {
    const A = [
      [1, 2, 3],
      [0, 1, 4],
      [5, 6, 0],
    ];
    const inv = invertMatrix(A);
    expect(inv).not.toBeNull();

    const product = matMul(A, inv!);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(product[i][j]).toBeCloseTo(i === j ? 1 : 0, 8);
      }
    }
  });

  it("returns null for singular matrix", () => {
    const singular = [
      [1, 2],
      [2, 4],
    ];
    expect(invertMatrix(singular)).toBeNull();
  });

  it("inverts a 1x1 matrix", () => {
    const inv = invertMatrix([[5]]);
    expect(inv).not.toBeNull();
    expect(inv![0][0]).toBeCloseTo(0.2, 10);
  });
});
