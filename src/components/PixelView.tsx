import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import type {Tool} from "../types";

export type PixelViewProps = {
  width?: number;
  height?: number;
  pixelSize?: number;
  tool: Tool;
  paintColor: string;
  toolSize: number;
  zoom?: number;
  panX?: number;
  panY?: number;
  onZoomChange?: (zoom: number) => void;
  onPanChange?: (panX: number, panY: number) => void;
  referenceImage?: string;
  onPickColor?: (color: string) => void;
  onActivate?: () => void;
};

export type PixelViewHandle = {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  getPixels: () => string[];
  setPixels: (pixels: string[], width?: number, height?: number) => void;
};

const CHECKER_SIZE = 8;
const MAX_HISTORY = 100;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 32;

type PanDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
};

const PixelView = forwardRef<PixelViewHandle, PixelViewProps>(
  function PixelView(
    {
      width = 32,
      height = 32,
      pixelSize = 1,
      tool,
      paintColor,
      toolSize,
      zoom = 1,
      panX = 0,
      panY = 0,
      onZoomChange,
      onPanChange,
      onPickColor,
      onActivate,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    const paintingRef = useRef(false);
    const lastIndexRef = useRef(-1);
    const changedStrokeRef = useRef(false);
    const drawingPointerRef = useRef<number | null>(null);

    // Middle-mouse drag state.
    const panDragRef = useRef<PanDrag | null>(null);
    const [isPanning, setIsPanning] = useState(false);

    const [pixels, setPixels] = useState<string[]>(() =>
      Array(width * height).fill(""),
    );

    const pixelsRef = useRef(pixels);
    const historyRef = useRef<string[][]>([[...pixels]]);
    const historyIndexRef = useRef(0);

    const dimensionsRef = useRef({width, height});

    const canvasWidth = width * pixelSize;
    const canvasHeight = height * pixelSize;

    // Latest navigation values for wheel handling.
    const navigationRef = useRef({zoom, panX, panY});
    navigationRef.current = {zoom, panX, panY};

    // Preserve existing pixels when canvas dimensions change.
    useEffect(() => {
      const previous = dimensionsRef.current;

      if (previous.width === width && previous.height === height) {
        return;
      }

      const next = Array<string>(width * height).fill("");

      for (let y = 0; y < Math.min(previous.height, height); y++) {
        for (let x = 0; x < Math.min(previous.width, width); x++) {
          next[y * width + x] = pixelsRef.current[y * previous.width + x] ?? "";
        }
      }

      dimensionsRef.current = {width, height};
      pixelsRef.current = next;
      setPixels(next);

      historyRef.current = [[...next]];
      historyIndexRef.current = 0;

      paintingRef.current = false;
      changedStrokeRef.current = false;
      lastIndexRef.current = -1;
      drawingPointerRef.current = null;
      panDragRef.current = null;
      setIsPanning(false);
    }, [width, height]);

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
              (Math.floor(cx / CHECKER_SIZE) + Math.floor(cy / CHECKER_SIZE)) %
                2 ===
              0;

            ctx.fillStyle = even ? "#f1f5f9" : "#cbd5e1";

            ctx.fillRect(
              cx,
              cy,
              Math.min(CHECKER_SIZE, x + pixelSize - cx),
              Math.min(CHECKER_SIZE, y + pixelSize - cy),
            );
          }
        }
      },
      [width, pixelSize],
    );

    const redraw = useCallback(
      (source: string[]) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", {alpha: false});

        if (!canvas || !ctx) return;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        ctx.imageSmoothingEnabled = false;

        for (let y = 0; y < canvasHeight; y += CHECKER_SIZE) {
          for (let x = 0; x < canvasWidth; x += CHECKER_SIZE) {
            const even =
              (Math.floor(x / CHECKER_SIZE) + Math.floor(y / CHECKER_SIZE)) %
                2 ===
              0;

            ctx.fillStyle = even ? "#f1f5f9" : "#cbd5e1";

            ctx.fillRect(
              x,
              y,
              Math.min(CHECKER_SIZE, canvasWidth - x),
              Math.min(CHECKER_SIZE, canvasHeight - y),
            );
          }
        }

        source.forEach((color, index) => {
          if (color) drawCell(ctx, index, color);
        });
      },
      [canvasWidth, canvasHeight, drawCell],
    );

    useEffect(() => {
      redraw(pixelsRef.current);
    }, [pixels, redraw]);

    const restoreHistory = useCallback((index: number) => {
      const snapshot = historyRef.current[index];
      if (!snapshot) return;

      const restored = [...snapshot];

      historyIndexRef.current = index;
      pixelsRef.current = restored;
      setPixels(restored);
    }, []);

    const undo = useCallback(() => {
      if (historyIndexRef.current > 0) {
        restoreHistory(historyIndexRef.current - 1);
      }
    }, [restoreHistory]);

    const redo = useCallback(() => {
      if (historyIndexRef.current < historyRef.current.length - 1) {
        restoreHistory(historyIndexRef.current + 1);
      }
    }, [restoreHistory]);

    const clear = useCallback(() => {
      const empty = Array<string>(width * height).fill("");

      pixelsRef.current = empty;
      setPixels(empty);

      const history = historyRef.current.slice(0, historyIndexRef.current + 1);

      history.push([...empty]);

      if (history.length > MAX_HISTORY) {
        history.shift();
      }

      historyRef.current = history;
      historyIndexRef.current = history.length - 1;
    }, [width, height]);

    const setFramePixels = useCallback(
      (source: string[], frameWidth = width, frameHeight = height) => {
        const next = Array<string>(frameWidth * frameHeight).fill("");

        for (let i = 0; i < Math.min(next.length, source.length); i++) {
          next[i] = source[i] ?? "";
        }

        // Keep the dimension effect from treating a frame switch as a resize
        // that should preserve the previous frame's pixels.
        dimensionsRef.current = {
          width: frameWidth,
          height: frameHeight,
        };

        pixelsRef.current = next;
        setPixels(next);

        historyRef.current = [[...next]];
        historyIndexRef.current = 0;

        paintingRef.current = false;
        changedStrokeRef.current = false;
        lastIndexRef.current = -1;
        drawingPointerRef.current = null;
      },
      [width, height],
    );

    useImperativeHandle(
      ref,
      () => ({
        undo,
        redo,
        clear,
        getPixels: () => [...pixelsRef.current],
        setPixels: setFramePixels,
      }),
      [undo, redo, clear, setFramePixels],
    );

    // Convert pointer coordinates into image pixel coordinates.
    const getPixelIndex = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();

      if (!rect.width || !rect.height) return -1;

      const x = Math.floor(((event.clientX - rect.left) / rect.width) * width);

      const y = Math.floor(((event.clientY - rect.top) / rect.height) * height);

      if (x < 0 || x >= width || y < 0 || y >= height) {
        return -1;
      }

      return y * width + x;
    };

    const paintAt = (index: number) => {
      if (index < 0 || index === lastIndexRef.current) return;

      lastIndexRef.current = index;

      const ctx = canvasRef.current?.getContext("2d", {
        alpha: false,
      });

      if (!ctx) return;

      const centerX = index % width;
      const centerY = Math.floor(index / width);
      const size = Math.max(1, Math.floor(toolSize));

      const startX = centerX - Math.floor((size - 1) / 2);
      const startY = centerY - Math.floor((size - 1) / 2);

      const nextColor = tool === "erase" ? "" : paintColor;

      for (let y = startY; y < startY + size; y++) {
        for (let x = startX; x < startX + size; x++) {
          if (x < 0 || x >= width || y < 0 || y >= height) {
            continue;
          }

          const cellIndex = y * width + x;

          if (pixelsRef.current[cellIndex] === nextColor) {
            continue;
          }

          pixelsRef.current[cellIndex] = nextColor;
          drawCell(ctx, cellIndex, nextColor);
          changedStrokeRef.current = true;
        }
      }
    };

    const finishStroke = () => {
      if (!paintingRef.current) return;

      paintingRef.current = false;
      drawingPointerRef.current = null;
      lastIndexRef.current = -1;

      if (changedStrokeRef.current) {
        const snapshot = [...pixelsRef.current];

        const history = historyRef.current.slice(
          0,
          historyIndexRef.current + 1,
        );

        history.push(snapshot);

        if (history.length > MAX_HISTORY) {
          history.shift();
        }

        historyRef.current = history;
        historyIndexRef.current = history.length - 1;
        pixelsRef.current = snapshot;

        setPixels(snapshot);
      }

      changedStrokeRef.current = false;
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      onActivate?.();

      // Middle mouse button: grab and pan the canvas.
      if (event.button === 1) {
        event.preventDefault();
        event.stopPropagation();

        // Avoid starting a pan while another pointer action is active.
        if (paintingRef.current || panDragRef.current) return;

        event.currentTarget.setPointerCapture(event.pointerId);

        panDragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startPanX: panX,
          startPanY: panY,
        };

        setIsPanning(true);
        return;
      }

      // Only the left mouse button paints or picks colors.
      if (event.button !== 0) return;

      if (panDragRef.current) return;

      const index = getPixelIndex(event);
      if (index < 0) return;

      if (tool === "eyedropper") {
        const picked = pixelsRef.current[index];

        if (picked) {
          onPickColor?.(picked);
        }

        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);

      drawingPointerRef.current = event.pointerId;
      paintingRef.current = true;
      lastIndexRef.current = -1;
      changedStrokeRef.current = false;

      paintAt(index);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = panDragRef.current;

      // Pan is calculated in screen pixels, not image pixels.
      // This remains accurate at every zoom level.
      if (drag && drag.pointerId === event.pointerId) {
        event.preventDefault();

        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;

        onPanChange?.(drag.startPanX + deltaX, drag.startPanY + deltaY);

        return;
      }

      if (
        paintingRef.current &&
        drawingPointerRef.current === event.pointerId
      ) {
        paintAt(getPixelIndex(event));
      }
    };

    const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = panDragRef.current;

      if (drag && drag.pointerId === event.pointerId) {
        event.preventDefault();

        panDragRef.current = null;
        setIsPanning(false);
        return;
      }

      if (drawingPointerRef.current === event.pointerId) {
        finishStroke();
      }
    };

    const handlePointerCancel = (
      event: ReactPointerEvent<HTMLCanvasElement>,
    ) => {
      const drag = panDragRef.current;

      if (drag && drag.pointerId === event.pointerId) {
        panDragRef.current = null;
        setIsPanning(false);
      }

      if (drawingPointerRef.current === event.pointerId) {
        finishStroke();
      }
    };

    const handleLostPointerCapture = (
      event: ReactPointerEvent<HTMLCanvasElement>,
    ) => {
      const drag = panDragRef.current;

      if (drag && drag.pointerId === event.pointerId) {
        panDragRef.current = null;
        setIsPanning(false);
      }

      if (drawingPointerRef.current === event.pointerId) {
        finishStroke();
      }
    };

    // Ctrl + wheel: zoom around cursor.
    // Alt + wheel: horizontal pan.
    // Shift + wheel: vertical pan.
    useEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const handleWheel = (event: WheelEvent) => {
        if (!event.ctrlKey && !event.altKey && !event.shiftKey) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        onActivate?.();

        const current = navigationRef.current;

        if (event.ctrlKey) {
          const rect = viewport.getBoundingClientRect();

          if (!rect.width || !rect.height) return;

          const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;

          if (delta === 0) return;

          const factor = delta < 0 ? 1.1 : 1 / 1.1;

          const nextZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, current.zoom * factor),
          );

          if (nextZoom === current.zoom) return;

          const cursorX = event.clientX - rect.left - rect.width / 2;

          const cursorY = event.clientY - rect.top - rect.height / 2;

          const ratio = nextZoom / current.zoom;

          const nextPanX = cursorX - (cursorX - current.panX) * ratio;

          const nextPanY = cursorY - (cursorY - current.panY) * ratio;

          onPanChange?.(nextPanX, nextPanY);
          onZoomChange?.(nextZoom);

          return;
        }

        if (event.altKey) {
          const delta = event.deltaX !== 0 ? event.deltaX : event.deltaY;

          if (delta === 0) return;

          onPanChange?.(current.panX - delta, current.panY);

          return;
        }

        if (event.shiftKey) {
          const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;

          if (delta === 0) return;

          onPanChange?.(current.panX, current.panY - delta);
        }
      };

      viewport.addEventListener("wheel", handleWheel, {
        passive: false,
      });

      return () => {
        viewport.removeEventListener("wheel", handleWheel);
      };
    }, [onActivate, onPanChange, onZoomChange]);

    return (
      <div
        ref={viewportRef}
        className="flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden bg-background"
        style={{
          overscrollBehavior: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div
          className="flex shrink-0 items-center justify-center"
          style={{
            width: canvasWidth * zoom,
            height: canvasHeight * zoom,
            transform: `translate(${panX}px, ${panY}px)`,
            flexShrink: 0,
          }}
        >
          <canvas
            ref={canvasRef}
            aria-label={`Pixel art canvas ${width} by ${height}`}
            className="block"
            style={{
              width: canvasWidth * zoom,
              height: canvasHeight * zoom,
              imageRendering: "pixelated",
              touchAction: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
              cursor: isPanning
                ? "grabbing"
                : tool === "eyedropper"
                  ? "copy"
                  : "crosshair",
            }}
            onAuxClick={(event) => {
              // Prevent Chromium's middle-click auto-scroll behavior.
              if (event.button === 1) {
                event.preventDefault();
              }
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={handleLostPointerCapture}
          />
        </div>
      </div>
    );
  },
);

export default PixelView;
