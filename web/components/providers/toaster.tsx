"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={5000}
      toastOptions={{
        className: "font-sans",
      }}
    />
  );
}
