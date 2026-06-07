"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  createdAt: number;
  durationMs: number; // always set internally
  actionLabel?: string;
  onAction?: () => void;
};

// ✅ Input allows durationMs to be optional (fixes your strict TS error)
type ToastInput = Omit<Toast, "id" | "createdAt" | "durationMs"> & {
  durationMs?: number;
};

type ToastApi = {
  show: (t: ToastInput) => string;
  success: (message: string, opts?: Partial<Omit<ToastInput, "type" | "message">>) => string;
  error: (message: string, opts?: Partial<Omit<ToastInput, "type" | "message">>) => string;
  info: (message: string, opts?: Partial<Omit<ToastInput, "type" | "message">>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

function cls(...x: Array<string | false | null | undefined>) {
  return x.filter(Boolean).join(" ");
}

function typeClasses(type: ToastType) {
  switch (type) {
    case "success":
      return "border-green-200 bg-green-50 text-green-900";
    case "error":
      return "border-red-200 bg-red-50 text-red-900";
    default:
      return "border-blue-200 bg-blue-50 text-blue-900";
  }
}

function icon(type: ToastType) {
  if (type === "success") return "✅";
  if (type === "error") return "⚠️";
  return "ℹ️";
}

function makeId() {
  // avoids crypto.randomUUID typing/runtime issues on some setups
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));

    const timer = timers.current[id];
    if (timer) window.clearTimeout(timer);
    delete timers.current[id];
  }, []);

  const clear = useCallback(() => {
    setToasts([]);
    Object.values(timers.current).forEach((t) => window.clearTimeout(t));
    timers.current = {};
  }, []);

  const show = useCallback(
    (t: ToastInput) => {
      const id = makeId();

      const toast: Toast = {
        id,
        type: t.type,
        title: t.title,
        message: t.message,
        createdAt: Date.now(),
        durationMs: t.durationMs ?? (t.type === "error" ? 6000 : 3500),
        actionLabel: t.actionLabel,
        onAction: t.onAction,
      };

      // keep max 4 visible
      setToasts((prev) => [toast, ...prev].slice(0, 4));

      timers.current[id] = window.setTimeout(() => dismiss(id), toast.durationMs);
      return id;
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, opts) => show({ type: "success", message, ...(opts ?? {}) }),
      error: (message, opts) => show({ type: "error", message, ...(opts ?? {}) }),
      info: (message, opts) => show({ type: "info", message, ...(opts ?? {}) }),
      dismiss,
      clear,
    }),
    [show, dismiss, clear]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toast stack */}
      <div className="fixed top-3 left-0 right-0 z-50 px-3">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cls(
                "rounded-lg border p-3 shadow-sm",
                "backdrop-blur supports-[backdrop-filter]:bg-opacity-90",
                typeClasses(t.type)
              )}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-lg leading-none">{icon(t.type)}</div>

                <div className="min-w-0 flex-1">
                  {t.title ? <div className="text-sm font-semibold">{t.title}</div> : null}
                  <div className="text-sm break-words">{t.message}</div>

                  {t.actionLabel && t.onAction ? (
                    <button
                      className="mt-2 underline text-sm"
                      onClick={() => {
                        t.onAction?.();
                        dismiss(t.id);
                      }}
                    >
                      {t.actionLabel}
                    </button>
                  ) : null}
                </div>

                <button className="text-sm underline" onClick={() => dismiss(t.id)} aria-label="Dismiss toast">
                  Close
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
