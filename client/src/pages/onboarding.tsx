import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, ArrowRight, Building2, CreditCard, Shield, Upload, Users, Activity } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STEPS = [
  { id: 1, title: "Account", icon: Shield },
  { id: 2, title: "Practice Info", icon: Building2 },
  { id: 3, title: "Banking", icon: CreditCard },
  { id: 4, title: "EHR Integration", icon: Activity },
  { id: 5, title: "Team", icon: Users },
  { id: 6, title: "Historical Data", icon: Upload },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();

  // Step 1: Account
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Step 2: Practice Info
  const [providerName, setProviderName] = useState("");
  const [npi, setNpi] = useState("");
  const [tin, setTin] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Step 3: Banking
  const [bankRoutingNumber, setBankRoutingNumber] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");

  // Step 4: EHR Integration (optional)
  const [ehrSystem, setEhrSystem] = useState<string>("");
  const [ehrApiEndpoint, setEhrApiEndpoint] = useState("");
  const [ehrClientId, setEhrClientId] = useState("");
  const [ehrClientSecret, setEhrClientSecret] = useState("");
  const [ehrEnabled, setEhrEnabled] = useState(false);

  // Step 5: Team (optional)
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [newTeamEmail, setNewTeamEmail] = useState("");

  // Step 6: Historical Data
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const progress = (step / STEPS.length) * 100;

  const handleNext = async () => {
    if (step === 1) {
      // Validate account info
      if (!username || !password || !email || !firstName || !lastName) {
        toast({ title: "Please fill in all fields", variant: "destructive" });
        return;
      }
      if (password.length < 8) {
        toast({ title: "Password must be at least 8 characters", variant: "destructive" });
        return;
      }
    } else if (step === 2) {
      // Validate practice info
      if (!providerName || !npi || !tin) {
        toast({ title: "Please fill in required practice information", variant: "destructive" });
        return;
      }
      if (npi.length !== 10) {
        toast({ title: "NPI must be 10 digits", variant: "destructive" });
        return;
      }
    } else if (step === 3) {
      // Validate banking (optional for now)
      if (bankRoutingNumber && bankRoutingNumber.length !== 9) {
        toast({ title: "Routing number must be 9 digits", variant: "destructive" });
        return;
      }
    } else if (step === 4) {
      // Validate EHR (optional, but if enabled, validate fields)
      if (ehrEnabled) {
        if (!ehrSystem || !ehrApiEndpoint || !ehrClientId || !ehrClientSecret) {
          toast({ title: "Please fill in all EHR connection details", variant: "destructive" });
          return;
        }
      }
    }

    if (step < STEPS.length) {
      setStep(step + 1);
    } else {
      // Final submission
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    try {
      // Step 1: Register user
      await register(username, password, email, "provider");

      // Step 2: Create provider profile
      const providerRes = await apiRequest("POST", "/api/providers", {
        providerName,
        npi,
        tin,
        firstName,
        lastName,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || email,
        bankRoutingNumber: bankRoutingNumber || undefined,
        bankAccountNumber: bankAccountNumber || undefined,
        ehrSystem: ehrEnabled && ehrSystem ? ehrSystem : undefined,
        ehrApiEndpoint: ehrEnabled && ehrApiEndpoint ? ehrApiEndpoint : undefined,
        ehrClientId: ehrEnabled && ehrClientId ? ehrClientId : undefined,
        ehrClientSecret: ehrEnabled && ehrClientSecret ? ehrClientSecret : undefined,
        ehrEnabled,
      });

      if (!providerRes.ok) {
        const error = await providerRes.json();
        throw new Error(error.message || "Failed to create provider profile");
      }

      // Step 3: Add team members (if any)
      for (const teamEmail of teamMembers) {
        await apiRequest("POST", "/api/team-members", { email: teamEmail });
      }

      // Step 4: Upload historical data (if provided)
      if (uploadedFile) {
        const formData = new FormData();
        formData.append("file", uploadedFile);
        await apiRequest("POST", "/api/historical-claims/upload", formData);
      }

      toast({ title: "Onboarding complete! Welcome to ClaimPay" });
      setLocation("/provider/dashboard");
    } catch (error: any) {
      toast({
        title: "Onboarding failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addTeamMember = () => {
    if (newTeamEmail && !teamMembers.includes(newTeamEmail)) {
      setTeamMembers([...teamMembers, newTeamEmail]);
      setNewTeamEmail("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Provider Onboarding</h1>
            <span className="text-sm text-muted-foreground">Step {step} of {STEPS.length}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Indicators */}
        <div className="mb-8 flex justify-between">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isComplete = s.id < step;
            return (
              <div
                key={s.id}
                className={`flex flex-col items-center gap-2 ${
                  isActive ? "text-primary" : isComplete ? "text-accent" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isComplete
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="hidden text-xs sm:block">{s.title}</span>
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>{STEPS[step - 1].title}</CardTitle>
            <CardDescription>
              {step === 1 && "Create your ClaimPay account"}
              {step === 2 && "Tell us about your practice"}
              {step === 3 && "Set up your payment details"}
              {step === 4 && "Connect your EHR system for automatic claim processing (optional)"}
              {step === 5 && "Invite your team (optional)"}
              {step === 6 && "Upload historical claims data (optional)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Account */}
            {step === 1 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    data-testid="input-onboarding-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-onboarding-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="input-onboarding-password"
                  />
                  <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                </div>
              </>
            )}

            {/* Step 2: Practice Info */}
            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="providerName">Practice Name</Label>
                  <Input
                    id="providerName"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    required
                    data-testid="input-provider-name"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="npi">NPI (10 digits)</Label>
                    <Input
                      id="npi"
                      value={npi}
                      onChange={(e) => setNpi(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      required
                      data-testid="input-npi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tin">TIN</Label>
                    <Input
                      id="tin"
                      value={tin}
                      onChange={(e) => setTin(e.target.value)}
                      required
                      data-testid="input-tin"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    data-testid="input-contact-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder={email}
                    data-testid="input-contact-email"
                  />
                </div>
              </>
            )}

            {/* Step 3: Banking */}
            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="routing">Bank Routing Number (9 digits)</Label>
                  <Input
                    id="routing"
                    value={bankRoutingNumber}
                    onChange={(e) =>
                      setBankRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))
                    }
                    data-testid="input-routing-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account">Bank Account Number</Label>
                  <Input
                    id="account"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    data-testid="input-account-number"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Your banking information is encrypted and secure. This is used for ACH payments.
                </p>
              </>
            )}

            {/* Step 4: EHR Integration */}
            {step === 4 && (
              <>
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="ehrEnabled"
                        checked={ehrEnabled}
                        onChange={(e) => setEhrEnabled(e.target.checked)}
                        className="h-4 w-4"
                        data-testid="checkbox-ehr-enabled"
                      />
                      <Label htmlFor="ehrEnabled" className="cursor-pointer font-medium">
                        Enable EHR Integration for Automatic Claim Processing
                      </Label>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Connect your EHR system to automatically pull claims, code them with AI, and process payments without manual intervention.
                    </p>
                  </div>

                  {ehrEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="ehrSystem">EHR System</Label>
                        <Select value={ehrSystem} onValueChange={setEhrSystem}>
                          <SelectTrigger data-testid="select-ehr-system">
                            <SelectValue placeholder="Select your EHR system" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Epic">Epic</SelectItem>
                            <SelectItem value="Cerner">Cerner</SelectItem>
                            <SelectItem value="Allscripts">Allscripts</SelectItem>
                            <SelectItem value="Athenahealth">Athenahealth</SelectItem>
                            <SelectItem value="eClinicalWorks">eClinicalWorks</SelectItem>
                            <SelectItem value="NextGen">NextGen Healthcare</SelectItem>
                            <SelectItem value="Other">Other FHIR-compliant</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="ehrApiEndpoint">FHIR API Endpoint URL</Label>
                        <Input
                          id="ehrApiEndpoint"
                          type="url"
                          value={ehrApiEndpoint}
                          onChange={(e) => setEhrApiEndpoint(e.target.value)}
                          placeholder="https://fhir.your-ehr-system.com/api/v4"
                          data-testid="input-ehr-endpoint"
                        />
                        <p className="text-xs text-muted-foreground">
                          Your EHR's FHIR R4 API endpoint (usually provided by your IT department)
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="ehrClientId">OAuth2 Client ID</Label>
                          <Input
                            id="ehrClientId"
                            value={ehrClientId}
                            onChange={(e) => setEhrClientId(e.target.value)}
                            placeholder="client-id-123"
                            data-testid="input-ehr-client-id"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ehrClientSecret">OAuth2 Client Secret</Label>
                          <Input
                            id="ehrClientSecret"
                            type="password"
                            value={ehrClientSecret}
                            onChange={(e) => setEhrClientSecret(e.target.value)}
                            placeholder="••••••••"
                            data-testid="input-ehr-client-secret"
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border border-accent/30 bg-accent/10 p-4">
                        <p className="text-sm font-medium">How it works:</p>
                        <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-muted-foreground">
                          <li>We connect to your EHR using secure FHIR API</li>
                          <li>New encounters are automatically pulled every 15 minutes</li>
                          <li>AI codes each claim with ICD-10 and CPT codes</li>
                          <li>Risk assessment determines approval eligibility</li>
                          <li>Approved claims receive instant 95% payout</li>
                          <li>Full claims submitted to insurance on your behalf</li>
                        </ol>
                      </div>
                    </>
                  )}
                  
                  {!ehrEnabled && (
                    <p className="text-sm text-muted-foreground">
                      You can skip this step and manually submit claims. EHR integration can be enabled later from your dashboard.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Step 5: Team */}
            {step === 5 && (
              <>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Team member email"
                      value={newTeamEmail}
                      onChange={(e) => setNewTeamEmail(e.target.value)}
                      data-testid="input-team-email"
                    />
                    <Button onClick={addTeamMember} data-testid="button-add-team">
                      Add
                    </Button>
                  </div>
                  {teamMembers.length > 0 && (
                    <div className="space-y-2">
                      <Label>Team Members ({teamMembers.length})</Label>
                      <div className="space-y-2">
                        {teamMembers.map((email, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-md border border-border p-3"
                          >
                            <span className="text-sm">{email}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setTeamMembers(teamMembers.filter((e) => e !== email))}
                              data-testid={`button-remove-team-${i}`}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Invite team members to collaborate on claims. You can skip this step.
                  </p>
                </div>
              </>
            )}

            {/* Step 6: Historical Data */}
            {step === 6 && (
              <>
                <div className="space-y-4">
                  <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                    <div className="mt-4">
                      <Label
                        htmlFor="file-upload"
                        className="cursor-pointer text-sm font-medium text-primary hover:underline"
                      >
                        Upload historical claims (CSV or PDF)
                      </Label>
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".csv,.pdf"
                        onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                        className="hidden"
                        data-testid="input-file-upload"
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Help us analyze your claim patterns (2+ years recommended)
                      </p>
                    </div>
                  </div>
                  {uploadedFile && (
                    <div className="flex items-center gap-2 rounded-md border border-border p-3">
                      <span className="text-sm">{uploadedFile.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUploadedFile(null)}
                        data-testid="button-remove-file"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    This helps us improve AI accuracy for your specific practice. You can skip this
                    step.
                  </p>
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  data-testid="button-previous-step"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
              )}
              <Button
                onClick={handleNext}
                className={step === 1 ? "ml-auto" : ""}
                data-testid="button-next-step"
              >
                {step === STEPS.length ? "Complete Onboarding" : "Next"}
                {step < STEPS.length && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
