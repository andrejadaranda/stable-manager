import { requirePageRole } from "@/lib/auth/redirects";
import { listClientsWithUpcomingCount } from "@/services/clients";
import { ClientList } from "@/components/clients/client-list";
import { CreateClientPanel } from "@/components/clients/create-client-form";
import { PageHeader } from "@/components/ui";

export default async function ClientsPage() {
  await requirePageRole("owner", "employee");

  const clients = await listClientsWithUpcomingCount();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        subtitle="Roster, balances, and upcoming lessons."
        actions={<CreateClientPanel />}
      />
      <ClientList clients={clients} />
    </div>
  );
}
