import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  TrendingUp,
  XCircle,
  Activity,
  RefreshCw,
  Wifi,
  Download,
  FileSpreadsheet,
  FileCode,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Claim, DateRange } from "@shared/schema";
import { anonymizePatientId } from "@shared/phi-utils";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { PortalLayout } from "@/components/portal-layout";
import { getCustomerNavConfig } from "@/config/nav-config";

export default function ProviderDashboard() {
  const [, setLocation] = useLocation();
  const { user, provider, logout, isLoading, impersonating, impersonatedRole } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("day");
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const authChecked = useRef(false);

  const { data: metrics } = useQuery({
    queryKey: ["/api/metrics/provider", dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/metrics/provider?range=${dateRange}`);
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    enabled: !isLoading && !!user && !!provider,
  });

  const { data: claimsData } = useQuery<{
    claims: Claim[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ["/api/claims"],
    queryFn: async () => {
      const res = await fetch(`/api/claims?limit=100`);
      if (!res.ok) throw new Error('Failed to fetch claims');
      return res.json();
    },
    enabled: !isLoading && !!user && !!provider,
  });
  
  const claims = claimsData?.claims || [];

  const { data: ehrStatus } = useQuery<{
    ehrEnabled: boolean;
    ehrSystem: string | null;
    lastSync: string | null;
    syncServiceStatus: { running: boolean; syncing: boolean };
  }>({
    queryKey: ["/api/ehr/status"],
    enabled: !isLoading && !!user && !!provider,
  });

  const { toast } = useToast();

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ehr/test-connection", {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.connected ? "Connection successful" : "Connection failed",
        description: data.message,
        variant: data.connected ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncNowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ehr/sync", {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync completed",
        description: `Processed ${data.processedClaims} claims`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics/provider"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ehr/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    await logout();
  };

  // Download functions for different formats
  const downloadCSV = () => {
    const headers = ['Claim ID', 'Patient ID', 'Date', 'Amount', 'Status', 'Risk Score', 'ICD-10', 'CPT'];
    const rows = claims.map(claim => [
      claim.id,
      anonymizePatientId(claim.patientId || ''),
      new Date(claim.submittedAt).toLocaleDateString(),
      Number(claim.claimAmount).toFixed(2),
      claim.status,
      claim.riskScore || 'N/A',
      claim.codes?.icd10?.join('; ') || 'N/A',
      claim.codes?.cpt?.join('; ') || 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claims-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadModal(false);
    toast({ title: 'CSV downloaded successfully' });
  };

  const downloadXML = () => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<claims>
${claims.map(claim => `  <claim>
    <id>${claim.id}</id>
    <patientId>${anonymizePatientId(claim.patientId || '')}</patientId>
    <date>${new Date(claim.submittedAt).toISOString()}</date>
    <amount>${Number(claim.claimAmount).toFixed(2)}</amount>
    <status>${claim.status}</status>
    <riskScore>${claim.riskScore || 'N/A'}</riskScore>
    <icd10>${claim.codes?.icd10?.map(code => `<code>${code}</code>`).join('') || '<code>N/A</code>'}</icd10>
    <cpt>${claim.codes?.cpt?.map(code => `<code>${code}</code>`).join('') || '<code>N/A</code>'}</cpt>
  </claim>`).join('\n')}
</claims>`;

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claims-export-${new Date().toISOString().split('T')[0]}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadModal(false);
    toast({ title: 'XML downloaded successfully' });
  };

  const downloadPDF = async () => {
    try {
      // Create a simple HTML table for PDF generation
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>ClaimPay Claims Report</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Patient ID</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Risk Score</th>
              </tr>
            </thead>
            <tbody>
              ${claims.map(claim => `
                <tr>
                  <td>${claim.id.substring(0, 8)}...</td>
                  <td>${anonymizePatientId(claim.patientId || '')}</td>
                  <td>${new Date(claim.submittedAt).toLocaleDateString()}</td>
                  <td>$${Number(claim.claimAmount).toFixed(2)}</td>
                  <td>${claim.status}</td>
                  <td>${claim.riskScore || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      // Use browser's print functionality to save as PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
      
      setShowDownloadModal(false);
      toast({ title: 'PDF generation initiated', description: 'Use browser print dialog to save as PDF' });
    } catch (error) {
      toast({ title: 'PDF generation failed', variant: 'destructive' });
    }
  };

  const downloadXLS = () => {
    // Create HTML table that Excel can open
    const htmlTable = `
      <table>
        <thead>
          <tr>
            <th>Claim ID</th>
            <th>Patient ID</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Risk Score</th>
            <th>ICD-10 Codes</th>
            <th>CPT Codes</th>
          </tr>
        </thead>
        <tbody>
          ${claims.map(claim => `
            <tr>
              <td>${claim.id}</td>
              <td>${anonymizePatientId(claim.patientId || '')}</td>
              <td>${new Date(claim.submittedAt).toLocaleDateString()}</td>
              <td>${Number(claim.claimAmount).toFixed(2)}</td>
              <td>${claim.status}</td>
              <td>${claim.riskScore || 'N/A'}</td>
              <td>${claim.codes?.icd10?.join(', ') || 'N/A'}</td>
              <td>${claim.codes?.cpt?.join(', ') || 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claims-export-${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadModal(false);
    toast({ title: 'Excel file downloaded successfully' });
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

    // Only make redirect decisions after auth has been checked
    if (!authChecked.current) {
      return;
    }

    if (!user) {
      setLocation("/");
      return;
    }

    // Check if user is authorized for provider dashboard
    const isAuthorized = user.role === "provider" || (impersonating && impersonatedRole === "provider");
    
    if (!isAuthorized) {
      // Redirect non-providers to their appropriate dashboard
      if (user.role === "admin" || user.role === "super_admin") {
        setLocation("/admin/dashboard");
      } else if (user.role === "bank") {
        setLocation("/bank/dashboard");
      } else {
        setLocation("/");
      }
      return;
    }

    // Only redirect to onboarding if we're sure there's no provider (and not impersonating)
    if (!impersonating && user.role === "provider" && !provider) {
      setLocation("/onboarding");
    }
  }, [user, provider, isLoading, impersonating, impersonatedRole, setLocation]);

  if (isLoading || !user || !provider) {
    return null;
  }

  const stats = (metrics as any) || {
    totalSubmitted: 0,
    totalCoded: 0,
    totalAccepted: 0,
    totalRejected: 0,
    totalPaid: 0,
    totalPaidAmount: 0,
    acceptanceRate: 0,
    avgPaymentTime: 0,
  };

  // Generate real chart data based on claims
  const chartData = (() => {
    if (!claims || claims.length === 0) {
      return [];
    }

    // Group claims by day for the last 7 days
    const today = new Date();
    const days: Array<{ date: Date; name: string; value: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: 0,
      });
    }

    // Sum up claim amounts for each day
    claims.forEach(claim => {
      const claimDate = new Date(claim.submittedAt);
      claimDate.setHours(0, 0, 0, 0);
      
      const dayIndex = days.findIndex(d => d.date.getTime() === claimDate.getTime());
      if (dayIndex !== -1 && claim.status === 'paid') {
        days[dayIndex].value += Number(claim.payoutAmount || 0);
      }
    });

    return days.map(({ name, value }) => ({ name, value }));
  })();

  const navConfig = getCustomerNavConfig(handleLogout);

  return (
    <PortalLayout 
      navConfig={navConfig}
      portalName="Provider Portal"
    >
      <div className="p-6 md:p-8">
        {/* Dashboard Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Welcome back, {provider.firstName || provider.providerName}</h1>
            <p className="mt-1 text-muted-foreground">Here's your claims overview</p>
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
              <CardTitle className="text-sm font-medium">Submitted Claims</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold" data-testid="metric-submitted">
                {stats.totalSubmitted}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalCoded} coded by AI
              </p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-chart-3" data-testid="metric-acceptance">
                {stats.acceptanceRate}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalAccepted} approved, {stats.totalRejected} rejected
              </p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-primary" data-testid="metric-paid">
                ${stats.totalPaidAmount?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalPaid} claims paid out
              </p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Payment Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-accent" data-testid="metric-payment-time">
                {stats.avgPaymentTime || 0}h
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                vs 30 days historically
              </p>
            </CardContent>
          </Card>
        </div>

        {/* EHR Integration Status */}
        {provider.ehrEnabled && ehrStatus && (
          <Card className="mb-8 border-card-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <Activity className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">EHR Integration</CardTitle>
                    <CardDescription>
                      {ehrStatus.ehrSystem} • Automatic claim processing
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={ehrStatus.ehrEnabled ? "default" : "secondary"}>
                  {ehrStatus.ehrEnabled ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-chart-3/10">
                    <Wifi className="h-4 w-4 text-chart-3" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Connection Status</p>
                    <p className="text-xs text-muted-foreground">
                      {ehrStatus.syncServiceStatus?.running ? "Online" : "Offline"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Last Sync</p>
                    <p className="text-xs text-muted-foreground">
                      {ehrStatus.lastSync
                        ? new Date(ehrStatus.lastSync).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10">
                    <FileText className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Auto-Processed</p>
                    <p className="text-xs text-muted-foreground">
                      {claims.filter((c) => c.source === "ehr_auto").length} claims
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={testConnectionMutation.isPending}
                  data-testid="button-test-ehr-connection"
                >
                  {testConnectionMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Wifi className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncNowMutation.mutate()}
                  disabled={syncNowMutation.isPending}
                  data-testid="button-sync-ehr-now"
                >
                  {syncNowMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Now
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <Card
            className="cursor-pointer border-card-border transition-shadow hover:shadow-md"
            onClick={() => setLocation("/provider/claims")}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                <FileText className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="font-medium">View Claims</h3>
                <p className="text-sm text-muted-foreground">Track claim status</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer border-card-border transition-shadow hover:shadow-md"
            onClick={() => setShowDownloadModal(true)}
            data-testid="button-download-reports"
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-4/10">
                <ArrowUpRight className="h-6 w-6 text-chart-4" />
              </div>
              <div>
                <h3 className="font-medium">Download Reports</h3>
                <p className="text-sm text-muted-foreground">Export claims data</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Revenue Chart */}
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
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
                    tickFormatter={(value) => `$${value / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Claims */}
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle>Recent Claims</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {claims.slice(0, 5).map((claim) => (
                  <div 
                    key={claim.id} 
                    className="flex items-center justify-between cursor-pointer rounded-lg p-2 -m-2 hover-elevate active-elevate-2 transition-all"
                    onClick={() => setSelectedClaim(claim)}
                    data-testid={`claim-item-${claim.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          claim.status === "paid"
                            ? "bg-chart-3/10"
                            : claim.status === "rejected"
                            ? "bg-destructive/10"
                            : "bg-primary/10"
                        }`}
                      >
                        {claim.status === "paid" ? (
                          <CheckCircle2 className="h-5 w-5 text-chart-3" />
                        ) : claim.status === "rejected" ? (
                          <XCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <Clock className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium" data-testid={`text-patient-${claim.id}`}>
                          {anonymizePatientId(claim.patientId || '')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(claim.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        ${Number(claim.claimAmount).toLocaleString()}
                      </p>
                      <Badge
                        variant={
                          claim.status === "paid"
                            ? "default"
                            : claim.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                        className="mt-1"
                      >
                        {claim.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {claims.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No claims submitted yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Claim Detail Modal with anonymized PHI */}
      {selectedClaim && (
        <ClaimDetailModal 
          claim={selectedClaim} 
          onClose={() => setSelectedClaim(null)} 
        />
      )}

      {/* Download Format Selection Modal */}
      <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Download Claims Report</DialogTitle>
            <DialogDescription>
              Select a file format to download your claims data
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-4"
              onClick={downloadCSV}
              data-testid="download-csv"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-medium">CSV (Comma Separated)</div>
                <div className="text-xs text-muted-foreground">Compatible with Excel, Google Sheets</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-4"
              onClick={downloadXLS}
              data-testid="download-xls"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
                <FileSpreadsheet className="h-5 w-5 text-chart-3" />
              </div>
              <div className="text-left">
                <div className="font-medium">Excel (XLS)</div>
                <div className="text-xs text-muted-foreground">Microsoft Excel format</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-4"
              onClick={downloadXML}
              data-testid="download-xml"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <FileCode className="h-5 w-5 text-accent" />
              </div>
              <div className="text-left">
                <div className="font-medium">XML</div>
                <div className="text-xs text-muted-foreground">Structured data format</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-4"
              onClick={downloadPDF}
              data-testid="download-pdf"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                <FileText className="h-5 w-5 text-chart-4" />
              </div>
              <div className="text-left">
                <div className="font-medium">PDF</div>
                <div className="text-xs text-muted-foreground">Portable document format</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
