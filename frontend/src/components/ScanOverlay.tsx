"use client";

interface DamageItem {
  part: string;
  type: string;
  severity: "low" | "medium" | "high";
  repair_cost_pln: number;
  replace_cost_asm: number;
  can_repair: boolean;
  bbox_hint: string;
}

// Map Gemini's bbox_hint to screen overlay positions (percentage-based)
const POSITION_MAP: Record<string, { top: string; left: string }> = {
  "przód":       { top: "15%", left: "40%" },
  "lewy-przód":  { top: "20%", left: "10%" },
  "prawy-przód": { top: "20%", left: "65%" },
  "lewy-bok":    { top: "40%", left: "5%" },
  "prawy-bok":   { top: "40%", left: "70%" },
  "lewy-tył":    { top: "60%", left: "10%" },
  "prawy-tył":   { top: "60%", left: "65%" },
  "tył":         { top: "65%", left: "40%" },
  "dach":        { top: "10%", left: "40%" },
  "podwozie":    { top: "75%", left: "40%" },
};

const SEVERITY_COLORS = {
  high: "#e54d4d",
  medium: "#d4a346",
  low: "#4caf78",
};

interface ScanOverlayProps {
  damages: DamageItem[];
  isAnalyzing: boolean;
  scanPulse: boolean;
  totalRepair: number;
  totalAsm: number;
  frameCount: number;
}

export default function ScanOverlay({
  damages,
  isAnalyzing,
  scanPulse,
  totalRepair,
  totalAsm,
  frameCount,
}: ScanOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* Scan line animation */}
      {isAnalyzing && (
        <div className="scanner-line" />
      )}

      {/* Damage markers on camera feed */}
      {damages.map((dmg, i) => {
        const pos = POSITION_MAP[dmg.bbox_hint] || { top: "30%", left: "30%" };
        const color = SEVERITY_COLORS[dmg.severity] || "#d4a346";
        const cost = dmg.repair_cost_pln > 0 ? dmg.repair_cost_pln : dmg.replace_cost_asm;

        return (
          <div
            key={`${dmg.part}-${i}`}
            className="absolute scanner-damage-marker animate-fade-in"
            style={{
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -50%)",
            }}
          >
            {/* Pulse ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `${color}20`,
                border: `1px solid ${color}40`,
                animation: "pulse-ring 2s ease-out infinite",
                width: 48,
                height: 48,
                margin: "-12px",
              }}
            />

            {/* Center dot */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                background: `${color}30`,
                border: `2px solid ${color}`,
                boxShadow: `0 0 12px ${color}60`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: color }}
              />
            </div>

            {/* Label */}
            <div
              className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap"
              style={{
                background: "rgba(0,0,0,0.85)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${color}40`,
                borderRadius: 8,
                padding: "4px 10px",
              }}
            >
              <p
                className="text-[10px] font-semibold"
                style={{ color }}
              >
                {dmg.part}
              </p>
              <p className="text-[9px] text-white/50">
                {dmg.type} · {cost.toLocaleString()} zł
              </p>
            </div>
          </div>
        );
      })}

      {/* Bottom total bar */}
      {damages.length > 0 && (
        <div
          className="absolute bottom-28 left-4 right-4 flex items-center justify-between px-4 py-2 rounded-xl pointer-events-none"
          style={{
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[9px] text-white/35 uppercase tracking-wider">
                Dealer
              </p>
              <p className="text-sm font-semibold text-[#e54d4d]">
                {totalAsm.toLocaleString()} zł
              </p>
            </div>
            <div
              className="w-px h-8"
              style={{ background: "rgba(255,255,255,0.1)" }}
            />
            <div>
              <p className="text-[9px] text-white/35 uppercase tracking-wider">
                Repair
              </p>
              <p className="text-sm font-semibold text-[#4caf78]">
                {totalRepair.toLocaleString()} zł
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[9px] text-white/25">
              Save ~{Math.round(((totalAsm - totalRepair) / Math.max(totalAsm, 1)) * 100)}%
            </p>
            <p className="text-[10px] text-white/40">
              {frameCount} frames
            </p>
          </div>
        </div>
      )}

      {/* Scan pulse overlay */}
      {scanPulse && (
        <div className="scanner-pulse-overlay" />
      )}
    </div>
  );
}
