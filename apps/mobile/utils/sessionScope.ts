import { getAuth } from "@react-native-firebase/auth";
import { useEffect, useRef } from "react";
import {
  capturePushSession,
  isPushSessionCurrent,
  type PushSession,
} from "@/services/pushSession";

/** Bind screen work to its mounted account, including delayed alert actions. */
export function createSessionScope() {
  const user = getAuth().currentUser;
  const owner = user ? capturePushSession(user.uid) : null;
  let mounted = true;
  return {
    capture(): PushSession | null {
      return owner && this.isCurrent(owner) ? owner : null;
    },
    isCurrent(session: PushSession): boolean {
      return mounted && owner === session && isPushSessionCurrent(session);
    },
    activate() {
      mounted = true;
    },
    close() {
      mounted = false;
    },
  };
}

export function useSessionScope() {
  const scope = useRef<ReturnType<typeof createSessionScope> | null>(null);
  if (!scope.current) scope.current = createSessionScope();
  const current = scope.current;
  useEffect(() => {
    current.activate();
    return () => current.close();
  }, [current]);
  return current;
}
