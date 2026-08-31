import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="md:pl-64">
        <Header />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
