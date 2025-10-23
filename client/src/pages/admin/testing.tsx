import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { PortalLayout } from "@/components/portal-layout";
import { getInternalNavConfig } from "@/config/nav-config";

export default function AdminTesting() {
  const [, setLocation] = useLocation();
  const { user, logout, impersonating, impersonatedRole } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  useEffect(() => {
    const isAuthorized =
      user &&
      (user.role === "admin" ||
        user.role === "super_admin" ||
        (impersonating && (impersonatedRole === "admin" || impersonatedRole === "super_admin")));

    if (user && !isAuthorized) {
      setLocation("/");
    }
  }, [user, impersonating, impersonatedRole, setLocation]);

  if (!user) {
    return null;
  }

  const navConfig = getInternalNavConfig(handleLogout);

  return (
    <PortalLayout navConfig={navConfig} portalName="Internal Portal">
      <div className="p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Testing</h1>
          <p className="mt-1 text-muted-foreground">Test and debug system features</p>
        </div>

        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Testing page content coming soon...</p>
        </div>
      </div>
    </PortalLayout>
  );
}
