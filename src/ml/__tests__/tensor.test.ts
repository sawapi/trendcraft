import { describe, expect, it } from "vitest";
import { Tensor, mulberry32, randNormal } from "../tensor";

describe("mulberry32 PRNG", () => {
  it("produces deterministic sequence", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("different seeds produce different sequences", () => {
    const rng1 = mulberry32(1);
    const rng2 = mulberry32(2);
    let same = 0;
    for (let i = 0; i < 100; i++) {
      if (rng1() === rng2()) same++;
    }
    expect(same).toBeLessThan(5);
  });
});

describe("randNormal", () => {
  it("produces roughly normal distribution", () => {
    const rng = mulberry32(42);
    const values: number[] = [];
    for (let i = 0; i < 10000; i++) {
      values.push(randNormal(rng));
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    expect(mean).toBeCloseTo(0, 1);
    expect(variance).toBeCloseTo(1, 0);
  });
});

describe("Tensor", () => {
  describe("factory methods", () => {
    it("zeros", () => {
      const t = Tensor.zeros(2, 3);
      expect(t.rows).toBe(2);
      expect(t.cols).toBe(3);
      expect(Array.from(t.data)).toEqual([0, 0, 0, 0, 0, 0]);
    });

    it("ones", () => {
      const t = Tensor.ones(2, 2);
      expect(Array.from(t.data)).toEqual([1, 1, 1, 1]);
    });

    it("fromArray / toArray round-trip", () => {
      const arr = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      const t = Tensor.fromArray(arr);
      expect(t.toArray()).toEqual(arr);
    });

    it("fromVec / toVec round-trip", () => {
      const vec = [1, 2, 3, 4];
      const t = Tensor.fromVec(vec);
      expect(t.rows).toBe(1);
      expect(t.cols).toBe(4);
      expect(t.toVec()).toEqual(vec);
    });

    it("randn produces values with Xavier scale", () => {
      const rng = mulberry32(42);
      const t = Tensor.randn(100, 100, rng);
      const mean = t.data.reduce((a, b) => a + b, 0) / t.data.length;
      expect(Math.abs(mean)).toBeLessThan(0.1);
    });
  });

  describe("matmul", () => {
    it("2×3 × 3×2 = 2×2", () => {
      const a = Tensor.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      const b = Tensor.fromArray([
        [7, 8],
        [9, 10],
        [11, 12],
      ]);
      const c = a.matmul(b);
      expect(c.rows).toBe(2);
      expect(c.cols).toBe(2);
      expect(c.toArray()).toEqual([
        [58, 64],
        [139, 154],
      ]);
    });

    it("identity matmul", () => {
      const a = Tensor.fromArray([
        [1, 0],
        [0, 1],
      ]);
      const b = Tensor.fromArray([
        [5, 6],
        [7, 8],
      ]);
      expect(a.matmul(b).toArray()).toEqual(b.toArray());
    });
  });

  describe("add / sub / scale / mul", () => {
    it("add", () => {
      const a = Tensor.fromArray([[1, 2]]);
      const b = Tensor.fromArray([[3, 4]]);
      expect(a.add(b).toArray()).toEqual([[4, 6]]);
    });

    it("sub", () => {
      const a = Tensor.fromArray([[5, 3]]);
      const b = Tensor.fromArray([[1, 2]]);
      expect(a.sub(b).toArray()).toEqual([[4, 1]]);
    });

    it("scale", () => {
      const a = Tensor.fromArray([[1, 2, 3]]);
      expect(a.scale(2).toArray()).toEqual([[2, 4, 6]]);
    });

    it("mul (Hadamard)", () => {
      const a = Tensor.fromArray([[2, 3]]);
      const b = Tensor.fromArray([[4, 5]]);
      expect(a.mul(b).toArray()).toEqual([[8, 15]]);
    });
  });

  describe("addBias", () => {
    it("broadcasts bias to each row", () => {
      const a = Tensor.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const bias = Tensor.fromVec([10, 20]);
      expect(a.addBias(bias).toArray()).toEqual([
        [11, 22],
        [13, 24],
      ]);
    });
  });

  describe("transpose", () => {
    it("transposes correctly", () => {
      const a = Tensor.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      expect(a.transpose().toArray()).toEqual([
        [1, 4],
        [2, 5],
        [3, 6],
      ]);
    });
  });

  describe("softmax", () => {
    it("produces valid probabilities per row", () => {
      const a = Tensor.fromArray([
        [1, 2, 3],
        [10, 20, 30],
      ]);
      const s = a.softmax();
      for (let i = 0; i < s.rows; i++) {
        let sum = 0;
        for (let j = 0; j < s.cols; j++) {
          const v = s.get(i, j);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
          sum += v;
        }
        expect(sum).toBeCloseTo(1, 10);
      }
    });

    it("handles large values without overflow", () => {
      const a = Tensor.fromArray([[1000, 1001, 1002]]);
      const s = a.softmax();
      let sum = 0;
      for (let j = 0; j < s.cols; j++) sum += s.get(0, j);
      expect(sum).toBeCloseTo(1, 10);
    });
  });

  describe("gelu", () => {
    it("gelu(0) ≈ 0", () => {
      const a = Tensor.fromArray([[0]]);
      expect(a.gelu().get(0, 0)).toBeCloseTo(0, 5);
    });

    it("gelu is monotonically increasing for x > 0", () => {
      const vals = [0.1, 0.5, 1, 2, 3];
      const a = Tensor.fromArray([vals]);
      const g = a.gelu();
      for (let i = 1; i < vals.length; i++) {
        expect(g.get(0, i)).toBeGreaterThan(g.get(0, i - 1));
      }
    });
  });

  describe("layerNorm", () => {
    it("normalizes each row to ~zero mean, ~unit variance", () => {
      const a = Tensor.fromArray([[10, 20, 30, 40]]);
      const gamma = Tensor.ones(1, 4);
      const beta = Tensor.zeros(1, 4);
      const normed = a.layerNorm(gamma, beta);

      let mean = 0;
      for (let j = 0; j < 4; j++) mean += normed.get(0, j);
      mean /= 4;
      expect(mean).toBeCloseTo(0, 5);

      let variance = 0;
      for (let j = 0; j < 4; j++) variance += (normed.get(0, j) - mean) ** 2;
      variance /= 4;
      expect(variance).toBeCloseTo(1, 3);
    });

    it("applies affine transform", () => {
      const a = Tensor.fromArray([[1, 3]]);
      const gamma = Tensor.fromVec([2, 2]);
      const beta = Tensor.fromVec([5, 5]);
      const normed = a.layerNorm(gamma, beta);
      // mean=2, std=1, xhat = [-1, 1]
      // out = gamma*xhat + beta = [2*(-1)+5, 2*1+5] = [3, 7]
      expect(normed.get(0, 0)).toBeCloseTo(3, 3);
      expect(normed.get(0, 1)).toBeCloseTo(7, 3);
    });
  });

  describe("crossEntropyLoss", () => {
    it("returns 0 for perfect prediction", () => {
      // Logits strongly favor class 0
      const logits = Tensor.fromArray([[100, -100, -100]]);
      const loss = logits.crossEntropyLoss([0]);
      expect(loss).toBeCloseTo(0, 3);
    });

    it("returns positive loss for wrong prediction", () => {
      const logits = Tensor.fromArray([[100, -100, -100]]);
      const loss = logits.crossEntropyLoss([1]);
      expect(loss).toBeGreaterThan(100);
    });
  });

  describe("causalMask", () => {
    it("sets upper triangle to -Infinity", () => {
      const a = Tensor.ones(3, 3);
      const masked = a.causalMask();
      expect(masked.get(0, 0)).toBe(1);
      expect(masked.get(0, 1)).toBe(Number.NEGATIVE_INFINITY);
      expect(masked.get(0, 2)).toBe(Number.NEGATIVE_INFINITY);
      expect(masked.get(1, 0)).toBe(1);
      expect(masked.get(1, 1)).toBe(1);
      expect(masked.get(1, 2)).toBe(Number.NEGATIVE_INFINITY);
      expect(masked.get(2, 0)).toBe(1);
      expect(masked.get(2, 1)).toBe(1);
      expect(masked.get(2, 2)).toBe(1);
    });
  });

  describe("gather", () => {
    it("selects rows by indices", () => {
      const source = Tensor.fromArray([
        [10, 20],
        [30, 40],
        [50, 60],
      ]);
      const result = Tensor.gather(source, [2, 0, 1]);
      expect(result.toArray()).toEqual([
        [50, 60],
        [10, 20],
        [30, 40],
      ]);
    });
  });

  describe("sliceRows / sliceCols", () => {
    it("sliceRows", () => {
      const a = Tensor.fromArray([
        [1, 2],
        [3, 4],
        [5, 6],
      ]);
      expect(a.sliceRows(1, 3).toArray()).toEqual([
        [3, 4],
        [5, 6],
      ]);
    });

    it("sliceCols", () => {
      const a = Tensor.fromArray([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ]);
      expect(a.sliceCols(1, 3).toArray()).toEqual([
        [2, 3],
        [6, 7],
      ]);
    });
  });

  describe("concatCols", () => {
    it("concatenates column-wise", () => {
      const a = Tensor.fromArray([
        [1, 2],
        [5, 6],
      ]);
      const b = Tensor.fromArray([
        [3, 4],
        [7, 8],
      ]);
      expect(Tensor.concatCols([a, b]).toArray()).toEqual([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ]);
    });
  });
});
