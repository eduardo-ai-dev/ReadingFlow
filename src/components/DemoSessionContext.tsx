"use client";

import { createContext, useContext } from "react";

const DemoSessionContext = createContext<boolean>(false);

export function DemoSessionProvider({
  isDemo,
  children,
}: {
  isDemo: boolean;
  children: React.ReactNode;
}) {
  return (
    <DemoSessionContext.Provider value={isDemo}>
      {children}
    </DemoSessionContext.Provider>
  );
}

export function useIsDemoSession(): boolean {
  return useContext(DemoSessionContext);
}
