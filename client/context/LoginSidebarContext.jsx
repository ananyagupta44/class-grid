"use client";

import { createContext, useContext, useState } from "react";

const LoginSidebarContext = createContext(null);

export function LoginSidebarProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState("student"); // "student" | "admin" | "staff"

  function openLogin(selectedRole = "student") {
    setRole(selectedRole);
    setIsOpen(true);
  }

  function closeLogin() {
    setIsOpen(false);
  }

  return (
    <LoginSidebarContext.Provider
      value={{ isOpen, role, openLogin, closeLogin }}
    >
      {children}
    </LoginSidebarContext.Provider>
  );
}

export function useLoginSidebar() {
  const ctx = useContext(LoginSidebarContext);
  if (!ctx) {
    throw new Error(
      "useLoginSidebar must be used inside a LoginSidebarProvider",
    );
  }
  return ctx;
}
