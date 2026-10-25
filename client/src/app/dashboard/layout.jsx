import { TimetableProvider } from "../../context/TimetableContext";

export const metadata = {
  title: "ClassGrid — Dashboard",
};

export default function DashboardLayout({ children }) {
  return <TimetableProvider>{children}</TimetableProvider>;
}
