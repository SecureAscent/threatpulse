import React from "react";
import { motion } from "framer-motion";
import SeverityBadge from "@/components/SeverityBadge";
import RiskScoreBadge from "@/components/RiskScoreBadge";
import StatusBadge from "@/components/StatusBadge";
import { Check, X, UserPlus } from "lucide-react";

export default function MobileReviewCard({ threat, onReview, onSkip, onAssign, reviewing }) {
  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(_e, info) => {
        if (info.offset.x > 120) onReview(threat);
        else if (info.offset.x < -120) onSkip(threat);
      }}
      whileDrag={{ scale: 1.02 }}
      className="relative bg-card rounded-2xl border border-border shadow-lg p-5 cursor-grab active:cursor-grabbing select-none"
    >
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <SeverityBadge severity={threat.severity} />
        <RiskScoreBadge score={threat.risk_score} />
        <StatusBadge status={threat.status} />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
        {threat.source || "Unknown"}
      </p>
      <h3 className="text-base font-semibold leading-snug mb-2">{threat.title}</h3>
      {threat.description && (
        <p className="text-sm text-muted-foreground line-clamp-4 mb-3">{threat.description}</p>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 flex-wrap">
        {threat.cve_id && <span className="font-mono text-primary">{threat.cve_id}</span>}
        {threat.affected_products && <span className="truncate max-w-[14rem]">{threat.affected_products}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onReview(threat)}
          disabled={reviewing}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
        >
          <Check className="w-4 h-4" /> Reviewed
        </button>
        <button
          onClick={() => onAssign(threat)}
          className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-border text-sm hover:bg-accent"
          title="Assign to me"
        >
          <UserPlus className="w-4 h-4" />
        </button>
        <button
          onClick={() => onSkip(threat)}
          className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-border text-sm hover:bg-accent"
          title="Skip"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}