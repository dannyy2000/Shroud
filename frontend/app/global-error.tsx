"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          margin: 0,
          padding: "40px",
          background: "#0d1117",
          minHeight: "100vh",
          fontFamily: "monospace",
          color: "#e6edf3",
        }}
      >
        <h2 style={{ color: "#f85149", marginBottom: "16px", fontSize: "20px" }}>
          Critical App Error
        </h2>
        <pre
          style={{
            background: "#161b22",
            border: "1px solid #30363d",
            padding: "16px",
            borderRadius: "8px",
            whiteSpace: "pre-wrap",
            fontSize: "13px",
            color: "#e6edf3",
            marginBottom: "16px",
          }}
        >
          {error.message}
          {"\n\n"}
          {error.stack}
        </pre>
        <button
          onClick={reset}
          style={{
            background: "#58a6ff",
            color: "#0d1117",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
