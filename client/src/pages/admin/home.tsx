import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { PortalLayout } from "@/components/portal-layout";
import { getInternalNavConfig } from "@/config/nav-config";
import {
  DollarSign,
  TrendingUp,
  FileText,
  XCircle,
  Users,
  Activity,
  Zap,
  Clock,
  Info,
} from "lucide-react";
import { useState } from "react";
import type { DateRange } from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HomeMetrics {
  totalPaymentsOut: number;
  totalPaymentsIn: number;
  grossProfit: number;
  claimsPurchased: number;
  claimsRejected: number;
  activeCustomers: number;
  aiModelUptime: number;
  errorRate: number;
  processingSpeed: number;
  paymentSpeed: number;
}

export default function AdminHome() {
  const [, setLocation] = useLocation();
  const { user, logout, impersonating, impersonatedRole } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("day");

  const { data: metrics } = useQuery<HomeMetrics>({
    queryKey: ["/api/metrics/admin/home", dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/metrics/admin/home?range=${dateRange}`);
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
  });

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

  const stats: HomeMetrics = metrics || {
    totalPaymentsOut: 0,
    totalPaymentsIn: 0,
    grossProfit: 0,
    claimsPurchased: 0,
    claimsRejected: 0,
    activeCustomers: 0,
    aiModelUptime: 99.9,
    errorRate: 0.1,
    processingSpeed: 1.2,
    paymentSpeed: 2.5,
  };

  const navConfig = getInternalNavConfig(handleLogout);

  return (
    <PortalLayout navConfig={navConfig} portalName="Internal Portal">
      <div className="p-6 md:p-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Home</h1>
            <p className="mt-1 text-muted-foreground">System overview and key metrics</p>
          </div>
          <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <TabsList>
              <TabsTrigger value="day" data-testid="filter-day">
                Today
              </TabsTrigger>
              <TabsTrigger value="week" data-testid="filter-week">
                Week
              </TabsTrigger>
              <TabsTrigger value="month" data-testid="filter-month">
                Month
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Row 1: Financial Metrics */}
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments Out</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-payments-out">
                ${stats.totalPaymentsOut.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Amount paid to customers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments In</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-payments-in">
                ${stats.totalPaymentsIn.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Received from insurance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-gross-profit">
                ${stats.grossProfit.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Total revenue</p>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Claims Metrics */}
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Claims Purchased</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-claims-purchased">
                {stats.claimsPurchased.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Total claims bought</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Claims Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-claims-rejected">
                {stats.claimsRejected.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Claims not purchased</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-active-customers">
                {stats.activeCustomers.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Current providers</p>
            </CardContent>
          </Card>
        </div>

        {/* Row 3: System Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Model Uptime</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-ai-uptime">
                {stats.aiModelUptime.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">System availability</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-error-rate">
                {stats.errorRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Processing errors</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing Speed</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-processing-speed">
                {stats.processingSpeed.toFixed(1)}s
              </div>
              <p className="text-xs text-muted-foreground">Avg claim processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Speed</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Average amount of time from coding to payment</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-payment-speed">
                {stats.paymentSpeed.toFixed(1)}h
              </div>
              <p className="text-xs text-muted-foreground">Coding to payment</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
