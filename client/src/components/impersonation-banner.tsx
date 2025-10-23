import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { EntitySelector } from "@/components/entity-selector";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { LogOut, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ImpersonationBanner() {
  const { impersonating, impersonateId, impersonatedRole, entityName } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const returnToInternalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/switch-portal", { targetPortal: 'internal' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Returned to Internal Portal",
        description: "You are no longer impersonating",
      });
      navigate('/admin/dashboard');
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Return",
        description: error.message || "Could not return to internal portal",
        variant: "destructive",
      });
    },
  });

  if (!impersonating) {
    return null;
  }

  const entityType = impersonatedRole === 'provider' ? 'customer' : 'bank';

  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Impersonating: <span className="font-semibold">{entityName}</span>
          </span>
          
          {impersonateId && (
            <EntitySelector
              entityType={entityType}
              currentEntityId={impersonateId}
              currentEntityName={entityName || ''}
            />
          )}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => returnToInternalMutation.mutate()}
          disabled={returnToInternalMutation.isPending}
          data-testid="button-return-internal"
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Return to Internal
        </Button>
      </AlertDescription>
    </Alert>
  );
}
