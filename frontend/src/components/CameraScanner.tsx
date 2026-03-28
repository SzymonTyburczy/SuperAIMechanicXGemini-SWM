"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import ScanOverlay from "./ScanOverlay";

interface DamageItem {
  part: string;
  type: string;
  severity: "low" | "medium" | "high";
  repair_cost_pln: number;
  replace_cost_asm: number;
  can_repair: boolean;
  bbox_hint: string;
}

interface ScanSessionData {
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

interface CameraScannerProps {
  roomId: string;
  carModel: string;
  backendUrl: string;
  onComplete: (result: ScanSessionData) => void;
  videoSrc?: string; // optional video file URL instead of camera
}

export default function CameraScanner({
  roomId,
  carModel,
  backendUrl,
  onComplete,
  videoSrc,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const analyzeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAnalyzingRef = useRef(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [damages, setDamages] = useState<DamageItem[]>([]);
  const [latestResult, setLatestResult] = useState<DamageItem[]>([]);
  const [totalRepair, setTotalRepair] = useState(0);
  const [totalAsm, setTotalAsm] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [scanPulse, setScanPulse] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showDamageList, setShowDamageList] = useState(false);
  const sessionDataRef = useRef<ScanSessionData | null>(null);

  // Start camera or video file
  useEffect(() => {
    let mounted = true;
    let stream: MediaStream | null = null;

    async function startSource() {
      // VIDEO FILE MODE
      if (videoSrc) {
        if (!videoRef.current) return;
        videoRef.current.src = videoSrc;
        videoRef.current.loop = true;
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          const e = playErr as DOMException;
          if (e.name === "AbortError") {
            await new Promise((r) => setTimeout(r, 100));
            if (mounted && videoRef.current) {
              try { await videoRef.current.play(); } catch { /* autoPlay fallback */ }
            }
          } else throw playErr;
        }
        if (mounted) setIsStreaming(true);
        return;
      }

      // CAMERA MODE — try rear, then any, then basic
      const constraints = [
        { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: true, audio: false },
      ];

      for (const constraint of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          break;
        } catch (err) {
          const error = err as DOMException;
          if (error.name === "NotAllowedError" || error.name === "SecurityError") throw err;
          console.log(`[Camera] Constraint failed (${error.name}), trying next...`);
        }
      }

      if (!stream) throw new Error("No camera available");
      if (!mounted || !videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch (playErr) {
        const e = playErr as DOMException;
        if (e.name === "AbortError") {
          await new Promise((r) => setTimeout(r, 100));
          if (mounted && videoRef.current?.srcObject) {
            try { await videoRef.current.play(); } catch { /* autoPlay fallback */ }
          }
        } else throw playErr;
      }
      if (mounted) setIsStreaming(true);
    }

    startSource().catch((err) => {
      console.error("Source error:", err);
      if (mounted) setCameraError(
        videoSrc
          ? "Failed to load video. Check the file path."
          : "Camera access denied. Please allow camera permissions and try again.",
      );
    });

    return () => {
      mounted = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [videoSrc]);

  // Connect WebSocket (only for camera mode, not video file)
  useEffect(() => {
    if (videoSrc) {
      // In video mode, skip WebSocket — use HTTP fallback only
      console.log("[Scanner] Video mode — skipping WebSocket, will use HTTP");
      return;
    }

    const wsUrl = backendUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://");

    try {
      const ws = new WebSocket(`${wsUrl}/ws/scan/${roomId}`);

      ws.onopen = () => {
        console.log("[WS] Connected, sending init");
        ws.send(JSON.stringify({ role: "scanner", carModel }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log("[WS] Message:", msg.type);

        if (msg.type === "analysis_result") {
          const analysisData = msg.data || {};
          const newDamages = analysisData.damages || [];
          const session = msg.session;
          if (session) {
            setDamages(session.damages || []);
            setTotalRepair(session.total_repair_estimate_pln || 0);
            setTotalAsm(session.total_asm_estimate_pln || 0);
            setFrameCount(session.frameCount || 0);
            sessionDataRef.current = session;
          }
          setLatestResult(newDamages);
          isAnalyzingRef.current = false;
          setIsAnalyzing(false);
          setScanPulse(true);
          setTimeout(() => setScanPulse(false), 600);
        }
      };

      ws.onclose = () => {
        console.log("[WS] Connection closed");
      };

      ws.onerror = () => {
        console.log("[WS] Connection failed, using HTTP fallback");
      };

      wsRef.current = ws;
    } catch {
      console.log("[WS] WebSocket not available, using HTTP fallback");
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomId, carModel, backendUrl, videoSrc]);

  // Capture and send frame via HTTP
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) {
      console.log("[Scanner] No video/canvas ref");
      return;
    }
    if (isAnalyzingRef.current) {
      console.log("[Scanner] Already analyzing, skip");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Wait for video to have real dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log("[Scanner] Video not ready yet", video.videoWidth, video.videoHeight);
      return;
    }

    // Set canvas to a reasonable size for analysis
    const size = Math.min(video.videoWidth, video.videoHeight, 768);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Center crop to square
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    const frameBase64 = canvas
      .toDataURL("image/jpeg", 0.7)
      .split(",")[1];

    if (!frameBase64) {
      console.log("[Scanner] Empty frame, skip");
      return;
    }

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    console.log(`[Scanner] Sending frame #${frameCount + 1} (${Math.round(frameBase64.length / 1024)}KB)`);

    // Try WebSocket first (camera mode), fall back to HTTP
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[Scanner] Sending via WebSocket");
      wsRef.current.send(
        JSON.stringify({
          type: "frame",
          frameBase64,
        }),
      );
    } else {
      // HTTP fallback (always used in video mode)
      console.log("[Scanner] Sending via HTTP POST /api/analyze");
      try {
        const resp = await fetch(`${backendUrl}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            frameBase64,
            carModel,
          }),
        });
        const data = await resp.json();
        console.log("[Scanner] Gemini response:", JSON.stringify(data).substring(0, 300));
        
        const session = data.session;
        if (session) {
          setDamages(session.damages || []);
          setTotalRepair(session.total_repair_estimate_pln || 0);
          setTotalAsm(session.total_asm_estimate_pln || 0);
          setFrameCount(session.frameCount || 0);
          sessionDataRef.current = session;
          console.log(`[Scanner] Session updated: ${(session.damages || []).length} damages, repair: ${session.total_repair_estimate_pln} zł`);
        }
        // data.damages is the full Gemini result object which contains .damages array
        const geminiResult = data.damages || {};
        const latestDmg = geminiResult.damages || [];
        console.log(`[Scanner] Latest frame damages: ${latestDmg.length}`);
        setLatestResult(latestDmg);
      } catch (err) {
        console.error("[Scanner] Analysis error:", err);
      }
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      setScanPulse(true);
      setTimeout(() => setScanPulse(false), 600);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl, roomId, carModel]);

  // Store the latest captureAndAnalyze in a ref so the interval always calls the latest version
  const captureRef = useRef(captureAndAnalyze);
  captureRef.current = captureAndAnalyze;

  // Start auto-analysis every ~3s once camera/video is streaming
  useEffect(() => {
    if (!isStreaming) {
      console.log("[Scanner] Not streaming yet, waiting...");
      return;
    }

    console.log("[Scanner] Streaming started, beginning auto-analysis every 3s");

    // Small delay before first capture
    const timeout = setTimeout(() => {
      captureRef.current();
      analyzeTimerRef.current = setInterval(() => captureRef.current(), 3000);
    }, 1000);

    return () => {
      clearTimeout(timeout);
      if (analyzeTimerRef.current) {
        clearInterval(analyzeTimerRef.current);
        analyzeTimerRef.current = null;
      }
    };
  }, [isStreaming]);

  // Complete scan
  const handleComplete = useCallback(() => {
    // Stop analysis
    if (analyzeTimerRef.current) {
      clearInterval(analyzeTimerRef.current);
    }

    // Notify backend
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "complete" }));
    }

    const result = sessionDataRef.current || {
      roomId,
      damages,
      hidden_damage_predictions: [],
      total_repair_estimate_pln: totalRepair,
      total_asm_estimate_pln: totalAsm,
      frameCount,
    };

    onComplete(result);
  }, [roomId, damages, totalRepair, totalAsm, frameCount, onComplete]);

  // Camera error state
  if (cameraError) {
    return (
      <div className="min-h-[100svh] flex flex-col items-center justify-center px-6 text-center">
        <div
          className="w-16 h-16 rounded-full mb-6 flex items-center justify-center"
          style={{
            background: "rgba(229,77,77,0.12)",
            border: "1px solid rgba(229,77,77,0.2)",
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#e54d4d"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-2">Camera Unavailable</h2>
        <p className="text-sm text-white/45 mb-6 max-w-xs">{cameraError}</p>
        <a href="/scan" className="ghost-btn">
          Try again
        </a>
      </div>
    );
  }

  return (
    <div className="scanner-viewport relative w-full h-[100svh] overflow-hidden bg-black">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera video feed — fullscreen */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* AR overlay layer */}
      <ScanOverlay
        damages={latestResult}
        isAnalyzing={isAnalyzing}
        scanPulse={scanPulse}
        totalRepair={totalRepair}
        totalAsm={totalAsm}
        frameCount={frameCount}
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 scanner-top-bar">
        <div className="flex items-center justify-between px-4 py-3">
          <a
            href="/scan"
            className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </a>

          <div className="text-center">
            <p className="text-[11px] font-medium text-white/80">{carModel}</p>
            <p className="text-[9px] text-white/35">
              {isAnalyzing
                ? "Analyzing…"
                : damages.length > 0
                  ? `${damages.length} damages found`
                  : "Scanning…"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Scan indicator */}
            <div
              className={`w-2 h-2 rounded-full transition-all ${scanPulse ? "scale-150" : ""}`}
              style={{
                background: isAnalyzing
                  ? "#d4a346"
                  : damages.length > 0
                    ? "#e54d4d"
                    : "#4caf78",
                boxShadow: isAnalyzing
                  ? "0 0 8px rgba(212,163,70,0.5)"
                  : damages.length > 0
                    ? "0 0 8px rgba(229,77,77,0.5)"
                    : "0 0 8px rgba(76,175,120,0.5)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Scanning frame corners */}
      <div className="absolute inset-8 sm:inset-16 z-10 pointer-events-none">
        <div className="relative w-full h-full">
          {/* Corner brackets */}
          {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => {
            const color = isAnalyzing ? "#d4a346" : "rgba(255,255,255,0.4)";
            const border = `2px solid ${color}`;
            const none = "none";
            return (
              <div
                key={i}
                className={`absolute ${pos} w-8 h-8`}
                style={{
                  borderTop: pos.includes("bottom") ? none : border,
                  borderBottom: pos.includes("top") ? none : border,
                  borderLeft: pos.includes("right") ? none : border,
                  borderRight: pos.includes("left") ? none : border,
                  borderRadius: "4px",
                  transition: "border-color 0.3s",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom panel — damage list + complete button */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        {/* Toggle damage list */}
        {damages.length > 0 && (
          <div className="px-4 mb-2">
            <button
              onClick={() => setShowDamageList(!showDamageList)}
              className="w-full text-left"
            >
              <div
                className="scanner-damage-pill flex items-center justify-between px-4 py-2.5 rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: "#e54d4d" }}
                  />
                  <span className="text-xs font-medium text-white/80">
                    {damages.length} damage{damages.length !== 1 ? "s" : ""}{" "}
                    detected
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#4caf78] font-medium">
                    ~{totalRepair.toLocaleString()} zł
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-white/40 transition-transform ${showDamageList ? "rotate-180" : ""}`}
                  >
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Expanded damage list */}
        {showDamageList && damages.length > 0 && (
          <div className="px-4 mb-2 max-h-48 overflow-y-auto">
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "rgba(0,0,0,0.85)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {damages.map((dmg, i) => {
                const color = {
                  high: "#e54d4d",
                  medium: "#d4a346",
                  low: "#4caf78",
                }[dmg.severity];
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{
                      borderBottom:
                        i < damages.length - 1
                          ? "1px solid rgba(255,255,255,0.06)"
                          : "none",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: color }}
                      />
                      <div>
                        <p className="text-[11px] text-white/80">{dmg.part}</p>
                        <p className="text-[9px] text-white/35">{dmg.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-medium" style={{ color }}>
                        {(dmg.repair_cost_pln || dmg.replace_cost_asm).toLocaleString()}{" "}
                        zł
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="scanner-bottom-bar px-4 pb-6 pt-3">
          <div className="flex gap-3">
            <button onClick={handleComplete} className="solid-btn flex-1 py-4">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Complete scan
            </button>
          </div>

          {/* Frame counter */}
          <p className="text-[9px] text-white/25 text-center mt-2">
            {frameCount} frames analyzed · Room {roomId}
          </p>
        </div>
      </div>
    </div>
  );
}
