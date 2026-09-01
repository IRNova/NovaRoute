import { redirect } from "next/navigation";

// Merged into /dashboard/settings/feature-flags, which is the copy the
// settings navigation links to. The two pages toggled the same flags and
// differed only in one entry and some layout.
export default function FeaturesSettingsRedirect() {
  redirect("/dashboard/settings/feature-flags");
}
