/**
 * App.jsx - The top-level component. Its ONLY job is routing:
 * look at the URL and decide which page component to draw.
 *
 * Public pages (landing, sign-in, onboarding) render directly.
 * Dashboard pages are wrapped in <Layout roles={[...]}> which checks
 * "is this person allowed to see this page?" before rendering.
 */

import { useRoute, matchRoute } from './router.jsx';
import { AppProvider } from './context/AppContext.jsx';
import Layout from './components/Layout.jsx';

/* Public pages */
import Landing from './pages/Landing.jsx';
import SignIn from './pages/SignIn.jsx';
import ClientOnboarding1 from './pages/onboarding/ClientOnboarding1.jsx';
import ClientOnboarding2 from './pages/onboarding/ClientOnboarding2.jsx';
import FirmOnboarding1 from './pages/onboarding/FirmOnboarding1.jsx';
import FirmOnboarding2 from './pages/onboarding/FirmOnboarding2.jsx';
import FirmOnboarding3 from './pages/onboarding/FirmOnboarding3.jsx';

/* Client pages */
import ClientDashboard from './pages/client/ClientDashboard.jsx';
import LawFirmSearch from './pages/client/LawFirmSearch.jsx';
import ClientCases from './pages/client/ClientCases.jsx';
import ClientCaseDetails from './pages/client/ClientCaseDetails.jsx';
import AdvocateProfile from './pages/client/AdvocateProfile.jsx';
import ClientBilling from './pages/client/ClientBilling.jsx';
import PayNow from './pages/client/PayNow.jsx';
import Transactions from './pages/client/Transactions.jsx';

/* Firm + lawyer pages (lawyers reuse these - roles param controls access) */
import FirmDashboard from './pages/firm/FirmDashboard.jsx';
import FirmCases from './pages/firm/FirmCases.jsx';
import FirmCaseDetails from './pages/firm/FirmCaseDetails.jsx';
import FirmTasks from './pages/firm/FirmTasks.jsx';
import FirmBilling from './pages/firm/FirmBilling.jsx';
import FirmUsers from './pages/firm/FirmUsers.jsx';

/* Shared pages: documents, activity log, schedule */
import DocumentsMain from './pages/documents/DocumentsMain.jsx';
import CaseDocuments from './pages/documents/CaseDocuments.jsx';
import ActivityLog from './pages/documents/ActivityLog.jsx';
import ScheduleManagement from './pages/documents/ScheduleManagement.jsx';

/* Superadmin pages */
import SADashboard from './pages/superadmin/SADashboard.jsx';
import SARevenue from './pages/superadmin/SARevenue.jsx';
import SAFirms from './pages/superadmin/SAFirms.jsx';
import SALawyers from './pages/superadmin/SALawyers.jsx';
import SAUsers from './pages/superadmin/SAUsers.jsx';
import SAConsultations from './pages/superadmin/SAConsultations.jsx';
import SAInvoices from './pages/superadmin/SAInvoices.jsx';
import SASettings from './pages/superadmin/SASettings.jsx';

export default function App() {
  const path = useRoute(); // re-renders this component on every hash change

  /* A tiny helper: match "/client/cases/:id" style patterns in one line. */
  const m = (pattern) => matchRoute(path, pattern);

  /* Find the first matching route and remember what to render. */
  let page = null;

  if (m('/')) page = <Landing />;
  else if (m('/signin')) page = <SignIn />;

  /* ── Onboarding wizards (public) ── */
  else if (m('/onboarding/client/1')) page = <ClientOnboarding1 />;
  else if (m('/onboarding/client/2')) page = <ClientOnboarding2 />;
  else if (m('/onboarding/firm/1')) page = <FirmOnboarding1 />;
  else if (m('/onboarding/firm/2')) page = <FirmOnboarding2 />;
  else if (m('/onboarding/firm/3')) page = <FirmOnboarding3 />;

  /* ── Client portal (only clients; superadmin may peek too) ── */
  else if (m('/client/dashboard')) page = <Layout roles={['client']}><ClientDashboard /></Layout>;
  else if (m('/client/search')) page = <Layout roles={['client']}><LawFirmSearch /></Layout>;
  else if (m('/client/cases')) page = <Layout roles={['client']}><ClientCases /></Layout>;
  else if (m('/client/cases/:id')) page = <Layout roles={['client']}><ClientCaseDetails {...m('/client/cases/:id')} /></Layout>;
  else if (m('/client/advocate/:id')) page = <Layout roles={['client']}><AdvocateProfile {...m('/client/advocate/:id')} /></Layout>;
  else if (m('/client/billing')) page = <Layout roles={['client']}><ClientBilling /></Layout>;
  else if (m('/client/billing/pay/:id')) page = <Layout roles={['client']}><PayNow {...m('/client/billing/pay/:id')} /></Layout>;
  else if (m('/client/transactions')) page = <Layout roles={['client']}><Transactions /></Layout>;
  else if (m('/client/chat')) page = <Layout roles={['client']}><ConsultationChat /></Layout>;
  else if (m('/client/chat/:consId')) page = <Layout roles={['client']}><ConsultationChat {...m('/client/chat/:consId')} /></Layout>;

  /* ── Firm portal (admin + lawyer + intern; superadmin may peek too) ── */
  else if (m('/firm/dashboard')) page = <Layout roles={['firmadmin', 'lawyer', 'intern']}><FirmDashboard /></Layout>;
  else if (m('/firm/cases')) page = <Layout roles={['firmadmin', 'lawyer', 'intern']}><FirmCases /></Layout>;
  else if (m('/firm/cases/:id')) page = <Layout roles={['firmadmin', 'lawyer', 'intern']}><FirmCaseDetails {...m('/firm/cases/:id')} /></Layout>;
  else if (m('/firm/tasks')) page = <Layout roles={['firmadmin', 'lawyer', 'intern']}><FirmTasks /></Layout>;
  else if (m('/firm/tasks/:caseId')) page = <Layout roles={['firmadmin', 'lawyer', 'intern']}><FirmTasks {...m('/firm/tasks/:caseId')} /></Layout>;
  else if (m('/firm/billing')) page = <Layout roles={['firmadmin', 'lawyer']}><FirmBilling /></Layout>;
  else if (m('/firm/users')) page = <Layout roles={['firmadmin']}><FirmUsers /></Layout>;
  else if (m('/firm/chat')) page = <Layout roles={['firmadmin', 'lawyer', 'intern']}><ConsultationChat staff /></Layout>;
  else if (m('/firm/chat/:consId')) page = <Layout roles={['firmadmin', 'lawyer', 'intern']}><ConsultationChat staff {...m('/firm/chat/:consId')} /></Layout>;

  /* ── Documents / schedule / activity log (any signed-in role; data is role-scoped) ── */
  else if (m('/documents')) page = <Layout><DocumentsMain /></Layout>;
  else if (m('/documents/:caseId')) page = <Layout><CaseDocuments {...m('/documents/:caseId')} /></Layout>;
  else if (m('/activity-log')) page = <Layout><ActivityLog /></Layout>;
  else if (m('/schedule')) page = <Layout roles={['firmadmin', 'lawyer', 'intern']}><ScheduleManagement /></Layout>;

  /* ── Superadmin console ── */
  else if (m('/superadmin/dashboard')) page = <Layout roles={['superadmin']}><SADashboard /></Layout>;
  else if (m('/superadmin/revenue')) page = <Layout roles={['superadmin']}><SARevenue /></Layout>;
  else if (m('/superadmin/firms')) page = <Layout roles={['superadmin']}><SAFirms /></Layout>;
  else if (m('/superadmin/lawyers')) page = <Layout roles={['superadmin']}><SALawyers /></Layout>;
  else if (m('/superadmin/users')) page = <Layout roles={['superadmin']}><SAUsers /></Layout>;
  else if (m('/superadmin/consultations')) page = <Layout roles={['superadmin']}><SAConsultations /></Layout>;
  else if (m('/superadmin/invoices')) page = <Layout roles={['superadmin']}><SAInvoices /></Layout>;
  else if (m('/superadmin/settings')) page = <Layout roles={['superadmin']}><SASettings /></Layout>;

  /* Unknown URL -> simple 404 message. */
  else page = (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-4xl font-bold text-slate-300">404</p>
        <p className="mt-2 text-slate-500">Page not found.</p>
        <a href="#/" className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:underline">
          Back to home
        </a>
      </div>
    </div>
  );

  /* AppProvider gives every page access to useApp() (user, toast, ...). */
  return <AppProvider>{page}</AppProvider>;
}
