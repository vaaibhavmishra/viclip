import { createContext, useState } from "react";

export const StatesContext = createContext({
  isSyncing: true,
  setIsSyncing: (_value: boolean) => {},
  notification: true,
  setNotification: (_value: boolean) => {},
});

export function StateProvider({ children }: { children: React.ReactNode }) {
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [notification, setNotification] = useState<boolean>(true);

  return (
    <StatesContext.Provider
      value={{ isSyncing, setIsSyncing, notification, setNotification }}
    >
      {children}
    </StatesContext.Provider>
  );
}
