import { redirect } from "next/navigation";

// Merged into /dashboard/settings/cache. This page duplicated the Semantic
// Cache controls and added only an Idempotency section, which moved there.
// Kept as a redirect so existing links and bookmarks still land somewhere.
export default function CacheSettingsRedirect() {
  redirect("/dashboard/settings/cache");
}
