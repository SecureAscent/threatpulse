import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export default function JiraTicketDialog({ open, threat, onOpenChange, onUpdate, onClose, saving }) {
  const [summary, setSummary] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (threat) {
      setSummary(threat.title ? `[ThreatPulse] ${threat.title}` : "");
      setComment("");
    }
  }, [threat]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Jira Ticket {threat?.ticket_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="jira-summary">Summary</Label>
            <Input
              id="jira-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ticket summary"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jira-comment">Comment</Label>
            <Textarea
              id="jira-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment to the ticket…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => onUpdate({ summary, comment })} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Update"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => onClose({ summary, comment })}
            disabled={saving}
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Closing…</> : "Update & Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}