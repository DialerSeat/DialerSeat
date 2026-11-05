import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import MobileFaqView from './view'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const baseMetadata: Metadata = {
  title: 'DialerSeat on Mobile: Install the PWA | DialerSeat',
  description:
    'DialerSeat runs as a full Progressive Web App on your phone: the same terminal, analytics, and teams tools as desktop, installed to your home screen in under a minute. Step-by-step install instructions for iPhone and Android, what the rest of the category publishes about mobile in its own requirements, and what is honestly worse on a handset.',
  keywords: [
    'dialer app for iphone',
    'mobile predictive dialer',
    'can you run a dialer from your phone',
    'call center software on mobile',
    'dial leads from phone',
    'power dialer android',
  ],
  alternates: {
    canonical: 'https://dialerseat.com/faq/mobile',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'DialerSeat on Mobile: Install the PWA',
    description:
      'The full dialer terminal and analytics dashboard, installed to your home screen. No App Store, no separate app to keep updated.',
    url: 'https://dialerseat.com/faq/mobile',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat on Mobile: Install the PWA',
    description: 'The full dialer terminal and analytics dashboard, installed to your home screen. No App Store, no separate app to keep updated.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default function MobileFaqPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: msg("Home"), url: '/' },
        { name: msg("Faq"), url: '/faq' },
        { name: msg("DialerSeat on Mobile"), url: '/faq/mobile' },
      ])} />
      {/* -- THE QUESTIONS THIS PAGE ACTUALLY ANSWERS ------------------
          The page had breadcrumbs and nothing else, which left the one
          question a buyer asks about mobile -- whether anybody else does
          it -- unavailable to an assistant answering from markup. Every
          answer below is visible text on the page, as Google requires. */}
      <JsonLd data={faqPageSchema([
        {
          question: msg("Is there a DialerSeat mobile app?"),
          answer: msg("There is no App Store or Play Store download. DialerSeat installs to a phone's home screen as a Progressive Web App and runs full-screen from there, and it is the same application as the desktop one rather than a companion app with a subset of it: Analytics, Dialer, Campaigns, Recordings, Leads, Teams and Settings, with the same permissions behind them."),
        },
        {
          question: msg("Can you actually run a dialer from a phone?"),
          answer: msg("On DialerSeat, yes, including the dialer terminal itself. The agent leg is a SIP registration over a WebSocket with the audio carried by WebRTC inside the browser, so there is no softphone to install and no bridge number to call, and the requirement comes down to a browser and a microphone."),
        },
        {
          question: msg("Do other dialers work on a phone?"),
          answer: msg("Mostly not, and their own documentation says so. ReadyMode's published system requirements call for Windows or Chrome OS with a wired USB headset and a network cable, and list Bluetooth headsets, Wi-Fi, cellular and satellite connections as unsupported. PhoneBurner's support centre says there is no mobile app for Apple or Android, that phone use is not recommended and may be unstable, and that you must switch the browser to full desktop mode. Five9's public requirements page asks for a computer, a USB headset and a high-speed internet connection. Mojo does ship a phone app, and its own pricing page sells lead management and dialing separately: Agent Access at $10 a user, then $89 or $139 a licence for the single-line or three-line dialer."),
        },
        {
          question: msg("Does it work on both iPhone and Android?"),
          answer: msg("Yes. On iPhone the install is done from Safari, using Share and then Add to Home Screen, which is an Apple restriction rather than ours: other iOS browsers cannot trigger it. On Android it is Chrome's three-dot menu and Install app. Either way updates arrive in the background the way the website updates, with no release to wait for."),
        },
        {
          question: msg("What is worse about dialing from a phone?"),
          answer: msg("Set-up work is a desktop job: uploading a lead file and mapping its columns, writing scripts and configuring a campaign are all faster on a keyboard. Dense tables like the leads list and the compliance export mean scrolling across columns, and you cannot put a CRM beside the dialer on one handset. For a full shift, set auto-lock to Never and keep the phone on a charger."),
        },
      ])} />
      <MobileFaqView />
    </>
  )
}
