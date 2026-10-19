import { useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Eraser, Pipette, X } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import type { Tool } from "../types";

type ToolbarProps = {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
};

const tools = [
  { id: "draw" as const, label: "Pencil", Icon: Pencil },
  { id: "erase" as const, label: "Eraser", Icon: Eraser },
  { id: "eyedropper" as const, label: "Eyedropper", Icon: Pipette },
];

export default function Toolbar({ activeTool, onToolChange, color, onColorChange }: ToolbarProps) {
  const [expanded, setExpanded] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <aside className={`relative z-20 flex h-full shrink-0 flex-col border-r bg-background transition-[width] duration-200 ${expanded ? "w-48" : "w-12"}`}>
      <button type="button" onClick={() => setExpanded(v => !v)} title={expanded ? "Collapse toolbar" : "Expand toolbar"} className="flex h-12 shrink-0 items-center justify-center border-b hover:bg-muted">
        {expanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>
      <div className="flex flex-col gap-1 p-1.5">
        {tools.map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => onToolChange(id)} title={label}
            className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm ${activeTool === id ? "bg-primary text-primary-foreground" : "hover:bg-muted"} ${expanded ? "justify-start" : "justify-center"}`}>
            <Icon size={18} />{expanded && <span>{label}</span>}
          </button>
        ))}
      </div>
      <div className="mt-auto border-t p-2">
        {expanded && <p className="mb-2 text-xs text-muted-foreground">COLOR</p>}
        <div className={`flex items-center ${expanded ? "gap-3" : "justify-center"}`}>
          <button type="button" onClick={() => setPickerOpen(v => !v)} title={`Choose color: ${color}`} aria-label="Open color picker"
            className="h-8 w-8 shrink-0 rounded border border-border" style={{ backgroundColor: color }} />
          {expanded && <button type="button" onClick={() => setPickerOpen(v => !v)} className="font-mono text-xs uppercase hover:underline">{color}</button>}
        </div>
      </div>
      {pickerOpen && (
        <div className="absolute bottom-3 left-full z-50 ml-2 w-60 rounded-xl border bg-background p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium">Choose color</span>
            <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close color picker" className="rounded p-1 hover:bg-muted"><X size={16} /></button>
          </div>
          <HexColorPicker color={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ff0000"} onChange={onColorChange} style={{ width: "100%", height: 160 }} />
          <input type="text" value={color} onChange={e => { const v = e.currentTarget.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onColorChange(v); }}
            onBlur={() => { if (!/^#[0-9a-fA-F]{6}$/.test(color)) onColorChange("#ff0000"); }}
            maxLength={7} spellCheck={false} aria-label="Hex color value" className="mt-3 w-full rounded-md border bg-transparent p-2 font-mono text-sm uppercase outline-none" />
        </div>
      )}
    </aside>
  );
}
