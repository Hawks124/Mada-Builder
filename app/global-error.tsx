"use client";

import NextError from "next/error";
import { useEffect } from "react";
import { captureError } from "@/lib/monitoring";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    captureError(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
