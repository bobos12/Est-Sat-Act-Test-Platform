"use client";

/** Header checkbox that ticks or clears every row in its form. */
export function SelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="Select all exams"
      className="h-4 w-4 accent-mark-500"
      onChange={(e) => {
        e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((c) => (c.checked = e.currentTarget.checked));
      }}
    />
  );
}
