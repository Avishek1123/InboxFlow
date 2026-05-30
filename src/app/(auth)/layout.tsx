import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminSetupNotice } from "@/components/auth/admin-setup-notice";
import { APP_NAME } from "@/lib/constants";
import { getServerSession } from "@/lib/firebase/server-auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="text-sm font-semibold tracking-tight hover:opacity-80">
          {APP_NAME}
        </Link>
      </div>
      <div className="w-full max-w-md">
        <AdminSetupNotice />
        {children}
      </div>
    </div>
  );
}
