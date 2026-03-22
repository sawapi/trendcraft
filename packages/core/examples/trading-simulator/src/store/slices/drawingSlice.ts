import type { Drawing } from "../../types";
import { generateId } from "../helpers";
import type { DrawingSlice, SliceCreator } from "../types";

export const createDrawingSlice: SliceCreator<DrawingSlice> = (set) => ({
  drawings: [],

  addDrawing: (drawing: Omit<Drawing, "id">) => {
    set((state) => ({
      drawings: [...state.drawings, { id: generateId(), ...drawing }],
    }));
  },

  removeDrawing: (id: string) => {
    set((state) => ({
      drawings: state.drawings.filter((d) => d.id !== id),
    }));
  },

  clearDrawings: () => {
    set({ drawings: [] });
  },
});
