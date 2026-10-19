
import { useEffect, useRef } from "react";

type PixelViewProps = {
  width?: number;
  height?: number;
  pixelSize?: number;
};

export default function PixelView({
  width = 32,
  height = 32,
  pixelSize = 16,
}: PixelViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    canvas.width = width * pixelSize;
    canvas.height = height * pixelSize;

    // Raw pixel view: transparent pixels over a checkerboard.
    const checkerSize = 8;

    for (let y = 0; y < canvas.height; y += checkerSize) {
      for (let x = 0; x < canvas.width; x += checkerSize) {
        ctx.fillStyle =
          (Math.floor(x / checkerSize) +
            Math.floor(y / checkerSize)) %
            2 ===
          0
            ? "#f1f5f9"
            : "#cbd5e1";

        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    // Example pixel data; empty cells are transparent.
    const pixels = new Map<string, string>([
      ["15,8", "#ef4444"],
      ["16,8", "#ef4444"],
      ["14,9", "#ef4444"],
      ["15,9", "#ef4444"],
      ["16,9", "#ef4444"],
      ["17,9", "#ef4444"],
      ["15,10", "#2563eb"],
      ["16,10", "#2563eb"],
    ]);

    for (const [key, color] of pixels) {
      const [x, y] = key.split(",").map(Number);

      ctx.fillStyle = color;
      ctx.fillRect(
        x * pixelSize,
        y * pixelSize,
        pixelSize,
        pixelSize
      );
    }
  }, [width, height, pixelSize]);

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-auto bg-background p-4">
      <canvas
        ref={canvasRef}
        className="max-w-full"
        style={{
          imageRendering: "pixelated",
          width: width * pixelSize,
          height: height * pixelSize,
        }}
      />
    </div>
  );
}
