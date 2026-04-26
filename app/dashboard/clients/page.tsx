import { requirePageRole } from "@/lib/auth/redirects";
import { listClientsWithUpcomingCount } from "@/services/clients";
import { ClientList } from "@/components/clients/client-list";
import { CreateClientPanel } from "@/components/clients/create-client-form";

export default async function ClientsPage() {
  await requirePageRole("owner", "employee");

  const clients = await listClientsWithUpcomingCount();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Clients</h1>
        <CreateClientPanel />
      </div>
      <ClientList clients={clients} />
    </div>
  );
}
