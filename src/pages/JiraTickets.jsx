import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ticket, Loader2, Search } from "lucide-react";
import TicketSummary from "@/components/tickets/TicketSummary";
import TicketRow from "@/components/tickets/TicketRow";
import JiraTicketDialog from "@/components/tickets/JiraTicketDialog";
import { useToast } from "@/components/ui/use-toast";

const STATUS_FILTERS = ["Open", "Mitigated", "All"];

export default function JiraTickets() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("Open");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(new Set());
  const [editTarget, setEditTarget] = useState(null);
  const [dialogSaving, setDialogSaving] = useState(false);

  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "tickets"],
    queryFn: () => base44.entities.Threat.list("-created_date", 500),
  });

  const ticketable = useMemo(
    () => threats.filter((t) => t.severity === "Critical" || t.severity === "High"),
    [threats]
  );

  const stats = useMemo(() => {
    const open = ticketable.filter((t) => t.status !== "Mitigated" && (t.ticket_created || t.ticket_name || t.ticket_url));
    return {
      open: open.length,
      critical: ticketable.filter((t) => t.severity === "Critical" && t.status !== "Mitigated").length,
      high: ticketable.filter((t) => t.severity === "High" && t.status !== "Mitigated").length,
      mitigated: ticketable.filter((t) => t.status === "Mitigated").length,
    };
  }, [ticketable]);

  const filtered = useMemo(() => {
    let out = ticketable;
    if (statusFilter === "Open") out = out.filter((t) => t.status !== "Mitigated");
    else if (statusFilter === "Mitigated") out = out.filter((t) => t.status === "Mitigated");
    if (severityFilter !== "All") out = out.filter((t) => t.severity === severityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((t) =>
        (t.title || "").toLowerCase().includes(q) ||
        (t.cve_id || "").toLowerCase().includes(q) ||
        (t.ticket_name || "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [ticketable, statusFilter, severityFilter, search]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["threats"] });
    qc.invalidateQueries({ queryKey: ["threats", "tickets"] });
  };

  const handleCreate = async (threatId) => {
    setActionLoading((prev) => new Set(prev).add(threatId));
    try {
      const res = await base44.functions.invoke("createThreatTicket", { threat_id: threatId });
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: `Jira ticket ${res.data.ticket_key} created` });
      refresh();
    } catch (e) {
      toast({ title: "Failed to create ticket", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading((prev) => { const s = new Set(prev); s.delete(threatId); return s; });
    }
  };

  const handleUpdate = async ({ summary, comment }) => {
    if (!editTarget) return;
    setDialogSaving(true);
    try {
      const res = await base44.functions.invoke("manageJiraTicket", {
        action: "update",
        threat_id: editTarget.id,
        summary,
        comment,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: `Ticket ${editTarget.ticket_name} updated` });
      setEditTarget(null);
      refresh();
    } catch (e) {
      toast({ title: "Failed to update ticket", description: e.message, variant: "destructive" });
    } finally {
      setDialogSaving(false);
    }
  };

  const handleClose = async ({ comment }) => {
    if (!editTarget) return;
    setDialogSaving(true);
    try {
      const res = await base44.functions.invoke("manageJiraTicket", {
        action: "close",
        threat_id: editTarget.id,
        comment,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: `Ticket ${editTarget.ticket_name} closed — threat mitigated` });
      setEditTarget(null);
      refresh();
    } catch (e) {
      toast({ title: "Failed to close ticket", description: e.message, variant: "destructive" });
    } finally {
      setDialogSaving(false);
    }
  };

  const handleCloseDirect = async (threat) => {
    setActionLoading((prev) => new Set(prev).add(threat.id));
    try {
      const res = await base44.functions.invoke("manageJiraTicket", {
        action: "close",
        threat_id: threat.id,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: `Ticket ${threat.ticket_name} closed — threat mitigated` });
      refresh();
    } catch (e) {
      toast({ title: "Failed to close ticket", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading((prev) => { const s = new Set(prev); s.delete(threat.id); return s; });
    }
  };

  const TH = "text-left px-4 py-2.5 font-medium whitespace-nowrap text-xs uppercase";

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Ticket className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jira Ticket Board</h1>
          <p className="text-sm text-muted-foreground">Create, edit, and close Jira tickets for critical & high-severity vulnerabilities</p>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6">
        <TicketSummary stats={stats} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {["All", "Critical", "High"].map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                severityFilter === s ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search CVE, title, ticket…"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} threats</span>
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium">No threats match your filters</p>
          <p className="text-sm mt-1">Adjust the filters or ingest new threats from the Feeds page.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-auto max-h-[65vh]">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-secondary/40 text-muted-foreground sticky top-0 z-10">
              <tr>
                <th className={TH}>Jira Ticket</th>
                <th className={TH}>CVE</th>
                <th className={TH}>Severity</th>
                <th className={TH}>Threat</th>
                <th className={TH}>Status</th>
                <th className={TH}>Assigned</th>
                <th className={TH}>Age</th>
                <th className={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <TicketRow
                  key={t.id}
                  threat={t}
                  actionLoading={actionLoading}
                  onCreate={handleCreate}
                  onEdit={setEditTarget}
                  onClose={handleCloseDirect}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Create a Jira ticket, edit its summary or add a comment, or close it — closing a ticket mitigates the threat in ThreatPulse automatically.
      </p>

      <JiraTicketDialog
        open={!!editTarget}
        threat={editTarget}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        onUpdate={handleUpdate}
        onClose={handleClose}
        saving={dialogSaving}
      />
    </div>
  );
}