"use client";

import * as Sentry from "@sentry/nextjs";
import type NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: NextError & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>{/* Your Error component here... */}</body>
    </html>
  );
}
