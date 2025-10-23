import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Mail, UserPlus, CheckCircle, XCircle, Clock, DollarSign, 
  Building2, Landmark, Users, LogOut, Search, Download, 
  MoreHorizontal, Shield, Ban, RefreshCw, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserDetailModal } from "@/components/user-detail-modal";
import { PortalLayout } from "@/components/portal-layout";
import { getInternalNavConfig } from "@/config/nav-config";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "bank"]),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface PendingInvitation {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

export default function AdminUsers() {
  const [, setLocation] = useLocation();
  const { user, logout, hasPermission, impersonating, impersonatedRole } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [bulkActionDialog, setBulkActionDialog] = useState<'suspend' | 'activate' | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'role' | 'status' | 'lastLogin'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<User | null>(null);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "admin",
    },
  });

  const { data: pendingInvitations = [] } = useQuery<PendingInvitation[]>({
    queryKey: ["/api/invitations/pending"],
    enabled: !impersonating,
  });

  const { data: statsData } = useQuery<{
    total: number;
    active: number;
    suspended: number;
    pending: number;
    byRole: { admin: number; bank: number; provider: number };
  }>({
    queryKey: ["/api/admin/users/stats"],
    enabled: !impersonating,
  });

  const { data: usersData, isLoading } = useQuery<{
    users: User[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: [
      "/api/admin/users",
      searchTerm,
      userTypeFilter,
      statusFilter,
      page,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (userTypeFilter !== 'all') params.append('userType', userTypeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('page', page.toString());
      params.append('limit', '20');
      
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: !impersonating,
  });

  const { data: teamMembers = [], isLoading: teamMembersLoading } = useQuery<any[]>({
    queryKey: ["/api/team-members", impersonating],
    enabled: impersonating && impersonatedRole === 'provider',
  });

  const users = usersData?.users || [];
  const totalPages = usersData?.totalPages || 1;
  const total = usersData?.total || 0;

  const filteredTeamMembers = teamMembers
    .filter(member => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        member.firstName?.toLowerCase().includes(searchLower) ||
        member.lastName?.toLowerCase().includes(searchLower) ||
        member.email?.toLowerCase().includes(searchLower);
      
      const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

  const sortedUsers = [...users].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;
    
    switch (sortBy) {
      case 'name':
        aVal = a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : a.username;
        bVal = b.firstName && b.lastName ? `${b.firstName} ${b.lastName}` : b.username;
        break;
      case 'email':
        aVal = a.email;
        bVal = b.email;
        break;
      case 'role':
        aVal = a.role;
        bVal = b.role;
        break;
      case 'status':
        aVal = a.status;
        bVal = b.status;
        break;
      case 'lastLogin':
        aVal = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        bVal = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        break;
      default:
        return 0;
    }
    
    if (aVal === bVal) return 0;
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      return apiRequest("POST", "/api/invitations/send", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Invitation sent",
        description: "The invitation email has been sent successfully.",
      });
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/invitations/approve/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User approved",
        description: "The user has been approved and can now access the platform.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve user",
        variant: "destructive",
      });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/invitations/deny/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User denied",
        description: "The user has been denied access to the platform.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deny user",
        variant: "destructive",
      });
    },
  });

  const bulkSuspendMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("POST", "/api/admin/users/bulk-suspend", { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUsers([]);
      setBulkActionDialog(null);
      toast({
        title: "Users suspended",
        description: `Successfully suspended ${selectedUsers.length} user(s).`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to suspend users",
        variant: "destructive",
      });
    },
  });

  const bulkActivateMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("POST", "/api/admin/users/bulk-activate", { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUsers([]);
      setBulkActionDialog(null);
      toast({
        title: "Users activated",
        description: `Successfully activated ${selectedUsers.length} user(s).`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to activate users",
        variant: "destructive",
      });
    },
  });

  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams({
        ...(userTypeFilter !== 'all' && { userType: userTypeFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm }),
      });
      
      const response = await fetch(`/api/admin/users/export?${queryParams}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'users-export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      toast({
        title: "Export successful",
        description: "User data has been exported to CSV.",
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message || "Failed to export users",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const onSubmit = (data: InviteFormData) => {
    inviteMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Mail className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Awaiting Approval
          </Badge>
        );
      case "approved":
        return (
          <Badge className="gap-1 bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-3 w-3" />
            Active
          </Badge>
        );
      case "suspended":
        return (
          <Badge variant="destructive" className="gap-1">
            <Ban className="h-3 w-3" />
            Suspended
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
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
      <div className="p-6 md:p-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" data-testid="text-page-title">
              {impersonating ? "Team Members" : "User Management"}
            </h1>
            {!impersonating && (
              <div className="flex gap-2">
                {hasPermission("read", "user") && (
                  <Button variant="outline" onClick={handleExport} data-testid="button-export">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                )}
                {hasPermission("invite", "user") && (
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-invite-user">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite User
                      </Button>
                    </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite New User</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="user@example.com"
                                data-testid="input-email"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="John"
                                data-testid="input-firstname"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Doe"
                                data-testid="input-lastname"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-role">
                                  <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="admin" data-testid="option-admin">Admin</SelectItem>
                                <SelectItem value="bank" data-testid="option-bank">Bank Partner</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={inviteMutation.isPending}
                        data-testid="button-send-invitation"
                      >
                        {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              )}
              </div>
            )}
          </div>

          {!impersonating && pendingInvitations.length > 0 && hasPermission("approve", "invitation") && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Approvals ({pendingInvitations.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`approval-item-${invitation.id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold" data-testid={`text-name-${invitation.id}`}>
                            {invitation.firstName} {invitation.lastName}
                          </h4>
                          {getStatusBadge(invitation.status)}
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-email-${invitation.id}`}>
                          {invitation.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Role: <span className="capitalize">{invitation.role}</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(invitation.id)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${invitation.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => denyMutation.mutate(invitation.id)}
                          disabled={denyMutation.isPending}
                          data-testid={`button-deny-${invitation.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!impersonating && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-users">
                    {statsData?.total || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-active-users">
                    {statsData?.active || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Suspended Users</CardTitle>
                  <Ban className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-suspended-users">
                    {statsData?.suspended || 0}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {impersonating && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Team Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-members">
                    {teamMembers.length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Members</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-active-members">
                    {teamMembers.filter(m => m.status === 'active').length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-pending-members">
                    {teamMembers.filter(m => m.status === 'pending').length}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{impersonating ? "All Team Members" : "All Users"}</CardTitle>
                {!impersonating && selectedUsers.length > 0 && hasPermission("update", "user") && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkActionDialog('suspend')}
                      data-testid="button-bulk-suspend"
                    >
                      <Ban className="h-4 w-4 mr-1" />
                      Suspend ({selectedUsers.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkActionDialog('activate')}
                      data-testid="button-bulk-activate"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Activate ({selectedUsers.length})
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={impersonating ? "Search team members..." : "Search users..."}
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                      className="pl-9"
                      data-testid="input-search"
                    />
                  </div>
                  {!impersonating && (
                    <Select
                      value={userTypeFilter}
                      onValueChange={(value) => {
                        setUserTypeFilter(value);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[180px]" data-testid="select-user-type">
                        <SelectValue placeholder="User Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="provider">Provider</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[180px]" data-testid="select-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="approved">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedUsers.length === users.length && users.length > 0}
                            onCheckedChange={toggleAllUsers}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('name')}
                            className="-ml-3 h-8 data-testid='sort-name'"
                          >
                            User
                            {sortBy === 'name' ? (
                              sortOrder === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="ml-2 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('role')}
                            className="-ml-3 h-8"
                            data-testid="sort-role"
                          >
                            Role
                            {sortBy === 'role' ? (
                              sortOrder === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="ml-2 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>Internal Role</TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('status')}
                            className="-ml-3 h-8"
                            data-testid="sort-status"
                          >
                            Status
                            {sortBy === 'status' ? (
                              sortOrder === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="ml-2 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('lastLogin')}
                            className="-ml-3 h-8"
                            data-testid="sort-last-login"
                          >
                            Last Login
                            {sortBy === 'lastLogin' ? (
                              sortOrder === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="ml-2 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(impersonating ? teamMembersLoading : isLoading) ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">
                            {impersonating ? "Loading team members..." : "Loading users..."}
                          </TableCell>
                        </TableRow>
                      ) : impersonating ? (
                        filteredTeamMembers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center" data-testid="text-no-users">
                              No team members found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredTeamMembers.map((u) => (
                            <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                              <TableCell>
                                <Checkbox
                                  checked={false}
                                  disabled
                                  data-testid={`checkbox-user-${u.id}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback>
                                      {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium" data-testid={`text-name-${u.id}`}>
                                      {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email}
                                    </div>
                                    <div className="text-sm text-muted-foreground" data-testid={`text-email-${u.id}`}>
                                      {u.email}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {u.internalRole?.replace('_', ' ') || 'Team Member'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">-</span>
                              </TableCell>
                              <TableCell>{getStatusBadge(u.status)}</TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm text-muted-foreground">-</span>
                              </TableCell>
                            </TableRow>
                          ))
                        )
                      ) : sortedUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center" data-testid="text-no-users">
                            No users found
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedUsers.map((u) => (
                          <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedUsers.includes(u.id)}
                                onCheckedChange={() => toggleUserSelection(u.id)}
                                data-testid={`checkbox-user-${u.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {(u.firstName?.[0] || u.username[0]).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium" data-testid={`text-name-${u.id}`}>
                                    {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username}
                                  </div>
                                  <div className="text-sm text-muted-foreground" data-testid={`text-email-${u.id}`}>
                                    {u.email}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                                {u.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {u.internalRole ? (
                                <Badge variant="outline" className="capitalize">
                                  <Shield className="h-3 w-3 mr-1" />
                                  {u.internalRole.replace('_', ' ')}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(u.status)}</TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-actions-${u.id}`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setSelectedUserForDetails(u)}
                                    data-testid={`menu-view-details-${u.id}`}
                                  >
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setSelectedUserForDetails(u)}
                                    data-testid={`menu-edit-user-${u.id}`}
                                  >
                                    Edit User
                                  </DropdownMenuItem>
                                  {u.status === 'approved' ? (
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => {
                                        setSelectedUsers([u.id]);
                                        setBulkActionDialog('suspend');
                                      }}
                                      data-testid={`menu-suspend-${u.id}`}
                                    >
                                      Suspend User
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedUsers([u.id]);
                                        setBulkActionDialog('activate');
                                      }}
                                      data-testid={`menu-activate-${u.id}`}
                                    >
                                      Activate User
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {!impersonating && totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {totalPages} ({total} total users)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        data-testid="button-next-page"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={bulkActionDialog === 'suspend'} onOpenChange={(open) => !open && setBulkActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Users</DialogTitle>
            <DialogDescription>
              Are you sure you want to suspend {selectedUsers.length} user(s)? They will lose access to the platform.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => bulkSuspendMutation.mutate(selectedUsers)}
              disabled={bulkSuspendMutation.isPending}
            >
              {bulkSuspendMutation.isPending ? "Suspending..." : "Suspend Users"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkActionDialog === 'activate'} onOpenChange={(open) => !open && setBulkActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate Users</DialogTitle>
            <DialogDescription>
              Are you sure you want to activate {selectedUsers.length} user(s)? They will regain access to the platform.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionDialog(null)}>Cancel</Button>
            <Button
              onClick={() => bulkActivateMutation.mutate(selectedUsers)}
              disabled={bulkActivateMutation.isPending}
            >
              {bulkActivateMutation.isPending ? "Activating..." : "Activate Users"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        <UserDetailModal
          user={selectedUserForDetails}
          open={!!selectedUserForDetails}
          onOpenChange={(open) => !open && setSelectedUserForDetails(null)}
          onUserUpdate={(updatedUser) => setSelectedUserForDetails(updatedUser)}
          hasPermission={hasPermission}
        />
    </PortalLayout>
  );
}
