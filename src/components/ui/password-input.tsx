"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

/**
 * Password field with a show/hide toggle. The toggle is named via sr-only text
 * (not aria-label) so `getByLabel("Password")` still resolves the input alone.
 */
function PasswordInput({ className, ...props }: React.ComponentProps<"input">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        title={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-9 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {show ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
            <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
            <path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.1 9.1 0 0 0 5.4-1.61" />
            <path d="m2 2 20 20" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
        <span className="sr-only">{show ? "Hide password" : "Show password"}</span>
      </button>
    </div>
  );
}

export { PasswordInput };
