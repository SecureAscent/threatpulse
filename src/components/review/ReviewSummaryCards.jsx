import React from "react";

const glassCls =
  "rounded-[26px] border border-white/[0.17] shadow-[0_22px_56px_rgba(0,0,0,0.22),inset_0_1px_rgba(255,255,255,0.12)] backdrop-blur-[18px] bg-[linear-gradient(140deg,rgba(255,255,255,0.105),rgba(255,255,255,0.045))]";

function MetricCard({ label, value, accent }) {
  return (
    <article className={`${glassCls} p-8 md:p-9 min-h-[150px] flex flex-col justify-between`}>
      <span className="text-[15px] uppercase tracking-[1.7px] text-[#b8b9d2] font-semibold">{label}</span>
      <div>
        <div className="text-[31px] font-bold tracking-[-0.5px] text-white">{value}</div>
        {accent && (
          <div
            className="h-[5px] w-[74px] rounded-full mt-4"
            style={{
              background: "linear-gradient(90deg,#ff647e,#ffc464)",
              boxShadow: "0 0 20px rgba(255,100,126,0.4)",
            }}
          />
        )}
      </div>
    </article>
  );
}

export default function ReviewSummaryCards({ todayCount, activeReviewers, totalReviewed }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-[22px]">
      <MetricCard label="Reviewed Today" value={todayCount} accent />
      <MetricCard label="Active Reviewers" value={activeReviewers} />
      <MetricCard label="Total Reviews (All Time)" value={totalReviewed} />
    </div>
  );
}