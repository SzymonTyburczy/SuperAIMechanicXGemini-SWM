"use client";

import { useMemo } from "react";

type Severity = "high" | "medium" | "low";

type DamageItem = {
  id: string;
  part: string;
  type: string;
  severity: Severity;
  severityLabel: string;
  repair_cost_pln: number;
  replace_cost_asm: number;
  can_repair: boolean;
  bbox_hint?: string;
  confidence?: number;
};

type HiddenPrediction = {
  id: string;
  part: string;
  probability_pct: number;
  reason: string;
  cost_pln: number;
};

type AnalysisReport = {
  car: string;
  analysisDate: string;
  mileage: number | null;
  overallScore: number;
  totalCostMin: number;
  totalCostMax: number;
  marketplaceSavings: number;
  repairTimeWeeks: number;
  damages: DamageItem[];
  hiddenDamagePredictions: HiddenPrediction[];
  summary: {
    damageCount: number;
    hiddenCount: number;
    hiddenRiskAvg: number;
  };
  raw: unknown;
};

const severityConfig: Record<Severity, { color: string; bg: string; border: string }> = {
  high: { color: "#e54d4d", bg: "rgba(229,77,77,0.06)", border: "rgba(229,77,77,0.15)" },
  medium: { color: "#d4a346", bg: "rgba(212,163,70,0.06)", border: "rgba(212,163,70,0.15)" },
  low: { color: "#4caf78", bg: "rgba(76,175,120,0.06)", border: "rgba(76,175,120,0.15)" },
};

function RingChart({ value, size = 80, strokeWidth = 6, color = "#fff" }: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * circ} ${circ}`}
        style={{ transition: "stroke-dasharray 800ms ease-out" }}
      />
    </svg>
  );
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("en-US")} zł`;
}

function severityDef(severity: Severity) {
  return severityConfig[severity];
}

export default function RepairReport({ report }: { report: AnalysisReport | null }) {
  const derivedSteps = useMemo(() => {
    if (!report) return [];

    return report.damages.map((damage, index) => ({
      id: `${damage.id}-step`,
      step: index + 1,
      title: `${damage.can_repair ? "Repair" : "Replace"} - ${damage.part}`,
      details: `${damage.type}${damage.bbox_hint ? ` · ${damage.bbox_hint}` : ""}`,
      duration:
        damage.severity === "high"
          ? "2-3 days"
          : damage.severity === "medium"
            ? "1-2 days"
            : "few hours",
      severity: damage.severity,
    }));
  }, [report]);

  if (!report) {
    return (
      <section id="report" className="py-12 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="surface rounded-2xl p-8 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">No analysis yet</h2>
            <p className="text-sm text-white/40">
              Upload a photo, click Analyze and wait for the AI response.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="report" className="py-12 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="badge badge-severity-low mb-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4caf78" }} />
              Analysis complete
            </div>
            <h2 className="text-xl font-semibold text-white">{report.car}</h2>
            <p className="text-xs text-white/30 mt-0.5">
              {report.analysisDate}
              {report.mileage !== null ? ` · ${report.mileage.toLocaleString("en-US")} km` : ""}
            </p>
          </div>
          <button id="export-pdf-btn" className="ghost-btn text-[13px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export PDF
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-8" style={{ background: "var(--border)" }}>
          {[
            {
              label: "Repair cost",
              value: `${formatCurrency(report.totalCostMin)} – ${formatCurrency(report.totalCostMax)}`,
              sub: "Computed from AI output",
              ring: report.overallScore,
              ringColor: "#d4a346",
            },
            {
              label: "Savings",
              value: formatCurrency(report.marketplaceSavings),
              sub: "estimated vs dealer",
              ring: Math.min(100, report.marketplaceSavings > 0 ? 72 : 28),
              ringColor: "#4caf78",
            },
            {
              label: "Damage count",
              value: `${report.summary.damageCount}`,
              sub: `${report.summary.hiddenCount} hidden predictions`,
              ring: Math.min(100, report.summary.damageCount * 18),
              ringColor: "rgba(255,255,255,0.4)",
            },
            {
              label: "Condition score",
              value: `${report.overallScore}/100`,
              sub: "Derived from severity + confidence",
              ring: report.overallScore,
              ringColor: "rgba(255,255,255,0.5)",
            },
          ].map((card, i) => (
            <div key={i} className="p-5 bg-black flex flex-col gap-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">{card.label}</p>
                  <p className="font-semibold text-sm text-white">{card.value}</p>
                  <p className="text-[10px] text-white/25 mt-1">{card.sub}</p>
                </div>
                <RingChart value={card.ring} size={44} strokeWidth={4} color={card.ringColor} />
              </div>
            </div>
          ))}
        </div>

        <div className="surface rounded-xl p-4 mb-3">
          <p className="text-xs text-white/40">
            AI found <strong className="text-white/60">{report.summary.damageCount} visible issues</strong>
              {report.summary.hiddenCount > 0 ? (
                <>
                  {" "}and <strong className="text-white/60">{report.summary.hiddenCount} hidden predictions</strong>
                </>
              ) : null}
              . Average hidden risk: <strong className="text-white/60">{report.summary.hiddenRiskAvg}%</strong>.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-10">
          <div className="surface rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-white/25 mb-3">Suggested repair plan</p>
            <div className="space-y-3">
              {derivedSteps.map((step) => {
                const cfg = severityDef(step.severity);
                return (
                  <div key={step.id} className="rounded-lg p-3" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-xs font-medium text-white">{step.step}. {step.title}</span>
                      <span className="text-[10px] text-white/30">{step.duration}</span>
                    </div>
                    <p className="text-[11px] text-white/40">{step.details}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="surface rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-white/25 mb-3">Raw AI summary</p>
            <div className="space-y-2 text-xs text-white/45">
              <p>Overall score: {report.overallScore}/100</p>
              <p>Estimated repair time: ~{report.repairTimeWeeks} weeks</p>
              <p>Costs are computed from Gemini output, not hardcoded mock data.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Damage findings</h3>
            <span className="text-[11px] text-white/30">{report.damages.length} items</span>
          </div>

          {report.damages.map((damage) => {
            const cfg = severityDef(damage.severity);
            return (
              <div key={damage.id} className="surface surface-hover rounded-xl p-5" style={{ borderColor: cfg.border }}>
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                      <h4 className="font-medium text-sm text-white">{damage.part}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {damage.severityLabel}
                      </span>
                      {damage.can_repair ? (
                        <span className="text-[10px] text-[#4caf78]">repairable</span>
                      ) : (
                        <span className="text-[10px] text-[#d4a346]">replace recommended</span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mb-3">
                      {damage.type}
                      {damage.bbox_hint ? ` · ${damage.bbox_hint}` : ""}
                    </p>

                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[10px] text-white/25 w-20">Confidence</span>
                      <div className="flex-1 progress-bar">
                        <div className="progress-fill" style={{ width: `${damage.confidence ?? 70}%`, background: cfg.color }} />
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: cfg.color }}>{damage.confidence ?? 70}%</span>
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-2 md:min-w-44">
                    <div className="flex-1 md:flex-none rounded-lg p-3" style={{ background: "rgba(229,77,77,0.04)", border: "1px solid rgba(229,77,77,0.08)" }}>
                      <p className="text-[10px] text-white/25 mb-0.5">Repair</p>
                      <p className="font-medium text-xs text-[#e54d4d]">{formatCurrency(damage.repair_cost_pln)}</p>
                    </div>
                    <div className="flex-1 md:flex-none rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                      <p className="text-[10px] text-white/25 mb-0.5">Replacement</p>
                      <p className="font-medium text-xs text-white/60">{formatCurrency(damage.replace_cost_asm)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {report.hiddenDamagePredictions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Hidden damage predictions</h3>
              <span className="text-[11px] text-white/30">AI predictions</span>
            </div>

            {report.hiddenDamagePredictions.map((prediction) => (
              <div key={prediction.id} className="surface surface-hover rounded-xl p-5">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#d4a346" }} />
                      <h4 className="font-medium text-sm text-white">{prediction.part}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(212,163,70,0.06)", color: "#d4a346", border: "1px solid rgba(212,163,70,0.15)" }}>
                        {prediction.probability_pct}%
                      </span>
                    </div>
                    <p className="text-xs text-white/40">{prediction.reason}</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ background: "rgba(212,163,70,0.04)", border: "1px solid rgba(212,163,70,0.08)" }}>
                    <p className="text-[10px] text-white/25 mb-0.5">Predicted cost</p>
                    <p className="font-medium text-xs text-[#d4a346]">{formatCurrency(prediction.cost_pln)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
