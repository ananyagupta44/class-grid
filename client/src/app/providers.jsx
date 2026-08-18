"use client";

import { TimetableProvider } from "../context/TimetableContext";

export default function Providers({ children }) {
  return (
    <TimetableProvider>
      {children}
    </TimetableProvider>
  );
}