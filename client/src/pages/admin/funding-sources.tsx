import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
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
import { Landmark } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PortalLayout } from "@/components/portal-layout";
import { getInternalNavConfig } from "@/config/nav-config";

interface FundingSource {
  id: string;
  name: string;
  email: string;
  totalFunded: number;
  activeFunding: number;
  settledFunding: number;
  totalProviders: number;
  createdAt: string;
}

export default function AdminFundingSources() {
  const [, setLocation] = useLocation();
  const { user, logout, impersonating, impersonatedRole } = useAuth();
  
  const { data: fundingSources = [], isLoading } = useQuery<FundingSource[]>({
    queryKey: ["/api/admin/funding-sources"],
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

  const totalFundedAcrossAll = fundingSources.reduce((sum, fs) => sum + fs.totalFunded, 0);
  const activeFundingAcrossAll = fundingSources.reduce((sum, fs) => sum + fs.activeFunding, 0);
  
  const navConfig = getInternalNavConfig(handleLogout);

  return (
    <PortalLayout navConfig={navConfig} portalName="Internal Portal">
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Funding Sources</h1>
          {!isLoading && (
            <div className="flex gap-3">
              <Badge variant="secondary" data-testid="badge-total-funded">
                Total Funded: {formatCurrency(totalFundedAcrossAll)}
              </Badge>
              <Badge variant="default" data-testid="badge-active-funding">
                Active: {formatCurrency(activeFundingAcrossAll)}
              </Badge>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-muted-foreground" data-testid="text-loading">Loading funding sources...</div>
        ) : (

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bank Partner</TableHead>
              <TableHead className="text-right">Total Funded</TableHead>
              <TableHead className="text-right">Active Funding</TableHead>
              <TableHead className="text-right">Settled Funding</TableHead>
              <TableHead className="text-right">Providers</TableHead>
              <TableHead>Partner Since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fundingSources.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground" data-testid="text-no-sources">
                  No funding sources found
                </TableCell>
              </TableRow>
            ) : (
              fundingSources.map((source) => (
                <TableRow
                  key={source.id}
                  data-testid={`row-source-${source.id}`}
                  className="hover-elevate cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium" data-testid={`text-bank-name-${source.id}`}>
                          {source.name}
                        </div>
                        <div className="text-sm text-muted-foreground" data-testid={`text-email-${source.id}`}>
                          {source.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium" data-testid={`text-total-funded-${source.id}`}>
                    {formatCurrency(source.totalFunded)}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-active-funding-${source.id}`}>
                    <span className="text-green-600 dark:text-green-400">
                      {formatCurrency(source.activeFunding)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-settled-funding-${source.id}`}>
                    <span className="text-blue-600 dark:text-blue-400">
                      {formatCurrency(source.settledFunding)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-providers-${source.id}`}>
                    <Badge variant="secondary">{source.totalProviders}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground" data-testid={`text-joined-${source.id}`}>
                    {formatDistanceToNow(new Date(source.createdAt), { addSuffix: true })}
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
