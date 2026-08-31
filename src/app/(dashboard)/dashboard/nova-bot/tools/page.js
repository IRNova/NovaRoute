import { Metadata } from "next";
import NovaToolsPageClient from "./NovaToolsPageClient";

export const metadata = { title: "Nova Tools — NovaRoute" };

export default function NovaToolsPage() {
  return <NovaToolsPageClient />;
}
