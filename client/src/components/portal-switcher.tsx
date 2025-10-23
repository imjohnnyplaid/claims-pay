import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRightLeft, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function PortalSwitcher() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [targetPortal, setTargetPortal] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [useAutoSelect, setUseAutoSelect] = useState(true);
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");

  // Only show for admin and super_admin users
  if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
    return null;
  }

  // Fetch entities when portal is selected and not using auto-select
  const { data: entitiesData, isLoading: entitiesLoading } = useQuery({
    queryKey: ['/api/entities', targetPortal, searchQuery],
    enabled: !!targetPortal && targetPortal !== 'internal' && !useAutoSelect,
  });

  const switchPortalMutation = useMutation({
    mutationFn: async (data: { targetPortal: string; impersonateId?: string }) => {
      const res = await apiRequest("POST", "/api/switch-portal", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Portal Switched",
        description: data.impersonating 
          ? `Now viewing ${data.entityName}` 
          : "Switched to internal portal",
      });

      // Use full page reload to ensure auth state is completely fresh
      let targetUrl = '/admin/dashboard';
      if (data.impersonating) {
        if (targetPortal === 'customer') {
          targetUrl = '/provider/dashboard';
        } else if (targetPortal === 'bank') {
          targetUrl = '/bank/dashboard';
        }
      }
      
      // Force full page reload to prevent race conditions with auth state
      window.location.href = targetUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Switch Failed",
        description: error.message || "Failed to switch portal",
        variant: "destructive",
      });
    },
  });

  const handleSwitch = () => {
    if (!targetPortal) {
      toast({
        title: "Select Portal",
        description: "Please select a target portal",
        variant: "destructive",
      });
      return;
    }

    const data: any = { targetPortal };
    
    if (targetPortal !== 'internal' && !useAutoSelect && selectedEntityId) {
      data.impersonateId = selectedEntityId;
    }

    switchPortalMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          data-testid="button-portal-switcher"
          className="gap-2"
        >
          <ArrowRightLeft className="h-4 w-4" />
          Switch Portal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Switch Portal</DialogTitle>
          <DialogDescription>
            Switch between internal admin portal and customer/bank portals with impersonation
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="portal">Target Portal</Label>
            <Select value={targetPortal} onValueChange={(value) => {
              setTargetPortal(value);
              setSelectedEntityId("");
              setSearchQuery("");
              setUseAutoSelect(true);
            }}>
              <SelectTrigger id="portal" data-testid="select-portal">
                <SelectValue placeholder="Select portal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal Admin Portal</SelectItem>
                <SelectItem value="customer">Customer Portal (Provider)</SelectItem>
                <SelectItem value="bank">Bank Portal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {targetPortal && targetPortal !== 'internal' && (
            <>
              <div className="space-y-2">
                <Label>Entity Selection</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={useAutoSelect ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setUseAutoSelect(true);
                      setSelectedEntityId("");
                    }}
                    data-testid="button-auto-select"
                    className="flex-1"
                  >
                    Most Active (Auto)
                  </Button>
                  <Button
                    type="button"
                    variant={!useAutoSelect ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseAutoSelect(false)}
                    data-testid="button-manual-select"
                    className="flex-1"
                  >
                    Choose Specific
                  </Button>
                </div>
              </div>

              {!useAutoSelect && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="search">Search Entity</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search by name, email, NPI..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        data-testid="input-search-entity"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="entity">Select Entity</Label>
                    {entitiesLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                        <SelectTrigger id="entity" data-testid="select-entity">
                          <SelectValue placeholder="Select entity" />
                        </SelectTrigger>
                        <SelectContent>
                          {(entitiesData as any)?.entities?.map((entity: any) => (
                            <SelectItem key={entity.id} value={entity.id}>
                              {entity.name} - {entity.activityMetric} {targetPortal === 'customer' ? 'claims' : 'transactions'}
                            </SelectItem>
                          )) || []}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSwitch}
              disabled={switchPortalMutation.isPending || (targetPortal !== 'internal' && !useAutoSelect && !selectedEntityId)}
              data-testid="button-confirm-switch"
            >
              {switchPortalMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Switch Portal
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
