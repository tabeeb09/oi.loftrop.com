import PrivilegeRequestsAdmin from "@/components/admin/PrivilegeRequestsAdmin";
import { requireRole } from "@/src/lib/server/auth";
import { listPrivilegeRequests } from "@/src/lib/server/privilege-requests";

export const dynamic = "force-dynamic";

export default async function PrivilegeRequestsPage() {
  await requireRole(["owner"]);
  const requests = await listPrivilegeRequests();

  return (
    <main style={{ maxWidth: "72rem", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Privilege Requests</h1>
      <p>Owners can approve requests here. Approval assigns the requested Keycloak client role.</p>
      <PrivilegeRequestsAdmin initialRequests={requests} />
    </main>
  );
}
