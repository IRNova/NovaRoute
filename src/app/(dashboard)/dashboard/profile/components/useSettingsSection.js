"use client";

import { useState, useCallback, useEffect } from "react";

export default function useSettingsSection(initForm = () => ({})) {
  const [form, setForm] = useState(initForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setForm(initForm(data));
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ type: "error", message: "Failed to load settings" });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const save = useCallback(async (patch, successMsg = "Settings saved") => {
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");
      setStatus({ type: "success", message: successMsg });
      return true;
    } catch (err) {
      setStatus({
        type: "error",
        message: err.message || "An error occurred",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { form, setForm, setField, save, loading, saving, status };
}
