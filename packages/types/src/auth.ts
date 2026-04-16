/**
 * User profile information stored in the database
 */
export interface UserProfile {
  email: string | null;
  name: string | null;
  createdAt: string | null;
}

/**
 * User object from authentication
 */
export interface User {
  uid: string | null;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}
