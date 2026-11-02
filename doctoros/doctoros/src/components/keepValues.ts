"use client";
import { startTransition } from "react";

/**
 * React 19-এ ফর্ম action শেষ হলে সব ঘর খালি হয়ে যায় — error এলে রোগী/ডাক্তারকে আবার সব লিখতে হয়।
 * এই onSubmit দিয়ে পাঠালে লেখা থেকে যায়। চাপা বাটনের name/value-ও (intent) সাথে যায়।
 */
export function keepValues(dispatch: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  };
}
