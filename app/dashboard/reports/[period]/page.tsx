import ReportView from '../ReportView'

export const metadata = {
  title: 'Billing Statement: DialerSeat',
}

// Opened in its own tab, deliberately outside the dashboard chrome. A statement
// with a sidebar and a nav bar around it prints as a screenshot of an app; on
// its own it prints as a document.
export default async function ReportPeriodPage({
  params,
}: {
  params: Promise<{ period: string }>
}) {
  const { period } = await params
  return <ReportView period={period} />
}
