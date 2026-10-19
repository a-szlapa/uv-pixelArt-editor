
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Tool } from "../types";

export type PixelViewProps = {
  width?: number;
  height?: number;
  pixelSize?: number;
  tool: Tool;
  paintColor: string;
  toolSize: number;
  onPickColor?: (color: string) => void;
  onActivate?: () => void;
};

export type PixelViewHandle = {
  undo: () => void;
  redo: () => void;
};

const CHECKER_SIZE = 8;

const PixelView = forwardRef<PixelViewHandle, PixelViewProps>(
  function PixelView(
    {
      width = 32,
      height = 32,
      pixelSize = 16,
      tool,
      paintColor,
      toolSize,
      onPickColor,
      onActivate,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const paintingRef = useRef(false);
    const lastIndexRef = useRef(-1);
    const changedStrokeRef = useRef(false);

    const [pixels, setPixels] = useState<string[]>(
      () => Array(width * height).fill("")
    );

    const pixelsRef = useRef(pixels);
    const historyRef = useRef<string[][]>([[...pixels]]);
    const historyIndexRef = useRef(0);

    const canvasWidth = width * pixelSize;
    const canvasHeight = height * pixelSize;

    const drawCell = useCallback(
      (ctx: CanvasRenderingContext2D, index: number, color: string) => {
        const x = (index % width) * pixelSize;
        const y = Math.floor(index / width) * pixelSize;

        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, pixelSize, pixelSize);
          return;
        }

        for (let cy = y; cy < y + pixelSize; cy += CHECKER_SIZE) {
          for (let cx = x; cx < x + pixelSize; cx += CHECKER_SIZE) {
            const even =
              (Math.floor(cx / CHECKER_SIZE) +
                Math.floor(cy / CHECKER_SIZE)) %
                2 ===
              0;

            ctx.fillStyle = even ? "#f1f5f9" : "#cbd5e1";
            ctx.fillRect(
              cx,
              cy,
              Math.min(CHECKER_SIZE, x + pixelSize - cx),
              Math.min(CHECKER_SIZE, y + pixelSize - cy)
            );
          }
        }
      },
      [width, pixelSize]
    );

    const redrawCanvas = useCallback(
      (source: string[]) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !ctx) return;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        ctx.imageSmoothingEnabled = false;

        for (let y = 0; y < canvasHeight; y += CHECKER_SIZE) {
          for (let x = 0; x < canvasWidth; x += CHECKER_SIZE) {
            const even =
              (Math.floor(x / CHECKER_SIZE) +
                Math.floor(y / CHECKER_SIZE)) %
                2 ===
              0;

            ctx.fillStyle = even ? "#f1f5f9" : "#cbd5e1";
            ctx.fillRect(
              x,
              y,
              Math.min(CHECKER_SIZE, canvasWidth - x),
              Math.min(CHECKER_SIZE, canvasHeight - y)
            );
          }
        }

        source.forEach((color, index) => {
          if (color) drawCell(ctx, index, color);
        });
      },
      [canvasWidth, canvasHeight, drawCell]
    );

    useEffect(() => {
      redrawCanvas(pixels);
    }, [pixels, redrawCanvas]);

    const applyHistory = useCallback((index: number) => {
      const snapshot = historyRef.current[index];
      if (!snapshot) return;

      const restored = [...snapshot];
      historyIndexRef.current = index;
      pixelsRef.current = restored;
      setPixels(restored);
    }, []);

    const undo = useCallback(() => {
      if (historyIndexRef.current > 0) {
        applyHistory(historyIndexRef.current - 1);
      }
    }, [applyHistory]);

    const redo = useCallback(() => {
      if (historyIndexRef.current < historyRef.current.length - 1) {
        applyHistory(historyIndexRef.current + 1);
      }
    }, [applyHistory]);

    useImperativeHandle(ref, () => ({ undo, redo }), [undo, redo]);

    const getPixelIndex = (
      e: ReactPointerEvent<HTMLCanvasElement>
    ) => {
      const rect = e.currentTarget.getBoundingClientRect();

      const x = Math.floor(
        ((e.clientX - rect.left) / rect.width) * width
      );
      const y = Math.floor(
        ((e.clientY - rect.top) / rect.height) * height
      );

      if (x < 0 || x >= width || y < 0 || y >= height) return -1;
      return y * width + x;
    };

    const paintAt = (index: number) => {
      if (index < 0 || index === lastIndexRef.current) return;
      lastIndexRef.current = index;

      const ctx = canvasRef.current?.getContext("2d", { alpha: false });
      if (!ctx) return;

      const centerX = index % width;
      const centerY = Math.floor(index / width);
      const size = Math.max(1, Math.floor(toolSize));
      const startX = centerX - Math.floor((size - 1) / 2);
      const startY = centerY - Math.floor((size - 1) / 2);
      const nextColor = tool === "erase" ? "" : paintColor;

      for (let by = startY; by < startY + size; by++) {
        for (let bx = startX; bx < startX + size; bx++) {
          if (bx < 0 || bx >= width || by < 0 || by >= height) {
            continue;
          }

          const cellIndex = by * width + bx;
          if (pixelsRef.current[cellIndex] === nextColor) continue;

          // Mutate the ref during the stroke; don't copy the whole array
          // for every cell. Commit one snapshot when the stroke ends.
          pixelsRef.current[cellIndex] = nextColor;
          drawCell(ctx, cellIndex, nextColor);
          changedStrokeRef.current = true;
        }
      }
    };

    const finishStroke = () => {
      if (!paintingRef.current) return;

      paintingRef.current = false;
      lastIndexRef.current = -1;

      if (changedStrokeRef.current) {
        const snapshot = [...pixelsRef.current];
        const history = historyRef.current.slice(
          0,
          historyIndexRef.current + 1
        );

        history.push(snapshot);

        // Limit history so long sessions don't grow memory forever.
        if (history.length > 100) history.shift();

        historyRef.current = history;
        historyIndexRef.current = history.length - 1;
        pixelsRef.current = snapshot;
        setPixels(snapshot);
      }

      changedStrokeRef.current = false;
    };

    const handlePointerDown = (
      e: ReactPointerEvent<HTMLCanvasElement>
    ) => {
      onActivate?.();

      const index = getPixelIndex(e);
      if (index < 0) return;

      if (tool === "eyedropper") {
        const picked = pixelsRef.current[index];
        if (picked) onPickColor?.(picked);
        return;
      }

      e.currentTarget.setPointerCapture(e.pointerId);
      paintingRef.current = true;
      lastIndexRef.current = -1;
      changedStrokeRef.current = false;
      paintAt(index);
    };

    return (
      <div className="flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden bg-background p-4">
        <canvas
          ref={canvasRef}
          aria-label="Pixel art view"
          tabIndex={0}
          className="block outline-none"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: `${width} / ${height}`,
            imageRendering: "pixelated",
            touchAction: "none",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={(e) => {
            if (paintingRef.current) paintAt(getPixelIndex(e));
          }}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onLostPointerCapture={finishStroke}
        />
      </div>
    );
  }
);

export default PixelView;
