"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function PushSettings() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(ok);

    if (!ok) return;

    setPermission(Notification.permission);

    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      setSubscribed(Boolean(subscription));
    });
  }, []);

  async function enable() {
    if (!supported) return;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setStatus("VAPID public key is not configured.");
      return;
    }

    setStatus("Enabling push notifications...");

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result !== "granted") {
      setStatus("Notification permission was not granted.");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    if (!response.ok) {
      const body = await response.json();
      setStatus(body.error ?? "Could not save push subscription.");
      return;
    }

    setSubscribed(true);
    setStatus("Push notifications enabled on this device.");
  }

  async function disable() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      await subscription.unsubscribe();
    }

    setSubscribed(false);
    setStatus("Push notifications disabled on this device.");
  }

  return (
    <div className="card">
      <div className="eyebrow">PWA / Web Push</div>
      <h3 className="text-xl font-black">Phone Notifications</h3>

      {!supported ? (
        <p className="mt-3 text-sm text-slate-400">
          This browser is not currently exposing Web Push. On iPhone, install
          Dusk Industries to the Home Screen first, then open the installed app
          and enable notifications here.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-400">
            Permission: {permission} · Device: {subscribed ? "subscribed" : "not subscribed"}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {!subscribed ? (
              <button className="button-primary" type="button" onClick={enable}>
                Enable phone notifications
              </button>
            ) : (
              <button className="button-secondary" type="button" onClick={disable}>
                Disable on this device
              </button>
            )}
          </div>
        </>
      )}

      {status ? <p className="mt-3 text-sm text-slate-400">{status}</p> : null}
    </div>
  );
}
