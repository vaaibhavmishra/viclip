"use server";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";
import type { Arch, OS, Version } from "@/types/download";

// Initialize Firebase Admin SDK with service account credentials
const initFirebaseAdmin = () => {
  if (getApps().length === 0) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines in the private key
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }
  return getApps()[0];
};

export async function saveEmail(email: string) {
  const app = initFirebaseAdmin();
  const db = getDatabase(app);

  // Use push to create a unique entry for each email
  const newEmailRef = db.ref("waitlist-users").push();
  await newEmailRef.set({
    email: email,
    timestamp: new Date().toISOString(),
    status: "active",
  });

  console.log("Email saved successfully");
}

export async function checkEmail(email: string) {
  const app = initFirebaseAdmin();
  const db = getDatabase(app);
  const usersRef = db.ref("waitlist-users");

  // Get all waitlist users and check email manually
  const snapshot = await usersRef.get();

  if (snapshot.exists()) {
    const users = snapshot.val();
    // Iterate through all users to find matching email
    return Object.values(users).some((user: unknown) => {
      if (typeof user === "object" && user !== null && "email" in user) {
        return (user as { email: string }).email === email;
      }
      return false;
    });
  }
  return false;
}

export async function getDownloadLink(
  os: OS,
  version: Version,
  arch: Arch,
): Promise<string> {
  // Determine the file extension based on OS
  let ext: string;
  switch (os) {
    case "win":
      ext = "exe";
      break;
    case "mac":
      ext = "dmg";
      break;
    case "linux":
      ext = "AppImage";
      break;
    case "android":
      ext = "apk";
      break;
    case "ios":
      ext = "ipa";
      break;
    default:
      throw new Error(`Unsupported OS: ${os}`);
  }
  const app = initFirebaseAdmin();
  const bucket = getStorage(app).bucket(process.env.FIREBASE_STORAGE_BUCKET);
  const fileRef = bucket.file(
    `v${version}/ViClip-${version}-${os}-${arch}${
      os === "win" ? "-setup" : ""
    }.${ext}`,
  );

  // Generate a signed URL that expires in 24 hours
  const [signedUrl] = await fileRef.getSignedUrl({
    action: "read",
    expires: Date.now() + 24 * 60 * 60 * 1000, // 1 day from now
  });

  return signedUrl;
}
