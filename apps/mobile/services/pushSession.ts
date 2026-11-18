import { getAuth } from "@react-native-firebase/auth";
import { randomUUID } from "expo-crypto";
import { authStorage } from "./secureStorage";

export interface PushSession {
  userId: string;
  id: string;
}

let activeSession: PushSession | null = null;
let generation = 0;
let suspended = false;

export function beginPushSession(userId: string): PushSession {
  generation += 1;
  suspended = false;
  activeSession = { userId, id: randomUUID() };
  return activeSession;
}

export function capturePushSession(userId: string): PushSession | null {
  if (suspended || getAuth().currentUser?.uid !== userId) return null;
  if (!activeSession || activeSession.userId !== userId) {
    try {
      const persistedId = authStorage.getSessionId(userId);
      if (persistedId) {
        generation += 1;
        activeSession = { userId, id: persistedId };
        return activeSession;
      }
    } catch {
      return null;
    }
    return beginPushSession(userId);
  }
  return activeSession;
}

export function isPushSessionCurrent(session: PushSession): boolean {
  return (
    !suspended &&
    activeSession === session &&
    getAuth().currentUser?.uid === session.userId
  );
}

/** Invalidate pending push work immediately and identify this logout attempt. */
export function suspendPushSession(): () => boolean {
  generation += 1;
  const logoutGeneration = generation;
  suspended = true;
  activeSession = null;
  return () => suspended && generation === logoutGeneration;
}
