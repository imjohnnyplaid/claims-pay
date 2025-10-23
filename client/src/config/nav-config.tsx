import {
  Home,
  Code,
  Receipt,
  Building2,
  Landmark,
  Users,
  Zap,
  FileText,
  FlaskConical,
  User,
  LogOut,
  FileText as FilePlus,
  Settings,
  ListChecks,
} from "lucide-react";
import { NavConfig } from "@/components/portal-layout";

export function getInternalNavConfig(onSignOut: () => void): NavConfig {
  return {
    userDropdown: {
      items: [
        {
          title: "Profile",
          icon: User,
          onClick: () => {
            // Navigate to profile page when implemented
            console.log("Navigate to profile");
          },
          testId: "dropdown-profile",
        },
        {
          title: "Sign out",
          icon: LogOut,
          onClick: onSignOut,
          testId: "dropdown-signout",
        },
      ],
    },
    main: [
      {
        items: [
          {
            title: "Home",
            icon: Home,
            href: "/admin/home",
            testId: "nav-home",
          },
          {
            title: "Coding",
            icon: Code,
            href: "/admin/coding",
            testId: "nav-coding",
          },
          {
            title: "Transactions",
            icon: Receipt,
            href: "/admin/transactions",
            testId: "nav-transactions",
          },
          {
            title: "Providers",
            icon: Building2,
            href: "/admin/providers",
            testId: "nav-providers",
          },
          {
            title: "Banks",
            icon: Landmark,
            href: "/admin/banks",
            testId: "nav-banks",
          },
        ],
      },
      {
        title: "Manage",
        items: [
          {
            title: "Users",
            icon: Users,
            href: "/admin/users",
            testId: "nav-users",
          },
          {
            title: "System Status",
            icon: Zap,
            href: "/admin/system-status",
            testId: "nav-system-status",
          },
          {
            title: "Reports",
            icon: FileText,
            href: "/admin/reports",
            testId: "nav-reports",
          },
          {
            title: "Testing",
            icon: FlaskConical,
            href: "/admin/testing",
            testId: "nav-testing",
          },
        ],
      },
    ],
  };
}

export function getCustomerNavConfig(onSignOut: () => void): NavConfig {
  return {
    userDropdown: {
      items: [
        {
          title: "Settings",
          icon: Settings,
          onClick: () => {
            window.location.href = "/provider/settings";
          },
          testId: "dropdown-settings",
        },
        {
          title: "Sign out",
          icon: LogOut,
          onClick: onSignOut,
          testId: "dropdown-signout",
        },
      ],
    },
    main: [
      {
        items: [
          {
            title: "Dashboard",
            icon: Home,
            href: "/provider/dashboard",
            testId: "nav-dashboard",
          },
          {
            title: "New Claim",
            icon: FilePlus,
            href: "/provider/claims/new",
            testId: "nav-new-claim",
          },
          {
            title: "All Claims",
            icon: ListChecks,
            href: "/provider/claims",
            testId: "nav-all-claims",
          },
          {
            title: "Settings",
            icon: Settings,
            href: "/provider/settings",
            testId: "nav-settings",
          },
        ],
      },
    ],
  };
}

export function getBankNavConfig(onSignOut: () => void): NavConfig {
  return {
    userDropdown: {
      items: [
        {
          title: "Sign out",
          icon: LogOut,
          onClick: onSignOut,
          testId: "dropdown-signout",
        },
      ],
    },
    main: [
      {
        items: [
          {
            title: "Dashboard",
            icon: Home,
            href: "/bank/dashboard",
            testId: "nav-dashboard",
          },
          {
            title: "Providers",
            icon: Building2,
            href: "/bank/providers",
            testId: "nav-providers",
          },
          {
            title: "Users",
            icon: Users,
            href: "/bank/users",
            testId: "nav-users",
          },
        ],
      },
    ],
  };
}
