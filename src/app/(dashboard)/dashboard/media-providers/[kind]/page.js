"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

// The media category list pages were fully merged into the single providers
// page. Old /dashboard/media-providers/<kind> URLs now deep-link to the
// matching section (e.g. ...#image, ...#tts) instead.
const KIND_ANCHORS = {
  webSearch: "web",
  webFetch: "web",
};

export default function MediaProvidersRedirect() {
  const params = useParams();

  useEffect(() => {
    const kind = params.kind;
    const anchor = KIND_ANCHORS[kind] || kind || "providers";
    window.location.replace(`/dashboard/providers#${anchor}`);
  }, [params]);

  return null;
}
