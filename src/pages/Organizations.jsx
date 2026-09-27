import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Building2,
  Plus,
  Users,
  Trash2,
  Loader2,
  Globe,
  Shield,
  Crown,
  Mail,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PLAN_META = {
  free: { label: "Free", color: "bg-secondary text-secondary-foreground border-border" },
  smb: { label: "SMB", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  enterprise: { label: "Enterprise", color: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  self_hosted: { label: "Self-Hosted", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
};

export default function Organizations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", plan: "smb", seats: 10, data_region: "us-east" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [inviteOrg, setInviteOrg] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => base44.entities.Organization.list("-created_date", 50),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await base44.entities.Organization.create({
        ...form,
        seats: Number(form.seats),
        members: [user.id],
      });
      setShowCreate(false);
      setForm({ name: "", plan: "smb", seats: 10, data_region: "us-east" });
      qc.invalidateQueries({ queryKey: ["organizations"] });
    } catch (err) {
      setError(err.message || "Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    setError("");
    try {
      await base44.users.inviteUser(inviteEmail, "user");
      const org = orgs.find((o) => o.id === inviteOrg);
      const invitee = await base44.entities.User.filter({ email: inviteEmail });
      const userId = invitee[0]?.id;
      if (userId && org) {
        const members = [...(org.members || []), userId];
        await base44.entities.Organization.update(org.id, { members });
        qc.invalidateQueries({ queryKey: ["organizations"] });
      }
      setInviteEmail("");
      setInviteOrg(null);
    } catch (err) {
      setError(err.message || "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (org, userId) => {
    const members = (org.members || []).filter((m) => m !== userId);
    await base44.entities.Organization.update(org.id, { members });
    qc.invalidateQueries({ queryKey: ["organizations"] });
  };

  const handleDelete = async (org) => {
    if (!confirm(`Delete organization "${org.name}"? This cannot be undone.`)) return;
    await base44.entities.Organization.delete(org.id);
    qc.invalidateQueries({ queryKey: ["organizations"] });
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
            <p className="text-sm text-muted-foreground">Multi-tenant org management, seats, and SSO</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Organization
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : orgs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">No organizations yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first organization to start managing teams.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orgs.map((org) => {
            const planMeta = PLAN_META[org.plan] || PLAN_META.free;
            const memberUsers = (org.members || []).map((id) => users.find((u) => u.id === id)).filter(Boolean);
            return (
              <div key={org.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="p-5 border-b border-border flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{org.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${planMeta.color}`}>
                        {planMeta.label}
                      </span>
                      {org.sso_enabled && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border bg-primary/10 text-primary border-primary/20">
                          <Shield className="w-3 h-3" /> SSO
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {org.data_region || "us-east"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" /> {(org.members || []).length}/{org.seats || "∞"} seats
                      </span>
                      <span>Retention: {org.retention_days || 90}d</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setInviteOrg(org.id)}>
                      <Mail className="w-3.5 h-3.5 mr-1.5" /> Invite
                    </Button>
                    {org.created_by_id === user.id && (
                      <button onClick={() => handleDelete(org)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Members</p>
                  {memberUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members loaded. Invite users to this organization.</p>
                  ) : (
                    <div className="space-y-2">
                      {memberUsers.map((u) => (
                        <div key={u.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                              {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{u.full_name || u.email}</p>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {org.created_by_id === u.id && (
                              <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                                <Crown className="w-3 h-3" /> Owner
                              </span>
                            )}
                            {org.created_by_id !== u.id && (
                              <button
                                onClick={() => handleRemoveMember(org, u.id)}
                                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">New Organization</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Organization Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Acme Security"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Plan</label>
                <select
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="free">Free</option>
                  <option value="smb">SMB</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="self_hosted">Self-Hosted</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Seats</label>
                  <Input
                    type="number"
                    value={form.seats}
                    onChange={(e) => setForm({ ...form, seats: e.target.value })}
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Data Region</label>
                  <select
                    value={form.data_region}
                    onChange={(e) => setForm({ ...form, data_region: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="us-east">US East</option>
                    <option value="us-west">US West</option>
                    <option value="eu-west">EU West</option>
                    <option value="ap-southeast">AP Southeast</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" disabled={creating} className="flex-1">
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Organization
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {inviteOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Invite to Organization</h3>
              <button onClick={() => setInviteOrg(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email Address</label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="analyst@company.com"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1.5">They'll receive an invitation and be added to this organization.</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" disabled={inviting} className="flex-1">
                  {inviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Send Invitation
                </Button>
                <Button type="button" variant="outline" onClick={() => setInviteOrg(null)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}