import { useCallback, useEffect, useRef, useState } from "react";
import Toolbar from "./components/Toolbar";
import TopBar from "./components/TopBar";
import PixelView from "./components/PixelView";
import type { PixelViewHandle } from "./components/PixelView";
import type { CanvasDimensions, ReferenceImage, Tool } from "./types";

export default function App() {
  const [activeTool, setActiveTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#ff0000");
  const [toolSizes, setToolSizes] = useState<Record<Tool, number>>({ draw: 1, erase: 1, eyedropper: 1 });
  const [leftDimensions, setLeftDimensions] = useState<CanvasDimensions>({ width: 32, height: 32 });
  const [rightDimensions, setRightDimensions] = useState<CanvasDimensions>({ width: 256, height: 256 });
  const [leftZoom, setLeftZoom] = useState(8);
  const [rightZoom, setRightZoom] = useState(1);
  const [focused, setFocused] = useState<"left" | "right">("left");
  const [reference, setReference] = useState<ReferenceImage | null>(null);
  const [resizeTarget, setResizeTarget] = useState<"left" | "right" | null>(null);
  const [resizeWidth, setResizeWidth] = useState("32");
  const [resizeHeight, setResizeHeight] = useState("32");
  const leftRef = useRef<PixelViewHandle>(null);
  const rightRef = useRef<PixelViewHandle>(null);

  const undo = useCallback(() => (focused === "left" ? leftRef : rightRef).current?.undo(), [focused]);
  const redo = useCallback(() => (focused === "left" ? leftRef : rightRef).current?.redo(), [focused]);

  const openResize = useCallback((side: "left" | "right") => {
    const dimensions = side === "left" ? leftDimensions : rightDimensions;
    setResizeTarget(side);
    setResizeWidth(String(dimensions.width));
    setResizeHeight(String(dimensions.height));
  }, [leftDimensions, rightDimensions]);

  const importReference = useCallback(async () => {
    const result = await window.desktop?.importReference();
    if (result) setReference(result);
  }, []);

  const setZoom = useCallback((side: "left" | "right", zoom: number) => {
    if (side === "left") setLeftZoom(zoom);
    else setRightZoom(zoom);
  }, []);

  useEffect(() => {
    const unsubscribe = window.desktop?.onMenuAction(action => {
      if (action === "import-reference") void importReference();
      else if (action === "resize-left") openResize("left");
      else if (action === "resize-right") openResize("right");
      else if (action === "zoom-left-in") setLeftZoom(z => Math.min(16, z * 1.25));
      else if (action === "zoom-left-out") setLeftZoom(z => Math.max(0.1, z / 1.25));
      else if (action === "zoom-left-reset") setLeftZoom(1);
      else if (action === "zoom-right-in") setRightZoom(z => Math.min(16, z * 1.25));
      else if (action === "zoom-right-out") setRightZoom(z => Math.max(0.1, z / 1.25));
      else if (action === "zoom-right-reset") setRightZoom(1);
    });
    return () => unsubscribe?.();
  }, [importReference, openResize]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const key = event.key.toLowerCase();
      if (key === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if (key === "y") { event.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  useEffect(() => () => {
    if (reference?.dataUrl.startsWith("blob:")) URL.revokeObjectURL(reference.dataUrl);
  }, [reference]);

  const applyResize = () => {
    if (!resizeTarget) return;
    const max = resizeTarget === "right" ? 256 : 2048;
    const dimensions = {
      width: Math.max(1, Math.min(max, Number(resizeWidth) || 1)),
      height: Math.max(1, Math.min(max, Number(resizeHeight) || 1)),
    };
    if (resizeTarget === "left") setLeftDimensions(dimensions);
    else setRightDimensions(dimensions);
    setResizeTarget(null);
  };

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <Toolbar activeTool={activeTool} onToolChange={setActiveTool} color={color} onColorChange={setColor} />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar activeTool={activeTool} toolSize={toolSizes[activeTool]} onToolSizeChange={size => setToolSizes(old => ({ ...old, [activeTool]: size }))}
          leftDimensions={leftDimensions} onResizeLeft={setLeftDimensions} onUndo={undo} onRedo={redo}
          leftZoom={leftZoom} rightZoom={rightZoom} onZoomChange={setZoom} />
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex w-1/2 min-w-0 border-r">
            <PixelView ref={leftRef} width={leftDimensions.width} height={leftDimensions.height} zoom={leftZoom}
              tool={activeTool} paintColor="#000000" toolSize={toolSizes[activeTool]} onActivate={() => setFocused("left")} />
          </div>
          <div className="flex w-1/2 min-w-0">
            <PixelView ref={rightRef} width={rightDimensions.width} height={rightDimensions.height} zoom={rightZoom}
              tool={activeTool} paintColor={color} toolSize={toolSizes[activeTool]} referenceImage={reference?.dataUrl}
              onPickColor={setColor} onActivate={() => setFocused("right")} />
          </div>
        </div>
      </section>

      {resizeTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={e => { e.preventDefault(); applyResize(); }} className="w-full max-w-sm rounded-xl border bg-background p-5 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold">Resize {resizeTarget === "left" ? "left" : "right"} canvas</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {resizeTarget === "right" ? "Maximum dimensions are 256 × 256." : "Maximum dimensions are 2048 × 2048."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Width
                <input autoFocus type="number" min={1} max={resizeTarget === "right" ? 256 : 2048} value={resizeWidth} onChange={e => setResizeWidth(e.target.value)} className="mt-1 w-full rounded border bg-background p-2" />
              </label>
              <label className="text-sm">Height
                <input type="number" min={1} max={resizeTarget === "right" ? 256 : 2048} value={resizeHeight} onChange={e => setResizeHeight(e.target.value)} className="mt-1 w-full rounded border bg-background p-2" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setResizeTarget(null)} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">Cancel</button>
              <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Resize</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
