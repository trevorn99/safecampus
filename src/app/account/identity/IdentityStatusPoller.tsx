"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Verification results arrive async via webhook, so while a session is
// pending this polls for the server to notice it resolved — same pattern
// as GenerateReportButton on the Threat Intelligence page.
export function IdentityStatusPoller() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
