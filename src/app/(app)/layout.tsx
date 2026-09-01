import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { getAccessContext } from "@/lib/access";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccessContext();
  if (!access) redirect("/login");

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top_right,_rgba(47,91,246,0.07),_transparent_28%),linear-gradient(to_bottom,_#f8fafc,_#f5f7fb)]">
      <Sidebar role={access.role} displayName={access.name} viewPermissions={access.viewPermissions} />
      <div className="md:pl-64">
        <Header />
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-7">{children}</main>
      </div>
      <BottomNav role={access.role} viewPermissions={access.viewPermissions} />
    </div>
  );
}
