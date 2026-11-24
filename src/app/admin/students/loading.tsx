import { PageSkeleton } from "@/components/admin/ui";

export default function Loading() {
  return <PageSkeleton stats={5} rows={10} />;
}
