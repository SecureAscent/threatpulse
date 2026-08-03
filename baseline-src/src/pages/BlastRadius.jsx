import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Crosshair } from "lucide-react";
import BlastRadiusMatrix from "@/components/BlastRadiusMatrix";

export default function BlastRadius() {
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 500),
  });
  const { data: assets = [] } = useQuery({
    queryKey: ["products", "assets"],
    queryFn: () => base44.entities.Product.list("-created_date", 200),
  });

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6 flex items-center gap-2">
        <Crosshair className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Blast Radius</h1>
          <p className="text-sm text-muted-foreground">
            Critical and high-severity threats mapped to product portfolio items — exactly what is at risk
          </p>
        </div>
      </div>
      <BlastRadiusMatrix threats={threats} assets={assets} isLoading={isLoading} />
    </div>
  );
}