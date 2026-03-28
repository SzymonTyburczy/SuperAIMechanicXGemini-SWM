"use client";

import { useState, useCallback, Suspense, lazy } from "react";
import Navbar from "@/components/Navbar";
import UploadZone from "@/components/UploadZone";
import AnalysisLoader from "@/components/AnalysisLoader";
import RepairReport from "@/components/RepairReport";

const Viewer3D = lazy(() => import("@/components/Viewer3D"));

export default function Home() {
  const [phase, setPhase] = useState<"landing" | "analyzing" | "report">(
    "landing",
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] ?? "";
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Nie udało się odczytać pliku"));
      reader.readAsDataURL(file);
    });

  const buildReportFromBackend = (data: any, carModel: string, mileage: string) => {
    const analysis =
      data?.damages && typeof data.damages === "object" && !Array.isArray(data.damages)
        ? data.damages
        : data;

    const damages = Array.isArray(analysis?.damages) ? analysis.damages : [];
    const hidden = Array.isArray(analysis?.hidden_damage_predictions)
      ? analysis.hidden_damage_predictions
      : [];

    const mappedDamages = damages.map((dmg: any, idx: number) => {
      const severity =
        dmg?.severity === "high" || dmg?.severity === "low"
          ? dmg.severity
          : "medium";

      return {
        id: `d${idx + 1}`,
        part: dmg?.part ?? "Unknown part",
        type: dmg?.type ?? "Damage detected",
        severity,
        repair_cost_pln: Number(dmg?.repair_cost_pln ?? 0),
        replace_cost_asm: Number(dmg?.replace_cost_asm ?? 0),
        can_repair: Boolean(dmg?.can_repair),
        bbox_hint: dmg?.bbox_hint ?? "",
        confidence: Math.min(
          98,
          Math.max(
            35,
            Number.isFinite(Number(dmg?.repair_cost_pln))
              ? 60 + (severity === "high" ? 20 : severity === "low" ? -10 : 0)
              : 70,
          ),
        ),
      };
    });

    const hiddenDamages = hidden.map((pred: any, idx: number) => ({
      id: `h${idx + 1}`,
      part: pred?.part ?? "Hidden damage",
      probability_pct: Number(pred?.probability_pct ?? 50),
      reason: pred?.reason ?? "Predicted hidden damage",
      cost_pln: Number(pred?.cost_pln ?? 0),
    }));

    const totalMin =
      Number(analysis?.total_repair_estimate_pln ?? 0) ||
      mappedDamages.reduce(
        (s: number, d: { repair_cost_pln: number }) => s + d.repair_cost_pln,
        0,
      );
    const totalMax =
      Number(analysis?.total_asm_estimate_pln ?? 0) ||
      mappedDamages.reduce(
        (s: number, d: { replace_cost_asm: number }) => s + d.replace_cost_asm,
        0,
      );
    const savings = Math.max(0, totalMax - totalMin);

    const severityScore = mappedDamages.reduce((acc: number, d: { severity: string }) => {
      if (d.severity === "high") return acc + 3;
      if (d.severity === "medium") return acc + 2;
      return acc + 1;
    }, 0);
    const avgSeverity = mappedDamages.length ? severityScore / mappedDamages.length : 1;
    const overallScore = Math.max(
      20,
      Math.min(95, Math.round(100 - avgSeverity * 18)),
    );

    const damageCount = mappedDamages.length;
    const hiddenRiskAvg = hidden.length
      ? Math.round(
          hidden.reduce(
            (sum: number, dmg: { probability_pct?: number }) =>
              sum + Number(dmg.probability_pct ?? 0),
            0,
          ) /
            hidden.length,
        )
      : 0;

    return {
      car: carModel || "Unknown",
      analysisDate: new Date().toLocaleDateString("en-US"),
      mileage: Number.isFinite(Number(mileage)) ? Number(mileage) : null,
      overallScore,
      totalCostMin: Math.max(0, totalMin),
      totalCostMax: Math.max(0, totalMax),
      marketplaceSavings: savings,
      repairTimeWeeks: Math.max(1, Math.ceil(damageCount / 2) + (hiddenRiskAvg > 40 ? 1 : 0)),
      damages: mappedDamages,
      hiddenDamagePredictions: hidden,
      summary: {
        damageCount,
        hiddenCount: hidden.length,
        hiddenRiskAvg,
      },
      raw: analysis,
    };
  };

  type AnalyzePayload = {
    files: { file: File; type: "image" | "video" }[];
    carModel: string;
    mileage: string;
  };

  const handleAnalyze = useCallback(
    async ({ files, carModel, mileage }: AnalyzePayload) => {
      if (!files.length) return;
      setIsAnalyzing(true);
      setAnalysisError(null);
      setReport(null);
      setPhase("analyzing");

      try {
        const imageFile = files.find((f) => f.type === "image")?.file;
        if (!imageFile) {
          throw new Error(
            "Dodaj przynajmniej jedno zdjęcie (wideo nie jest obsługiwane w analizie).",
          );
        }

        const frameBase64 = await fileToBase64(imageFile);
        const resp = await fetch(`${API_BASE}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: "local-demo",
            frameBase64,
            carModel,
          }),
        });

        if (!resp.ok) {
          const message = await resp.text();
          throw new Error(message || "Backend error");
        }

        const data = await resp.json();
        if (data?.error) {
          throw new Error(data.error);
        }
        const nextReport = buildReportFromBackend(data, carModel, mileage);
        setReport(nextReport);
        setPhase("report");
      } catch (err) {
        setAnalysisError(
          err instanceof Error
            ? err.message
            : "Nie udało się przeprowadzić analizy",
        );
        setReport(null);
        setPhase("landing");
      }
      setIsAnalyzing(false);
    },
    [API_BASE],
  );

  return (
    <div className="min-h-screen" style={{ background: "#000" }}>
      <Navbar />

      {/* Analysis loading overlay */}
      {phase === "analyzing" && <AnalysisLoader />}

      {/* ─── HERO ─── */}
      {phase === "landing" && (
        <section className="min-h-[100svh] flex flex-col pt-24 pb-12">
          <div className="max-w-7xl mx-auto px-6 w-full">
            {analysisError && (
              <div className="mb-6 rounded-xl border border-[#e54d4d]/30 bg-[#e54d4d]/10 p-4 text-[#e54d4d] text-sm text-left">
                {analysisError}
              </div>
            )}
            {/* Top: text content */}
            <div className="animate-slide-up text-center mb-10">
              <div className="badge mb-6 mx-auto">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#4caf78" }}
                />
                Hackathon Demo · Beta
              </div>

              <h1 className="text-4xl md:text-5xl xl:text-6xl font-semibold leading-[1.08] tracking-tight mb-5 text-white">
                Your virtual <span className="text-white/50">mechanic</span>
              </h1>

              <p className="text-base text-white/55 leading-relaxed mb-8 max-w-2xl mx-auto">
                Upload photos of your damaged vehicle — AI detects visible and
                hidden defects, finds cheaper parts on marketplaces, and
                compares workshops in your area. Stop overpaying at the dealer.
              </p>

              <div className="flex items-center justify-center gap-4 mb-8">
                <button
                  id="hero-cta-btn"
                  onClick={() =>
                    document
                      .getElementById("upload")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="solid-btn"
                >
                  Get free estimate
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  id="hero-demo-btn"
                  onClick={() => setPhase("analyzing")}
                  className="ghost-btn"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Watch demo
                </button>
              </div>

              {/* Quick stats */}
              <div className="flex gap-10 justify-center flex-wrap">
                {[
                  { value: "~60%", label: "Cheaper vs dealer" },
                  { value: "< 3 min", label: "Analysis time" },
                  { value: "94%", label: "AI accuracy" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-xl font-semibold text-white">
                      {stat.value}
                    </p>
                    <p className="text-[11px] text-white/30 mt-1 tracking-wide uppercase">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Full-width 3D viewer */}
            <div className="relative flex justify-center">
              <div
                className="rounded-2xl overflow-hidden w-full"
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  maxWidth: 1200,
                }}
              >
                <Suspense
                  fallback={
                    <div
                      className="flex items-center justify-center w-full rounded-2xl"
                      style={{ background: "#2a2a2e", minHeight: 430 }}
                    >
                      <div className="text-center">
                        <svg
                          className="animate-spin mx-auto mb-3"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="1.5"
                            strokeDasharray="20 40"
                            strokeLinecap="round"
                          />
                        </svg>
                        <p className="text-[11px] text-white/25">
                          Loading 3D model…
                        </p>
                      </div>
                    </div>
                  }
                >
                  <Viewer3D hasBodyDamage={false} />
                </Suspense>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── HOW IT WORKS ─── */}
      {phase === "landing" && (
        <section id="how" className="py-24 scroll-mt-20">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-2xl font-semibold mb-3 text-white">
                How it works
              </h2>
              <p className="text-sm text-white/40">
                Three steps to a precise repair estimate
              </p>
            </div>

            <div
              className="grid md:grid-cols-3 gap-px"
              style={{ background: "var(--border)" }}
            >
              {[
                {
                  num: "01",
                  title: "Upload photos or video",
                  desc: "Record your car on your phone and upload to the platform. AI handles photos, 360° videos, and underbody footage.",
                },
                {
                  num: "02",
                  title: "AI damage analysis",
                  desc: "AI models detect damage, predict hidden defects, and propose the most cost-effective repair method.",
                },
                {
                  num: "03",
                  title: "Full report & plan",
                  desc: "Receive a report with cost estimates (marketplace vs dealer parts), workshop comparison, and repair timeline.",
                },
              ].map((step) => (
                <div key={step.num} className="p-8 bg-black">
                  <span className="text-[11px] font-mono text-white/20 tracking-widest">
                    {step.num}
                  </span>
                  <h3 className="font-medium text-white mt-4 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-white/40 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── UPLOAD ─── */}
      {phase === "landing" && (
        <UploadZone onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
      )}

      {/* ─── REPORT + 3D ─── */}
      {phase === "report" && (
        <div className="pt-20">
          <section id="viewer-section" className="py-8 scroll-mt-20">
            <div className="max-w-[96rem] mx-auto px-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-1 text-white">
                    3D Vehicle Visualization
                  </h2>
                  <p className="text-xs text-white/35">
                    Audi A5 2022 with detected damage markers
                  </p>
                </div>
                <button
                  id="new-analysis-btn"
                  onClick={() => setPhase("landing")}
                  className="ghost-btn text-[13px]"
                >
                  ← New analysis
                </button>
              </div>

              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <Suspense
                  fallback={
                    <div
                      className="flex items-center justify-center w-full mx-auto rounded-2xl"
                      style={{
                        background: "#020204",
                        minHeight: 760,
                        maxWidth: "min(100%, 1200px)",
                      }}
                    >
                      <svg
                        className="animate-spin"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="rgba(255,255,255,0.15)"
                          strokeWidth="1.5"
                          strokeDasharray="20 40"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  }
                >
                  <Viewer3D hasBodyDamage={true} />
                </Suspense>
              </div>
            </div>
          </section>

          {analysisError && (
            <div className="max-w-6xl mx-auto px-6 pb-4">
              <div className="rounded-xl border border-[#e54d4d]/30 bg-[#e54d4d]/10 p-4 text-[#e54d4d] text-sm">
                {analysisError}
              </div>
            </div>
          )}
          <RepairReport report={report} />
        </div>
      )}

      {/* ─── FOOTER ─── */}
      <footer
        className="mt-24 py-8"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="opacity-50"
            >
              <path
                d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[13px] font-medium text-white/50">
              AutoMechanic AI
            </span>
          </div>
          <p className="text-[11px] text-white/25 text-center">
            Hackathon Demo · Prototype · Estimates are for demonstration only
          </p>
          <p className="text-[11px] text-white/25">2026 · Made with care</p>
        </div>
      </footer>
    </div>
  );
}
