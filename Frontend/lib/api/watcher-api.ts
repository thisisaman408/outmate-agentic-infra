// Event-Based Discovery
export async function createEventWatcher(criteria: EventCriteria): Promise<EventWatcher>
export async function getEventMatches(watcherId: string): Promise<EventMatch[]>

// Account Watching
export async function createAccountWatcher(accountId: string, triggers: string[]): Promise<AccountWatcher>
export async function getAccountUpdates(watcherId: string): Promise<AccountUpdate[]>

// Lead Watching
export async function createLeadWatcher(leadId: string, triggers: string[]): Promise<LeadWatcher>
export async function getLeadUpdates(watcherId: string): Promise<LeadUpdate[]>

// Common
export async function listWatchers(type?: WatcherType): Promise<Watcher[]>
export async function updateWatcher(watcherId: string, updates: Partial<Watcher>): Promise<Watcher>
export async function deleteWatcher(watcherId: string): Promise<void>
export async function toggleWatcherStatus(watcherId: string): Promise<Watcher>