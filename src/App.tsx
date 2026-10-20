import {useCallback, useEffect, useRef, useState} from "react";
import Toolbar from "./components/Toolbar";
import TopBar from "./components/TopBar";
import PixelView from "./components/PixelView";
import type {PixelViewHandle} from "./components/PixelView";
import type {CanvasDimensions, ReferenceImage, Tool} from "./types";

type CanvasSide = "left" | "right";

type Pan = {
  x: number;
  y: number;
};

type AnimationFrame = {
  width: number;
  height: number;
  pixels: string[];
};

type ImportedPng = {
  name: string;
  dataUrl: string;
};

export default function App() {
  const [activeTool, setActiveTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#ff0000");

  const [toolSizes, setToolSizes] = useState<Record<Tool, number>>({
    draw: 1,
    erase: 1,
    eyedropper: 1,
  });

  const [leftDimensions, setLeftDimensions] = useState<CanvasDimensions>({
    width: 32,
    height: 32,
  });

  const [rightDimensions, setRightDimensions] = useState<CanvasDimensions>({
    width: 256,
    height: 256,
  });

  const [leftZoom, setLeftZoom] = useState(8);
  const [rightZoom, setRightZoom] = useState(1);

  const [leftPan, setLeftPan] = useState<Pan>({x: 0, y: 0});
  const [rightPan, setRightPan] = useState<Pan>({x: 0, y: 0});

  const [focused, setFocused] = useState<CanvasSide>("left");
  const [reference, setReference] = useState<ReferenceImage | null>(null);

  const [resizeTarget, setResizeTarget] = useState<CanvasSide | null>(null);
  const [resizeWidth, setResizeWidth] = useState("32");
  const [resizeHeight, setResizeHeight] = useState("32");

  // Animation frames.
  const [frames, setFrames] = useState<AnimationFrame[]>([]);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);

  // Animation-strip import dialog.
  const [animStrip, setAnimStrip] = useState<ImportedPng | null>(null);
  const [stripImageSize, setStripImageSize] = useState({
    width: 0,
    height: 0,
  });

  const [cellWidth, setCellWidth] = useState(16);
  const [cellHeight, setCellHeight] = useState(16);
  const [columnCount, setColumnCount] = useState(1);
  const [rowCount, setRowCount] = useState(1);
  const [stripError, setStripError] = useState("");

  const leftRef = useRef<PixelViewHandle>(null);
  const rightRef = useRef<PixelViewHandle>(null);

  const undo = useCallback(() => {
    (focused === "left" ? leftRef : rightRef).current?.undo();
  }, [focused]);

  const redo = useCallback(() => {
    (focused === "left" ? leftRef : rightRef).current?.redo();
  }, [focused]);

  const openResize = useCallback(
    (side: CanvasSide) => {
      const dimensions = side === "left" ? leftDimensions : rightDimensions;

      setResizeTarget(side);
      setResizeWidth(String(dimensions.width));
      setResizeHeight(String(dimensions.height));
    },
    [leftDimensions, rightDimensions],
  );

  const importReference = useCallback(async () => {
    const result = await window.desktop?.importReference();

    if (result) {
      setReference(result);
    }
  }, []);

  const importAnimStrip = useCallback(async () => {
    const result = await window.desktop?.importAnimStrip();

    if (!result) return;

    setStripError("");
    setStripImageSize({width: 0, height: 0});
    setAnimStrip(result);
  }, []);

  const setZoom = useCallback((side: CanvasSide, zoom: number) => {
    const nextZoom = Math.max(0.25, Math.min(32, zoom));

    if (side === "left") {
      setLeftZoom(nextZoom);
    } else {
      setRightZoom(nextZoom);
    }
  }, []);

  const setPan = useCallback((side: CanvasSide, x: number, y: number) => {
    const limit = 100000;

    const nextPan = {
      x: Math.max(-limit, Math.min(limit, x)),
      y: Math.max(-limit, Math.min(limit, y)),
    };

    if (side === "left") {
      setLeftPan(nextPan);
    } else {
      setRightPan(nextPan);
    }
  }, []);

  const resetView = useCallback((side: CanvasSide) => {
    if (side === "left") {
      setLeftZoom(1);
      setLeftPan({x: 0, y: 0});
    } else {
      setRightZoom(1);
      setRightPan({x: 0, y: 0});
    }
  }, []);

  // Load an imported strip to determine its real dimensions.
  useEffect(() => {
    if (!animStrip) return;

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;

      const imageWidth = image.naturalWidth;
      const imageHeight = image.naturalHeight;

      setStripImageSize({
        width: imageWidth,
        height: imageHeight,
      });

      const initialWidth = Math.min(16, imageWidth);
      const initialHeight = Math.min(16, imageHeight);

      setCellWidth(initialWidth);
      setCellHeight(initialHeight);

      setColumnCount(Math.max(1, Math.floor(imageWidth / initialWidth)));
      setRowCount(Math.max(1, Math.floor(imageHeight / initialHeight)));
      setStripError("");
    };

    image.onerror = () => {
      if (!cancelled) {
        setStripError("Could not load this PNG.");
      }
    };

    image.src = animStrip.dataUrl;

    return () => {
      cancelled = true;
    };
  }, [animStrip]);

  const commitAnimationStrip = useCallback(async () => {
    if (!animStrip) return;

    const imageWidth = stripImageSize.width;
    const imageHeight = stripImageSize.height;

    const validGrid =
      imageWidth > 0 &&
      imageHeight > 0 &&
      Number.isInteger(cellWidth) &&
      Number.isInteger(cellHeight) &&
      Number.isInteger(columnCount) &&
      Number.isInteger(rowCount) &&
      cellWidth >= 1 &&
      cellHeight >= 1 &&
      columnCount >= 1 &&
      rowCount >= 1 &&
      cellWidth * columnCount <= imageWidth &&
      cellHeight * rowCount <= imageHeight;

    if (!validGrid) {
      setStripError(
        "The cell size and row/column counts must fit entirely inside the PNG.",
      );
      return;
    }

    try {
      const image = new Image();

      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not decode this PNG."));
      });

      image.src = animStrip.dataUrl;
      await loaded;

      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = image.naturalWidth;
      sourceCanvas.height = image.naturalHeight;

      const context = sourceCanvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (!context) {
        throw new Error("Could not read the PNG pixels.");
      }

      context.drawImage(image, 0, 0);

      const importedFrames: AnimationFrame[] = [];

      // Read frames left-to-right, then top-to-bottom.
      for (let row = 0; row < rowCount; row++) {
        for (let column = 0; column < columnCount; column++) {
          const imageData = context.getImageData(
            column * cellWidth,
            row * cellHeight,
            cellWidth,
            cellHeight,
          );

          const rgba = imageData.data;
          const colors: string[] = [];

          for (let i = 0; i < rgba.length; i += 4) {
            const r = rgba[i];
            const g = rgba[i + 1];
            const b = rgba[i + 2];
            const a = rgba[i + 3];

            // This editor represents transparent pixels as empty strings.
            colors.push(
              a === 0
                ? ""
                : `#${[r, g, b]
                    .map((channel) => channel.toString(16).padStart(2, "0"))
                    .join("")}`,
            );
          }

          importedFrames.push({
            width: cellWidth,
            height: cellHeight,
            pixels: colors,
          });
        }
      }

      if (importedFrames.length === 0) {
        throw new Error("No frames were found in the selected grid.");
      }

      setFrames(importedFrames);
      setActiveFrameIndex(0);
      setLeftDimensions({width: cellWidth, height: cellHeight});

      leftRef.current?.setPixels(
        importedFrames[0].pixels,
        cellWidth,
        cellHeight,
      );

      setFocused("left");
      setAnimStrip(null);
      setStripError("");
    } catch (error) {
      setStripError(
        error instanceof Error
          ? error.message
          : "Could not import the animation strip.",
      );
    }
  }, [animStrip, stripImageSize, cellWidth, cellHeight, columnCount, rowCount]);

  // Save the visible frame before switching and restore the requested frame.
  const goToFrame = useCallback(
    (requestedIndex: number) => {
      if (frames.length === 0) return;

      const nextIndex = Math.max(
        0,
        Math.min(frames.length - 1, requestedIndex),
      );

      if (nextIndex === activeFrameIndex) return;

      const currentPixels = leftRef.current?.getPixels();

      const updatedFrames = frames.map((frame, index) =>
        index === activeFrameIndex && currentPixels
          ? {...frame, pixels: currentPixels}
          : frame,
      );

      setFrames(updatedFrames);

      const nextFrame = updatedFrames[nextIndex];

      setLeftDimensions({
        width: nextFrame.width,
        height: nextFrame.height,
      });

      leftRef.current?.setPixels(
        nextFrame.pixels,
        nextFrame.width,
        nextFrame.height,
      );

      setActiveFrameIndex(nextIndex);
      setFocused("left");
    },
    [frames, activeFrameIndex],
  );

  useEffect(() => {
    const unsubscribe = window.desktop?.onMenuAction((action) => {
      if (action === "import-reference") {
        void importReference();
      } else if (action === "import-anim-strip") {
        void importAnimStrip();
      } else if (action === "resize-left") {
        openResize("left");
      } else if (action === "resize-right") {
        openResize("right");
      } else if (action === "zoom-left-in") {
        setLeftZoom((z) => Math.min(32, z * 1.25));
      } else if (action === "zoom-left-out") {
        setLeftZoom((z) => Math.max(0.25, z / 1.25));
      } else if (action === "zoom-left-reset") {
        resetView("left");
      } else if (action === "zoom-right-in") {
        setRightZoom((z) => Math.min(32, z * 1.25));
      } else if (action === "zoom-right-out") {
        setRightZoom((z) => Math.max(0.25, z / 1.25));
      } else if (action === "zoom-right-reset") {
        resetView("right");
      }
    });

    return () => unsubscribe?.();
  }, [importReference, importAnimStrip, openResize, resetView]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;

      return (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;

      // Prevent the Windows/Electron menu from activating on Alt alone.
      if (event.key === "Alt") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Stop Chromium zoom and browser navigation shortcuts.
      if (
        (modifier && ["+", "=", "-", "0"].includes(key)) ||
        (event.altKey && ["arrowleft", "arrowright"].includes(key))
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Navigate frames with the arrow keys when no modifier is held.
      if (!modifier && !event.altKey) {
        if (event.key === "ArrowLeft" && frames.length > 0) {
          event.preventDefault();
          goToFrame(activeFrameIndex - 1);
          return;
        }

        if (event.key === "ArrowRight" && frames.length > 0) {
          event.preventDefault();
          goToFrame(activeFrameIndex + 1);
          return;
        }
      }

      if (!modifier) return;

      if (key === "z") {
        event.preventDefault();
        event.stopPropagation();

        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (key === "y") {
        event.preventDefault();
        event.stopPropagation();
        redo();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt" && !isEditableTarget(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target;

      if (target instanceof HTMLElement && target.closest("canvas")) {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("contextmenu", onContextMenu, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
    };
  }, [undo, redo, frames.length, activeFrameIndex, goToFrame]);

  useEffect(() => {
    return () => {
      if (reference?.dataUrl.startsWith("blob:")) {
        URL.revokeObjectURL(reference.dataUrl);
      }
    };
  }, [reference]);

  const applyResize = () => {
    if (!resizeTarget) return;

    const max = resizeTarget === "right" ? 256 : 2048;

    const dimensions = {
      width: Math.max(1, Math.min(max, Math.floor(Number(resizeWidth) || 1))),
      height: Math.max(1, Math.min(max, Math.floor(Number(resizeHeight) || 1))),
    };

    if (resizeTarget === "left") {
      setLeftDimensions(dimensions);
    } else {
      setRightDimensions(dimensions);
    }

    setResizeTarget(null);
  };

  const gridFits =
    stripImageSize.width > 0 &&
    stripImageSize.height > 0 &&
    cellWidth >= 1 &&
    cellHeight >= 1 &&
    columnCount >= 1 &&
    rowCount >= 1 &&
    cellWidth * columnCount <= stripImageSize.width &&
    cellHeight * rowCount <= stripImageSize.height;

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        color={color}
        onColorChange={setColor}
      />

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar
          activeTool={activeTool}
          toolSize={toolSizes[activeTool]}
          onToolSizeChange={(size) =>
            setToolSizes((old) => ({
              ...old,
              [activeTool]: size,
            }))
          }
          leftDimensions={leftDimensions}
          onResizeLeft={setLeftDimensions}
          onUndo={undo}
          onRedo={redo}
          leftZoom={leftZoom}
          rightZoom={rightZoom}
          onZoomChange={setZoom}
        />

        {frames.length > 0 && (
          <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
            <button
              type="button"
              onClick={() => goToFrame(activeFrameIndex - 1)}
              disabled={activeFrameIndex === 0}
              className="rounded border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40"
              aria-label="Previous frame"
              title="Previous frame (Left Arrow)"
            >
              ←
            </button>

            <span className="min-w-24 text-center text-sm tabular-nums">
              Frame {activeFrameIndex + 1} / {frames.length}
            </span>

            <input
              aria-label="Animation frame"
              type="range"
              min={0}
              max={frames.length - 1}
              value={activeFrameIndex}
              onChange={(event) => goToFrame(Number(event.target.value))}
              className="min-w-0 flex-1 accent-primary"
            />

            <button
              type="button"
              onClick={() => goToFrame(activeFrameIndex + 1)}
              disabled={activeFrameIndex === frames.length - 1}
              className="rounded border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40"
              aria-label="Next frame"
              title="Next frame (Right Arrow)"
            >
              →
            </button>
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex w-1/2 min-w-0 border-r">
            <PixelView
              ref={leftRef}
              width={leftDimensions.width}
              height={leftDimensions.height}
              zoom={leftZoom}
              panX={leftPan.x}
              panY={leftPan.y}
              onZoomChange={(zoom) => setZoom("left", zoom)}
              onPanChange={(x, y) => setPan("left", x, y)}
              tool={activeTool}
              paintColor="#000000"
              toolSize={toolSizes[activeTool]}
              onActivate={() => setFocused("left")}
            />
          </div>

          <div className="flex w-1/2 min-w-0">
            <PixelView
              ref={rightRef}
              width={rightDimensions.width}
              height={rightDimensions.height}
              zoom={rightZoom}
              panX={rightPan.x}
              panY={rightPan.y}
              onZoomChange={(zoom) => setZoom("right", zoom)}
              onPanChange={(x, y) => setPan("right", x, y)}
              tool={activeTool}
              paintColor={color}
              toolSize={toolSizes[activeTool]}
              referenceImage={reference?.dataUrl}
              onPickColor={setColor}
              onActivate={() => setFocused("right")}
            />
          </div>
        </div>
      </section>

      {resizeTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              applyResize();
            }}
            className="w-full max-w-sm rounded-xl border bg-background p-5 shadow-2xl"
          >
            <h2 className="mb-4 text-lg font-semibold">
              Resize {resizeTarget === "left" ? "left" : "right"} canvas
            </h2>

            <p className="mb-4 text-sm text-muted-foreground">
              {resizeTarget === "right"
                ? "Maximum dimensions are 256 × 256."
                : "Maximum dimensions are 2048 × 2048."}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Width
                <input
                  autoFocus
                  type="number"
                  min={1}
                  max={resizeTarget === "right" ? 256 : 2048}
                  value={resizeWidth}
                  onChange={(event) => setResizeWidth(event.target.value)}
                  className="mt-1 w-full rounded border bg-background p-2"
                />
              </label>

              <label className="text-sm">
                Height
                <input
                  type="number"
                  min={1}
                  max={resizeTarget === "right" ? 256 : 2048}
                  value={resizeHeight}
                  onChange={(event) => setResizeHeight(event.target.value)}
                  className="mt-1 w-full rounded border bg-background p-2"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResizeTarget(null)}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                Resize
              </button>
            </div>
          </form>
        </div>
      )}

      {animStrip && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void commitAnimationStrip();
            }}
            className="my-auto w-full max-w-3xl rounded-xl border bg-background p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Import Animation Strip
                </h2>
                <p className="text-sm text-muted-foreground">
                  {animStrip.name} · {stripImageSize.width || "…"} ×{" "}
                  {stripImageSize.height || "…"} px
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAnimStrip(null);
                  setStripError("");
                }}
                className="rounded border px-3 py-1 text-sm hover:bg-muted"
              >
                Cancel
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="text-sm">
                Cell width
                <input
                  type="number"
                  min={1}
                  max={stripImageSize.width || 2048}
                  value={cellWidth}
                  onChange={(event) => {
                    const width = Math.max(
                      1,
                      Math.min(
                        stripImageSize.width || 2048,
                        Math.floor(Number(event.target.value) || 1),
                      ),
                    );
                    setCellWidth(width);
                    setColumnCount(
                      Math.max(1, Math.floor(stripImageSize.width / width)),
                    );
                  }}
                  className="mt-1 w-full rounded border bg-background p-2"
                />
              </label>

              <label className="text-sm">
                Cell height
                <input
                  type="number"
                  min={1}
                  max={stripImageSize.height || 2048}
                  value={cellHeight}
                  onChange={(event) => {
                    const height = Math.max(
                      1,
                      Math.min(
                        stripImageSize.height || 2048,
                        Math.floor(Number(event.target.value) || 1),
                      ),
                    );
                    setCellHeight(height);
                    setRowCount(
                      Math.max(1, Math.floor(stripImageSize.height / height)),
                    );
                  }}
                  className="mt-1 w-full rounded border bg-background p-2"
                />
              </label>

              <label className="text-sm">
                Columns
                <input
                  type="number"
                  min={1}
                  max={stripImageSize.width || 2048}
                  value={columnCount}
                  onChange={(event) => {
                    const columns = Math.max(
                      1,
                      Math.min(
                        stripImageSize.width || 2048,
                        Math.floor(Number(event.target.value) || 1),
                      ),
                    );

                    setColumnCount(columns);

                    if (stripImageSize.width > 0) {
                      setCellWidth(Math.floor(stripImageSize.width / columns));
                    }
                  }}
                  className="mt-1 w-full rounded border bg-background p-2"
                />
              </label>

              <label className="text-sm">
                Rows
                <input
                  type="number"
                  min={1}
                  max={stripImageSize.height || 2048}
                  value={rowCount}
                  onChange={(event) => {
                    const rows = Math.max(
                      1,
                      Math.min(
                        stripImageSize.height || 2048,
                        Math.floor(Number(event.target.value) || 1),
                      ),
                    );

                    setRowCount(rows);

                    if (stripImageSize.height > 0) {
                      setCellHeight(Math.floor(stripImageSize.height / rows));
                    }
                  }}
                  className="mt-1 w-full rounded border bg-background p-2"
                />
              </label>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>{columnCount * rowCount} frames</span>
              <span>
                Each frame: {cellWidth} × {cellHeight} px
              </span>
            </div>

            <div className="mb-3 flex max-h-[45vh] min-h-24 items-center justify-center overflow-auto rounded border bg-muted/30 p-3">
              {stripImageSize.width > 0 && stripImageSize.height > 0 ? (
                <div
                  className="relative shrink-0"
                  style={{
                    width: `min(100%, 1000px)`,
                    aspectRatio: `${stripImageSize.width} / ${stripImageSize.height}`,
                  }}
                >
                  <img
                    src={animStrip.dataUrl}
                    alt="Animation strip preview"
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-fill"
                    style={{imageRendering: "pixelated"}}
                  />

                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, rgba(250,204,21,.95) 1px, transparent 1px), linear-gradient(to bottom, rgba(250,204,21,.95) 1px, transparent 1px)",
                      backgroundSize: `${
                        (cellWidth / stripImageSize.width) * 100
                      }% 100%, 100% ${
                        (cellHeight / stripImageSize.height) * 100
                      }%`,
                      backgroundPosition: "top left",
                    }}
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Loading PNG preview…
                </span>
              )}
            </div>

            {stripError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {stripError}
              </p>
            )}

            {!gridFits && stripImageSize.width > 0 && (
              <p className="mt-3 text-sm text-destructive">
                The selected grid must fit entirely inside the PNG.
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAnimStrip(null);
                  setStripError("");
                }}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!gridFits}
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
              >
                Import {columnCount * rowCount} Frames
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
