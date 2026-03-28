"use client";

import { useState, useRef, useCallback } from "react";

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  type: "image" | "video";
}

interface UploadZoneProps {
  onFilesReady: (files: UploadedFile[]) => void;
  isAnalyzing: boolean;
}

export default function UploadZone({ onFilesReady, isAnalyzing }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [carModel, setCarModel] = useState("Audi A5 2022");
  const [mileage, setMileage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((rawFiles: FileList | File[]) => {
    const arr = Array.from(rawFiles);
    const processed: UploadedFile[] = arr
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .map((f) => ({
        id: Math.random().toString(36).slice(2),
        file: f,
        preview: URL.createObjectURL(f),
        type: f.type.startsWith("image/") ? "image" : "video",
      }));
    setFiles((prev) => [...prev, ...processed]);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAnalyze = () => {
    if (files.length > 0) {
      onFilesReady(files);
    }
  };

  const CAR_MODELS = [
    "Audi A5 2022", "Audi S5 2021", "Audi A4 2020", "Audi A6 2023",
    "BMW 3 Series 2022", "Mercedes C-Class 2021", "Volkswagen Golf 2022",
    "Tesla Model 3 2023", "Toyota Camry 2022", "Other",
  ];

  return (
    <section id="upload" className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="badge badge-accent mb-4">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
            AI Analysis Ready
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold mb-3 text-white">
            Start your repair estimate
          </h2>
          <p className="text-sm text-white/40 max-w-lg mx-auto">
            Upload photos or video of your damaged vehicle — AI will analyze the damage,
            find cheaper parts, and calculate the real cost of repair.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          {/* Left: config */}
          <div className="md:col-span-2 space-y-4">
            <div className="surface rounded-xl p-5">
              <h3 className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-4">
                Vehicle parameters
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-white/45 mb-1.5 block">
                    Car model
                  </label>
                  <select
                    id="car-model-select"
                    value={carModel}
                    onChange={(e) => setCarModel(e.target.value)}
                    className="form-input"
                  >
                    {CAR_MODELS.map((m) => (
                      <option key={m} value={m} style={{ background: "#0a0a0a" }}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-white/45 mb-1.5 block">
                    Mileage (km)
                  </label>
                  <input
                    id="mileage-input"
                    type="number"
                    placeholder="e.g. 95000"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-white/45 mb-1.5 block">
                    Location (optional)
                  </label>
                  <input
                    id="location-input"
                    type="text"
                    placeholder="e.g. Warsaw"
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* AI analysis list */}
            <div className="surface rounded-xl p-5 space-y-3">
              <h3 className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                What AI analyzes
              </h3>
              {[
                "Visible body damage",
                "Hidden defect prediction",
                "Part prices: dealer vs marketplace",
                "Workshop comparison nearby",
                "Repair plan with timeline",
                "Wear & consumable status",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0" />
                  <span className="text-xs text-white/40">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: upload */}
          <div className="md:col-span-3 flex flex-col gap-4">
            {/* Drop zone */}
            <div
              id="upload-dropzone"
              className={`upload-zone rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer min-h-52 transition-all ${
                dragging ? "dragging" : ""
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => e.target.files && processFiles(e.target.files)}
              />
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p className="font-medium text-sm text-white/60 mb-1">
                Drag photos or video here
              </p>
              <p className="text-xs text-white/25 mb-4">
                or click to browse files
              </p>
              <div className="flex gap-2 flex-wrap justify-center">
                {["JPG", "PNG", "HEIC", "MP4", "MOV"].map((ext) => (
                  <span key={ext} className="text-[10px] text-white/20 px-2 py-0.5 rounded border border-white/[0.06]">{ext}</span>
                ))}
              </div>
            </div>

            {/* Preview thumbnails */}
            {files.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {files.map((f) => (
                  <div key={f.id} className="relative group rounded-lg overflow-hidden aspect-square">
                    {f.type === "image" ? (
                      <img src={f.preview} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <video src={f.preview} className="w-full h-full object-cover" muted />
                    )}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs"
                        style={{ background: "rgba(229,77,77,0.6)" }}
                      >
                        ×
                      </button>
                    </div>
                    {f.type === "video" && (
                      <div className="absolute bottom-1 left-1">
                        <span className="text-[9px] text-white/50 px-1.5 py-0.5 rounded bg-black/50">
                          VIDEO
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <div
                  className="aspect-square rounded-lg border border-dashed border-white/[0.08] flex items-center justify-center cursor-pointer hover:border-white/20 transition-colors"
                  onClick={() => inputRef.current?.click()}
                >
                  <span className="text-lg text-white/20">+</span>
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              id="analyze-btn"
              onClick={handleAnalyze}
              disabled={files.length === 0 || isAnalyzing}
              className={`w-full py-3.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                files.length > 0 && !isAnalyzing ? "solid-btn justify-center" : ""
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              style={
                files.length === 0 || isAnalyzing
                  ? {
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--border)",
                      color: "rgba(255,255,255,0.3)",
                    }
                  : undefined
              }
            >
              {isAnalyzing ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
                  </svg>
                  Analyzing damage…
                </span>
              ) : files.length === 0 ? (
                "Upload photos to begin"
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Analyze {files.length} {files.length === 1 ? "file" : "files"} — AI Estimate
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
