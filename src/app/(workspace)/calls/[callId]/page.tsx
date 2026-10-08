import { Suspense } from "react";
import { CallDetail } from "@/components/call-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  return (
    <Suspense fallback={<p>Opening call…</p>}>
      <CallDetail id={(await params).callId} />
    </Suspense>
  );
}
