export interface UserProfile {
  email: string | null;
  name: string | null;
  createdAt: string | null;
}

export interface User {
  uid: string | null;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}
