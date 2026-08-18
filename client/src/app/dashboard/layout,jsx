import { TimetableProvider } from "../../context/TimetableContext";
import DashboardTabs from "../../components/DashboardTabs";

export const metadata = {
  title: "ClassGrid — Dashboard",
};

export default function DashboardLayout({ children }) {
  return (
    <TimetableProvider>
      <DashboardTabs />
      {children}
    </TimetableProvider>
  );
}