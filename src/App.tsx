
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Eraser,
  Pipette,
  X,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";

import PixelView from "./components/PixelView";
import type { PixelViewHandle } from "./components/PixelView";
import type { Tool } from "./types";

export default function App() {
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [activeTool, setActiveTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#ff0000");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [focusedCanvas, setFocusedCanvas] = useState<0 | 1>(0);

  const [toolSizes, setToolSizes] = useState<Record<Tool, number>>({
    draw: 1,
    erase: 1,
    eyedropper: 1,
  });

  const leftCanvasRef = useRef<PixelViewHandle>(null);
  const rightCanvasRef = useRef<PixelViewHandle>(null);

  const tools = [
    { id: "draw" as const, label: "Pencil", icon: Pencil, hasSize: true },
    { id: "erase" as const, label: "Eraser", icon: Eraser, hasSize: true },
    {
      id: "eyedropper" as const,
      label: "Eyedropper",
      icon: Pipette,
      hasSize: false,
    },
  ];

  const currentTool = tools.find((tool) => tool.id === activeTool)!;
  const toolSize = toolSizes[activeTool];

  const changeToolSize = (size: number) => {
    setToolSizes((previous) => ({
      ...previous,
      [activeTool]: size,
    }));
  };

  const handleUndoRedo = useCallback(
    (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "z") {
        event.preventDefault();

        const canvasRef =
          focusedCanvas === 0 ? leftCanvasRef : rightCanvasRef;

        if (event.shiftKey) {
          canvasRef.current?.redo();
        } else {
          canvasRef.current?.undo();
        }
      } else if (key === "y") {
        event.preventDefault();

        const canvasRef =
          focusedCanvas === 0 ? leftCanvasRef : rightCanvasRef;

        canvasRef.current?.redo();
      }
    },
    [focusedCanvas]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleUndoRedo);
    return () => window.removeEventListener("keydown", handleUndoRedo);
  }, [handleUndoRedo]);

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      <aside
        className={`relative z-20 flex shrink-0 flex-col border-r transition-[width] duration-200 ${
          toolbarOpen ? "w-48" : "w-12"
        }`}
      >
        <button
          onClick={() => setToolbarOpen((open) => !open)}
          title={toolbarOpen ? "Collapse toolbar" : "Expand toolbar"}
          className="flex h-12 items-center justify-center border-b hover:bg-muted"
        >
          {toolbarOpen ? (
            <ChevronLeft size={18} />
          ) : (
            <ChevronRight size={18} />
          )}
        </button>

        <div className="flex flex-col gap-1 p-1.5">
          {tools.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTool(id)}
              title={label}
              className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm ${
                activeTool === id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              } ${toolbarOpen ? "justify-start" : "justify-center"}`}
            >
              <Icon size={18} />
              {toolbarOpen && <span>{label}</span>}
            </button>
          ))}
        </div>

        <div className="mt-auto border-t p-2">
          {toolbarOpen && (
            <p className="mb-2 text-xs text-muted-foreground">COLOR</p>
          )}

          <div
            className={`flex items-center ${
              toolbarOpen ? "gap-3" : "justify-center"
            }`}
          >
            <button
              type="button"
              title={`Choose color: ${color}`}
              aria-label="Open color picker"
              aria-expanded={colorPickerOpen}
              onClick={() => setColorPickerOpen((open) => !open)}
              className="h-8 w-8 shrink-0 rounded border border-border"
              style={{ backgroundColor: color }}
            />

            {toolbarOpen && (
              <button
                type="button"
                onClick={() => setColorPickerOpen((open) => !open)}
                className="font-mono text-xs uppercase hover:underline"
              >
                {color}
              </button>
            )}
          </div>
        </div>

        {colorPickerOpen && (
          <div className="absolute bottom-3 left-full z-50 ml-2 w-60 rounded-xl border bg-background p-3 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">Choose color</span>
              <button
                type="button"
                onClick={() => setColorPickerOpen(false)}
                aria-label="Close color picker"
                className="rounded p-1 hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>

            <HexColorPicker
              color={color}
              onChange={setColor}
              style={{ width: "100%", height: 160 }}
            />

            <div className="mt-3 flex items-center gap-2 rounded-md border p-2">
              <div
                className="h-7 w-7 shrink-0 rounded border"
                style={{ backgroundColor: color }}
              />
              <input
                type="text"
                value={color}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(value)) {
                    setColor(value);
                  }
                }}
                onBlur={() => {
                  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
                    setColor("#ff0000");
                  }
                }}
                aria-label="Hex color value"
                maxLength={7}
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase outline-none"
              />
            </div>
          </div>
        )}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b px-4">
          <div className="flex items-center gap-2">
            <currentTool.icon size={18} />
            <span className="text-sm font-medium">{currentTool.label}</span>
          </div>

          {currentTool.hasSize && (
            <>
              <div className="h-6 border-l" />

              <label
                htmlFor="tool-size"
                className="whitespace-nowrap text-sm text-muted-foreground"
              >
                Size
              </label>

              <input
                id="tool-size"
                type="range"
                min={1}
                max={16}
                step={1}
                value={toolSize}
                onChange={(event) =>
                  changeToolSize(Number(event.target.value))
                }
                className="w-40 cursor-pointer accent-primary"
              />

              <span className="w-8 text-right font-mono text-sm tabular-nums">
                {toolSize}
              </span>
              <span className="text-xs text-muted-foreground">
                {toolSize === 1 ? "pixel" : "pixels"}
              </span>
            </>
          )}

          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span>Undo: Ctrl+Z</span>
            <span>Redo: Ctrl+Shift+Z</span>
          </div>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex w-1/2 min-w-0 border-r">
            <PixelView
              ref={leftCanvasRef}
              tool={activeTool}
              paintColor="#000000"
              toolSize={toolSize}
              onActivate={() => setFocusedCanvas(0)}
            />
          </div>

          <div className="flex w-1/2 min-w-0">
            <PixelView
              ref={rightCanvasRef}
              tool={activeTool}
              paintColor={color}
              toolSize={toolSize}
              onPickColor={setColor}
              onActivate={() => setFocusedCanvas(1)}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
