"use client";

import { useRef, useState, useEffect, useCallback } from "react";

/**
 * Signature capture: draw on a canvas (primary) or type a name rendered in a
 * signature script (secondary). Either way, onChange receives a PNG data-URL
 * that gets stamped onto the document's signature field at seal time.
 */
export default function SignaturePad({
  name,
  onChange,
}: {
  name: string;
  onChange: (dataUrl: string | null) => void;
}) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState(name);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk  = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // ── Canvas setup (retina-crisp) ──
  const prep = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ratio = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * ratio; cv.height = h * ratio;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0d1117";
  }, []);

  useEffect(() => { if (mode === "draw") prep(); }, [mode, prep]);

  const pos = (e: React.PointerEvent) => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = pos(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    hasInk.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (hasInk.current) emitCanvas();
  };

  const emitCanvas = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    onChange(hasInk.current ? cv.toDataURL("image/png") : null);
  };

  const clear = () => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (cv && ctx) ctx.clearRect(0, 0, cv.width, cv.height);
    hasInk.current = false;
    onChange(null);
  };

  // ── Typed mode: render the name in a script font onto an offscreen canvas ──
  const emitTyped = useCallback((text: string) => {
    if (!text.trim()) { onChange(null); return; }
    const cv = document.createElement("canvas");
    cv.width = 600; cv.height = 160;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0d1117";
    ctx.font = "64px 'Brush Script MT', 'Segoe Script', cursive";
    ctx.textBaseline = "middle";
    ctx.fillText(text.trim(), 20, 90);
    onChange(cv.toDataURL("image/png"));
  }, [onChange]);

  useEffect(() => { if (mode === "type") emitTyped(typed); }, [mode, typed, emitTyped]);

  return (
    <div style={{ marginBottom: 6 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button type="button" onClick={() => setMode("draw")}
          style={tab(mode === "draw")}>Draw</button>
        <button type="button" onClick={() => setMode("type")}
          style={tab(mode === "type")}>Type</button>
      </div>

      {mode === "draw" ? (
        <div style={{ position: "relative" }}>
          <canvas
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            style={{
              width: "100%", height: 150, borderRadius: 8,
              background: "#fff", border: "1px solid #333",
              touchAction: "none", cursor: "crosshair", display: "block",
            }}
          />
          <div style={{ position: "absolute", left: 12, right: 12, bottom: 34,
                        borderBottom: "1px solid #ccc", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: 12, bottom: 18,
                        fontSize: 10, color: "#999", pointerEvents: "none" }}>
            Sign above the line
          </div>
          <button type="button" onClick={clear}
            style={{ position: "absolute", top: 8, right: 8, fontSize: 11,
                     color: "#888", background: "none", border: "none", cursor: "pointer" }}>
            Clear
          </button>
        </div>
      ) : (
        <div>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type your full name"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8,
                     background: "#161b22", border: "1px solid #333", color: "#fff",
                     fontSize: 14, boxSizing: "border-box", marginBottom: 8 }}
          />
          <div style={{ height: 90, borderRadius: 8, background: "#fff",
                        border: "1px solid #333", display: "flex", alignItems: "center",
                        paddingLeft: 20, overflow: "hidden" }}>
            <span style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
                           fontSize: 40, color: "#0d1117" }}>
              {typed || "Your signature"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function tab(active: boolean): React.CSSProperties {
  return {
    padding: "6px 16px", borderRadius: 7, fontSize: 12, cursor: "pointer",
    border: active ? "1px solid #00BFA6" : "1px solid #333",
    background: active ? "rgba(0,191,166,0.12)" : "transparent",
    color: active ? "#00BFA6" : "#888",
  };
}