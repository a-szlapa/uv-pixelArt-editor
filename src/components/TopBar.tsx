import { Redo2, Undo2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { Tool, CanvasDimensions } from "../types";

type TopBarProps = {
  activeTool: Tool;
  toolSize: number;
  onToolSizeChange: (size: number) => void;
  leftDimensions: CanvasDimensions;
  onResizeLeft: (dimensions: CanvasDimensions) => void;
  onUndo: () => void;
  onRedo: () => void;
  leftZoom: number;
  rightZoom: number;
  onZoomChange: (side: "left" | "right", zoom: number) => void;
};

export default function TopBar({
  activeTool, toolSize, onToolSizeChange,
  onUndo, onRedo, leftZoom, rightZoom, onZoomChange,
}: TopBarProps) {
  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b px-3 py-2">
      {(activeTool === "draw" || activeTool === "erase") && (
        <label className="flex items-center gap-2 text-sm">
          {activeTool === "draw" ? "Pencil size" : "Eraser size"}
          <input type="range" min={1} max={32} value={toolSize} onChange={e => onToolSizeChange(Number(e.currentTarget.value))} className="w-24 accent-primary" />
          <span className="w-5 font-mono tabular-nums">{toolSize}</span>
        </label>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={onUndo} title="Undo (Ctrl+Z)" className="rounded p-2 hover:bg-muted"><Undo2 size={17} /></button>
        <button type="button" onClick={onRedo} title="Redo (Ctrl+Shift+Z)" className="rounded p-2 hover:bg-muted"><Redo2 size={17} /></button>
        <span className="mx-1 h-6 border-l" />
        <ZoomControls label="L" zoom={leftZoom} onChange={z => onZoomChange("left", z)} />
        <ZoomControls label="R" zoom={rightZoom} onChange={z => onZoomChange("right", z)} />
      </div>
    </header>
  );
}

function clamp(value: string) {
  return Math.max(1, Math.min(2048, Number(value) || 1));
}

function ZoomControls({ label, zoom, onChange }: { label: string; zoom: number; onChange: (zoom: number) => void }) {
  return <div className="flex items-center gap-1" title={`${label === "L" ? "Left" : "Right"} canvas zoom`}>
    <span className="px-1 text-xs text-muted-foreground">{label}</span>
    <button type="button" onClick={() => onChange(Math.max(0.1, +(zoom / 1.25).toFixed(2)))} title="Zoom out" className="rounded p-1.5 hover:bg-muted"><ZoomOut size={15} /></button>
    <span className="w-12 text-center font-mono text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
    <button type="button" onClick={() => onChange(Math.min(16, +(zoom * 1.25).toFixed(2)))} title="Zoom in" className="rounded p-1.5 hover:bg-muted"><ZoomIn size={15} /></button>
    <button type="button" onClick={() => onChange(1)} title="Reset zoom" className="rounded p-1.5 hover:bg-muted"><Maximize2 size={15} /></button>
  </div>;
}
