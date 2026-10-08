import { Suspense } from "react";
import { CallLog } from "@/components/call-list";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading review queue…</p>}>
      <CallLog review />
    </Suspense>
  );
}
