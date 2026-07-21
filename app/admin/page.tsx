import { readStore } from "@/lib/store";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const store = await readStore();

  return (
    <AdminDashboard initialImages={store.images} initialScreens={store.screens} />
  );
}
