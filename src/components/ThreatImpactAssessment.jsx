import React from "react";
import { Clock, DollarSign, Boxes, Info } from "lucide-react";
import { estimateImpact, parseAffectedProducts, formatCost } from "@/lib/impactAssessment";

export default function ThreatImpactAssessment({ threat }) {
  const hasStored =
    threat.estimated_downtime_hours != null || threat.estimated_recovery_cost != null;
  const computed = estimateImpact(threat);
  const downtimeHours = hasStored ? threat.estimated_downtime_hours : computed.downtimeHours;
  const recoveryCost = hasStored ? threat.estimated_recovery_cost : computed.recoveryCost;
  const productCount = parseAffectedProducts(threat).length;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Impact Assessment</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Clock className="w-3.5 h-3.5" /> Est. Downtime
          </div>
          <p className="text-lg font-bold">
            {downtimeHours} <span className="text-xs font-normal text-muted-foreground">hrs</span>
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Est. Recovery Cost
          </div>
          <p className="text-lg font-bold">{formatCost(recoveryCost)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
        <Boxes className="w-3.5 h-3.5" />
        <span>
          {productCount} affected product{productCount === 1 ? "" : "s"} in portfolio
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground/70 mt-2">
        Estimated from severity ({threat.severity}) and affected product portfolio breadth.
      </p>
    </div>
  );
}