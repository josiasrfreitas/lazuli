"use client";

import { isValidElement, useEffect, useEffectEvent, useRef, type ReactNode } from "react";

import { toastManager } from "./toast";

export type ToastAlertProps = {
  children: ReactNode;
  variant: "destructive" | "warning";
  toastTimeout?: number;
};

type ActiveToast = { id: string; owners: Map<symbol, ReactNode> };
type NoticeLease = { update: (children: ReactNode) => void; dispose: () => void };
const activeToasts = new Map<string, ActiveToast>();
const MIN_TOAST_TIMEOUT_MS = 5000;
const MAX_TOAST_TIMEOUT_MS = 15_000;

function contentText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children))
    return (children as readonly ReactNode[]).map((child) => contentText(child)).join(" ");
  if (isValidElement<{ children?: ReactNode }>(children))
    return contentText(children.props.children);
  return "";
}

function showNotice(input: {
  key: string;
  children: ReactNode;
  variant: ToastAlertProps["variant"];
  timeout: number;
}): NoticeLease {
  const owner = Symbol();
  let active = activeToasts.get(input.key);
  if (active) {
    active.owners.set(owner, input.children);
    toastManager.update(active.id, { title: input.children });
  } else {
    active = { id: `notice:${input.key}`, owners: new Map([[owner, input.children]]) };
    const current = active;
    activeToasts.set(input.key, active);
    toastManager.add({
      id: active.id,
      title: input.children,
      type: input.variant === "warning" ? "warning" : "error",
      priority: "high",
      timeout: input.timeout,
      onRemove: () => {
        if (activeToasts.get(input.key) === current) activeToasts.delete(input.key);
      },
    });
  }
  const owned = active;
  return {
    update(children) {
      const current = activeToasts.get(input.key);
      if (current !== owned || !current.owners.has(owner)) return;
      current.owners.set(owner, children);
      if ([...current.owners.keys()].at(-1) === owner)
        toastManager.update(current.id, { title: children });
    },
    dispose() {
      const current = activeToasts.get(input.key);
      if (current !== owned) return;
      current.owners.delete(owner);
      if (current.owners.size === 0) {
        activeToasts.delete(input.key);
        toastManager.close(current.id);
      } else {
        const remaining = [...current.owners.values()].at(-1);
        toastManager.update(current.id, { title: remaining });
      }
    },
  };
}

export function ToastAlert({
  children,
  variant,
  toastTimeout = MAX_TOAST_TIMEOUT_MS,
}: ToastAlertProps): null {
  const message = contentText(children).replaceAll(/\s+/gu, " ").trim();
  const key = message;
  const lease = useRef<NoticeLease | null>(null);
  const show = useEffectEvent(() =>
    showNotice({
      key,
      children,
      variant,
      timeout:
        toastTimeout === 0
          ? 0
          : Math.max(MIN_TOAST_TIMEOUT_MS, Math.min(MAX_TOAST_TIMEOUT_MS, toastTimeout)),
    }),
  );

  useEffect(() => {
    if (!message) return;
    lease.current = show();
    return () => {
      lease.current?.dispose();
      lease.current = null;
    };
  }, [key, message, toastTimeout]);

  useEffect(() => {
    lease.current?.update(children);
  }, [children]);

  return null;
}
