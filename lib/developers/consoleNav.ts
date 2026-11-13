// The console's sidebar and every setting on its pages, as data. The sidebar
// renders CONSOLE_NAV; the search indexes both, so a setting is findable by
// name even though it lives halfway down a page.

export type NavIcon =
  | 'overview' | 'keys' | 'webhooks' | 'miniplayer' | 'modes' | 'dispositions'
  | 'seats' | 'usage' | 'billing' | 'settings' | 'docs' | 'api'

export interface NavItem {
  href: string
  label: string
  group: 'Platform' | 'Configure' | 'Account' | 'Docs'
  icon: NavIcon
  description: string
  keywords: string[]
}

export const CONSOLE_NAV: NavItem[] = [
  { href: '/console', label: 'Overview', group: 'Platform', icon: 'overview',
    description: 'Where your integration stands: account, keys, webhooks, seats and live dialing, with the next step to take.',
    keywords: ['home', 'dashboard', 'status', 'checklist', 'progress'] },
  { href: '/console/api-keys', label: 'API keys', group: 'Platform', icon: 'keys',
    description: 'Create, copy and revoke secret and publishable keys for test and live.',
    keywords: ['secret key', 'publishable key', 'token', 'credentials', 'sk_test', 'sk_live', 'pk_test', 'pk_live', 'rotate', 'revoke'] },
  { href: '/console/webhooks', label: 'Webhooks', group: 'Platform', icon: 'webhooks',
    description: 'Endpoints that receive call, disposition and seat events, with their signing secrets.',
    keywords: ['events', 'callback url', 'endpoint', 'signing secret', 'whsec', 'notifications'] },
  { href: '/console/miniplayer', label: 'Miniplayer', group: 'Platform', icon: 'miniplayer',
    description: 'The embed snippet for the portable dialer, and the origins allowed to load it.',
    keywords: ['embed', 'widget', 'iframe', 'script', 'snippet', 'allowed origins', 'domains', 'portable dialer', 'sdk'] },
  { href: '/console/dial-modes', label: 'Dial modes', group: 'Configure', icon: 'modes',
    description: 'The dial mode for your whole platform, the modes allowed, and exceptions per seat or campaign.',
    keywords: ['dialer mode', 'predictive', 'power', 'progressive', 'preview', 'policy', 'exceptions', 'upgrades', 'override'] },
  { href: '/console/dispositions', label: 'Dispositions', group: 'Configure', icon: 'dispositions',
    description: 'Your CRM\'s own outcomes, shown to agents in the miniplayer and sent back by code.',
    keywords: ['outcomes', 'results', 'wrap up', 'codes', 'status', 'mapping'] },
  { href: '/console/seats', label: 'Seats', group: 'Configure', icon: 'seats',
    description: 'Every user on your platform who dials, who pays for them, and their status.',
    keywords: ['users', 'agents', 'members', 'reps', 'licenses'] },
  { href: '/console/usage', label: 'Usage', group: 'Account', icon: 'usage',
    description: 'Seat-weeks and dials by week. Real numbers only; empty until you dial.',
    keywords: ['dials', 'metering', 'consumption', 'stats', 'volume'] },
  { href: '/console/billing', label: 'Billing', group: 'Account', icon: 'billing',
    description: 'Live dialing, who pays for seats, your tier, and your negotiated rates.',
    keywords: ['pricing', 'invoice', 'payment', 'plan', 'tier', 'rates', 'activate', 'live dialing', 'revenue share', 'sales'] },
  { href: '/console/settings', label: 'Settings', group: 'Account', icon: 'settings',
    description: 'Your platform\'s name and website, and how your developer account relates to dialerseat.com.',
    keywords: ['platform name', 'company', 'website', 'profile', 'account'] },
  { href: '/docs/quickstart', label: 'Docs', group: 'Docs', icon: 'docs',
    description: 'Quickstart and guides.',
    keywords: ['documentation', 'guide', 'help', 'tutorial'] },
  { href: '/docs/api', label: 'API reference', group: 'Docs', icon: 'api',
    description: 'Every endpoint, with method, path and what it does.',
    keywords: ['endpoints', 'rest', 'reference', 'routes'] },
]

export interface SettingItem { href: string; page: string; label: string; description: string; keywords: string[] }

export const CONSOLE_SETTINGS: SettingItem[] = [
  { page: 'API keys', href: '/console/api-keys#create', label: 'Create a secret key', description: 'Make a new secret key for your server. It is shown once.', keywords: ['new key', 'generate', 'add key', 'roll'] },
  { page: 'API keys', href: '/console/api-keys#publishable', label: 'Publishable keys', description: 'Keys safe for the browser, used by the miniplayer loader.', keywords: ['public key', 'frontend', 'client'] },
  { page: 'API keys', href: '/console/api-keys#secret', label: 'Revoke a key', description: 'Stop a key working immediately. Cannot be undone.', keywords: ['leaked', 'compromised', 'delete key', 'disable key'] },
  { page: 'API keys', href: '/console/api-keys#env', label: 'Test and live environments', description: 'Switch between test keys and live keys.', keywords: ['sandbox', 'production', 'toggle'] },
  { page: 'Webhooks', href: '/console/webhooks#add', label: 'Add an endpoint', description: 'A URL that receives the events you choose.', keywords: ['new webhook', 'url', 'subscribe'] },
  { page: 'Webhooks', href: '/console/webhooks#endpoints', label: 'Signing secret', description: 'The whsec_ secret that signs every delivery to an endpoint.', keywords: ['hmac', 'verify', 'signature', 'whsec'] },
  { page: 'Miniplayer', href: '/console/miniplayer#snippet', label: 'Embed snippet', description: 'The script tag and mount call to paste into your app.', keywords: ['install', 'code', 'copy', 'html'] },
  { page: 'Miniplayer', href: '/console/miniplayer#origins', label: 'Allowed origins', description: 'Domains allowed to load the miniplayer.', keywords: ['cors', 'domain', 'whitelist', 'frame ancestors', 'staging'] },
  { page: 'Dial modes', href: '/console/dial-modes#default', label: 'Default dial mode', description: 'The mode every seat starts in.', keywords: ['platform wide', 'standard'] },
  { page: 'Dial modes', href: '/console/dial-modes#allowed', label: 'Allowed dial modes', description: 'Which modes seats may use at all.', keywords: ['restrict', 'turn off predictive', 'enable'] },
  { page: 'Dial modes', href: '/console/dial-modes#allowed', label: 'Seats may choose their mode', description: 'Whether a seat can switch between allowed modes itself.', keywords: ['agent choice', 'lock mode'] },
  { page: 'Dial modes', href: '/console/dial-modes#exceptions', label: 'Dial-mode exceptions', description: 'Override the policy for one seat or one campaign.', keywords: ['upgrade', 'override', 'special case', 'per seat', 'per campaign'] },
  { page: 'Dispositions', href: '/console/dispositions#add', label: 'Add a disposition', description: 'Add one of your outcomes with its code, label and outcome class.', keywords: ['new outcome', 'custom'] },
  { page: 'Billing', href: '/console/billing#live', label: 'Activate live dialing', description: 'Turn on real calls for live keys. Until then, everything works in test mode.', keywords: ['go live', 'production', 'pay', 'enable dialing', 'paid'] },
  { page: 'Billing', href: '/console/billing#model', label: 'Who pays for seats', description: 'User-billed, platform-billed, or mixed.', keywords: ['billing model', 'user pays', 'platform pays', 'resell'] },
  { page: 'Billing', href: '/console/billing#rates', label: 'Negotiated rates', description: 'Your seat-week price, included dials and per-dial overage once sales sets them.', keywords: ['price', 'volume', 'discount', 'contract'] },
  { page: 'Billing', href: '/console/billing#tiers', label: 'Tiers', description: 'Sandbox, Launch, Scale and Partner.', keywords: ['plans', 'upgrade plan'] },
  { page: 'Settings', href: '/console/settings#platform', label: 'Platform name and website', description: 'How your platform appears in the console and on invoices.', keywords: ['rename', 'company name', 'url'] },
  { page: 'Settings', href: '/console/settings#independent', label: 'Your dialerseat.com account', description: 'Your developer account and your dialerseat.com account are separate.', keywords: ['subscription', 'linked', 'separate', 'independent', 'same login', 'my dialer', 'teams', 'main site'] },
]
