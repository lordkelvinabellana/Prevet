"use client";

import { useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "car-photos";
const MAX_FILES = 8;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — mirrors the bucket's file_size_limit

type Item = {
  /** Stable client id for React keys + removal. */
  key: string;
  /** Local object URL for the preview (revoked on remove). */
  preview: string;
  /** Storage object path once uploaded; null while uploading. */
  path: string | null;
  status: "uploading" | "done" | "error";
};

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
}

/**
 * Eager, client-side multi-photo upload to the private `car-photos` bucket. Each
 * file lands at `<userId>/<uuid>/<i>-<name>` (RLS lets a user write only their own
 * folder). Reports the uploaded object paths up via `onChange`; the assess form
 * sends them in the POST and the service stores them on the car.
 */
export function PhotoUpload({
  onChange,
  initial,
}: {
  onChange: (paths: string[]) => void;
  /** Already-uploaded photos to show on mount (edit flow): path + signed URL. */
  initial?: { path: string; url: string }[];
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>(() =>
    (initial ?? []).map((it, i) => ({
      key: `init-${i}-${it.path}`,
      preview: it.url,
      path: it.path,
      status: "done" as const,
    })),
  );
  const [error, setError] = useState<string | null>(null);

  function emit(next: Item[]) {
    onChange(next.filter((i) => i.path).map((i) => i.path as string));
  }

  async function addFiles(files: File[]) {
    setError(null);
    const room = MAX_FILES - items.length;
    if (room <= 0) {
      setError(`Up to ${MAX_FILES} photos.`);
      return;
    }
    const accepted = files.slice(0, room).filter((f) => {
      if (!f.type.startsWith("image/")) {
        setError("Only image files are allowed.");
        return false;
      }
      if (f.size > MAX_BYTES) {
        setError("Each photo must be 5 MB or smaller.");
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return;

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setError("Please sign in again to upload photos.");
      return;
    }
    const folder = crypto.randomUUID();

    const staged: Item[] = accepted.map((f, i) => ({
      key: `${folder}-${i}`,
      preview: URL.createObjectURL(f),
      path: null,
      status: "uploading",
    }));
    setItems((prev) => [...prev, ...staged]);

    await Promise.all(
      accepted.map(async (file, i) => {
        const path = `${userId}/${folder}/${i}-${safeName(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        setItems((prev) => {
          const next = prev.map((it) =>
            it.key === staged[i].key
              ? {
                  ...it,
                  path: upErr ? null : path,
                  status: (upErr ? "error" : "done") as Item["status"],
                }
              : it,
          );
          emit(next);
          return next;
        });
        if (upErr) setError("A photo failed to upload. Try again.");
      }),
    );
  }

  function remove(key: string) {
    setItems((prev) => {
      const gone = prev.find((i) => i.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      const next = prev.filter((i) => i.key !== key);
      emit(next);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {items.map((it) => (
          <div
            key={it.key}
            className="relative size-20 overflow-hidden rounded-lg border border-border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.preview}
              alt=""
              className={`size-full object-cover ${
                it.status === "done" ? "" : "opacity-50"
              }`}
            />
            {it.status === "uploading" && (
              <span
                aria-label="Uploading"
                className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            )}
            <button
              type="button"
              onClick={() => remove(it.key)}
              aria-label="Remove photo"
              className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
            >
              ✕
            </button>
          </div>
        ))}

        {items.length < MAX_FILES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid size-20 place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            + Photo
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="Add car photos"
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []));
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Optional — up to {MAX_FILES} photos, 5 MB each. The first is the thumbnail.
        </p>
      )}
    </div>
  );
}
