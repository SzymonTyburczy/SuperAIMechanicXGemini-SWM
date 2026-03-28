import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Real-time Scan — AutoMechanic AI",
  description: "Point your camera at a damaged vehicle for instant AI analysis",
};

export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100svh] bg-black text-white overflow-hidden">
      {children}
    </div>
  );
}
