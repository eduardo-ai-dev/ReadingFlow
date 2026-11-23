"use client";

import { createContext, useContext } from "react";

const AuthDemoFlagContext = createContext<boolean>(true);

export function AuthDemoFlagProvider({
  demoEnabled,
  children,
}: {
  demoEnabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <AuthDemoFlagContext.Provider value={demoEnabled}>
      {children}
    </AuthDemoFlagContext.Provider>
  );
}

export function useDemoEnabled(): boolean {
  return useContext(AuthDemoFlagContext);
}
