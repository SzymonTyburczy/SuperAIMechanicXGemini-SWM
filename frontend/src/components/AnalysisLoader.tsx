"use client";

import { useEffect, useState } from "react";

const STEPS = [
	{ label: "Uploading files", duration: 600 },
	{ label: "AI damage detection", duration: 1200 },
	{ label: "Hidden defect prediction", duration: 900 },
	{ label: "Checking part prices", duration: 800 },
	{ label: "Comparing workshops", duration: 700 },
	{ label: "Generating report", duration: 500 },
];

export default function AnalysisLoader() {
	const [currentStep, setCurrentStep] = useState(0);
	const [progress, setProgress] = useState(0);
	const [stepProgress, setStepProgress] = useState(0);

	useEffect(() => {
		let stepIdx = 0;
		let totalElapsed = 0;
		let mounted = true;
		let intervalId: ReturnType<typeof setInterval> | undefined;
		const totalDuration = STEPS.reduce((s, step) => s + step.duration, 0);

		const runStep = () => {
			if (!mounted) return;
			if (stepIdx >= STEPS.length) {
				stepIdx = 0;
				totalElapsed = 0;
				setCurrentStep(0);
				setProgress(0);
				setStepProgress(0);
				intervalId = setInterval(() => {
					if (!mounted) return;
					const elapsed = Math.min(Date.now() % totalDuration, totalDuration);
					setProgress((elapsed / totalDuration) * 100);
				}, 100);
				return;
			}

			setCurrentStep(stepIdx);
			const step = STEPS[stepIdx];
			const stepStart = Date.now();

			intervalId = setInterval(() => {
				if (!mounted) return;
				const elapsed = Date.now() - stepStart;
				const stepPct = Math.min(elapsed / step.duration, 1);
				setStepProgress(stepPct * 100);
				setProgress(((totalElapsed + elapsed) / totalDuration) * 100);

				if (elapsed >= step.duration) {
					if (intervalId) clearInterval(intervalId);
					totalElapsed += step.duration;
					stepIdx++;
					runStep();
				}
			}, 30);
		};

		runStep();

		return () => {
			mounted = false;
			if (intervalId) clearInterval(intervalId);
		};
	}, []);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center"
			style={{ background: "rgba(0,0,0,0.96)", backdropFilter: "blur(20px)" }}
		>
			<div className="w-full max-w-sm px-6">
				{/* Header */}
				<div className="text-center mb-10">
					<h3 className="text-lg font-semibold text-white mb-1">Analyzing…</h3>
					<p className="text-xs text-white/35">{STEPS[currentStep]?.label}</p>
				</div>

				{/* Steps list */}
				<div className="space-y-3 mb-8">
					{STEPS.map((step, i) => {
						const isDone = i < currentStep;
						const isActive = i === currentStep;
						return (
							<div key={i} className="flex items-center gap-3">
								<div
									className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 transition-all duration-300"
									style={{
										border: isDone
											? "1px solid rgba(76,175,120,0.4)"
											: isActive
												? "1px solid rgba(255,255,255,0.2)"
												: "1px solid rgba(255,255,255,0.06)",
										background: isDone ? "rgba(76,175,120,0.1)" : "transparent",
									}}
								>
									{isDone ? (
										<svg
											width="10"
											height="10"
											viewBox="0 0 24 24"
											fill="none"
											stroke="#4caf78"
											strokeWidth="3"
										>
											<polyline points="20 6 9 17 4 12" />
										</svg>
									) : isActive ? (
										<svg
											className="animate-spin"
											width="10"
											height="10"
											viewBox="0 0 24 24"
											fill="none"
										>
											<circle
												cx="12"
												cy="12"
												r="9"
												stroke="rgba(255,255,255,0.4)"
												strokeWidth="2"
												strokeDasharray="15 42"
												strokeLinecap="round"
											/>
										</svg>
									) : (
										<span className="text-white/20">{i + 1}</span>
									)}
								</div>

								<div className="flex-1">
									<div className="flex items-center justify-between mb-0.5">
										<span
											className="text-xs font-medium transition-colors duration-300"
											style={{
												color: isDone
													? "rgba(76,175,120,0.8)"
													: isActive
														? "rgba(255,255,255,0.7)"
														: "rgba(255,255,255,0.2)",
											}}
										>
											{step.label}
										</span>
										{isDone && (
											<span className="text-[10px] text-[#4caf78]/60">✓</span>
										)}
										{isActive && (
											<span className="text-[10px] text-white/30">
												{Math.round(stepProgress)}%
											</span>
										)}
									</div>
									{isActive && (
										<div className="progress-bar" style={{ height: "2px" }}>
											<div
												className="h-full rounded-full"
												style={{
													width: `${stepProgress}%`,
													background: "rgba(255,255,255,0.4)",
													transition: "width 0.1s linear",
												}}
											/>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>

				{/* Overall progress */}
				<div>
					<div className="flex justify-between text-[11px] text-white/25 mb-2">
						<span>Progress</span>
						<span className="font-medium text-white/40">
							{Math.round(progress)}%
						</span>
					</div>
					<div className="progress-bar" style={{ height: "3px" }}>
						<div
							className="h-full rounded-full"
							style={{
								width: `${progress}%`,
								background: "rgba(255,255,255,0.5)",
								transition: "width 0.1s linear",
							}}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
