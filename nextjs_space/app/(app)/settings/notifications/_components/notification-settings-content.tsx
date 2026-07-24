'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { FadeIn, SlideIn } from '@/components/ui/animate';
import { Bell, Mail, MessageSquare, Users, Save, TestTube, Clock, Shield, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationPreference {
  id: string;
  emailEnabled: boolean;
  slackEnabled: boolean;
  teamsEnabled: boolean;
  email: string | null;
  slackWebhook: string | null;
  slackChannel: string | null;
  teamsWebhook: string | null;
  minSeverity: string;
  kevOnly: boolean;
  assetMatchOnly: boolean;
  digestMode: string;
  digestTime: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export default function NotificationSettingsContent() {
  const [prefs, setPrefs] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/notifications/preferences');
      if (res.ok) {
        const data = await res.json();
        setPrefs(data);
      }
    } catch (error) {
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });

      if (res.ok) {
        toast.success('Notification preferences saved');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save preferences');
      }
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (channel: string) => {
    setTesting(channel);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Test ${channel.toLowerCase()} notification sent!`);
      } else {
        toast.error(data.error || `Failed to send test ${channel.toLowerCase()} notification`);
      }
    } catch (error) {
      toast.error('Failed to send test notification');
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading preferences...</div>
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Failed to load preferences</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[900px] mx-auto">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Notification Settings</h1>
              <p className="text-sm text-muted-foreground">Configure how you receive threat alerts</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </FadeIn>

      {/* Channel Configuration */}
      <SlideIn from="bottom" delay={0.1}>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Notification Channels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email */}
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label className="font-medium">Email</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                </div>
                <div className="pl-8 space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={prefs.emailEnabled}
                      onCheckedChange={(checked) => setPrefs({ ...prefs, emailEnabled: checked })}
                    />
                    <Label>Enable email notifications</Label>
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-xs">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={prefs.email || ''}
                      onChange={(e) => setPrefs({ ...prefs, email: e.target.value })}
                      disabled={!prefs.emailEnabled}
                    />
                  </div>
                  {!process.env.NEXT_PUBLIC_SMTP_CONFIGURED && (
                    <div className="text-xs text-amber-500 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      SMTP not configured - emails will be logged but not sent
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTest('EMAIL')}
                    disabled={!prefs.emailEnabled || !prefs.email || testing === 'EMAIL'}
                    className="gap-1"
                  >
                    <TestTube className="w-3 h-3" />
                    {testing === 'EMAIL' ? 'Sending...' : 'Test Email'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Slack */}
            <div className="flex items-start justify-between border-t pt-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label className="font-medium">Slack</Label>
                    <p className="text-sm text-muted-foreground">Post notifications to Slack channel</p>
                  </div>
                </div>
                <div className="pl-8 space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={prefs.slackEnabled}
                      onCheckedChange={(checked) => setPrefs({ ...prefs, slackEnabled: checked })}
                    />
                    <Label>Enable Slack notifications</Label>
                  </div>
                  <div>
                    <Label htmlFor="slackWebhook" className="text-xs">Incoming Webhook URL</Label>
                    <Input
                      id="slackWebhook"
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={prefs.slackWebhook || ''}
                      onChange={(e) => setPrefs({ ...prefs, slackWebhook: e.target.value })}
                      disabled={!prefs.slackEnabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor="slackChannel" className="text-xs">Channel Name (optional)</Label>
                    <Input
                      id="slackChannel"
                      placeholder="#security-alerts"
                      value={prefs.slackChannel || ''}
                      onChange={(e) => setPrefs({ ...prefs, slackChannel: e.target.value })}
                      disabled={!prefs.slackEnabled}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTest('SLACK')}
                    disabled={!prefs.slackEnabled || !prefs.slackWebhook || testing === 'SLACK'}
                    className="gap-1"
                  >
                    <TestTube className="w-3 h-3" />
                    {testing === 'SLACK' ? 'Sending...' : 'Test Slack'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Teams */}
            <div className="flex items-start justify-between border-t pt-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label className="font-medium">Microsoft Teams</Label>
                    <p className="text-sm text-muted-foreground">Post notifications to Teams channel</p>
                  </div>
                </div>
                <div className="pl-8 space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={prefs.teamsEnabled}
                      onCheckedChange={(checked) => setPrefs({ ...prefs, teamsEnabled: checked })}
                    />
                    <Label>Enable Teams notifications</Label>
                  </div>
                  <div>
                    <Label htmlFor="teamsWebhook" className="text-xs">Incoming Webhook URL</Label>
                    <Input
                      id="teamsWebhook"
                      type="url"
                      placeholder="https://outlook.office.com/webhook/..."
                      value={prefs.teamsWebhook || ''}
                      onChange={(e) => setPrefs({ ...prefs, teamsWebhook: e.target.value })}
                      disabled={!prefs.teamsEnabled}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTest('TEAMS')}
                    disabled={!prefs.teamsEnabled || !prefs.teamsWebhook || testing === 'TEAMS'}
                    className="gap-1"
                  >
                    <TestTube className="w-3 h-3" />
                    {testing === 'TEAMS' ? 'Sending...' : 'Test Teams'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </SlideIn>

      {/* Trigger Preferences */}
      <SlideIn from="bottom" delay={0.2}>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Notification Triggers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="minSeverity">Minimum Severity</Label>
              <Select
                value={prefs.minSeverity}
                onValueChange={(value) => setPrefs({ ...prefs, minSeverity: value })}
              >
                <SelectTrigger id="minSeverity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICAL">Critical Only</SelectItem>
                  <SelectItem value="HIGH">High & Above</SelectItem>
                  <SelectItem value="MEDIUM">Medium & Above</SelectItem>
                  <SelectItem value="LOW">All Threats</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Only notify for threats at or above this severity</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>KEV Threats Only</Label>
                <p className="text-xs text-muted-foreground">Only notify for CISA Known Exploited Vulnerabilities</p>
              </div>
              <Switch
                checked={prefs.kevOnly}
                onCheckedChange={(checked) => setPrefs({ ...prefs, kevOnly: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Asset Matches Only</Label>
                <p className="text-xs text-muted-foreground">Only notify when threats match your linked assets</p>
              </div>
              <Switch
                checked={prefs.assetMatchOnly}
                onCheckedChange={(checked) => setPrefs({ ...prefs, assetMatchOnly: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </SlideIn>

      {/* Delivery Mode */}
      <SlideIn from="bottom" delay={0.3}>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Delivery Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="digestMode">Delivery Mode</Label>
              <Select
                value={prefs.digestMode}
                onValueChange={(value) => setPrefs({ ...prefs, digestMode: value })}
              >
                <SelectTrigger id="digestMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMMEDIATE">Immediate</SelectItem>
                  <SelectItem value="DAILY">Daily Digest</SelectItem>
                  <SelectItem value="WEEKLY">Weekly Digest</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {prefs.digestMode === 'IMMEDIATE' && 'Send notifications as threats are detected'}
                {prefs.digestMode === 'DAILY' && 'Accumulate and send once per day'}
                {prefs.digestMode === 'WEEKLY' && 'Accumulate and send once per week (Mondays)'}
              </p>
            </div>

            {(prefs.digestMode === 'DAILY' || prefs.digestMode === 'WEEKLY') && (
              <div>
                <Label htmlFor="digestTime">Digest Time</Label>
                <Input
                  id="digestTime"
                  type="time"
                  value={prefs.digestTime}
                  onChange={(e) => setPrefs({ ...prefs, digestTime: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Time of day to send digest (24-hour format)</p>
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Enable Quiet Hours</Label>
                <Switch
                  checked={prefs.quietHoursEnabled}
                  onCheckedChange={(checked) => setPrefs({ ...prefs, quietHoursEnabled: checked })}
                />
              </div>
              {prefs.quietHoursEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quietStart" className="text-xs">Start Time</Label>
                    <Input
                      id="quietStart"
                      type="time"
                      value={prefs.quietHoursStart || '22:00'}
                      onChange={(e) => setPrefs({ ...prefs, quietHoursStart: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quietEnd" className="text-xs">End Time</Label>
                    <Input
                      id="quietEnd"
                      type="time"
                      value={prefs.quietHoursEnd || '08:00'}
                      onChange={(e) => setPrefs({ ...prefs, quietHoursEnd: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Notifications during quiet hours will be held and delivered when the period ends
              </p>
            </div>
          </CardContent>
        </Card>
      </SlideIn>

      {/* Summary */}
      <SlideIn from="bottom" delay={0.4}>
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Current configuration:</span>
              <Badge variant="outline">
                {prefs.emailEnabled || prefs.slackEnabled || prefs.teamsEnabled
                  ? `${[prefs.emailEnabled && 'Email', prefs.slackEnabled && 'Slack', prefs.teamsEnabled && 'Teams'].filter(Boolean).join(', ')}`
                  : 'No channels enabled'}
              </Badge>
              <Badge variant="outline">{prefs.minSeverity}+ severity</Badge>
              <Badge variant="outline">{prefs.digestMode}</Badge>
            </div>
          </CardContent>
        </Card>
      </SlideIn>
    </div>
  );
}
