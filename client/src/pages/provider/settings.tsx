import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  User,
  Phone,
  Database,
  Building2,
  Users,
  Bell,
  Settings as SettingsIcon,
  Trash2,
  DollarSign,
  Beaker,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EHREmulatorPanel } from "@/components/ehr-emulator-panel";
import { PortalLayout } from "@/components/portal-layout";
import { getCustomerNavConfig } from "@/config/nav-config";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, provider, logout } = useAuth();
  const { toast } = useToast();
  const [deleteTeamMemberId, setDeleteTeamMemberId] = useState<string | null>(null);

  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/team-members"],
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { email?: string; password?: string }) => {
      const res = await apiRequest("PUT", "/api/user", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User information updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", "/api/provider/settings", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteTeamMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/team-members/${id}`, {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Team member removed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      setDeleteTeamMemberId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Remove failed", description: error.message, variant: "destructive" });
    },
  });

  const updateTeamMemberMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await apiRequest("PUT", `/api/team-members/${id}`, { role });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Access level updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const [userForm, setUserForm] = useState({
    email: user?.email || "",
    password: "",
    confirmPassword: "",
  });

  const [contactForm, setContactForm] = useState({
    firstName: provider?.firstName || "",
    lastName: provider?.lastName || "",
    contactPhone: provider?.contactPhone || "",
    contactEmail: provider?.contactEmail || "",
  });

  const [ehrForm, setEhrForm] = useState({
    ehrSystem: provider?.ehrSystem || "",
    ehrApiEndpoint: provider?.ehrApiEndpoint || "",
    ehrClientId: provider?.ehrClientId || "",
    ehrClientSecret: "",
    ehrEnabled: provider?.ehrEnabled || false,
  });

  const [bankForm, setBankForm] = useState({
    bankRoutingNumber: provider?.bankRoutingNumber || "",
    bankAccountNumber: "",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: provider?.notificationSettings?.emailNotifications ?? true,
    claimStatusUpdates: provider?.notificationSettings?.claimStatusUpdates ?? true,
    paymentConfirmations: provider?.notificationSettings?.paymentConfirmations ?? true,
    weeklyReports: provider?.notificationSettings?.weeklyReports ?? false,
  });

  const [thresholdSettings, setThresholdSettings] = useState({
    interval: provider?.instantPaymentThreshold?.interval || "daily",
    claimLimitType: provider?.instantPaymentThreshold?.claimLimitType || "percentage",
    claimLimitValue: provider?.instantPaymentThreshold?.claimLimitValue || 25,
  });

  if (!user || !provider) {
    return null;
  }

  const handleUserUpdate = () => {
    if (userForm.password && userForm.password !== userForm.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    const updates: any = {};
    if (userForm.email !== user.email) updates.email = userForm.email;
    if (userForm.password) updates.password = userForm.password;

    if (Object.keys(updates).length > 0) {
      updateUserMutation.mutate(updates);
    }
  };

  const handleContactUpdate = () => {
    updateProviderMutation.mutate(contactForm);
  };

  const handleEhrUpdate = () => {
    const updates: any = { ...ehrForm };
    if (!ehrForm.ehrClientSecret) delete updates.ehrClientSecret;
    updateProviderMutation.mutate(updates);
  };

  const handleBankUpdate = () => {
    const updates: any = {};
    if (bankForm.bankRoutingNumber) updates.bankRoutingNumber = bankForm.bankRoutingNumber;
    if (bankForm.bankAccountNumber) updates.bankAccountNumber = bankForm.bankAccountNumber;
    updateProviderMutation.mutate(updates);
  };

  const handleNotificationUpdate = () => {
    updateProviderMutation.mutate({ notificationSettings });
  };

  const handleThresholdUpdate = () => {
    updateProviderMutation.mutate({ instantPaymentThreshold: thresholdSettings });
  };

  const handleLogout = () => logout();
  const navConfig = getCustomerNavConfig(handleLogout);

  return (
    <PortalLayout 
      navConfig={navConfig}
      portalName="Provider Portal"
    >
      <div className="p-6 md:p-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/provider/dashboard")}
          data-testid="button-back"
          className="mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="mb-6">
          <h1 className="text-3xl font-semibold">Account Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your account preferences and settings
          </p>
        </div>

        <Tabs defaultValue="user" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 lg:w-auto lg:inline-grid">
            <TabsTrigger value="user" data-testid="tab-user">
              <User className="mr-2 h-4 w-4" />
              User
            </TabsTrigger>
            <TabsTrigger value="contact" data-testid="tab-contact">
              <Phone className="mr-2 h-4 w-4" />
              Contact
            </TabsTrigger>
            <TabsTrigger value="ehr" data-testid="tab-ehr">
              <Database className="mr-2 h-4 w-4" />
              EHR
            </TabsTrigger>
            <TabsTrigger value="testing" data-testid="tab-testing">
              <Beaker className="mr-2 h-4 w-4" />
              Testing
            </TabsTrigger>
            <TabsTrigger value="bank" data-testid="tab-bank">
              <Building2 className="mr-2 h-4 w-4" />
              Bank
            </TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team">
              <Users className="mr-2 h-4 w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="threshold" data-testid="tab-threshold">
              <SettingsIcon className="mr-2 h-4 w-4" />
              Threshold
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user">
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
                <CardDescription>Update your email and password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={user.username}
                    disabled
                    data-testid="input-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">New Password (optional)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Leave blank to keep current"
                    data-testid="input-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={userForm.confirmPassword}
                    onChange={(e) =>
                      setUserForm({ ...userForm, confirmPassword: e.target.value })
                    }
                    data-testid="input-confirm-password"
                  />
                </div>
                <Button
                  onClick={handleUserUpdate}
                  disabled={updateUserMutation.isPending}
                  data-testid="button-save-user"
                >
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Update your contact details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={contactForm.firstName}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, firstName: e.target.value })
                      }
                      placeholder="John"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={contactForm.lastName}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, lastName: e.target.value })
                      }
                      placeholder="Doe"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone Number</Label>
                  <Input
                    id="contactPhone"
                    value={contactForm.contactPhone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, contactPhone: e.target.value })
                    }
                    placeholder="(555) 123-4567"
                    data-testid="input-contact-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactForm.contactEmail}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, contactEmail: e.target.value })
                    }
                    placeholder="contact@example.com"
                    data-testid="input-contact-email"
                  />
                </div>
                <Button
                  onClick={handleContactUpdate}
                  disabled={updateProviderMutation.isPending}
                  data-testid="button-save-contact"
                >
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ehr">
            <Card>
              <CardHeader>
                <CardTitle>EHR Integration</CardTitle>
                <CardDescription>Configure your electronic health record system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ehrSystem">EHR System</Label>
                  <Select
                    value={ehrForm.ehrSystem}
                    onValueChange={(value) => {
                      if (value === "EHR_EMULATOR") {
                        setEhrForm({ ...ehrForm, ehrSystem: value, ehrApiEndpoint: "", ehrClientId: "", ehrClientSecret: "" });
                      } else {
                        setEhrForm({ ...ehrForm, ehrSystem: value });
                      }
                    }}
                  >
                    <SelectTrigger id="ehrSystem" data-testid="select-ehr-system">
                      <SelectValue placeholder="Select EHR system" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Epic">Epic</SelectItem>
                      <SelectItem value="Cerner">Cerner</SelectItem>
                      <SelectItem value="Allscripts">Allscripts</SelectItem>
                      <SelectItem value="Athenahealth">Athenahealth</SelectItem>
                      <SelectItem value="eClinicalWorks">eClinicalWorks</SelectItem>
                      <SelectItem value="NextGen">NextGen</SelectItem>
                      <SelectItem value="EHR_EMULATOR">EHR Emulator (Testing)</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {ehrForm.ehrSystem !== "EHR_EMULATOR" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="ehrApiEndpoint">API Endpoint</Label>
                      <Input
                        id="ehrApiEndpoint"
                        value={ehrForm.ehrApiEndpoint}
                        onChange={(e) => setEhrForm({ ...ehrForm, ehrApiEndpoint: e.target.value })}
                        placeholder="https://api.example.com/fhir"
                        data-testid="input-ehr-endpoint"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ehrClientId">Client ID</Label>
                      <Input
                        id="ehrClientId"
                        value={ehrForm.ehrClientId}
                        onChange={(e) => setEhrForm({ ...ehrForm, ehrClientId: e.target.value })}
                        data-testid="input-ehr-client-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ehrClientSecret">Client Secret</Label>
                      <Input
                        id="ehrClientSecret"
                        type="password"
                        value={ehrForm.ehrClientSecret}
                        onChange={(e) => setEhrForm({ ...ehrForm, ehrClientSecret: e.target.value })}
                        placeholder="Enter new secret to update"
                        data-testid="input-ehr-client-secret"
                      />
                    </div>
                  </>
                )}
                {ehrForm.ehrSystem === "EHR_EMULATOR" && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm text-muted-foreground">
                      EHR Emulator selected. No API credentials needed. Go to the Testing tab to generate sample encounters.
                    </p>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="ehrEnabled"
                    checked={ehrForm.ehrEnabled}
                    onCheckedChange={(checked) => setEhrForm({ ...ehrForm, ehrEnabled: checked })}
                    data-testid="switch-ehr-enabled"
                  />
                  <Label htmlFor="ehrEnabled">Enable EHR Integration</Label>
                </div>
                <Button
                  onClick={handleEhrUpdate}
                  disabled={updateProviderMutation.isPending}
                  data-testid="button-save-ehr"
                >
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="testing">
            <EHREmulatorPanel />
          </TabsContent>

          <TabsContent value="bank">
            <Card>
              <CardHeader>
                <CardTitle>Bank Information</CardTitle>
                <CardDescription>Update your banking details for payouts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bankRoutingNumber">Routing Number</Label>
                  <Input
                    id="bankRoutingNumber"
                    value={bankForm.bankRoutingNumber}
                    onChange={(e) =>
                      setBankForm({ ...bankForm, bankRoutingNumber: e.target.value })
                    }
                    placeholder="9 digits"
                    maxLength={9}
                    data-testid="input-routing-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">Account Number</Label>
                  <Input
                    id="bankAccountNumber"
                    value={bankForm.bankAccountNumber}
                    onChange={(e) =>
                      setBankForm({ ...bankForm, bankAccountNumber: e.target.value })
                    }
                    placeholder="Enter new account number to update"
                    data-testid="input-account-number"
                  />
                </div>
                <Button
                  onClick={handleBankUpdate}
                  disabled={updateProviderMutation.isPending}
                  data-testid="button-save-bank"
                >
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>Authorized Users</CardTitle>
                <CardDescription>
                  Manage team members who have access to your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {teamMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No team members added yet</p>
                ) : (
                  <div className="space-y-3">
                    {teamMembers.map((member: any) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-4 rounded-md border border-border p-4"
                        data-testid={`team-member-${member.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {member.user?.username?.charAt(0)?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.user?.username || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground">
                              {member.user?.email || ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={member.role}
                            onValueChange={(value) =>
                              updateTeamMemberMutation.mutate({ id: member.id, role: value })
                            }
                          >
                            <SelectTrigger className="w-32" data-testid={`select-role-${member.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTeamMemberId(member.id)}
                            data-testid={`button-remove-${member.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Configure how you receive updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="emailNotifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, emailNotifications: checked })
                    }
                    data-testid="switch-email-notifications"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="claimStatusUpdates">Claim Status Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when claim status changes
                    </p>
                  </div>
                  <Switch
                    id="claimStatusUpdates"
                    checked={notificationSettings.claimStatusUpdates}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, claimStatusUpdates: checked })
                    }
                    data-testid="switch-claim-updates"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="paymentConfirmations">Payment Confirmations</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive payment confirmation emails
                    </p>
                  </div>
                  <Switch
                    id="paymentConfirmations"
                    checked={notificationSettings.paymentConfirmations}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, paymentConfirmations: checked })
                    }
                    data-testid="switch-payment-confirmations"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="weeklyReports">Weekly Reports</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive weekly summary reports
                    </p>
                  </div>
                  <Switch
                    id="weeklyReports"
                    checked={notificationSettings.weeklyReports}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, weeklyReports: checked })
                    }
                    data-testid="switch-weekly-reports"
                  />
                </div>
                <Button
                  onClick={handleNotificationUpdate}
                  disabled={updateProviderMutation.isPending}
                  data-testid="button-save-notifications"
                >
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="threshold">
            <Card>
              <CardHeader>
                <CardTitle>Instant Payment Threshold</CardTitle>
                <CardDescription>
                  We'll code and pay as many claims as you'd like. Choose an interval and claim
                  volume to be paid below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="interval">Interval</Label>
                  <Select
                    value={thresholdSettings.interval}
                    onValueChange={(value) =>
                      setThresholdSettings({ ...thresholdSettings, interval: value })
                    }
                  >
                    <SelectTrigger id="interval" data-testid="select-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="claimLimitType">Number of Claims</Label>
                  <Select
                    value={thresholdSettings.claimLimitType}
                    onValueChange={(value) =>
                      setThresholdSettings({ ...thresholdSettings, claimLimitType: value })
                    }
                  >
                    <SelectTrigger id="claimLimitType" data-testid="select-claim-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Number</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {thresholdSettings.claimLimitType === "fixed" && (
                  <div className="space-y-2">
                    <Label htmlFor="fixedNumber">Number of Claims</Label>
                    <Input
                      id="fixedNumber"
                      type="number"
                      min="1"
                      value={thresholdSettings.claimLimitValue}
                      onChange={(e) =>
                        setThresholdSettings({
                          ...thresholdSettings,
                          claimLimitValue: parseInt(e.target.value) || 0,
                        })
                      }
                      data-testid="input-fixed-number"
                    />
                  </div>
                )}

                {thresholdSettings.claimLimitType === "percentage" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="percentageSlider">Percentage of Claims</Label>
                        <span className="text-sm font-medium" data-testid="text-percentage-value">
                          {thresholdSettings.claimLimitValue}%
                        </span>
                      </div>
                      <Slider
                        id="percentageSlider"
                        min={0}
                        max={100}
                        step={5}
                        value={[thresholdSettings.claimLimitValue]}
                        onValueChange={(value) =>
                          setThresholdSettings({ ...thresholdSettings, claimLimitValue: value[0] })
                        }
                        data-testid="slider-percentage"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Note: Percentage is calculated using your historical claims data to determine
                      the average number of claim submissions per {thresholdSettings.interval} period.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleThresholdUpdate}
                  disabled={updateProviderMutation.isPending}
                  data-testid="button-save-threshold"
                >
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!deleteTeamMemberId} onOpenChange={() => setDeleteTeamMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this team member? They will lose access to your
              account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTeamMemberId && deleteTeamMemberMutation.mutate(deleteTeamMemberId)}
              data-testid="button-confirm-remove"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
}
