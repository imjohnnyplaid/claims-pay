import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronDown, Search, Building2, User } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface EntitySelectorProps {
  entityType: 'customer' | 'bank';
  currentEntityId: string;
  currentEntityName: string;
}

export function EntitySelector({ entityType, currentEntityId, currentEntityName }: EntitySelectorProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch entities for selector
  const { data: entitiesData, isLoading: entitiesLoading } = useQuery({
    queryKey: ['/api/entities', entityType, searchQuery],
    enabled: open,
  });

  const switchEntityMutation = useMutation({
    mutationFn: async (targetId: string) => {
      const res = await apiRequest("POST", "/api/switch-entity", { targetId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      
      toast({
        title: "Entity Switched",
        description: `Now viewing ${data.entityName}`,
      });
      
      setOpen(false);
      setSearchQuery("");
      
      // Refresh page to reload data for new entity
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Switch Failed",
        description: error.message || "Failed to switch entity",
        variant: "destructive",
      });
    },
  });

  const handleEntitySelect = (entityId: string) => {
    if (entityId === currentEntityId) {
      setOpen(false);
      return;
    }
    switchEntityMutation.mutate(entityId);
  };

  const Icon = entityType === 'customer' ? User : Building2;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 min-w-[200px] justify-between"
          data-testid="button-entity-selector"
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="truncate">{currentEntityName}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="end">
        <div className="p-3 space-y-3">
          <div className="text-sm font-medium">
            Switch {entityType === 'customer' ? 'Provider' : 'Bank'}
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-entity-search"
              className="pl-9 h-9"
            />
          </div>

          {entitiesLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {(entitiesData as any)?.entities?.map((entity: any) => (
                <button
                  key={entity.id}
                  onClick={() => handleEntitySelect(entity.id)}
                  disabled={switchEntityMutation.isPending}
                  data-testid={`entity-option-${entity.id}`}
                  className={`
                    w-full text-left px-3 py-2 rounded-md text-sm transition-colors
                    ${entity.id === currentEntityId 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover-elevate active-elevate-2'
                    }
                  `}
                >
                  <div className="font-medium">{entity.name}</div>
                  <div className="text-xs opacity-80 mt-0.5">
                    {entity.activityMetric} {entityType === 'customer' ? 'claims' : 'transactions'} (30d)
                  </div>
                </button>
              )) || []}
              
              {(entitiesData as any)?.entities?.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No entities found
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
