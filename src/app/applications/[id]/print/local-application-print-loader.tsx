"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/components/landing/data";
import { clampToTwoPages } from "@/lib/apply/latex";
import { loadLocalApplication } from "@/lib/local-applications";
import type { TailoredDoc } from "@/lib/types";
import PrintDoc from "./print-doc";

export default function LocalApplicationPrintLoader({ id }: { id: string }) {
  const [doc, setDoc] = useState<TailoredDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setDoc(loadLocalApplication(id)?.result?.doc ?? null);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (!loaded) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <p className="tm-body">Loading your document...</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <p className="tm-body">
          This local document is not available.{" "}
          <Link href={ROUTES.dashboard} style={{ color: "var(--tm-blue-600)" }}>
            Back to dashboard
          </Link>
        </p>
      </div>
    );
  }

  return <PrintDoc doc={clampToTwoPages(doc)} id={id} />;
}
