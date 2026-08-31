"use client";

import { useEffect } from "react";

// Merged into the providers page — the #web section covers webSearch + webFetch.
export default function WebProvidersRedirect() {
  useEffect(() => {
    window.location.replace("/dashboard/providers#web");
  }, []);

  return null;
}
