import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Eye, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Claim, DateRange } from "@shared/schema";
import { anonymizePatientId } from "@shared/phi-utils";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { PortalLayout } from "@/components/portal-layout";
import { getCustomerNavConfig } from "@/config/nav-config";
import { useAuth } from "@/lib/auth";

export default function ClaimsList() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("day");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // When filtering is active, fetch all claims to ensure complete results
  const isFiltering = searchQuery !== "" || statusFilter !== "all";
  const fetchLimit = isFiltering ? 1000 : itemsPerPage;
  const fetchPage = isFiltering ? 1 : currentPage;

  const { data, isLoading } = useQuery<{
    claims: Claim[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ["/api/claims", dateRange, fetchPage, fetchLimit],
    queryFn: async () => {
      const res = await fetch(`/api/claims?range=${dateRange}&page=${fetchPage}&limit=${fetchLimit}`);
      if (!res.ok) throw new Error('Failed to fetch claims');
      return res.json();
    },
    placeholderData: (previousData) => previousData,
  });

  const claims = data?.claims || [];
  
  // Memoized filter handlers to prevent pagination reset on background refetch
  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handleStatusChange = useCallback((status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  }, []);

  // Memoized filtered claims to prevent unnecessary recalculations
  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      const anonymized = anonymizePatientId(claim.patientId || '');
      const matchesSearch =
        anonymized.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.patientId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || claim.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [claims, searchQuery, statusFilter]);

  // Calculate pagination for filtered results
  const totalPages = isFiltering
    ? Math.ceil(filteredClaims.length / itemsPerPage)
    : (data?.totalPages || 1);
  
  const paginatedClaims = isFiltering
    ? filteredClaims.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredClaims;
  
  // Calculate display indices for pagination text
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + paginatedClaims.length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "default";
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      case "submitted":
      case "coding":
      case "coded":
      case "risk_check":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const { logout } = useAuth();
  const handleLogout = () => logout();
  const navConfig = getCustomerNavConfig(handleLogout);

  return (
    <PortalLayout 
      navConfig={navConfig}
      portalName="Provider Portal"
    >
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/provider/dashboard")}
          data-testid="button-back-dashboard"
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">All Claims</h1>
            <p className="mt-2 text-muted-foreground">Track and manage your submitted claims</p>
          </div>
          <Tabs value={dateRange} onValueChange={(v) => handleDateRangeChange(v as DateRange)}>
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

        <Card className="border-card-border">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Claims History</CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by patient ID or claim ID..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-claims"
                  />
                </div>
                <Select value={statusFilter} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="coding">Coding</SelectItem>
                    <SelectItem value="coded">Coded</SelectItem>
                    <SelectItem value="risk_check">Risk Check</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="mt-4 text-sm text-muted-foreground">Loading claims...</p>
              </div>
            ) : filteredClaims.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "No claims match your filters"
                    : "No claims submitted yet"}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient ID (Anonymized)</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Risk Score</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedClaims.map((claim) => (
                        <TableRow 
                          key={claim.id} 
                          data-testid={`row-claim-${claim.id}`}
                          className="cursor-pointer hover-elevate active-elevate-2"
                          onClick={() => setSelectedClaim(claim)}
                        >
                          <TableCell className="font-medium font-mono">
                            {anonymizePatientId(claim.patientId || '')}
                          </TableCell>
                          <TableCell>${Number(claim.claimAmount).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(claim.status)}>
                              {claim.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {claim.riskScore ? (
                              <span
                                className={`font-medium ${
                                  claim.riskScore >= 80
                                    ? "text-chart-3"
                                    : claim.riskScore >= 60
                                    ? "text-chart-4"
                                    : "text-destructive"
                                }`}
                              >
                                {claim.riskScore}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(claim.submittedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClaim(claim);
                              }}
                              data-testid={`button-view-claim-${claim.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredClaims.length)} of {filteredClaims.length} claims
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Claim Detail Modal with anonymized PHI */}
      {selectedClaim && (
        <ClaimDetailModal 
          claim={selectedClaim} 
          onClose={() => setSelectedClaim(null)} 
        />
      )}
    </PortalLayout>
  );
}
