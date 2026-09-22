"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silent failure: the app still works without PWA registration.
      });
    }
  }, []);

  return null;
}
