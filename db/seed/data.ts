// Demo data: 3 fictional clients, 2 Boldly staff, 1 client user (phase 2).
// All names, emails and account IDs are made up. IDs are fixed so tests and
// demo links are stable.

export const DEMO_IDS = {
  users: {
    admin: "00000000-0000-4000-8000-000000000001",
    specialist: "00000000-0000-4000-8000-000000000002",
    harbourlineClient: "00000000-0000-4000-8000-000000000003",
  },
  clients: {
    harbourline: "10000000-0000-4000-8000-000000000001",
    northvale: "10000000-0000-4000-8000-000000000002",
    escarpment: "10000000-0000-4000-8000-000000000003",
  },
} as const;

export const demoUsers = [
  {
    id: DEMO_IDS.users.admin,
    email: "alex.morgan@demo.boldlyos.test",
    name: "Alex Morgan",
    title: "Managing Partner",
    role: "admin" as const,
    clientId: null,
  },
  {
    id: DEMO_IDS.users.specialist,
    email: "jordan.lee@demo.boldlyos.test",
    name: "Jordan Lee",
    title: "Digital Marketing Specialist",
    role: "team" as const,
    clientId: null,
  },
  {
    id: DEMO_IDS.users.harbourlineClient,
    email: "priya.shah@demo.harbourline.test",
    name: "Priya Shah",
    title: "Practice Manager, Harbourline Dental",
    role: "client_user" as const,
    clientId: DEMO_IDS.clients.harbourline,
  },
];

export const demoClients = [
  {
    id: DEMO_IDS.clients.harbourline,
    slug: "harbourline-dental",
    name: "Harbourline Dental Group",
    legalName: "Harbourline Dental Group Inc.",
    website: "https://harbourline-dental.example",
    industry: "Healthcare",
    city: "Hamilton, ON",
    status: "active" as const,
    services: ["Paid search", "Paid social", "SEO"],
    notes: "Three clinics. New-patient bookings are the primary KPI.",
    channels: [
      { channel: "google_ads" as const, externalAccountId: "412-883-1904", label: "Harbourline – Search" },
      { channel: "meta" as const, externalAccountId: "act_100000000000001", label: "Harbourline Dental" },
      { channel: "ga4" as const, externalAccountId: "properties/310000001", label: "harbourline-dental.example" },
    ],
    contacts: [
      { name: "Priya Shah", email: "priya.shah@demo.harbourline.test", title: "Practice Manager", isPrimary: true, isApprover: true },
      { name: "Dr. Marcus Bell", email: "marcus.bell@demo.harbourline.test", title: "Owner", isPrimary: false, isApprover: true },
    ],
  },
  {
    id: DEMO_IDS.clients.northvale,
    slug: "northvale-credit-union",
    name: "Northvale Credit Union",
    legalName: "Northvale Community Credit Union Ltd.",
    website: "https://northvale-cu.example",
    industry: "Financial services",
    city: "Burlington, ON",
    status: "active" as const,
    services: ["Paid search", "Paid social", "Content", "Video & podcast"],
    notes: "Compliance reviews all ad copy before client approval.",
    channels: [
      { channel: "google_ads" as const, externalAccountId: "735-210-4471", label: "Northvale – Mortgages" },
      { channel: "google_ads" as const, externalAccountId: "735-210-9902", label: "Northvale – Brand" },
      { channel: "meta" as const, externalAccountId: "act_100000000000002", label: "Northvale CU" },
      { channel: "ga4" as const, externalAccountId: "properties/310000002", label: "northvale-cu.example" },
    ],
    contacts: [
      { name: "Elena Fischer", email: "elena.fischer@demo.northvale.test", title: "Director, Marketing", isPrimary: true, isApprover: true },
      { name: "Sam Okafor", email: "sam.okafor@demo.northvale.test", title: "Compliance Officer", isPrimary: false, isApprover: true },
    ],
  },
  {
    id: DEMO_IDS.clients.escarpment,
    slug: "escarpment-brewing",
    name: "Escarpment Brewing Co.",
    legalName: "Escarpment Brewing Company Ltd.",
    website: "https://escarpment-brewing.example",
    industry: "Food & beverage",
    city: "Hamilton, ON",
    status: "active" as const,
    services: ["Paid social", "Video & podcast", "Brand"],
    notes: "Seasonal launches; taproom events drive most paid social.",
    channels: [
      { channel: "meta" as const, externalAccountId: "act_100000000000003", label: "Escarpment Brewing" },
      { channel: "ga4" as const, externalAccountId: "properties/310000003", label: "escarpment-brewing.example" },
    ],
    contacts: [
      { name: "Chris Dunn", email: "chris.dunn@demo.escarpment.test", title: "Co-founder", isPrimary: true, isApprover: true },
    ],
  },
];

/** [clientKey | null, actor, minutesAgo, module, action, summary] */
export const demoActivity: Array<[keyof typeof DEMO_IDS.clients | null, keyof typeof DEMO_IDS.users, number, string, string, string]> = [
  ["harbourline", "admin", 60 * 24 * 21, "core", "client.created", "Created client Harbourline Dental Group"],
  ["northvale", "admin", 60 * 24 * 20, "core", "client.created", "Created client Northvale Credit Union"],
  ["escarpment", "admin", 60 * 24 * 19, "core", "client.created", "Created client Escarpment Brewing Co."],
  [null, "admin", 60 * 24 * 18, "core", "team.invited", "Added Jordan Lee as a team member"],
  ["northvale", "specialist", 60 * 24 * 6, "core", "channel.added", "Added Google Ads account 735-210-9902"],
  ["harbourline", "specialist", 60 * 26, "core", "contact.added", "Added contact Dr. Marcus Bell"],
  ["escarpment", "specialist", 60 * 3, "core", "client.updated", "Updated client details (notes)"],
];
