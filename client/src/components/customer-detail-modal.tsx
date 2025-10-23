import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  TrendingUp,
  Users,
  CreditCard,
  CheckCircle2,
  XCircle,
  Landmark,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { UserDetailModal } from "./user-detail-modal";

interface CustomerDetailModalProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasPermission?: (action: string, resource: string) => boolean;
}

interface CustomerDetails {
  provider: {
    id: string;
    providerName: string;
    npi: string;
    tin: string;
    firstName: string | null;
    lastName: string | null;
    contactPhone: string;
    contactEmail: string;
    isActive: boolean;
    createdAt: string;
  };
  metrics: {
    totalClaims: number;
    approvedClaims: number;
    rejectedClaims: number;
    successRate: number;
    totalPayouts: number;
    totalReimbursements: number;
    netPL: number;
  };
  fundingAgreements: Array<{
    id: string;
    fundingAmount: string;
    interestRate: string;
    status: string;
    createdAt: string;
    bankContactName: string;
    bankEmail: string;
    bankInstitutionName: string;
  }>;
  teamMembers: Array<{
    id: string;
    role: string;
    invitedAt: string;
    user: User;
  }>;
  claims: any[];
  transactions: any[];
}

export function CustomerDetailModal({ customerId, open, onOpenChange, hasPermission }: CustomerDetailModalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);

  const { data: customerData, isLoading } = useQuery<CustomerDetails>({
    queryKey: [`/api/admin/customers/${customerId}`],
    enabled: open && !!customerId,
  });

  if (!customerData && !isLoading) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setUserModalOpen(true);
  };

  const provider = customerData?.provider;
  const metrics = customerData?.metrics;
  const fundingAgreements = customerData?.fundingAgreements || [];
  const teamMembers = customerData?.teamMembers || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-2xl">
                  {provider?.providerName || "Loading..."}
                </DialogTitle>
                <DialogDescription className="mt-2 flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    NPI: {provider?.npi}
                  </span>
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    TIN: {provider?.tin}
                  </span>
                  {provider?.isActive !== undefined && (
                    <Badge variant={provider.isActive ? "default" : "secondary"}>
                      {provider.isActive ? "Active" : "Inactive"}
                    </Badge>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading customer details...</div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" data-testid="tab-overview">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="metrics" data-testid="tab-metrics">
                  Metrics
                </TabsTrigger>
                <TabsTrigger value="funding" data-testid="tab-funding">
                  Funding Sources
                </TabsTrigger>
                <TabsTrigger value="team" data-testid="tab-team">
                  Team Members
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Provider Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-sm text-muted-foreground">Practice Name</div>
                        <div className="font-medium">{provider?.providerName}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Contact Person</div>
                        <div className="font-medium">
                          {provider?.firstName && provider?.lastName
                            ? `${provider.firstName} ${provider.lastName}`
                            : "Not provided"}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </div>
                        <div className="font-medium">{provider?.contactEmail}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone
                        </div>
                        <div className="font-medium">{provider?.contactPhone}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Member Since</div>
                        <div className="font-medium">
                          {provider?.createdAt
                            ? formatDistanceToNow(new Date(provider.createdAt), { addSuffix: true })
                            : "N/A"}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <Badge variant={provider?.isActive ? "default" : "secondary"}>
                          {provider?.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Quick Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-lg border border-border bg-card p-4">
                        <div className="text-2xl font-semibold">{metrics?.totalClaims || 0}</div>
                        <div className="text-sm text-muted-foreground">Total Claims</div>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-4">
                        <div className="text-2xl font-semibold text-primary">
                          {metrics?.successRate?.toFixed(1) || 0}%
                        </div>
                        <div className="text-sm text-muted-foreground">Success Rate</div>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-4">
                        <div className="text-2xl font-semibold">
                          {formatCurrency(metrics?.totalPayouts || 0)}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Paid</div>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-4">
                        <div className="text-2xl font-semibold">
                          {formatCurrency(metrics?.totalReimbursements || 0)}
                        </div>
                        <div className="text-sm text-muted-foreground">Reimbursed</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="metrics" className="mt-6 space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        Claims Performance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Submitted</span>
                        <span className="font-semibold">{metrics?.totalClaims || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Approved</span>
                        <span className="font-semibold text-primary">
                          {metrics?.approvedClaims || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Rejected</span>
                        <span className="font-semibold text-destructive">
                          {metrics?.rejectedClaims || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-4">
                        <span className="text-sm font-medium">Success Rate</span>
                        <span className="text-xl font-semibold text-primary">
                          {metrics?.successRate?.toFixed(1) || 0}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-accent" />
                        Financial Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Paid Out</span>
                        <span className="font-semibold">
                          {formatCurrency(metrics?.totalPayouts || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Reimbursed</span>
                        <span className="font-semibold text-primary">
                          {formatCurrency(metrics?.totalReimbursements || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-4">
                        <span className="text-sm font-medium">Net P&L</span>
                        <span
                          className={`text-xl font-semibold ${
                            (metrics?.netPL || 0) >= 0 ? "text-primary" : "text-destructive"
                          }`}
                        >
                          {formatCurrency(metrics?.netPL || 0)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="funding" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Landmark className="h-5 w-5" />
                      Funding Sources ({fundingAgreements.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {fundingAgreements.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No funding sources available
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bank Institution</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Funding Amount</TableHead>
                            <TableHead>Interest Rate</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fundingAgreements.map((fa) => (
                            <TableRow key={fa.id} data-testid={`funding-row-${fa.id}`}>
                              <TableCell>
                                <div className="font-medium">{fa.bankInstitutionName}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{fa.bankContactName}</div>
                                <div className="text-xs text-muted-foreground">{fa.bankEmail}</div>
                              </TableCell>
                              <TableCell className="font-semibold">
                                {formatCurrency(Number(fa.fundingAmount))}
                              </TableCell>
                              <TableCell>{Number(fa.interestRate).toFixed(2)}%</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    fa.status === "active"
                                      ? "default"
                                      : fa.status === "settled"
                                      ? "secondary"
                                      : "outline"
                                  }
                                >
                                  {fa.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(fa.createdAt), { addSuffix: true })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="team" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Team Members ({teamMembers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {teamMembers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No team members found
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Invited</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamMembers.map((tm) => (
                            <TableRow
                              key={tm.id}
                              className="cursor-pointer hover-elevate"
                              onClick={() => handleUserClick(tm.user)}
                              data-testid={`team-member-row-${tm.id}`}
                            >
                              <TableCell>
                                <div className="font-medium">
                                  {tm.user.firstName && tm.user.lastName
                                    ? `${tm.user.firstName} ${tm.user.lastName}`
                                    : tm.user.username}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {tm.user.email || tm.user.username}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{tm.role}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    tm.user.status === "approved"
                                      ? "default"
                                      : tm.user.status === "suspended"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {tm.user.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(tm.invitedAt), { addSuffix: true })}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUserClick(tm.user);
                                  }}
                                  data-testid={`button-view-user-${tm.id}`}
                                >
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <UserDetailModal
        user={selectedUser}
        open={userModalOpen}
        onOpenChange={setUserModalOpen}
        hasPermission={hasPermission}
      />
    </>
  );
}
