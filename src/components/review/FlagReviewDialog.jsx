import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Mail } from "lucide-react";

export default function FlagReviewDialog({ open, onOpenChange, threat, users, currentUser, onSubmit, submitting }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [message, setMessage] = useState("");

  const eligible = useMemo(
    () => (users || []).filter((u) => u.id !== currentUser?.id),
    [users, currentUser]
  );

  const handleSubmit = () => {
    let target;
    if (eligible.length > 0 && selectedUserId) {
      target = eligible.find((u) => u.id === selectedUserId);
    } else if (manualEmail) {
      target = { email: manualEmail, full_name: manualEmail.split("@")[0] };
    }
    if (!target) return;
    onSubmit({ target, message });
    setSelectedUserId("");
    setManualEmail("");
    setMessage("");
  };

  const canSubmit = (eligible.length > 0 && selectedUserId) || (!eligible.length && manualEmail);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Flag for Review</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Request a team member to review <strong className="text-foreground">{threat?.title}</strong>. They'll receive an email notification.
          </p>
          {eligible.length > 0 ? (
            <div>
              <label className="text-sm font-medium mb-2 block">Assign to</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a team member…</option>
                {eligible.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium mb-2 block">Team member email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-2 block">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add context for the reviewer…"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Flag & Notify
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}