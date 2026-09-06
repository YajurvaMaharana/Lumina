import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle2,
  Shield,
  Clock,
  Users,
  MapPin,
  ExternalLink,
  AlertTriangle,
  BookOpen,
  XCircle,
  ChevronRight,
  Info
} from 'lucide-react';
import NeuralOrbit, { NeuralOrbitLoader } from './NeuralOrbit';
import { useAuth } from '../lib/AuthContext';
import { CalendarEvent, CalendarIntegrationSettings } from '../types';

interface CalendarIntegrationSectionProps {
  onSelectJournal: (journalId: string | 'new', calendarEventMeta?: { eventId: string; eventSummary: string; eventTime: string }) => void;
}

export default function CalendarIntegrationSection({ onSelectJournal }: CalendarIntegrationSectionProps) {
  const { user } = useAuth();

  // Connection state
  const [status, setStatus] = useState<CalendarIntegrationSettings>({
    connected: false,
    connectedEmail: null,
    lastSyncedAt: null,
    autoPromptAfterMeeting: false
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // Events state
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isFetchingEvents, setIsFetchingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // General state
  const [statusError, setStatusError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar_connected') === 'true') {
      setSuccessMessage('Google Calendar connected successfully!');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh status
      fetchStatus();
    }
    const calError = params.get('calendar_error');
    if (calError) {
      const errorMessages: Record<string, string> = {
        consent_denied: 'Calendar access was denied. Please try again and accept the permissions.',
        invalid_callback: 'Invalid OAuth callback. Please try connecting again.',
        not_configured: 'Calendar integration is not configured on the server.',
        expired_state: 'OAuth session expired. Please try connecting again.',
        token_exchange_failed: 'Failed to authenticate with Google. Please try again.',
        callback_failed: 'Connection failed. Please try again.'
      };
      setStatusError(errorMessages[calError] || 'An error occurred connecting your calendar.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load status on mount
  useEffect(() => {
    if (user) {
      fetchStatus();
    }
  }, [user]);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/calendar/status', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        // Auto-fetch events if connected
        if (data.connected) {
          fetchEvents();
        }
      }
    } catch (err) {
      console.error('[Calendar] Status fetch error:', err);
    }
  }, [user]);

  const handleConnect = async () => {
    if (!user) return;
    setIsConnecting(true);
    setStatusError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/calendar/oauth/start', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start OAuth flow');
      }
      const data = await res.json();
      // Redirect to Google OAuth consent
      window.location.href = data.url;
    } catch (err: any) {
      setStatusError(err.message || 'Failed to connect calendar');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setIsDisconnecting(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        setStatus({ connected: false, connectedEmail: null, lastSyncedAt: null, autoPromptAfterMeeting: false });
        setEvents([]);
        setSuccessMessage('Calendar disconnected and tokens revoked.');
        setShowDisconnectModal(false);
      } else {
        const data = await res.json();
        setStatusError(data.error || 'Failed to disconnect');
      }
    } catch (err: any) {
      setStatusError(err.message || 'Failed to disconnect calendar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const fetchEvents = async () => {
    if (!user) return;
    setIsFetchingEvents(true);
    setEventsError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/calendar/events', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) {
          setStatus(prev => ({ ...prev, connected: false }));
        }
        throw new Error(data.error || 'Failed to fetch events');
      }
      const data = await res.json();
      setEvents(data.events || []);
      setStatus(prev => ({ ...prev, lastSyncedAt: Date.now() }));
    } catch (err: any) {
      setEventsError(err.message || 'Failed to load events');
    } finally {
      setIsFetchingEvents(false);
    }
  };

  const handleReflect = (event: CalendarEvent) => {
    onSelectJournal('new', {
      eventId: event.id,
      eventSummary: event.summary,
      eventTime: event.start
    });
  };

  const formatEventTime = (isoString: string, isAllDay: boolean) => {
    if (isAllDay) return 'All Day';
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const formatEventDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }).format(new Date(isoString));
    } catch {
      return '';
    }
  };

  const formatDuration = (start: string, end: string) => {
    try {
      const ms = new Date(end).getTime() - new Date(start).getTime();
      const mins = Math.round(ms / 60000);
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
    } catch {
      return '';
    }
  };

  const formatLastSynced = (ts: number | null) => {
    if (!ts) return 'Never';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
  };

  // Group events by date
  const groupedEvents: Record<string, CalendarEvent[]> = {};
  const now = new Date();
  events.forEach(ev => {
    const dateStr = formatEventDate(ev.start);
    if (!groupedEvents[dateStr]) groupedEvents[dateStr] = [];
    groupedEvents[dateStr].push(ev);
  });

  // Split into past and upcoming
  const pastEvents = events.filter(ev => new Date(ev.end) < now);
  const upcomingEvents = events.filter(ev => new Date(ev.end) >= now);

  // Auto-clear success/error messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (statusError) {
      const timer = setTimeout(() => setStatusError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [statusError]);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-900/20 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Google Calendar</h2>
          <p className="text-xs text-[var(--text-muted)]">Sync events and create contextual journal reflections</p>
        </div>
      </div>

      {/* Status Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {statusError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{statusError}</span>
        </div>
      )}

      {/* Connection Card */}
      <div className="glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Connection Status</h3>
              {/* Status Pill */}
              {status.connected ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              ) : isConnecting ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                  <NeuralOrbit size={14} speed="fast" glow={false} />
                  Connecting...
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-faint)]" />
                  Disconnected
                </span>
              )}
            </div>

            {status.connected && (
              <span className="text-[10px] text-[var(--text-faint)]">
                Last synced: {formatLastSynced(status.lastSyncedAt)}
              </span>
            )}
          </div>

          {status.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  Signed in as <strong className="text-[var(--text-primary)]">{status.connectedEmail}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchEvents}
                  disabled={isFetchingEvents}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors shadow-sm shadow-blue-900/20 disabled:opacity-50"
                >
                  {isFetchingEvents ? <NeuralOrbit size={16} speed="fast" glow={false} /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Refresh Events
                </button>
                <button
                  onClick={() => setShowDisconnectModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-red-500 text-xs font-semibold hover:bg-red-500/10 hover:border-red-500/20 transition-colors"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Connect your Google Calendar to see recent and upcoming events, then create contextual journal reflections linked to specific meetings.
              </p>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold hover:from-blue-500 hover:to-cyan-400 transition-all shadow-lg shadow-blue-900/25 disabled:opacity-50"
              >
                {isConnecting ? <NeuralOrbit size={18} speed="fast" glow={false} /> : <Link2 className="w-4 h-4" />}
                Connect Google Calendar
              </button>
            </div>
          )}
        </div>

        {/* Privacy Notice */}
        <div className="px-6 py-3.5 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-violet-500 dark:text-violet-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">
            <strong className="text-[var(--text-muted)]">Privacy:</strong> Lumina only reads your event titles, times, and attendee counts to suggest contextual journal prompts. 
            We never modify, create, or delete calendar events. Your OAuth tokens are stored securely server-side and can be revoked at any time.
          </p>
        </div>
      </div>

      {/* Events Section (only when connected) */}
      {status.connected && (
        <div className="space-y-4">
          {eventsError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{eventsError}</span>
              <button onClick={fetchEvents} className="ml-auto text-xs underline hover:no-underline">Retry</button>
            </div>
          )}

          {isFetchingEvents && events.length === 0 ? (
            <NeuralOrbitLoader size={44} label="Fetching Google Calendar events..." />
          ) : events.length === 0 && !eventsError ? (
            <div className="text-center py-12 glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
              <Calendar className="w-10 h-10 text-[var(--text-faint)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">No events found in the past or next 7 days.</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Click "Refresh Events" to check again.</p>
            </div>
          ) : (
            <>
              {/* Upcoming Events */}
              {upcomingEvents.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ChevronRight className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Upcoming</h3>
                    <span className="text-[10px] text-[var(--text-faint)] bg-[var(--bg-card-hover)] px-2 py-0.5 rounded-md">{upcomingEvents.length}</span>
                  </div>
                  <div className="space-y-2">
                    {upcomingEvents.map(ev => (
                      <EventCard key={ev.id} event={ev} onReflect={handleReflect} formatTime={formatEventTime} formatDate={formatEventDate} formatDuration={formatDuration} isPast={false} />
                    ))}
                  </div>
                </div>
              )}

              {/* Past Events */}
              {pastEvents.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 mt-6">
                    <Clock className="w-4 h-4 text-[var(--text-faint)]" />
                    <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider">Past Events</h3>
                    <span className="text-[10px] text-[var(--text-faint)] bg-[var(--bg-card-hover)] px-2 py-0.5 rounded-md">{pastEvents.length}</span>
                  </div>
                  <div className="space-y-2">
                    {pastEvents.map(ev => (
                      <EventCard key={ev.id} event={ev} onReflect={handleReflect} formatTime={formatEventTime} formatDate={formatEventDate} formatDuration={formatDuration} isPast={true} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Integration Info */}
      <div className="glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="space-y-2 text-xs text-[var(--text-muted)]">
            <p className="font-semibold text-[var(--text-secondary)]">Integration Details</p>
            <ul className="space-y-1.5 list-disc list-inside text-[var(--text-faint)]">
              <li>Events from the past 7 days and next 7 days are fetched from your primary calendar</li>
              <li>Click <strong className="text-[var(--text-muted)]">"Reflect on this"</strong> on any event to open a new journal session pre-linked to that meeting</li>
              <li>Lumina uses <strong className="text-[var(--text-muted)]">read-only</strong> access (calendar.readonly scope)</li>
              <li>You can disconnect and revoke access at any time — all stored tokens will be permanently deleted</li>
              <li>Token refresh is handled automatically; re-authentication is only needed if you manually revoke access from your Google Account</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <Unlink className="w-6 h-6" />
              <h3 className="text-lg font-bold">Disconnect Calendar?</h3>
            </div>
            <p className="text-[var(--text-muted)] text-sm mb-2 leading-relaxed">
              This will immediately:
            </p>
            <ul className="text-[var(--text-faint)] text-xs space-y-1 mb-6 list-disc list-inside">
              <li>Revoke Lumina's access to your Google Calendar</li>
              <li>Delete all stored OAuth tokens from our servers</li>
              <li>Remove synced event data from this view</li>
            </ul>
            <p className="text-[var(--text-faint)] text-xs mb-6">
              Your existing journal entries linked to calendar events will <strong className="text-[var(--text-muted)]">not</strong> be deleted.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDisconnectModal(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors shadow-sm shadow-red-900/20 disabled:opacity-50"
              >
                {isDisconnecting && <NeuralOrbit size={15} speed="fast" glow={false} />}
                Disconnect & Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface EventCardProps {
  key?: React.Key;
  event: CalendarEvent;
  onReflect: (event: CalendarEvent) => void;
  formatTime: (iso: string, isAllDay: boolean) => string;
  formatDate: (iso: string) => string;
  formatDuration: (start: string, end: string) => string;
  isPast: boolean;
}

// Sub-component: Event Card
const EventCard: React.FC<EventCardProps> = ({
  event,
  onReflect,
  formatTime,
  formatDate,
  formatDuration,
  isPast
}) => {
  const duration = formatDuration(event.start, event.end);

  return (
    <div className={`group glass rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 transition-all hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-color)] ${isPast ? 'opacity-75 hover:opacity-100' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {formatDate(event.start)}
            </span>
            <span className="text-[10px] text-[var(--text-faint)]">•</span>
            <span className="text-[10px] text-[var(--text-faint)]">
              {formatTime(event.start, event.isAllDay)}
            </span>
            {duration && (
              <>
                <span className="text-[10px] text-[var(--text-faint)]">•</span>
                <span className="text-[10px] text-[var(--text-faint)] flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {duration}
                </span>
              </>
            )}
          </div>

          <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
            {event.summary}
          </h4>

          <div className="flex items-center gap-3 mt-1.5">
            {event.attendeeCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
                <Users className="w-3 h-3" />
                {event.attendeeCount} attendee{event.attendeeCount !== 1 ? 's' : ''}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-faint)] truncate max-w-[150px]">
                <MapPin className="w-3 h-3 shrink-0" />
                {event.location}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onReflect(event)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-500 transition-colors shadow-sm shadow-violet-900/20 opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <BookOpen className="w-3 h-3" />
            Reflect
          </button>
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-[var(--text-faint)] hover:text-blue-500 hover:bg-blue-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              title="Open in Google Calendar"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
