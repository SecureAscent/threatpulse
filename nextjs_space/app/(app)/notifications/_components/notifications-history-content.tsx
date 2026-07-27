'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FadeIn, SlideIn } from '@/components/ui/animate';
import { Bell, Mail, MessageSquare, Users, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface NotificationLog {
  id: string;
  type: string;
  channel: string;
  status: string;
  title: string;
  message: string;
  sentAt: string | null;
  createdAt: string;
  failureReason: string | null;
  threat?: { id: string; title: string; threatId: string };
}

const statusBadge: Record<string, string> = {
  SENT: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  FAILED: 'bg-red-500/10 text-red-500 border-red-500/20',
  PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
};

const channelIcons: Record<string, any> = {
  EMAIL: Mail,
  SLACK: MessageSquare,
  TEAMS: Users,
};

export default function NotificationsHistoryContent() {
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchHistory();
  }, [typeFilter, statusFilter]);

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/notifications/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setStats(data.stats || {});
      }
    } catch (error) {
      toast.error('Failed to load notification history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">
      <div className="text-muted-foreground">Loading notifications...</div>
    </div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Notification History</h1>
              <p className="text-sm text-muted-foreground">View all sent and pending notifications</p>
            </div>
          </div>
          <Link href="/settings/notifications">
            <Button variant="outline" size="sm">Settings</Button>
          </Link>
        </div>
      </FadeIn>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: (stats.SENT || 0) + (stats.FAILED || 0) + (stats.PENDING || 0), icon: Bell },
          { label: 'Sent', value: stats.SENT || 0, icon: CheckCircle, color: 'text-emerald-500' },
          { label: 'Failed', value: stats.FAILED || 0, icon: XCircle, color: 'text-red-500' },
          { label: 'Pending', value: stats.PENDING || 0, icon: Clock, color: 'text-yellow-500' },
        ].map((stat, i) => (
          <SlideIn key={stat.label} from="bottom" delay={i * 0.05}>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-display font-bold mt-1">{stat.value}</p>
                  </div>
                  <stat.icon className={`w-5 h-5 ${stat.color || 'text-muted-foreground'}`} />
                </div>
              </CardContent>
            </Card>
          </SlideIn>
        ))}
      </div>

      {/* Filters */}
      <SlideIn from="bottom" delay={0.2}>
        <Card className="border-border/50">
          <CardContent className="pt-4 flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="THREAT_ADDED">Threat Added</SelectItem>
                <SelectItem value="THREAT_STATUS_CHANGED">Status Changed</SelectItem>
                <SelectItem value="JIRA_TICKET_CREATED">Jira Ticket</SelectItem>
                <SelectItem value="ASSET_THREAT_MATCH">Asset Match</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </SlideIn>

      {/* Notification List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No notifications yet</p>
              <p className="text-sm">Configure your notification preferences to start receiving alerts</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notif, i) => {
            const ChannelIcon = channelIcons[notif.channel] || Bell;
            return (
              <SlideIn key={notif.id} from="bottom" delay={Math.min(i * 0.02, 0.3)}>
                <Card className="border-border/50 hover:border-border transition-colors">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                        <ChannelIcon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="font-medium">{notif.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{notif.message}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className={statusBadge[notif.status]}>
                                {notif.status}
                              </Badge>
                              <Badge variant="outline">{notif.channel}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(notif.createdAt).toLocaleString()}
                              </span>
                            </div>
                            {notif.failureReason && (
                              <p className="text-xs text-red-500 mt-2">Error: {notif.failureReason}</p>
                            )}
                            {notif.threat && (
                              <Link href={`/threats/${notif.threat.id}`} className="text-xs text-primary hover:underline mt-2 inline-block">
                                View Threat: {notif.threat.threatId}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </SlideIn>
            );
          })
        )}
      </div>
    </div>
  );
}
