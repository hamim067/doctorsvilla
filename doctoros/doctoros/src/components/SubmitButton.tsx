"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn btn-primary", pendingText = "অপেক্ষা করুন…", pending, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string; pending?: boolean }) {
  const status = useFormStatus();
  const busy = pending ?? status.pending;
  return (
    <button type="submit" className={className} disabled={busy || rest.disabled} {...rest}>
      {busy ? pendingText : children}
    </button>
  );
}
