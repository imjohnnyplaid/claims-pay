import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, FileText, Upload } from "lucide-react";
import { PortalLayout } from "@/components/portal-layout";
import { getCustomerNavConfig } from "@/config/nav-config";
import { useAuth } from "@/lib/auth";

export default function NewClaim() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [rawClaimData, setRawClaimData] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const submitClaimMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/claims", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Claim submitted successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics/provider"] });
      setLocation("/provider/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patientName || !claimAmount) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    const amount = parseFloat(claimAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Please enter a valid claim amount", variant: "destructive" });
      return;
    }

    await submitClaimMutation.mutateAsync({
      patientName,
      patientId: patientId || null,
      claimAmount: amount,
      rawClaimData: rawClaimData || uploadedFile?.name || null,
      status: "submitted",
    });
  };

  const { logout } = useAuth();
  const handleLogout = () => logout();
  const navConfig = getCustomerNavConfig(handleLogout);

  return (
    <PortalLayout 
      navConfig={navConfig}
      portalName="Provider Portal"
    >
      <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/provider/dashboard")}
          data-testid="button-back-dashboard"
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Submit New Claim</h1>
          <p className="mt-2 text-muted-foreground">
            Enter claim details or upload claim file for AI-powered coding
          </p>
        </div>

        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>Claim Information</CardTitle>
            <CardDescription>Fill in patient and claim details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Patient Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Patient Details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="patientName">
                      Patient Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="patientName"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      required
                      data-testid="input-patient-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patientId">Patient ID (Optional)</Label>
                    <Input
                      id="patientId"
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                      data-testid="input-patient-id"
                    />
                  </div>
                </div>
              </div>

              {/* Claim Amount */}
              <div className="space-y-2">
                <Label htmlFor="claimAmount">
                  Claim Amount <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="claimAmount"
                    type="number"
                    step="0.01"
                    className="pl-7"
                    value={claimAmount}
                    onChange={(e) => setClaimAmount(e.target.value)}
                    required
                    data-testid="input-claim-amount"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You'll receive 95% of this amount upon approval
                </p>
              </div>

              {/* Claim Data Entry */}
              <div className="space-y-2">
                <Label htmlFor="rawClaimData">Claim Details (Optional)</Label>
                <Textarea
                  id="rawClaimData"
                  placeholder="Enter diagnosis, procedures, or other claim information..."
                  value={rawClaimData}
                  onChange={(e) => setRawClaimData(e.target.value)}
                  rows={5}
                  data-testid="input-claim-data"
                />
                <p className="text-xs text-muted-foreground">
                  Our AI will auto-code this information with ICD-10 and CPT codes
                </p>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Or Upload Claim File</Label>
                <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <div className="mt-4">
                    <Label
                      htmlFor="file-upload"
                      className="cursor-pointer text-sm font-medium text-primary hover:underline"
                    >
                      Upload claim document (PDF, CSV, or text)
                    </Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.csv,.txt"
                      onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                      className="hidden"
                      data-testid="input-claim-file"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      AI will extract and code claim information
                    </p>
                  </div>
                </div>
                {uploadedFile && (
                  <div className="flex items-center gap-2 rounded-md border border-border p-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1">{uploadedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadedFile(null)}
                      data-testid="button-remove-claim-file"
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                <h4 className="font-medium text-sm mb-2">What happens next?</h4>
                <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                  <li>AI analyzes and codes your claim (ICD-10, CPT)</li>
                  <li>Risk engine assesses approval probability</li>
                  <li>If score {'>'} 80%, instant approval and payment</li>
                  <li>95% of claim amount paid via ACH within hours</li>
                </ol>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={submitClaimMutation.isPending}
                  data-testid="button-submit-claim"
                >
                  {submitClaimMutation.isPending ? "Submitting..." : "Submit Claim"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/provider/dashboard")}
                  data-testid="button-cancel-claim"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
