import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Beaker, Play, Trash2, Users, FileText, CheckCircle2, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EmulatorStatus {
  enabled: boolean;
  encounterCount: number;
  patients: number;
}

interface SamplePatient {
  id: string;
  name: string;
  dob: string;
  gender: string;
  mrn: string;
}

interface EmulatedEncounter {
  id: string;
  patientName: string;
  encounterDate: string;
  diagnosis: string;
  procedure: string;
  totalCharge: number;
}

export function EHREmulatorPanel() {
  const { toast } = useToast();
  const [encounterCount, setEncounterCount] = useState(1);

  const { data: status, isLoading } = useQuery<EmulatorStatus>({
    queryKey: ["/api/ehr-emulator/status"],
  });

  const { data: patients = [] } = useQuery<SamplePatient[]>({
    queryKey: ["/api/ehr-emulator/patients"],
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ehr-emulator/enable", {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "EHR Emulator enabled for testing" });
      queryClient.invalidateQueries({ queryKey: ["/api/ehr-emulator/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to enable emulator",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ehr-emulator/disable", {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "EHR Emulator disabled" });
      queryClient.invalidateQueries({ queryKey: ["/api/ehr-emulator/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to disable emulator",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (count: number) => {
      const res = await apiRequest("POST", "/api/ehr-emulator/generate", { count });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Test encounters generated",
        description: `Created ${data.encounters.length} sample encounters`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ehr-emulator/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate encounters",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ehr-emulator/clear", {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Test encounters cleared" });
      queryClient.invalidateQueries({ queryKey: ["/api/ehr-emulator/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to clear encounters",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="text-muted-foreground">Loading emulator status...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Beaker className="h-5 w-5" />
                EHR Emulator Status
              </CardTitle>
              <CardDescription>
                Test your claims processing pipeline with simulated patient data
              </CardDescription>
            </div>
            <Badge variant={status?.enabled ? "default" : "secondary"} className="h-6">
              {status?.enabled ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Active
                </>
              ) : (
                <>
                  <XCircle className="mr-1 h-3 w-3" />
                  Inactive
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-border p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Sample Patients</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{status?.patients || 0}</p>
            </div>
            <div className="rounded-md border border-border p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Generated Encounters</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{status?.encounterCount || 0}</p>
            </div>
            <div className="rounded-md border border-border p-4">
              <div className="flex items-center gap-2">
                <Beaker className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Status</span>
              </div>
              <p className="mt-2 text-sm font-medium">
                {status?.enabled ? "Ready for Testing" : "Not Enabled"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!status?.enabled ? (
              <Button
                onClick={() => enableMutation.mutate()}
                disabled={enableMutation.isPending}
                data-testid="button-enable-emulator"
              >
                <Play className="mr-2 h-4 w-4" />
                Enable Emulator
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => disableMutation.mutate()}
                disabled={disableMutation.isPending}
                data-testid="button-disable-emulator"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Disable Emulator
              </Button>
            )}

            {status?.enabled && status?.encounterCount > 0 && (
              <Button
                variant="outline"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                data-testid="button-clear-encounters"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Encounters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generate Encounters Card */}
      {status?.enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Generate Test Encounters</CardTitle>
            <CardDescription>
              Create sample patient encounters to test the AI autocoder, risk engine, and payment system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Number of Encounters</label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={encounterCount}
                    onChange={(e) => setEncounterCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className="w-24 rounded-md border border-border bg-background px-3 py-2"
                    data-testid="input-encounter-count"
                  />
                  <span className="text-sm text-muted-foreground">(1-10 encounters)</span>
                </div>
              </div>
              <Button
                onClick={() => generateMutation.mutate(encounterCount)}
                disabled={generateMutation.isPending}
                data-testid="button-generate-encounters"
              >
                <Play className="mr-2 h-4 w-4" />
                Generate Encounters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sample Patients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Patients</CardTitle>
          <CardDescription>
            Pre-configured test patients available for encounter generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>MRN</TableHead>
                <TableHead>Date of Birth</TableHead>
                <TableHead>Gender</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((patient) => (
                <TableRow key={patient.id} data-testid={`patient-row-${patient.id}`}>
                  <TableCell className="font-medium">{patient.name}</TableCell>
                  <TableCell>{patient.mrn}</TableCell>
                  <TableCell>{new Date(patient.dob).toLocaleDateString()}</TableCell>
                  <TableCell>{patient.gender}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">How to Test End-to-End</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="ml-4 space-y-2 list-decimal">
            <li>Set your EHR System to "EHR Emulator (Testing)" in the EHR Integration tab</li>
            <li>Enable EHR Integration and save your settings</li>
            <li>Enable the Emulator above to activate testing mode</li>
            <li>Generate test encounters using the button above</li>
            <li>Go to your Dashboard and click "Sync Now" to process the encounters</li>
            <li>Watch as claims are auto-coded, risk-assessed, and processed for payment</li>
            <li>View the results in real-time on your Dashboard and Claims pages</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
