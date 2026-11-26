"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";

const size = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Drag-and-drop file box backed by a real <input type="file">, so it submits with its form as normal.
 * `onFiles` lets the parent react (e.g. fill a title from the file name).
 */
export function DropZone({
  name,
  label,
  hint,
  required,
  multiple,
  accept = "application/pdf",
  compact,
  disabled,
  onFiles,
  inputRef,
}: {
  name?: string;
  label: string;
  hint?: string;
  required?: boolean;
  multiple?: boolean;
  accept?: string;
  compact?: boolean;
  disabled?: boolean;
  onFiles?: (files: File[]) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const own = useRef<HTMLInputElement>(null);
  const input = inputRef ?? own;
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accepts = (f: File) => accept.split(",").some((a) => (a.trim() === "application/pdf" ? f.type === "application/pdf" || /\.pdf$/i.test(f.name) : true));

  const take = (list: FileList | File[]) => {
    const all = Array.from(list);
    const ok = all.filter(accepts);
    setError(ok.length < all.length ? "Only PDF files can be added." : null);
    const picked = multiple ? ok : ok.slice(0, 1);
    if (!picked.length) return;
    // Put the dropped files on the real input so the form submits them.
    const dt = new DataTransfer();
    picked.forEach((f) => dt.items.add(f));
    if (input.current) input.current.files = dt.files;
    setFiles(picked);
    onFiles?.(picked);
  };

  const clear = () => {
    if (input.current) input.current.value = "";
    setFiles([]);
    onFiles?.([]);
  };

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink-800">
        {label}
        {required ? null : <span className="font-normal text-ink-400"> (optional)</span>}
      </p>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled && e.dataTransfer.files.length) take(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex cursor-pointer items-center gap-4 rounded-[var(--radius-lg)] border-2 border-dashed px-4 transition",
          compact ? "py-3" : "py-5",
          over ? "border-mark-500 bg-mark-50" : files.length ? "border-success-600/40 bg-success-50/50" : "border-line-strong bg-paper/60 hover:border-ink-400 hover:bg-white",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={input}
          type="file"
          name={name}
          accept={accept}
          multiple={multiple}
          required={required && !files.length}
          disabled={disabled}
          onChange={(e) => e.target.files && take(e.target.files)}
          className="sr-only"
        />
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            files.length ? "bg-success-600 text-white" : over ? "bg-mark-500 text-white" : "bg-white text-ink-500 ring-1 ring-line",
          )}
        >
          <Icon name={files.length ? "check" : "download"} size={20} className={files.length ? "" : "rotate-180"} />
        </span>
        <span className="min-w-0 flex-1">
          {files.length ? (
            <>
              <span className="block truncate text-sm font-semibold text-ink-950">{files.length === 1 ? files[0].name : `${files.length} files selected`}</span>
              <span className="block truncate text-xs text-ink-500">
                {files.length === 1 ? size(files[0].size) : files.map((f) => f.name).join(", ")} · click to change
              </span>
            </>
          ) : (
            <>
              <span className="block text-sm font-semibold text-ink-900">
                {over ? "Drop to add" : multiple ? "Drag PDFs here" : "Drag a PDF here"} <span className="font-normal text-ink-500">or</span>{" "}
                <span className="text-mark-600 underline-offset-2 hover:underline">browse</span>
              </span>
              <span className="block text-xs text-ink-500">{hint ?? "PDF up to 50 MB"}</span>
            </>
          )}
        </span>
        {files.length ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              clear();
            }}
            aria-label="Remove file"
            className="rounded-md p-1.5 text-ink-400 hover:bg-white hover:text-danger-600"
          >
            <Icon name="x" size={16} />
          </button>
        ) : null}
      </label>
      {error ? <p className="mt-1.5 text-xs text-danger-600">{error}</p> : null}
    </div>
  );
}
