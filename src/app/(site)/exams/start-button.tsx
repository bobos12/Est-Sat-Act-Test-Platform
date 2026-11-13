"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { ExamLoader } from "@/components/exam/exam-loader";

/** Submit button for the start form; shows the loading screen while the exam is created and opened. */
export function StartExamButton({ resume, title }: { resume: boolean; title: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <Button type="submit" size="lg" className="mt-5 w-full" disabled={pending}>
        {pending ? "Opening…" : resume ? "Resume exam" : "Start exam"}
      </Button>
      {pending ? <ExamLoader title={title} resume={resume} /> : null}
    </>
  );
}
