"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ConsultationsSidebar from "./ConsultationsSidebar";
import ChatPanel from "./ChatPanel";

const MIN_WIDTH = 200;
const MAX_WIDTH = 520;
const DEFAULT_WIDTH = 275;

export default function DashboardShell({
  healthContent,
}: {
  healthContent: React.ReactNode;
}) {
  const [col1Width, setCol1Width] = useState(DEFAULT_WIDTH);
  const [col3Width, setCol3Width] = useState(DEFAULT_WIDTH);
  const [col1Open, setCol1Open] = useState(true);
  const [col3Open, setCol3Open] = useState(true);

  // Drag state stored in refs so mouse handlers don't go stale
  const dragging = useRef<"left" | "right" | null>(null);
  const startX = useRef(0);
  const startW = useRef(0);

  const onDividerMouseDown = useCallback(
    (side: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = side;
      startX.current = e.clientX;
      startW.current = side === "left" ? col1Width : col3Width;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [col1Width, col3Width],
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      if (dragging.current === "left") {
        setCol1Width(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW.current + delta)));
      } else {
        setCol3Width(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW.current - delta)));
      }
    }
    function onMouseUp() {
      if (!dragging.current) return;
      dragging.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Column 1: Consultations sidebar ── */}
      <div
        style={{ width: col1Open ? col1Width : 0 }}
        className="flex-none overflow-hidden border-r border-gray-200 transition-[width] duration-200"
      >
        {/* Inner keeps its full width so content doesn't reflow during animation */}
        <div style={{ width: col1Width }} className="h-full">
          <ConsultationsSidebar onCollapse={() => setCol1Open(false)} />
        </div>
      </div>

      {/* Collapsed col1: thin expand strip */}
      {!col1Open && (
        <button
          onClick={() => setCol1Open(true)}
          title="Show Consultations"
          className="flex-none w-8 flex items-center justify-center border-r border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Resize handle between col1 and col2 */}
      {col1Open && (
        <div
          onMouseDown={onDividerMouseDown("left")}
          className="flex-none w-1 bg-gray-200 hover:bg-blue-400 active:bg-blue-500 cursor-col-resize transition-colors"
        />
      )}

      {/* ── Column 2: Chat panel ── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <ChatPanel />
      </div>

      {/* Resize handle between col2 and col3 */}
      {col3Open && (
        <div
          onMouseDown={onDividerMouseDown("right")}
          className="flex-none w-1 bg-gray-200 hover:bg-blue-400 active:bg-blue-500 cursor-col-resize transition-colors"
        />
      )}

      {/* Collapsed col3: thin expand strip */}
      {!col3Open && (
        <button
          onClick={() => setCol3Open(true)}
          title="Show Health Info"
          className="flex-none w-8 flex items-center justify-center border-l border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* ── Column 3: Health sidebar ── */}
      <div
        style={{ width: col3Open ? col3Width : 0 }}
        className="flex-none overflow-hidden border-l border-gray-200 transition-[width] duration-200"
      >
        {/* Inner scrolls independently */}
        <div style={{ width: col3Width }} className="h-full flex flex-col bg-white">
          {/* Sticky header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
            <span className="text-sm font-semibold text-gray-800">Health</span>
            <button
              onClick={() => setCol3Open(false)}
              title="Collapse"
              className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 5l7 7-7 7M3 12h18" />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {healthContent}
          </div>
        </div>
      </div>
    </div>
  );
}
