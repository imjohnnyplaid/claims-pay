import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { PortalLayout } from "@/components/portal-layout";
import { getInternalNavConfig } from "@/config/nav-config";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  FileCheck,
  FileX,
  Users,
  Heart,
} from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DateRange } from "@shared/schema";

interface TransactionMetrics {
  totalPaymentsOut: number;
  totalPaymentsIn: number;
  grossProfit: number;
  netProfit: number;
  arBalance: number;
  arDays: number;
  claimsPaid: number;
  claimsDenied: number;
  averageRevenuePerCustomer: number;
  customerLifetimeValue: number;
}

export default function AdminTransactions() {
  const [, setLocation] = useLocation();
  const { user, logout, impersonating, impersonatedRole } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("day");

  const { data: metrics } = useQuery<TransactionMetrics>({
    queryKey: ["/api/metrics/transactions", dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/metrics/transactions?range=${dateRange}`);
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

  const stats: TransactionMetrics = metrics || {
    totalPaymentsOut: 0,
    totalPaymentsIn: 0,
    grossProfit: 0,
    netProfit: 0,
    arBalance: 0,
    arDays: 0,
    claimsPaid: 0,
    claimsDenied: 0,
    averageRevenuePerCustomer: 0,
    customerLifetimeValue: 0,
  };

  // Generate chart data for each metric
  const generateChartData = (value: number) => {
    const data = [];
    const points = dateRange === "day" ? 24 : dateRange === "week" ? 7 : 30;
    
    for (let i = 0; i < points; i++) {
      const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
      data.push({
        name: i.toString(),
        value: Math.max(0, value * (1 + variation)),
      });
    }
    return data;
  };

  const chartData = useMemo(() => ({
    paymentsOut: generateChartData(stats.totalPaymentsOut),
    paymentsIn: generateChartData(stats.totalPaymentsIn),
    grossProfit: generateChartData(stats.grossProfit),
    netProfit: generateChartData(stats.netProfit),
    arBalance: generateChartData(stats.arBalance),
    arDays: generateChartData(stats.arDays),
    claimsPaid: generateChartData(stats.claimsPaid),
    claimsDenied: generateChartData(stats.claimsDenied),
    arpc: generateChartData(stats.averageRevenuePerCustomer),
    clv: generateChartData(stats.customerLifetimeValue),
  }), [stats, dateRange]);

  const navConfig = getInternalNavConfig(handleLogout);

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    chartData, 
    prefix = "$",
    suffix = "",
    trend,
    testId 
  }: { 
    title: string; 
    value: number; 
    icon: any; 
    chartData: any[]; 
    prefix?: string;
    suffix?: string;
    trend?: "up" | "down";
    testId?: string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2" data-testid={testId}>
          {prefix}{value.toLocaleString()}{suffix}
        </div>
        {trend && (
          <div className="flex items-center text-xs text-muted-foreground mb-2">
            {trend === "up" ? (
              <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
            )}
            <span>{trend === "up" ? "Increasing" : "Decreasing"} trend</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={60}>
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="text-sm font-medium">
                        {prefix}{Math.round(payload[0].value as number).toLocaleString()}{suffix}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  return (
    <PortalLayout navConfig={navConfig} portalName="Internal Portal">
      <div className="p-6 md:p-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Transactions</h1>
            <p className="mt-1 text-muted-foreground">Financial metrics and performance</p>
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

        {/* Top Row: Key Summary Metrics */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments Out</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-payments-out-summary">
                ${stats.totalPaymentsOut.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Paid to customers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments In</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-payments-in-summary">
                ${stats.totalPaymentsIn.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Received from payers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">A/R Days</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-ar-days-summary">
                {stats.arDays.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">Avg days to reimbursement</p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <MetricCard
            title="Payments Out"
            value={stats.totalPaymentsOut}
            icon={DollarSign}
            chartData={chartData.paymentsOut}
            trend="up"
            testId="metric-payments-out"
          />
          <MetricCard
            title="Payments In"
            value={stats.totalPaymentsIn}
            icon={TrendingUp}
            chartData={chartData.paymentsIn}
            trend="up"
            testId="metric-payments-in"
          />
          <MetricCard
            title="Gross Profit"
            value={stats.grossProfit}
            icon={TrendingUp}
            chartData={chartData.grossProfit}
            trend="up"
            testId="metric-gross-profit"
          />
          <MetricCard
            title="Net Profit"
            value={stats.netProfit}
            icon={TrendingUp}
            chartData={chartData.netProfit}
            trend="up"
            testId="metric-net-profit"
          />
          <MetricCard
            title="A/R Balance"
            value={stats.arBalance}
            icon={DollarSign}
            chartData={chartData.arBalance}
            testId="metric-ar-balance"
          />
          <MetricCard
            title="A/R Days"
            value={stats.arDays}
            icon={Clock}
            chartData={chartData.arDays}
            suffix=" days"
            prefix=""
            trend="down"
            testId="metric-ar-days"
          />
          <MetricCard
            title="Claims Paid"
            value={stats.claimsPaid}
            icon={FileCheck}
            chartData={chartData.claimsPaid}
            prefix=""
            trend="up"
            testId="metric-claims-paid"
          />
          <MetricCard
            title="Claims Denied"
            value={stats.claimsDenied}
            icon={FileX}
            chartData={chartData.claimsDenied}
            prefix=""
            trend="down"
            testId="metric-claims-denied"
          />
          <MetricCard
            title="Average Revenue Per Customer"
            value={stats.averageRevenuePerCustomer}
            icon={Users}
            chartData={chartData.arpc}
            trend="up"
            testId="metric-arpc"
          />
          <MetricCard
            title="Customer Lifetime Value"
            value={stats.customerLifetimeValue}
            icon={Heart}
            chartData={chartData.clv}
            trend="up"
            testId="metric-clv"
          />
        </div>
      </div>
    </PortalLayout>
  );
}
