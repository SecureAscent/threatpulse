import { Check, ShieldCheck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERMISSIONS, ROLE_DESCRIPTIONS, ROLES, hasPermission, type Permission } from '@/lib/rbac';

const permissionLabels: Record<Permission, string> = {
  'threats.read': 'View threats',
  'threats.manage': 'Manage threats',
  'assets.read': 'View assets',
  'assets.manage': 'Manage assets',
  'integrations.manage': 'Manage integrations',
  'users.manage': 'Manage users',
  'organizations.manage': 'Manage organizations',
  'departments.manage': 'Manage departments',
  'audit.read': 'View audit log',
  'platform.manage': 'Manage platform-wide settings',
};

export default function RolesPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
          <ShieldCheck className="h-4 w-4" /> Administration
        </div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Roles & Permissions</h1>
        <p className="text-sm text-muted-foreground mt-1">Reference the platform RBAC policy used by routes and administrative APIs.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {ROLES.map((role) => (
          <Card key={role}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {role}
                <Badge variant={role === 'SUPERADMIN' ? 'default' : 'outline'}>{role}</Badge>
              </CardTitle>
              <CardDescription>{ROLE_DESCRIPTIONS[role]}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{PERMISSIONS.filter((permission) => hasPermission(role, permission)).length}</p>
              <p className="text-xs text-muted-foreground">granted permissions</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Permission Matrix</CardTitle>
          <CardDescription>Permissions are cumulative by role and enforced server-side.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permission</TableHead>
                {ROLES.map((role) => <TableHead key={role} className="text-center">{role}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS.map((permission) => (
                <TableRow key={permission}>
                  <TableCell>
                    <div className="font-medium">{permissionLabels[permission]}</div>
                    <div className="font-mono text-xs text-muted-foreground">{permission}</div>
                  </TableCell>
                  {ROLES.map((role) => (
                    <TableCell key={role} className="text-center">
                      {hasPermission(role, permission)
                        ? <Check className="h-4 w-4 text-emerald-500 mx-auto" aria-label="Granted" />
                        : <X className="h-4 w-4 text-muted-foreground/50 mx-auto" aria-label="Not granted" />}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
