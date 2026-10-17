/**
 * The demo clinic: a fully configured example so the product can be tried
 * end to end straight after install. Clearly marked as a demo; every value
 * here is editable in the dashboard.
 */
import type { WeeklyHours } from '../db/schema.ts';
import { LIBRARY, type LibraryArticle } from './library.ts';

export const DEMO_CLINIC = {
  name: 'Brightside Dental (Demo)',
  slug: 'brightside-demo',
  publicKey: 'pk_demo_brightside',
  phone: '5550142200',
  email: 'hello@brightside-dental.example',
  notificationEmail: 'frontdesk@brightside-dental.example',
  website: 'https://brightside-dental.example',
  address: '248 Harbor View Ave, Suite 5, Springfield',
  timezone: 'America/New_York',
  hours: {
    sun: [],
    mon: [['08:00', '17:00']],
    tue: [['08:00', '17:00']],
    wed: [['08:00', '19:00']],
    thu: [['08:00', '17:00']],
    fri: [['08:00', '15:00']],
    sat: [['09:00', '13:00']],
  } as WeeklyHours,
  slotMinutes: 30,
  minNoticeHours: 2,
  greeting: null as string | null,
  emergencyInstructions: 'For after-hours dental emergencies, call our on-call line at (555) 014-2299.',
};

export const DEMO_OWNER = { name: 'Demo Owner', email: 'demo@leadflow.local', password: 'demo1234' };

/** Example price ranges (USD) for the demo clinic, typical of US private practices. */
const DEMO_PRICES: Record<string, [number, number]> = {
  'dental-implants': [3000, 5000],
  'implant-supported-dentures': [15000, 28000],
  'clear-aligners': [3500, 6500],
  braces: [3500, 7000],
  'porcelain-veneers': [950, 2500],
  'cosmetic-bonding': [300, 700],
  'teeth-whitening': [350, 750],
  'dental-crowns': [1000, 1800],
  'dental-bridges': [2000, 5000],
  dentures: [1200, 3500],
  'root-canal-treatment': [700, 1500],
  'tooth-extraction': [150, 600],
  'wisdom-teeth': [300, 1200],
  fillings: [150, 450],
  'checkup-and-cleaning': [150, 300],
  'gum-disease': [600, 1500],
  'teeth-grinding': [300, 800],
  'severe-toothache': [100, 250],
};

const DEMO_POLICIES: Record<string, Pick<LibraryArticle, 'summary' | 'body'>> = {
  insurance: {
    summary:
      'We accept most PPO dental insurance plans, including Delta Dental, Cigna, Aetna, MetLife and Guardian, and we file the claims for you. We are not in network with HMO or Medicaid plans.',
    body: `Send us your insurance details before your visit and we'll check your benefits and estimate what you'll pay.
If you don't have insurance, our in-house membership plan covers two cleanings, exams and X-rays a year and gives 15% off most treatment.`,
  },
  'payment-and-financing': {
    summary: 'We accept cash, all major credit cards, and HSA and FSA cards. Payment is due at the time of treatment.',
    body: `Monthly payment plans are available through CareCredit and Cherry, subject to approval, with 0% interest options on many plans.
Larger treatment plans can be split into stages so you can spread the cost.`,
  },
  'new-patients': {
    summary: 'Yes, we are welcoming new patients of all ages, and new patient consultations for cosmetic and implant treatment are free.',
    body: `You can request your first visit right here in the chat or by phone.
Please arrive 10 minutes early to complete your forms.`,
  },
  'cancellation-policy': {
    summary: 'Please give us at least 24 hours’ notice if you need to cancel or reschedule.',
    body: 'Late cancellations and missed appointments may incur a $50 fee.',
  },
  'location-and-parking': {
    summary: 'Free patient parking is available in the lot behind the building, and street parking is free after 6 PM.',
    body: `We're a 5-minute walk from the Harbor View bus stop (routes 4 and 12).
The office is on the ground floor and is wheelchair accessible.`,
  },
};

/** The library as the demo clinic sees it: policies filled in, prices set. */
export function demoArticles(): (LibraryArticle & { priceMin: number | null; priceMax: number | null })[] {
  return LIBRARY.map((a) => {
    const price = DEMO_PRICES[a.slug];
    const policy = DEMO_POLICIES[a.slug];
    return {
      ...a,
      ...(policy ?? {}),
      published: policy ? true : (a.published ?? true),
      priceMin: price ? price[0] : null,
      priceMax: price ? price[1] : null,
    };
  });
}
