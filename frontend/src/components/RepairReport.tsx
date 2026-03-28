"use client";

import { useEffect, useRef, useState } from "react";

export const MOCK_REPORT = {
  car: "Audi A5 2022",
  vin: "WAUZZZ8T3NA123456",
  mileage: 95000,
  analysisDate: new Date().toLocaleDateString("en-US"),
  overallScore: 62,
  totalCostMin: 8400,
  totalCostMax: 14200,
  marketplaceSavings: 4800,
  repairTimeWeeks: 5,

  damages: [
    {
      id: "d1",
      component: "Front right door",
      severity: "high" as const,
      severityLabel: "Severe",
      description: "20×12 cm dent with paint scratching. Possible panel repair + respray.",
      asoCost: 3800,
      marketplaceCost: 890,
      laborCost: 1200,
      repairMethod: "Panel repair + respray",
      confidence: 94,
      hiddenRisk: 15,
      repairTime: "5–7 days",
    },
    {
      id: "d2",
      component: "Front bumper",
      severity: "medium" as const,
      severityLabel: "Moderate",
      description: "Surface scratches, minor paint chips. Polishing possible.",
      asoCost: 2200,
      marketplaceCost: 0,
      laborCost: 350,
      repairMethod: "Polish and touch-up",
      confidence: 88,
      hiddenRisk: 8,
      repairTime: "1 day",
    },
    {
      id: "d3",
      component: "Underbody — corrosion",
      severity: "medium" as const,
      severityLabel: "Moderate",
      description: "Rust spots found on sill reinforcements. Requires cleaning and anti-corrosion treatment.",
      asoCost: 1800,
      marketplaceCost: 0,
      laborCost: 900,
      repairMethod: "Cleaning + anti-corrosion",
      confidence: 79,
      hiddenRisk: 30,
      repairTime: "2 days",
    },
    {
      id: "d4",
      component: "Tires (2 pcs)",
      severity: "low" as const,
      severityLabel: "Minor",
      description: "Tread depth < 2mm. Insufficient pressure in 2 tires. Replacement needed.",
      asoCost: 1600,
      marketplaceCost: 1100,
      laborCost: 160,
      repairMethod: "Tire replacement + balancing",
      confidence: 97,
      hiddenRisk: 5,
      repairTime: "3 hours",
    },
    {
      id: "d5",
      component: "Suspension — rear axle",
      severity: "high" as const,
      severityLabel: "AI Prediction",
      description: "Based on impact angle, AI predicts 42% probability of rear control arm damage.",
      asoCost: 3200,
      marketplaceCost: 1400,
      laborCost: 800,
      repairMethod: "Diagnostics + control arm replacement",
      confidence: 42,
      hiddenRisk: 60,
      repairTime: "2 days",
    },
  ],

  repairPlan: [
    { step: 0, phase: "Parts ordering", duration: "3 days", details: "Order parts from Allegro/OLX/FB Marketplace. Savings vs dealer: ~€1,100.", status: "ready" },
    { step: 1, phase: "Body work", duration: "7 days", details: "Repair dents on front right door. Replace front bumper if non-repairable.", status: "ready" },
    { step: 2, phase: "Paint shop", duration: "5 days", details: "Respray door + bumper. Color matching Brilliant Black.", status: "ready" },
    { step: 3, phase: "Suspension", duration: "2 days", details: "Diagnostics and possible replacement of rear axle suspension components.", status: "conditional" },
    { step: 4, phase: "Anti-corrosion", duration: "2 days", details: "Clean rust on sills and apply anti-corrosion treatment.", status: "ready" },
    { step: 5, phase: "Tires", duration: "3 hours", details: "Replace 2 tires + wheel balancing. Check alignment.", status: "ready" },
    { step: 6, phase: "Final detailing", duration: "1 day", details: "Full cleaning and polishing. Quality inspection.", status: "ready" },
  ],

  mechanics: [
    {
      name: "AutoElite Warsaw",
      rating: 4.9,
      reviews: 312,
      distance: "2.1 km",
      availability: "In 3 days",
      hourlyRate: 220,
      totalEstimate: 6400,
      badges: ["Authorized Audi", "Express quote"],
      waitTime: "< 1 week",
    },
    {
      name: "PremiumBody Benedict",
      rating: 4.7,
      reviews: 184,
      distance: "4.8 km",
      availability: "Tomorrow",
      hourlyRate: 180,
      totalEstimate: 5200,
      badges: ["Best price", "Body shop"],
      waitTime: "2–3 days",
    },
    {
      name: "CarService Pro",
      rating: 4.5,
      reviews: 89,
      distance: "7.2 km",
      availability: "In 1 week",
      hourlyRate: 150,
      totalEstimate: 4800,
      badges: ["Budget"],
      waitTime: "1–2 weeks",
    },
  ],

  wearItems: [
    { part: "Air filters", status: "warning", note: "Replacement needed per mileage" },
    { part: "Brake fluid", status: "ok", note: "Good condition" },
    { part: "Front brake discs", status: "warning", note: "70% worn — replace soon" },
    { part: "Alternator", status: "ok", note: "Good condition" },
    { part: "Engine oil", status: "error", note: "Overdue — replace immediately" },
  ],
};

type Severity = "high" | "medium" | "low";

const severityConfig: Record<Severity, { color: string; bg: string; border: string }> = {
  high: { color: "#e54d4d", bg: "rgba(229,77,77,0.06)", border: "rgba(229,77,77,0.15)" },
  medium: { color: "#d4a346", bg: "rgba(212,163,70,0.06)", border: "rgba(212,163,70,0.15)" },
  low: { color: "#4caf78", bg: "rgba(76,175,120,0.06)", border: "rgba(76,175,120,0.15)" },
};

function RingChart({ value, size = 80, strokeWidth = 6, color = "#fff" }: {
  value: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setProgress(value), 100);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${(progress / 100) * circ} ${circ}`}
        style={{ transition: "stroke-dasharray 1.5s ease-out" }}
      />
    </svg>
  );
}

export default function RepairReport() {
  const report = MOCK_REPORT;
  const [activeTab, setActiveTab] = useState<"damages" | "plan" | "mechanics" | "wear">("damages");

  const severityDef = (s: string) => {
    if (s === "high" || s === "medium" || s === "low") return severityConfig[s as Severity];
    return { color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)" };
  };

  return (
    <section id="report" className="py-12 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="badge badge-severity-low mb-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4caf78" }} />
              Analysis complete
            </div>
            <h2 className="text-xl font-semibold text-white">{report.car}</h2>
            <p className="text-xs text-white/30 mt-0.5">
              VIN: {report.vin} · {report.analysisDate}
            </p>
          </div>
          <button id="export-pdf-btn" className="ghost-btn text-[13px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export PDF
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-8" style={{ background: "var(--border)" }}>
          {[
            {
              label: "Repair cost",
              value: `${report.totalCostMin.toLocaleString("en-US")} – ${report.totalCostMax.toLocaleString("en-US")} zł`,
              sub: "AI estimate range",
              ring: 65,
              ringColor: "#d4a346",
            },
            {
              label: "Savings",
              value: `${report.marketplaceSavings.toLocaleString("en-US")} zł`,
              sub: "vs dealer prices",
              ring: 72,
              ringColor: "#4caf78",
            },
            {
              label: "Repair time",
              value: `~${report.repairTimeWeeks} weeks`,
              sub: "Including order time",
              ring: 50,
              ringColor: "rgba(255,255,255,0.4)",
            },
            {
              label: "Vehicle condition",
              value: `${report.overallScore}/100`,
              sub: "Overall AI score",
              ring: report.overallScore,
              ringColor: "rgba(255,255,255,0.5)",
            },
          ].map((card, i) => (
            <div key={i} className="p-5 bg-black flex flex-col gap-2">
              <div className="flex items-start justify-between">
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

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-b border-white/[0.06]">
          {[
            { key: "damages", label: "Damage", count: report.damages.length },
            { key: "plan", label: "Repair plan", count: report.repairPlan.length },
            { key: "mechanics", label: "Workshops", count: report.mechanics.length },
            { key: "wear", label: "Wear", count: null },
          ].map((tab) => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className="flex items-center gap-2 py-3 px-4 text-[13px] font-medium transition-all duration-200 border-b-2 -mb-px"
              style={{
                borderColor: activeTab === tab.key ? "#fff" : "transparent",
                color: activeTab === tab.key ? "#fff" : "rgba(255,255,255,0.3)",
              }}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="text-[10px] text-white/25">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ─── Damages ─── */}
        {activeTab === "damages" && (
          <div className="space-y-3">
            {report.damages.map((dmg) => {
              const cfg = severityDef(dmg.severity);
              return (
                <div
                  key={dmg.id}
                  className="surface surface-hover rounded-xl p-5"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: cfg.color }}
                        />
                        <h3 className="font-medium text-sm text-white">{dmg.component}</h3>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                        >
                          {dmg.severityLabel}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 mb-3">{dmg.description}</p>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] text-white/25">Method:</span>
                        <span className="text-[11px] font-medium text-white/60">{dmg.repairMethod}</span>
                      </div>

                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] text-white/25 w-20">AI confidence</span>
                        <div className="flex-1 progress-bar">
                          <div className="progress-fill" style={{ width: `${dmg.confidence}%`, background: cfg.color }} />
                        </div>
                        <span className="text-[10px] font-medium" style={{ color: cfg.color }}>{dmg.confidence}%</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-white/25 w-20">Hidden risk</span>
                        <div className="flex-1 progress-bar">
                          <div className="progress-fill" style={{ width: `${dmg.hiddenRisk}%`, background: "#d4a346" }} />
                        </div>
                        <span className="text-[10px] font-medium text-[#d4a346]">{dmg.hiddenRisk}%</span>
                      </div>
                    </div>

                    {/* Costs */}
                    <div className="flex md:flex-col gap-2 md:min-w-40">
                      {dmg.asoCost > 0 && (
                        <div className="flex-1 md:flex-none rounded-lg p-3" style={{ background: "rgba(229,77,77,0.04)", border: "1px solid rgba(229,77,77,0.08)" }}>
                          <p className="text-[10px] text-white/25 mb-0.5">Dealer parts</p>
                          <p className="font-medium text-xs text-[#e54d4d] line-through">{dmg.asoCost.toLocaleString("en-US")} zł</p>
                        </div>
                      )}
                      {dmg.marketplaceCost > 0 && (
                        <div className="flex-1 md:flex-none rounded-lg p-3" style={{ background: "rgba(76,175,120,0.04)", border: "1px solid rgba(76,175,120,0.08)" }}>
                          <p className="text-[10px] text-white/25 mb-0.5">Marketplace</p>
                          <p className="font-medium text-xs text-[#4caf78]">{dmg.marketplaceCost.toLocaleString("en-US")} zł</p>
                        </div>
                      )}
                      <div className="flex-1 md:flex-none rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                        <p className="text-[10px] text-white/25 mb-0.5">Labor</p>
                        <p className="font-medium text-xs text-white/60">{dmg.laborCost.toLocaleString("en-US")} zł</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <span className="text-[10px] text-white/25">
                      Est. time: <strong className="text-white/40">{dmg.repairTime}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Repair Plan ─── */}
        {activeTab === "plan" && (
          <div className="space-y-3">
            <div className="surface rounded-xl p-4">
              <p className="text-xs text-white/40">
                Estimated total time: <strong className="text-white/60">~{report.repairTimeWeeks} weeks</strong>
              </p>
            </div>

            <div className="relative">
              <div
                className="absolute left-5 top-0 bottom-0 w-px"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.1), transparent)" }}
              />

              <div className="space-y-3">
                {report.repairPlan.map((step, i) => (
                  <div key={step.step} className="flex gap-4 items-start animate-slide-up" style={{ animationDelay: `${i * 0.08}s` }}>
                    <div className="relative z-10 flex-shrink-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-mono"
                        style={{
                          border: step.status === "conditional"
                            ? "1px solid rgba(212,163,70,0.3)"
                            : "1px solid rgba(255,255,255,0.08)",
                          color: step.status === "conditional" ? "#d4a346" : "rgba(255,255,255,0.3)",
                        }}
                      >
                        {step.step}
                      </div>
                    </div>

                    <div className="flex-1 surface surface-hover rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h4 className="font-medium text-sm text-white">{step.phase}</h4>
                        {step.status === "conditional" && (
                          <span className="badge badge-severity-medium text-[9px]">Conditional</span>
                        )}
                        <span className="ml-auto text-xs font-medium text-white/30">{step.duration}</span>
                      </div>
                      <p className="text-xs text-white/35">{step.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Mechanics ─── */}
        {activeTab === "mechanics" && (
          <div className="space-y-3">
            <div className="surface rounded-xl p-4">
              <p className="text-xs text-white/40">
                Found <strong className="text-white/60">{report.mechanics.length} workshops</strong> in your area.
                Prices are based on the AI analysis scope.
              </p>
            </div>

            {report.mechanics.map((mech, i) => (
              <div
                key={i}
                className="surface surface-hover rounded-xl p-5"
                style={i === 0 ? { borderColor: "rgba(255,255,255,0.12)" } : undefined}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      {i === 0 && <span className="badge badge-accent text-[9px]">Recommended</span>}
                      <h3 className="font-medium text-sm text-white">{mech.name}</h3>
                      {mech.badges.map((b) => (
                        <span key={b} className="text-[9px] text-white/25 px-2 py-0.5 rounded border border-white/[0.06]">{b}</span>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      {[
                        { label: "Rating", value: `${mech.rating}/5`, sub: `${mech.reviews} reviews` },
                        { label: "Distance", value: mech.distance, sub: "from location" },
                        { label: "Availability", value: mech.availability, sub: `Wait: ${mech.waitTime}` },
                        { label: "Rate", value: `${mech.hourlyRate} zł/h`, sub: "labor" },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <p className="text-[10px] text-white/25 mb-0.5">{stat.label}</p>
                          <p className="font-medium text-xs text-white/70">{stat.value}</p>
                          <p className="text-[10px] text-white/20">{stat.sub}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-[10px] text-white/25">Estimated total</p>
                      <p className="text-xl font-semibold text-white">
                        {mech.totalEstimate.toLocaleString("en-US")} zł
                      </p>
                    </div>
                    <button
                      id={`book-${i}`}
                      className={i === 0 ? "solid-btn text-[12px] py-2 px-4" : "ghost-btn text-[12px] py-2 px-4"}
                    >
                      {i === 0 ? "Book appointment →" : "Details"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Wear ─── */}
        {activeTab === "wear" && (
          <div className="space-y-3">
            <div className="surface rounded-xl p-4">
              <p className="text-xs text-white/40">
                AI analyzed mileage and photos. Below is a <strong className="text-white/60">condition prediction</strong> for key consumable parts.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {report.wearItems.map((item, i) => {
                const statusConfig = {
                  ok: { color: "#4caf78", border: "rgba(76,175,120,0.15)", icon: "✓" },
                  warning: { color: "#d4a346", border: "rgba(212,163,70,0.15)", icon: "!" },
                  error: { color: "#e54d4d", border: "rgba(229,77,77,0.15)", icon: "✗" },
                };
                const cfg = statusConfig[item.status as keyof typeof statusConfig];
                return (
                  <div
                    key={i}
                    className="surface surface-hover rounded-xl p-4 flex items-center gap-4"
                    style={{ borderColor: cfg.border }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ border: `1px solid ${cfg.border}`, color: cfg.color }}
                    >
                      {cfg.icon}
                    </div>
                    <div>
                      <p className="font-medium text-xs text-white">{item.part}</p>
                      <p className="text-[10px] text-white/35 mt-0.5">{item.note}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
