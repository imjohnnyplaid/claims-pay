import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CustomerDetailModal } from "@/components/customer-detail-modal";
import { PortalLayout } from "@/components/portal-layout";
import { getInternalNavConfig } from "@/config/nav-config";

interface Customer {
  id: string;
  providerName: string;
  npi: string;
  contactEmail: string;
  isActive: boolean;
  totalClaims: number;
  approvedClaims: number;
  rejectedClaims: number;
  totalPayouts: number;
  totalReimbursements: number;
  netPL: number;
  createdAt: string;
}

export default function AdminCustomers() {
  const [, setLocation] = useLocation();
  const { user, logout, hasPermission, impersonating, impersonatedRole } = useAuth();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/admin/customers"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleLogout = async () => {
    await logout();
  };

  useEffect(() => {
    const isAuthorized = user && (
      user.role === "admin" || 
      user.role === "super_admin" ||
      (impersonating && (impersonatedRole === "admin" || impersonatedRole === "super_admin"))
    );

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
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Customers</h1>
          {!isLoading && (
            <Badge variant="secondary" data-testid="badge-customer-count">
              {customers.length} Total Customers
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="text-muted-foreground" data-testid="text-loading">Loading customers...</div>
        ) : (
          <Card>
            <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>NPI</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Claims</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead className="text-right">Rejected</TableHead>
              <TableHead className="text-right">Total Payouts</TableHead>
              <TableHead className="text-right">Reimbursements</TableHead>
              <TableHead className="text-right">Net P&L</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground" data-testid="text-no-customers">
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  data-testid={`row-customer-${customer.id}`}
                  className="hover-elevate cursor-pointer"
                  onClick={() => {
                    setSelectedCustomerId(customer.id);
                    setCustomerModalOpen(true);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium" data-testid={`text-provider-name-${customer.id}`}>
                          {customer.providerName}
                        </div>
                        <div className="text-sm text-muted-foreground" data-testid={`text-email-${customer.id}`}>
                          {customer.contactEmail}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`text-npi-${customer.id}`}>{customer.npi}</TableCell>
                  <TableCell>
                    {customer.isActive ? (
                      <Badge variant="default" className="gap-1" data-testid={`badge-status-${customer.id}`}>
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1" data-testid={`badge-status-${customer.id}`}>
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-total-claims-${customer.id}`}>
                    {customer.totalClaims}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-approved-${customer.id}`}>
                    <span className="text-green-600 dark:text-green-400">{customer.approvedClaims}</span>
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-rejected-${customer.id}`}>
                    <span className="text-red-600 dark:text-red-400">{customer.rejectedClaims}</span>
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-payouts-${customer.id}`}>
                    {formatCurrency(customer.totalPayouts)}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-reimbursements-${customer.id}`}>
                    {formatCurrency(customer.totalReimbursements)}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-net-pl-${customer.id}`}>
                    <span className={customer.netPL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {formatCurrency(customer.netPL)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground" data-testid={`text-joined-${customer.id}`}>
                    {formatDistanceToNow(new Date(customer.createdAt), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
        )}

        <CustomerDetailModal
          customerId={selectedCustomerId}
          open={customerModalOpen}
          onOpenChange={setCustomerModalOpen}
          hasPermission={hasPermission}
        />
      </div>
    </PortalLayout>
  );
}
