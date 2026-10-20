export type Tool = "draw" | "erase" | "eyedropper";

export type CanvasDimensions = {
  width: number;
  height: number;
};

export type ReferenceImage = {
  name: string;
  dataUrl: string;
};

export type AnimationFrame = {
  width: number;
  height: number;
  pixels: string[];
};
