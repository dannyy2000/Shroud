"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { CustomConnectButton } from "~~/components/scaffold-stark/CustomConnectButton";

const NAV_LINKS = [
  { label: "Markets", href: "/" },
  { label: "Deposit", href: "/deposit" },
  { label: "Create", href: "/create" },
  { label: "Portfolio", href: "/portfolio" },
];

export const Header = () => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: "#161b22",
        borderColor: "#30363d",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #58a6ff, #8b45fd)", color: "#0d1117" }}
            >
              S
            </div>
            <span className="text-lg font-bold hidden sm:block" style={{ color: "#e6edf3" }}>
              Shroud
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: isActive ? "#e6edf3" : "#8b949e",
                    backgroundColor: isActive ? "#30363d" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Search + Wallet */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:block relative">
              <input
                type="text"
                placeholder="Search markets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="shroud-input text-sm w-56 pl-9"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "#8b949e" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <CustomConnectButton />

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg"
              style={{ color: "#8b949e" }}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="md:hidden pb-4 border-t" style={{ borderColor: "#30363d" }}>
            <div className="flex flex-col gap-1 pt-3">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{
                      color: isActive ? "#e6edf3" : "#8b949e",
                      backgroundColor: isActive ? "#30363d" : "transparent",
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};
