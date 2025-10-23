import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
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
import { Activity, Building2, DollarSign, LogOut, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import edellaLogo from "@assets/edella-logo@3x_1760044169163.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PortalLayout } from "@/components/portal-layout";
import { getBankNavConfig } from "@/config/nav-config";

interface FundingAgreement {
  id: string;
  providerId: string;
  fundingAmount: number;
  feeRate: number;
  status: string;
  fundedAt: string;
  settledAt: string | null;
  providerName: string;
  npi: string;
}

export default function BankProviders() {
  const [, setLocation] = useLocation();
  const { user, logout, impersonating, impersonatedRole } = useAuth();
  
  const { data: fundingAgreements = [], isLoading } = useQuery<FundingAgreement[]>({
    queryKey: ["/api/bank/providers"],
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
      user.role === "bank" ||
      (impersonating && impersonatedRole === "bank")
    );

    if (user && !isAuthorized) {
      setLocation("/");
    }
  }, [user, impersonating, impersonatedRole, setLocation]);

  // Render guard - don't render until we have user data
  if (!user) {
    return null;
  }

  const totalFunded = fundingAgreements.reduce((sum, fa) => sum + Number(fa.fundingAmount), 0);
  const activeFunding = fundingAgreements
    .filter(fa => fa.status === 'active')
    .reduce((sum, fa) => sum + Number(fa.fundingAmount), 0);

  const navConfig = getBankNavConfig(handleLogout);

  return (
    <PortalLayout 
      navConfig={navConfig}
      portalName="Bank Portal"
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Funded Providers</h1>
          {!isLoading && (
            <div className="flex gap-3">
              <Badge variant="secondary" data-testid="badge-total-funded">
                Total Funded: {formatCurrency(totalFunded)}
              </Badge>
              <Badge variant="default" data-testid="badge-active-funding">
                Active: {formatCurrency(activeFunding)}
              </Badge>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-muted-foreground" data-testid="text-loading">Loading providers...</div>
        ) : (

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>NPI</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Funding Amount</TableHead>
              <TableHead className="text-right">Fee Rate</TableHead>
              <TableHead>Funded Date</TableHead>
              <TableHead>Settled Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fundingAgreements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground" data-testid="text-no-providers">
                  No funded providers found
                </TableCell>
              </TableRow>
            ) : (
              fundingAgreements.map((agreement) => (
                <TableRow
                  key={agreement.id}
                  data-testid={`row-agreement-${agreement.id}`}
                  className="hover-elevate cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div className="font-medium" data-testid={`text-provider-name-${agreement.id}`}>
                        {agreement.providerName}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`text-npi-${agreement.id}`}>{agreement.npi}</TableCell>
                  <TableCell>
                    <Badge
                      variant={agreement.status === 'active' ? 'default' : 'secondary'}
                      data-testid={`badge-status-${agreement.id}`}
                    >
                      {agreement.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium" data-testid={`text-amount-${agreement.id}`}>
                    {formatCurrency(Number(agreement.fundingAmount))}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-fee-rate-${agreement.id}`}>
                    {Number(agreement.feeRate)}%
                  </TableCell>
                  <TableCell className="text-muted-foreground" data-testid={`text-funded-date-${agreement.id}`}>
                    {formatDistanceToNow(new Date(agreement.fundedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-muted-foreground" data-testid={`text-settled-date-${agreement.id}`}>
                    {agreement.settledAt
                      ? formatDistanceToNow(new Date(agreement.settledAt), { addSuffix: true })
                      : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
        )}
      </div>
    </PortalLayout>
  );
}
