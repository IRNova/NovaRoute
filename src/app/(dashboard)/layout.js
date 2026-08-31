import { DashboardLayout } from "@/shared/components";
import ErrorReporter from "@/shared/components/ErrorReporter";

export default function DashboardRootLayout({ children }) {
  return (
    <DashboardLayout>
      <ErrorReporter />
      {children}
    </DashboardLayout>
  );
}
