import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="max-w-sm text-muted-foreground">
        That assessment doesn&apos;t exist, or it may have been removed.
      </p>
      <Button asChild className="mt-2">
        <Link href="/assessments">Back to assessments</Link>
      </Button>
    </div>
  );
}
