import { ReactNode } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { PortalSwitcher } from "@/components/portal-switcher";
import { useAuth } from "@/lib/auth";
import { ChevronDown, LucideIcon } from "lucide-react";
import edellaLogo from "@assets/edella-logo@3x_1760044169163.png";

export interface NavItem {
  title: string;
  icon: LucideIcon;
  href: string;
  testId?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export interface NavConfig {
  main: NavSection[];
  userDropdown?: {
    items: Array<{
      title: string;
      icon: LucideIcon;
      onClick: () => void;
      testId?: string;
    }>;
  };
}

interface PortalLayoutProps {
  children: ReactNode;
  navConfig: NavConfig;
  portalName: string;
}

export function PortalLayout({ children, navConfig, portalName }: PortalLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, impersonating } = useAuth();

  if (!user) {
    return null;
  }

  const userInitials = user.username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarContent>

            {/* User Profile Dropdown */}
            {navConfig.userDropdown && (
              <div className="p-2 border-b">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between hover-elevate active-elevate-2"
                      data-testid="button-user-dropdown"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {userInitials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">
                          {user.firstName}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>{portalName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {navConfig.userDropdown.items.map((item) => (
                      <DropdownMenuItem
                        key={item.title}
                        onClick={item.onClick}
                        data-testid={item.testId}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Navigation Sections */}
            {navConfig.main.map((section, idx) => (
              <SidebarGroup key={idx}>
                {section.title && (
                  <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
                    {section.title}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const isActive = location === item.href;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            onClick={() => setLocation(item.href)}
                            isActive={isActive}
                            data-testid={item.testId}
                            className="text-sm"
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t p-2">
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {impersonating && <PortalSwitcher />}
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top Header */}
          <header className="flex items-center h-16 px-4 border-b bg-card gap-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="ml-auto flex items-center gap-2">
              {!impersonating && <PortalSwitcher />}
            </div>
          </header>

          <ImpersonationBanner />

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
