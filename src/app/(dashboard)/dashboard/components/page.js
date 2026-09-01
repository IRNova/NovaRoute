import { redirect } from "next/navigation";

// A showcase of the internal UI component library. Useful while building the
// design system, not something an operator of a gateway needs, and it was not
// reachable from the navigation anyway.
export default function ComponentsShowcaseRedirect() {
  redirect("/dashboard");
}
