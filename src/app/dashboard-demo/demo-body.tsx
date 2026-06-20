"use client";

import { useEffect, useState } from "react";
import DashboardClient from "../dashboard/dashboard-client";
import { getSession, signIn } from "@/lib/session";

export default function DemoBody() {
  // Mount gate: defer DashboardClient to a client-only mount so its
  // useDemoSession() reads the localStorage demo session (which never exists
  // during SSR — a hydrated render would be stuck on the null "sign in" state).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getSession()) signIn("alex.mercer@example.com", "Alex Mercer");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time mount gate
    setReady(true);
  }, []);

  return ready ? <DashboardClient /> : null;
}
