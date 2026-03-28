"use client";

import { useState, useEffect } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Also reload if we're in report phase (handled by the logo being an <a>)
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
        scrolled
          ? "bg-black/80 backdrop-blur-md border-b border-white/[0.08]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo — clickable, goes to homepage */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            scrollToTop();
            window.location.href = "/";
          }}
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          id="logo-link"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-semibold text-sm tracking-wide text-white">AutoMechanic</span>
        </a>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { href: "#upload", label: "Analysis" },
            { href: "#report", label: "Report" },
            { href: "#how", label: "How it works" },
            { href: "/scan", label: "Live Scan" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-[13px] font-medium transition-colors duration-200 tracking-wide ${
                item.href === "/scan"
                  ? "text-[#4a9eff] hover:text-[#6bb3ff]"
                  : "text-white/45 hover:text-white"
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <button
          id="nav-cta"
          className="hidden md:flex solid-btn text-[13px] py-2.5 px-5"
          onClick={() =>
            document.getElementById("upload")?.scrollIntoView({ behavior: "smooth" })
          }
        >
          Get estimate
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
