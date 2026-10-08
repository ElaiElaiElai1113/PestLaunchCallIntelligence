import { Suspense } from "react";
import { CallLog } from "@/components/call-list";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading calls…</p>}>
      <CallLog />
    </Suspense>
  );
}
