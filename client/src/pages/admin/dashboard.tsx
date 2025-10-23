import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Activity,
  Building2,
  DollarSign,
  Landmark,
  LogOut,
  TrendingUp,
  Users,
  Zap,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Provider } from "@shared/schema";
import edellaLogo from "@assets/edella-logo@3x_1760044169163.png";
import { PortalSwitcher } from "@/components/portal-switcher";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { type DateRange } from "@shared/schema";

interface AdminMetrics {
  activeCustomers: number;
  totalPaymentsOut: number;
  totalReimbursementsIn: number;
  netProfit: number;
  aiUptime: number;
  aiErrorRate: number;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout, impersonating, impersonatedRole } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("day");

  const { data: metrics } = useQuery<AdminMetrics>({
    queryKey: ["/api/metrics/admin", dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/metrics/admin?range=${dateRange}`);
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
  });

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/admin/providers"],
  });

  const handleLogout = async () => {
    await logout();
  };

  useEffect(() => {
    // Check if user is authorized for admin dashboard
    // Allow if: user is admin/super_admin OR user is impersonating as admin
    const isAuthorized = user && (
      user.role === "admin" || 
      user.role === "super_admin" ||
      (impersonating && (impersonatedRole === "admin" || impersonatedRole === "super_admin"))
    );

    if (user && !isAuthorized) {
      setLocation("/");
    }
  }, [user, impersonating, impersonatedRole, setLocation]);

  // Render guard - don't render until we have user data
  if (!user) {
    return null;
  }

  const stats: AdminMetrics = metrics || {
    activeCustomers: 0,
    totalPaymentsOut: 0,
    totalReimbursementsIn: 0,
    netProfit: 0,
    aiUptime: 99.9,
    aiErrorRate: 0.1,
  };

  // Generate deterministic chart data based on metrics and date range
  const chartData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const dataPoints: Array<{ name: string; payments: number; reimbursements: number }> = [];
    
    // Use actual metrics as the base values
    const basePayments = stats.totalPaymentsOut || 0;
    const baseReimbursements = stats.totalReimbursementsIn || 0;
    
    switch (dateRange) {
      case "day":
        // Last 24 hours - hourly data points
        const hourlyPayments = basePayments / 24;
        const hourlyReimbursements = baseReimbursements / 24;
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(now);
          hour.setHours(now.getHours() - i);
          dataPoints.push({
            name: hour.toLocaleTimeString('en-US', { hour: 'numeric' }),
            payments: hourlyPayments,
            reimbursements: hourlyReimbursements,
          });
        }
        break;
      case "week":
        // Last 7 days
        const dailyPayments = basePayments / 7;
        const dailyReimbursements = baseReimbursements / 7;
        for (let i = 6; i >= 0; i--) {
          const day = new Date(now);
          day.setDate(now.getDate() - i);
          dataPoints.push({
            name: day.toLocaleDateString('en-US', { weekday: 'short' }),
            payments: dailyPayments,
            reimbursements: dailyReimbursements,
          });
        }
        break;
      case "month":
        // Last 30 days - weekly data points
        const weeklyPayments = basePayments / 4;
        const weeklyReimbursements = baseReimbursements / 4;
        for (let i = 3; i >= 0; i--) {
          dataPoints.push({
            name: `Week ${4 - i}`,
            payments: weeklyPayments,
            reimbursements: weeklyReimbursements,
          });
        }
        break;
      case "qtd":
        // Current quarter - monthly data points
        const quarterStart = Math.floor(currentMonth / 3) * 3;
        const monthsInQuarter = currentMonth - quarterStart + 1;
        const monthlyPaymentsQtd = basePayments / monthsInQuarter;
        const monthlyReimbursementsQtd = baseReimbursements / monthsInQuarter;
        for (let i = quarterStart; i <= currentMonth; i++) {
          const monthDate = new Date(now.getFullYear(), i, 1);
          dataPoints.push({
            name: monthDate.toLocaleDateString('en-US', { month: 'short' }),
            payments: monthlyPaymentsQtd,
            reimbursements: monthlyReimbursementsQtd,
          });
        }
        break;
      case "ytd":
        // Year to date - monthly data points
        const monthsYtd = currentMonth + 1;
        const monthlyPaymentsYtd = basePayments / monthsYtd;
        const monthlyReimbursementsYtd = baseReimbursements / monthsYtd;
        for (let i = 0; i <= currentMonth; i++) {
          const monthDate = new Date(now.getFullYear(), i, 1);
          dataPoints.push({
            name: monthDate.toLocaleDateString('en-US', { month: 'short' }),
            payments: monthlyPaymentsYtd,
            reimbursements: monthlyReimbursementsYtd,
          });
        }
        break;
      case "year":
        // Full year - monthly data points
        const monthlyPayments = basePayments / 12;
        const monthlyReimbursements = baseReimbursements / 12;
        for (let i = 0; i < 12; i++) {
          const monthDate = new Date(now.getFullYear(), i, 1);
          dataPoints.push({
            name: monthDate.toLocaleDateString('en-US', { month: 'short' }),
            payments: monthlyPayments,
            reimbursements: monthlyReimbursements,
          });
        }
        break;
    }
    
    return dataPoints;
  }, [dateRange, stats.totalPaymentsOut, stats.totalReimbursementsIn]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="flex h-16 items-center gap-4 px-6">
          <div className="flex items-center gap-2">
            <img 
              src={edellaLogo} 
              alt="Edella" 
              style={{ width: 'auto', height: '100%', maxHeight: '32px' }}
              className="object-contain"
            />
          </div>
          <nav className="ml-4 flex gap-2">
            {!impersonating && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/admin/dashboard")}
                  data-testid="link-dashboard"
                >
                  Dashboard
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/admin/customers")}
                  data-testid="link-customers"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Customers
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/admin/funding-sources")}
                  data-testid="link-funding-sources"
                >
                  <Landmark className="h-4 w-4 mr-2" />
                  Funding Sources
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => setLocation("/admin/users")}
              data-testid="link-users"
            >
              <Users className="h-4 w-4 mr-2" />
              {impersonating ? "Team Members" : "Users"}
            </Button>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <PortalSwitcher />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2" data-testid="button-admin-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline">{user.username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Admin Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <ImpersonationBanner />

      <div className="p-6 md:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
            <p className="mt-1 text-muted-foreground">System overview and customer management</p>
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
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold" data-testid="metric-customers">
                {stats.activeCustomers}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Healthcare providers</p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments Out</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-destructive" data-testid="metric-payments-out">
                ${stats.totalPaymentsOut?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">To providers (95%)</p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reimbursements In</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-chart-3" data-testid="metric-reimbursements">
                ${stats.totalReimbursementsIn?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">From insurance</p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-primary" data-testid="metric-profit">
                ${stats.netProfit?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">5% commission avg</p>
            </CardContent>
          </Card>
        </div>

        {/* AI System Health */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card className="border-card-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
                  <Zap className="h-5 w-5 text-chart-3" />
                </div>
                <div>
                  <CardTitle className="text-base">AI Model Uptime</CardTitle>
                  <p className="text-sm text-muted-foreground">Last 30 days</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-chart-3">{stats.aiUptime}%</div>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                  <Activity className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Error Rate</CardTitle>
                  <p className="text-sm text-muted-foreground">AI coding errors</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{stats.aiErrorRate}%</div>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Processing Speed</CardTitle>
                  <p className="text-sm text-muted-foreground">Avg per claim</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">2.3s</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Revenue Chart */}
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value / 1000000}M`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="payments"
                    stackId="1"
                    stroke="hsl(var(--destructive))"
                    fill="hsl(var(--destructive))"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="reimbursements"
                    stackId="2"
                    stroke="hsl(var(--chart-3))"
                    fill="hsl(var(--chart-3))"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Customer List */}
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle>Recent Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Claims</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.slice(0, 5).map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{provider.providerName}</p>
                            <p className="text-xs text-muted-foreground">NPI: {provider.npi}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={provider.isActive ? "default" : "secondary"}>
                            {provider.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">-</TableCell>
                      </TableRow>
                    ))}
                    {providers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No customers yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
