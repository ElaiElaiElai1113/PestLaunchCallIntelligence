import { WorkspaceShell } from "@/components/workspace-shell";
export const dynamic = "force-dynamic";
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
