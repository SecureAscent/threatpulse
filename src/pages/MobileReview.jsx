import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Loader2, Check } from "lucide-react";
import MobileReviewCard from "@/components/review/MobileReviewCard";

const sevFilters = ["All", "Critical", "High", "Medium", "Low"];

export default function MobileReview() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [sevFilter, setSevFilter] = useState("All");
  const [processedIds, setProcessedIds] = useState(new Set());
  const [reviewing, setReviewing] = useState(false);
  const [toast, setToast] = useState("");

  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "mobile-review"],
    queryFn: () => base44.entities.Threat.list("-created_date", 200),
  });

  const todayStr = new Date().toDateString();
  const queue = useMemo(() => {
    return threats.filter((t) => {
      if (processedIds.has(t.id)) return false;
      const reviewedToday = t.last_reviewed_date && new Date(t.last_reviewed_date).toDateString() === todayStr;
      if (reviewedToday) return false;
      if (sevFilter !== "All" && t.severity !== sevFilter) return false;
      return true;
    });
  }, [threats, sevFilter, todayStr, processedIds]);

  const current = queue[0];

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  };

  const handleReview = async (threat) => {
    setReviewing(true);
    try {
      const reviewerName = user?.full_name || user?.email || "Unknown Analyst";
      await base44.entities.Threat.update(threat.id, {
        last_reviewed_date: new Date().toISOString(),
        last_reviewed_by: reviewerName,
      });
      await base44.entities.ThreatActivity.create({
        threat_id: threat.id,
        action: "reviewed",
        description: `Threat reviewed by ${reviewerName} (mobile)`,
        actor_name: reviewerName,
      });
      qc.invalidateQueries({ queryKey: ["threats"] });
      setProcessedIds((prev) => new Set([...prev, threat.id]));
      showToast("✓ Reviewed");
    } finally {
      setReviewing(false);
    }
  };

  const handleSkip = (threat) => {
    setProcessedIds((prev) => new Set([...prev, threat.id]));
    showToast("Skipped");
  };

  const handleAssign = async (threat) => {
    const name = user?.full_name || user?.email || "Me";
    await base44.entities.Threat.update(threat.id, { assigned_to: name });
    qc.invalidateQueries({ queryKey: ["threats"] });
    showToast("Assigned to you");
  };

  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold">Mobile Review</h1>
          <span className="text-xs text-muted-foreground">{queue.length} left</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {sevFilters.map((s) => (
            <button
              key={s}
              onClick={() => { setSevFilter(s); setProcessedIds(new Set()); }}
              className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${
                sevFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !current ? (
          <div className="text-center py-20">
            <Check className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
            <p className="font-medium">All caught up</p>
            <p className="text-sm text-muted-foreground mt-1">No threats left to review for this filter.</p>
          </div>
        ) : (
          <div>
            <MobileReviewCard
              key={current.id}
              threat={current}
              onReview={handleReview}
              onSkip={handleSkip}
              onAssign={handleAssign}
              reviewing={reviewing}
            />
            <p className="text-center text-xs text-muted-foreground mt-4">
              Swipe right to review · swipe left to skip
            </p>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}