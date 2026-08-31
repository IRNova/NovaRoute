import { getMachineId } from "@/shared/utils/machine";
import DashboardHome from "./DashboardHome";

export default async function DashboardPage() {
  const machineId = await getMachineId();
  return <DashboardHome machineId={machineId} />;
}
