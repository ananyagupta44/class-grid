import "./globals.css";
import AppShell from "../components/AppShell";
import { TimetableProvider } from "@/context/TimetableContext";

export const metadata = {
  title: "ClassGrid — Timetable Generator",
  description: "Automatic academic timetable generator",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppShell>
          <TimetableProvider>{children} </TimetableProvider>
        </AppShell>
      </body>
    </html>
  );
}
