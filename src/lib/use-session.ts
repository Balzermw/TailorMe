"use client";

import { useSyncExternalStore } from "react";
import { SESSION_EVENT, type DemoSession } from "./session";

const KEY = "tm_session_v1";
const LEGACY_DEMO_EMAILS = new Set([
  "alex.m@email.com",
  "alex.mercer@example.com",
]);

// Cache the parsed snapshot so getSnapshot returns a stable reference for an
// unchanged raw value (useSyncExternalStore requirement).
let cachedRaw: string | null | undefined;
let cachedValue: DemoSession | null = null;

function getSnapshot(): DemoSession | null {
  const raw = window.localStorage.getItem(KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedValue = raw ? (JSON.parse(raw) as DemoSession) : null;
      if (cachedValue && LEGACY_DEMO_EMAILS.has(cachedValue.email.toLowerCase())) {
        window.localStorage.removeItem(KEY);
        cachedRaw = null;
        cachedValue = null;
      }
    } catch {
      cachedValue = null;
    }
  }
  return cachedValue;
}

function getServerSnapshot(): DemoSession | null {
  return null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(SESSION_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SESSION_EVENT, onChange);
  };
}

// Hydration-safe demo session: null on the server and first paint, then the
// localStorage session; re-renders on sign-in/sign-out from any component.
export function useDemoSession(): DemoSession | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
