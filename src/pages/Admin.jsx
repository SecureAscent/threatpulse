import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Admin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("analyst");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const handleInvite = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setInviting(true);
    try {
      await base44.users.inviteUser(email, role);
      setSuccess(`Invitation sent to ${email}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      setError(err.message || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">Manage workspace members and roles.</p>
      </div>

      {/* Invite */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Invite Team Member</h3>
        </div>
        <form onSubmit={handleInvite} className="flex items-center gap-3 flex-wrap">
          <Input
            type="email"
            placeholder="analyst@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-48"
            required
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="analyst">Analyst</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <Button type="submit" disabled={inviting}>
            {inviting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : "Send Invite"}
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {success && <p className="mt-3 text-sm text-emerald-600">{success}</p>}
      </div>

      {/* Members */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold">Workspace Members</h3>
        </div>
        {isLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Email</th>
                <th className="text-left px-5 py-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium">{u.full_name || "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${(u.role === "admin" || u.role === "superadmin") ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary text-secondary-foreground border-border"}`}>
                      {(u.role === "admin" || u.role === "superadmin") && <ShieldCheck className="w-3 h-3" />}
                      {u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : "Analyst"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}