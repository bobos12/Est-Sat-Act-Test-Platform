import { PageSkeleton } from "@/components/admin/ui";

export default function Loading() {
  return <PageSkeleton stats={3} rows={10} tabs />;
}
