import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import {
  AlertCircle,
  DollarSign,
  LogOut,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import edellaLogo from "@assets/edella-logo@3x_1760044169163.png";
import { type DateRange } from "@shared/schema";
import { PortalLayout } from "@/components/portal-layout";
import { getBankNavConfig } from "@/config/nav-config";

interface BankMetrics {
  totalFunded: number;
  outstanding: number;
  defaultRate: number;
  projectedROI: number;
}

export default function BankDashboard() {
  const [, setLocation] = useLocation();
  const { user, bank, isLoading, logout, impersonating, impersonatedRole } = useAuth();
  const authChecked = useRef(false);
  const [dateRange, setDateRange] = useState<DateRange>("day");

  const { data: metrics } = useQuery<BankMetrics>({
    queryKey: ["/api/metrics/bank", dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/metrics/bank?range=${dateRange}`);
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
  });

  const handleLogout = async () => {
    await logout();
  };

  useEffect(() => {
    // Wait for auth to fully load before making redirect decisions
    if (isLoading) {
      return;
    }

    // Mark that we've completed at least one auth check
    if (user) {
      authChecked.current = true;
    }

    // Only redirect to onboarding after we've confirmed auth is loaded and there's no bank
    if (authChecked.current && user && user.role === "bank" && !bank) {
      setLocation("/bank/onboarding");
      return;
    }

    // Check if user is authorized for bank dashboard
    const isAuthorized = user && (
      user.role === "bank" ||
      (impersonating && impersonatedRole === "bank")
    );

    if (authChecked.current && user && !isAuthorized) {
      setLocation("/");
    }
  }, [user, bank, isLoading, impersonating, impersonatedRole, setLocation]);

  // Render guard - don't render until we have user data
  if (!user) {
    return null;
  }

  const stats: BankMetrics = metrics || {
    totalFunded: 0,
    outstanding: 0,
    defaultRate: 0,
    projectedROI: 0,
  };

  const navConfig = getBankNavConfig(handleLogout);

  return (
    <PortalLayout 
      navConfig={navConfig}
      portalName="Bank Portal"
    >
      <div className="p-6 md:p-8">
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">Funding Partner Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Track funded claims and portfolio performance</p>
          </div>
          <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <TabsList>
              <TabsTrigger value="day" data-testid="filter-day">Today</TabsTrigger>
              <TabsTrigger value="week" data-testid="filter-week">Week</TabsTrigger>
              <TabsTrigger value="month" data-testid="filter-month">Month</TabsTrigger>
              <TabsTrigger value="qtd" data-testid="filter-qtd">QTD</TabsTrigger>
              <TabsTrigger value="ytd" data-testid="filter-ytd">YTD</TabsTrigger>
              <TabsTrigger value="year" data-testid="filter-year">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Funded</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold" data-testid="metric-funded">
                ${stats.totalFunded?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Lifetime funding</p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-chart-4" data-testid="metric-outstanding">
                ${stats.outstanding?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Pending reimbursement</p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Default Rate</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-chart-3" data-testid="metric-default-rate">
                {stats.defaultRate}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Below 2% target</p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projected ROI</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-accent" data-testid="metric-roi">
                {stats.projectedROI}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Annualized return</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle>Portfolio Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium">Average Claim Turnaround</p>
                    <p className="text-sm text-muted-foreground">From funding to reimbursement</p>
                  </div>
                  <div className="text-2xl font-semibold">24 hrs</div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium">Approval Accuracy</p>
                    <p className="text-sm text-muted-foreground">AI risk assessment precision</p>
                  </div>
                  <div className="text-2xl font-semibold text-chart-3">98.2%</div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium">Portfolio Exposure</p>
                    <p className="text-sm text-muted-foreground">Current outstanding claims</p>
                  </div>
                  <div className="text-2xl font-semibold text-chart-4">
                    ${stats.outstanding?.toLocaleString() || "0"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
