"use client";

import { useState, useCallback } from "react";
import CameraScanner from "@/components/CameraScanner";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type ScanPhase = "setup" | "scanning" | "complete";

interface DamageItem {
  part: string;
  type: string;
  severity: "low" | "medium" | "high";
  repair_cost_pln: number;
  replace_cost_asm: number;
  can_repair: boolean;
  bbox_hint: string;
}

interface ScanResult {
  roomId: string;
  damages: DamageItem[];
  hidden_damage_predictions: Array<{
    part: string;
    probability_pct: number;
    reason: string;
    cost_pln: number;
  }>;
  total_repair_estimate_pln: number;
  total_asm_estimate_pln: number;
  frameCount: number;
}

export default function ScanPage() {
  const [phase, setPhase] = useState<ScanPhase>("setup");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [carModel, setCarModel] = useState("Audi A5 Sportback 2022");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);

  const handleStartScan = useCallback(async (mode: "camera" | "video") => {
    if (mode === "video" && !videoSrc) return;

    try {
      const resp = await fetch(
        `${BACKEND_URL}/api/scan/start?car_model=${encodeURIComponent(carModel)}`,
        { method: "POST" },
      );
      const data = await resp.json();
      setRoomId(data.roomId);
      setPhase("scanning");
    } catch {
      const localId = Math.random().toString(36).substring(2, 10);
      setRoomId(localId);
      setPhase("scanning");
    }
  }, [carModel, videoSrc]);

  const handleVideoFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoFileName(file.name);
  }, []);

  const handleScanComplete = useCallback((result: ScanResult) => {
    setScanResult(result);
    setPhase("complete");
  }, []);

  const handleSendToReport = useCallback(() => {
    if (scanResult) {
      sessionStorage.setItem("scanResults", JSON.stringify(scanResult));
      sessionStorage.setItem("scanRoomId", scanResult.roomId);
    }
    window.open(`/?fromScan=${roomId}`, "_blank");
  }, [scanResult, roomId]);

  return (
    <>
      {/* SETUP PHASE */}
      {phase === "setup" && (
        <div className="min-h-[100svh] flex flex-col items-center justify-center px-6">
          {/* Back link */}
          <a
            href="/"
            className="absolute top-6 left-6 text-white/40 hover:text-white/70 transition-colors text-sm flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </a>

          <div className="max-w-md w-full text-center">
            {/* Icon */}
            <div
              className="w-20 h-20 rounded-2xl mx-auto mb-8 flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(74,158,255,0.15), rgba(74,158,255,0.05))",
                border: "1px solid rgba(74,158,255,0.2)",
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="1.5">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>

            <h1 className="text-2xl font-semibold mb-3">Real-time Scan</h1>
            <p className="text-sm text-white/45 leading-relaxed mb-8">
              Use your camera or upload a video of your vehicle. AI will detect damage in real-time.
            </p>

            {/* Car model input */}
            <div className="mb-6 text-left">
              <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-2">
                Vehicle model
              </label>
              <input
                type="text"
                value={carModel}
                onChange={(e) => setCarModel(e.target.value)}
                className="form-input"
                placeholder="e.g. BMW 320d 2021"
              />
            </div>

            {/* Video file drop zone */}
            <div className="mb-4">
              <label
                className="block w-full cursor-pointer rounded-xl p-6 transition-all"
                style={{
                  background: videoSrc
                    ? "rgba(76,175,120,0.08)"
                    : "rgba(255,255,255,0.03)",
                  border: videoSrc
                    ? "2px solid rgba(76,175,120,0.3)"
                    : "2px dashed rgba(255,255,255,0.12)",
                }}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(74,158,255,0.5)"; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = videoSrc ? "rgba(76,175,120,0.3)" : "rgba(255,255,255,0.12)"; }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "rgba(76,175,120,0.3)";
                  const file = e.dataTransfer.files[0];
                  if (file?.type.startsWith("video/")) handleVideoFile(file);
                }}
              >
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoFile(file);
                  }}
                />
                {videoSrc ? (
                  <div className="flex items-center gap-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4caf78" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <div className="text-left">
                      <p className="text-sm text-[#4caf78] font-medium">{videoFileName}</p>
                      <p className="text-[10px] text-white/35">Video ready for analysis</p>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); setVideoSrc(null); setVideoFileName(null); }}
                      className="ml-auto text-white/30 hover:text-white/60"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" className="mx-auto mb-2">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    <p className="text-xs text-white/40">
                      Drop a video file here or <span className="text-[#4a9eff]">browse</span>
                    </p>
                    <p className="text-[10px] text-white/20 mt-1">MP4, MOV, WebM</p>
                  </div>
                )}
              </label>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              {videoSrc ? (
                <button
                  onClick={() => handleStartScan("video")}
                  className="solid-btn w-full text-base py-4"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Analyze video
                </button>
              ) : (
                <button
                  onClick={() => handleStartScan("camera")}
                  className="solid-btn w-full text-base py-4"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Start scanning
                </button>
              )}
            </div>

            <p className="text-[10px] text-white/25 mt-4">
              {videoSrc ? "Video will be analyzed frame by frame" : "Camera permission required · Works best on mobile"}
            </p>
          </div>
        </div>
      )}

      {/* SCANNING PHASE */}
      {phase === "scanning" && roomId && (
        <CameraScanner
          roomId={roomId}
          carModel={carModel}
          backendUrl={BACKEND_URL}
          onComplete={handleScanComplete}
          videoSrc={videoSrc || undefined}
        />
      )}

      {/* COMPLETE PHASE */}
      {phase === "complete" && scanResult && (
        <div className="min-h-[100svh] flex flex-col items-center justify-center px-6">
          {/* Success animation */}
          <div
            className="w-20 h-20 rounded-full mx-auto mb-8 flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(76,175,120,0.2), rgba(76,175,120,0.05))",
              border: "1px solid rgba(76,175,120,0.3)",
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4caf78"
              strokeWidth="2"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold mb-2">Scan Complete</h2>
          <p className="text-sm text-white/45 mb-8">
            {scanResult.damages.length} damages detected in{" "}
            {scanResult.frameCount} frames
          </p>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-8">
            <div
              className="p-4 rounded-xl text-center"
              style={{
                background: "rgba(229,77,77,0.08)",
                border: "1px solid rgba(229,77,77,0.15)",
              }}
            >
              <p className="text-[10px] text-white/35 mb-1">Dealer estimate</p>
              <p className="text-lg font-semibold text-[#e54d4d]">
                {scanResult.total_asm_estimate_pln.toLocaleString()} zł
              </p>
            </div>
            <div
              className="p-4 rounded-xl text-center"
              style={{
                background: "rgba(76,175,120,0.08)",
                border: "1px solid rgba(76,175,120,0.15)",
              }}
            >
              <p className="text-[10px] text-white/35 mb-1">Repair estimate</p>
              <p className="text-lg font-semibold text-[#4caf78]">
                {scanResult.total_repair_estimate_pln.toLocaleString()} zł
              </p>
            </div>
          </div>

          {/* Damage list */}
          <div className="w-full max-w-sm space-y-2 mb-8">
            {scanResult.damages.map((dmg, i) => {
              const color = {
                high: "#e54d4d",
                medium: "#d4a346",
                low: "#4caf78",
              }[dmg.severity];
              return (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: color }}
                    />
                    <span className="text-sm">{dmg.part}</span>
                  </div>
                  <span className="text-xs text-white/40">
                    {dmg.repair_cost_pln > 0
                      ? `${dmg.repair_cost_pln} zł`
                      : `${dmg.replace_cost_asm} zł`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <button onClick={handleSendToReport} className="solid-btn w-full py-4">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 3H3v18h18V3zM9 3v18M3 9h6M3 15h6" />
              </svg>
              View 3D Report
            </button>
            <button
              onClick={() => {
                setPhase("scanning");
              }}
              className="ghost-btn w-full py-3"
            >
              ↻ Scan again
            </button>
          </div>
        </div>
      )}
    </>
  );
}
