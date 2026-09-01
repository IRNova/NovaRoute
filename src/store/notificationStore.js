"use client";
/**
 * Notification Store — Zustand-based global toast notification system.
 * Centralized feedback for dashboard actions.
 */

import { create } from "zustand";

let idCounter = 0;

export const useNotificationStore = create((set, get) => ({
  notifications: [],

  // Standing conditions from /api/dashboard/action-items (a provider that is
  // failing, a quota that is spent, a default password still in place). They
  // are not events: they persist until the condition clears, so they are not
  // auto-dismissed and "Clear all" does not remove them. They used to be
  // rendered as a stack of banners in the middle of the dashboard, which
  // duplicated this bell.
  alerts: [],
  setAlerts: (alerts) => set({ alerts: Array.isArray(alerts) ? alerts : [] }),

  addNotification: (notification) => {
    const id = ++idCounter;
    const entry = {
      id,
      type: notification.type || "info",
      message: notification.message,
      title: notification.title || null,
      duration: notification.duration ?? 5000,
      dismissible: notification.dismissible ?? true,
      createdAt: Date.now(),
    };

    set((s) => ({ notifications: [...s.notifications, entry] }));

    // Auto-dismiss
    if (entry.duration > 0) {
      setTimeout(() => get().removeNotification(id), entry.duration);
    }

    return id;
  },

  removeNotification: (id) => {
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
  },

  clearAll: () => set({ notifications: [] }),

  success: (message, title) => get().addNotification({ type: "success", message, title }),
  error: (message, title) => get().addNotification({ type: "error", message, title, duration: 8000 }),
  warning: (message, title) => get().addNotification({ type: "warning", message, title }),
  info: (message, title) => get().addNotification({ type: "info", message, title }),
}));
