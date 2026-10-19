import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Tool } from "../types";

export type PixelViewProps = {
  width: number;
  height: number;
  zoom: number;
  tool: Tool;
  paintColor: string;
  toolSize: number;
  referenceImage?: string | null;
  onPickColor?: (color: string) => void;
  onActivate?: () => void;
};

export type PixelViewHandle = { undo: () => void; redo: () => void };
const CHECKER_SIZE = 8;
const MAX_HISTORY = 100;

const PixelView = forwardRef<PixelViewHandle, PixelViewProps>(function PixelView(
  { width, height, zoom, tool, paintColor, toolSize, referenceImage, onPickColor, onActivate }, ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintingRef = useRef(false);
  const lastIndexRef = useRef(-1);
  const changedRef = useRef(false);
  const [pixels, setPixels] = useState<string[]>(() => Array(width * height).fill(""));
  const pixelsRef = useRef(pixels);
  const dimensionsRef = useRef({ width, height });
  const historyRef = useRef<string[][]>([[...pixels]]);
  const historyIndexRef = useRef(0);

  const drawCell = useCallback((ctx: CanvasRenderingContext2D, index: number, color: string) => {
    const x = index % width;
    const y = Math.floor(index / width);
    if (color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    } else {
      ctx.fillStyle = ((Math.floor(x / CHECKER_SIZE) + Math.floor(y / CHECKER_SIZE)) % 2 === 0) ? "#f1f5f9" : "#cbd5e1";
      ctx.fillRect(x, y, 1, 1);
    }
  }, [width]);

  const redraw = useCallback((source: string[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.fillStyle = ((Math.floor(x / CHECKER_SIZE) + Math.floor(y / CHECKER_SIZE)) % 2 === 0) ? "#f1f5f9" : "#cbd5e1";
        ctx.fillRect(x, y, 1, 1);
      }
    }
    source.forEach((color, index) => { if (color) drawCell(ctx, index, color); });
  }, [width, height, drawCell]);

  useEffect(() => {
    const previousDimensions = dimensionsRef.current;
    const dimensionsChanged =
      previousDimensions.width !== width || previousDimensions.height !== height;

    if (dimensionsChanged) {
      const previousPixels = pixelsRef.current;
      const resized = Array(width * height).fill("");
      const copyWidth = Math.min(width, previousDimensions.width);
      const copyHeight = Math.min(height, previousDimensions.height);

      for (let y = 0; y < copyHeight; y++) {
        for (let x = 0; x < copyWidth; x++) {
          resized[y * width + x] = previousPixels[y * previousDimensions.width + x] || "";
        }
      }

      dimensionsRef.current = { width, height };
      pixelsRef.current = resized;
      historyRef.current = [[...resized]];
      historyIndexRef.current = 0;
      setPixels(resized);
      redraw(resized);
      return;
    }

    redraw(pixels);
  }, [width, height, pixels, redraw]);

  const restore = useCallback((index: number) => {
    const snapshot = historyRef.current[index];
    if (!snapshot) return;
    const copy = [...snapshot];
    historyIndexRef.current = index;
    pixelsRef.current = copy;
    setPixels(copy);
  }, []);
  const undo = useCallback(() => { if (historyIndexRef.current > 0) restore(historyIndexRef.current - 1); }, [restore]);
  const redo = useCallback(() => { if (historyIndexRef.current < historyRef.current.length - 1) restore(historyIndexRef.current + 1); }, [restore]);
  useImperativeHandle(ref, () => ({ undo, redo }), [undo, redo]);

  const getIndex = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * width);
    const y = Math.floor(((e.clientY - r.top) / r.height) * height);
    return x < 0 || x >= width || y < 0 || y >= height ? -1 : y * width + x;
  };

  const paintAt = (index: number) => {
    if (index < 0 || index === lastIndexRef.current) return;
    lastIndexRef.current = index;
    const ctx = canvasRef.current?.getContext("2d", { alpha: false });
    if (!ctx) return;
    const cx = index % width;
    const cy = Math.floor(index / width);
    const size = Math.max(1, Math.floor(toolSize));
    const startX = cx - Math.floor((size - 1) / 2);
    const startY = cy - Math.floor((size - 1) / 2);
    const nextColor = tool === "erase" ? "" : paintColor;
    for (let y = startY; y < startY + size; y++) for (let x = startX; x < startX + size; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const i = y * width + x;
      if (pixelsRef.current[i] === nextColor) continue;
      pixelsRef.current[i] = nextColor;
      drawCell(ctx, i, nextColor);
      changedRef.current = true;
    }
  };

  const finishStroke = () => {
    if (!paintingRef.current) return;
    paintingRef.current = false;
    lastIndexRef.current = -1;
    if (changedRef.current) {
      const snapshot = [...pixelsRef.current];
      const history = historyRef.current.slice(0, historyIndexRef.current + 1);
      history.push(snapshot);
      if (history.length > MAX_HISTORY) history.shift();
      historyRef.current = history;
      historyIndexRef.current = history.length - 1;
      pixelsRef.current = snapshot;
      setPixels(snapshot);
    }
    changedRef.current = false;
  };

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-auto bg-background p-4">
      <div className="relative shrink-0" style={{ width: width * zoom, height: height * zoom }}>
        <canvas ref={canvasRef} aria-label={`Canvas ${width} by ${height}`}
          style={{ width: width * zoom, height: height * zoom, imageRendering: "pixelated", touchAction: "none", position: "relative", display: "block" }}
          onPointerDown={e => {
            onActivate?.();
            const index = getIndex(e);
            if (index < 0) return;
            if (tool === "eyedropper") {
              const picked = pixelsRef.current[index];
              if (picked) onPickColor?.(picked);
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            paintingRef.current = true;
            lastIndexRef.current = -1;
            changedRef.current = false;
            paintAt(index);
          }}
          onPointerMove={e => { if (paintingRef.current) paintAt(getIndex(e)); }}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onLostPointerCapture={finishStroke}
        />
        {referenceImage && (
          <img src={referenceImage} alt="Reference image" draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-35" />
        )}
      </div>
    </div>
  );
});
export default PixelView;
