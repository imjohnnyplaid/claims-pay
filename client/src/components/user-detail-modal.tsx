import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  User as UserIcon,
  Shield,
  Activity,
  Building2,
  CheckCircle,
  Ban,
  Clock,
  Mail,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserDetailModalProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdate?: (user: User) => void;
  hasPermission?: (action: string, resource: string) => boolean;
}

export function UserDetailModal({ user, open, onOpenChange, onUserUpdate, hasPermission }: UserDetailModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<Partial<User>>({});

  const { data: auditLogs = { logs: [], total: 0 } } = useQuery<{
    logs: any[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: [`/api/admin/audit-logs?targetId=${user?.id}&limit=10`],
    enabled: open && !!user?.id && activeTab === "activity",
  });

  const { data: permissions = [] } = useQuery<{ permission: string }[]>({
    queryKey: [`/api/admin/users/${user?.id}/permissions`],
    enabled: open && !!user?.id && activeTab === "permissions",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      return apiRequest("PUT", `/api/admin/users/${user?.id}`, data);
    },
    onSuccess: (updatedUser: User) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      if (onUserUpdate) {
        onUserUpdate(updatedUser);
      }
      setIsEditing(false);
      setEditedUser({});
      toast({
        title: "User updated",
        description: "User information has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  const handleSave = () => {
    const payload: Partial<User> = {};
    
    if (editedUser.firstName !== undefined) payload.firstName = editedUser.firstName;
    if (editedUser.lastName !== undefined) payload.lastName = editedUser.lastName;
    if (editedUser.email !== undefined) payload.email = editedUser.email;
    if (editedUser.status !== undefined) payload.status = editedUser.status;
    
    updateMutation.mutate(payload);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedUser({});
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
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
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            User Details
          </DialogTitle>
          <DialogDescription>
            View and manage user information, permissions, and activity
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" data-testid="tab-profile">
              <UserIcon className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="permissions" data-testid="tab-permissions">
              <Shield className="h-4 w-4 mr-2" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">
              <Activity className="h-4 w-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="portal-data" data-testid="tab-portal-data">
              <Building2 className="h-4 w-4 mr-2" />
              Portal Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>User Information</CardTitle>
                  {hasPermission && hasPermission("update", "user") && (
                    !isEditing ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditing(true);
                          setEditedUser({
                            ...user,
                            firstName: user.firstName || "",
                            lastName: user.lastName || "",
                          });
                        }}
                        data-testid="button-edit-user"
                      >
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancel}
                          data-testid="button-cancel-edit"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={updateMutation.isPending}
                          data-testid="button-save-user"
                        >
                          {updateMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    {isEditing ? (
                      <Input
                        id="firstName"
                        value={editedUser.firstName || ""}
                        onChange={(e) =>
                          setEditedUser({ ...editedUser, firstName: e.target.value })
                        }
                        data-testid="input-edit-firstname"
                      />
                    ) : (
                      <p className="text-sm" data-testid="text-firstname">
                        {user.firstName || "-"}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    {isEditing ? (
                      <Input
                        id="lastName"
                        value={editedUser.lastName || ""}
                        onChange={(e) =>
                          setEditedUser({ ...editedUser, lastName: e.target.value })
                        }
                        data-testid="input-edit-lastname"
                      />
                    ) : (
                      <p className="text-sm" data-testid="text-lastname">
                        {user.lastName || "-"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  {isEditing ? (
                    <Input
                      id="email"
                      type="email"
                      value={editedUser.email || ""}
                      onChange={(e) =>
                        setEditedUser({ ...editedUser, email: e.target.value })
                      }
                      data-testid="input-edit-email"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm" data-testid="text-email">
                        {user.email}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <p className="text-sm" data-testid="text-username">
                      {user.username}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>User ID</Label>
                    <p className="text-sm font-mono text-xs" data-testid="text-user-id">
                      {user.id}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Badge variant="default" className="capitalize">
                      {user.role}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>Internal Role</Label>
                    {user.internalRole ? (
                      <Badge variant="outline" className="capitalize">
                        <Shield className="h-3 w-3 mr-1" />
                        {user.internalRole.replace("_", " ")}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    {isEditing ? (
                      <Select
                        value={editedUser.status || user.status}
                        onValueChange={(value) =>
                          setEditedUser({ ...editedUser, status: value })
                        }
                      >
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div>{getStatusBadge(user.status)}</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Last Login</Label>
                    <p className="text-sm" data-testid="text-last-login">
                      {user.lastLogin
                        ? formatDistanceToNow(new Date(user.lastLogin), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Created At</Label>
                  <p className="text-sm" data-testid="text-created-at">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleString()
                      : "-"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>User Permissions</CardTitle>
                <DialogDescription>
                  Permissions are derived from the user's role
                </DialogDescription>
              </CardHeader>
              <CardContent>
                {permissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-permissions">
                    No permissions found for this user
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {permissions.map((p, idx) => (
                      <Badge key={idx} variant="outline" className="justify-start">
                        <Shield className="h-3 w-3 mr-2" />
                        {p.permission}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <DialogDescription>
                  Last 10 actions related to this user
                </DialogDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-activity">
                    No recent activity
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>IP Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.logs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">{log.action}</TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(log.createdAt), {
                              addSuffix: true,
                            })}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.ipAddress || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="portal-data" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Portal-Specific Data</CardTitle>
                <DialogDescription>
                  Additional data based on user role
                </DialogDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Portal data will be displayed here based on user type (provider, bank, etc.)
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
