
import { useState } from "react";
import { ChevronLeft, ChevronRight, MousePointer2, Grid2X2, Settings2 } from "lucide-react";
import PixelView from "./components/PixelView";


export default function App() {
  const [toolbarOpen, setToolbarOpen] = useState(true);

  return (
    <main className="flex h-screen overflow-hidden bg-background">
    </main>
  );
}

