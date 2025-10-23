import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Claim } from "@shared/schema";
import { anonymizePatientId } from "@shared/phi-utils";
import { DollarSign, Calendar, Activity, Shield, FileCode } from "lucide-react";

interface ClaimDetailModalProps {
  claim: Claim;
  onClose: () => void;
}

export function ClaimDetailModal({ claim, onClose }: ClaimDetailModalProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-claim-detail">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Claim Details
            <Badge variant={
              claim.status === "paid" ? "default" :
              claim.status === "rejected" ? "destructive" :
              "secondary"
            }>
              {claim.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            HIPAA-compliant view with anonymized patient information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient Info - Anonymized */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Patient Information (Anonymized)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Patient ID</p>
                  <p className="text-sm font-medium" data-testid="text-patient-id-anonymized">
                    {anonymizePatientId(claim.patientId)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Claim ID</p>
                  <p className="text-sm font-mono" data-testid="text-claim-id">
                    {claim.id.substring(0, 8)}...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Claim Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Claim Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Claim Amount</p>
                  <p className="text-lg font-semibold text-primary" data-testid="text-claim-amount">
                    ${Number(claim.claimAmount).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payout Amount</p>
                  <p className="text-lg font-semibold" data-testid="text-payout-amount">
                    {claim.payoutAmount ? `$${Number(claim.payoutAmount).toLocaleString()}` : 'Pending'}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Submitted
                  </p>
                  <p className="text-sm" data-testid="text-submitted-date">
                    {new Date(claim.submittedAt).toLocaleString()}
                  </p>
                </div>
                {claim.paidAt && (
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Paid
                    </p>
                    <p className="text-sm" data-testid="text-paid-date">
                      {new Date(claim.paidAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Medical Codes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                Medical Coding (AI-Generated)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">ICD-10 Diagnosis Codes</p>
                <div className="flex flex-wrap gap-2">
                  {claim.codes?.icd10 && claim.codes.icd10.length > 0 ? (
                    claim.codes.icd10.map((code, idx) => (
                      <Badge key={idx} variant="outline" data-testid={`badge-icd10-${idx}`}>
                        {code}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No codes assigned</p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-2">CPT Procedure Codes</p>
                <div className="flex flex-wrap gap-2">
                  {claim.codes?.cpt && claim.codes.cpt.length > 0 ? (
                    claim.codes.cpt.map((code, idx) => (
                      <Badge key={idx} variant="outline" data-testid={`badge-cpt-${idx}`}>
                        {code}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No codes assigned</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          {claim.riskScore !== null && claim.riskScore !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Approval Likelihood Score</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            claim.riskScore >= 80 ? 'bg-chart-3' :
                            claim.riskScore >= 50 ? 'bg-primary' :
                            'bg-destructive'
                          }`}
                          style={{ width: `${claim.riskScore}%` }}
                        />
                      </div>
                      <span className="text-lg font-semibold" data-testid="text-risk-score">
                        {claim.riskScore}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Information */}
          {claim.rejectionReason && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Rejection Reason</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm" data-testid="text-rejection-reason">{claim.rejectionReason}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
