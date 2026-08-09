import "./globals.css";
import AppShell from "../components/AppShell";

export const metadata = {
  title: "ClassGrid — Timetable Generator",
  description: "Automatic academic timetable generator",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
