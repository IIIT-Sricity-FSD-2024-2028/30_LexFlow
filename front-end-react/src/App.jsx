/**
 * App.jsx - Top-level application component configured with React Router (react-router-dom).
 *
 * Configures declarative routes using <Routes> and <Route>.
 * Protected routes are wrapped in <Layout roles={[...]}> to enforce role-based access.
 */

import { useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { setGlobalNavigate } from './router.jsx';
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
import ClientBilling from './pages/client/ClientBilling.jsx';
import PayNow from './pages/client/PayNow.jsx';
import Transactions from './pages/client/Transactions.jsx';

/* Firm + lawyer pages */
import FirmDashboard from './pages/firm/FirmDashboard.jsx';
import FirmCases from './pages/firm/FirmCases.jsx';
import FirmCaseDetails from './pages/firm/FirmCaseDetails.jsx';
import FirmTasks from './pages/firm/FirmTasks.jsx';
import FirmBilling from './pages/firm/FirmBilling.jsx';
import FirmUsers from './pages/firm/FirmUsers.jsx';

/* Shared pages: documents, activity log */
import DocumentsMain from './pages/documents/DocumentsMain.jsx';
import CaseDocuments from './pages/documents/CaseDocuments.jsx';
import ActivityLog from './pages/documents/ActivityLog.jsx';

/* Superadmin pages */
import SADashboard from './pages/superadmin/SADashboard.jsx';
import SARevenue from './pages/superadmin/SARevenue.jsx';
import SAFirms from './pages/superadmin/SAFirms.jsx';
import SALawyers from './pages/superadmin/SALawyers.jsx';
import SAUsers from './pages/superadmin/SAUsers.jsx';
import SAConsultations from './pages/superadmin/SAConsultations.jsx';
import SAInvoices from './pages/superadmin/SAInvoices.jsx';
import SASettings from './pages/superadmin/SASettings.jsx';

/**
 * Higher-Order Component to automatically pass route params (:id, :caseId) as props.
 */
function withRouteParams(Component) {
  return function WithRouteParamsWrapper(props) {
    const params = useParams();
    return <Component {...params} {...props} />;
  };
}

const ParamClientCaseDetails = withRouteParams(ClientCaseDetails);
const ParamPayNow = withRouteParams(PayNow);
const ParamFirmCaseDetails = withRouteParams(FirmCaseDetails);
const ParamFirmTasks = withRouteParams(FirmTasks);
const ParamCaseDocuments = withRouteParams(CaseDocuments);

/** Synchronizes React Router's navigate hook with the global navigate helper. */
function NavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    setGlobalNavigate(navigate);
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <AppProvider>
      <NavigationBridge />
      <Routes>
        {/* Public pages */}
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<SignIn />} />

        {/* Onboarding wizards */}
        <Route path="/onboarding/client/1" element={<ClientOnboarding1 />} />
        <Route path="/onboarding/client/2" element={<ClientOnboarding2 />} />
        <Route path="/onboarding/firm/1" element={<FirmOnboarding1 />} />
        <Route path="/onboarding/firm/2" element={<FirmOnboarding2 />} />
        <Route path="/onboarding/firm/3" element={<FirmOnboarding3 />} />

        {/* Client portal */}
        <Route path="/client/dashboard" element={<Layout roles={['client']}><ClientDashboard /></Layout>} />
        <Route path="/client/search" element={<Layout roles={['client']}><LawFirmSearch /></Layout>} />
        <Route path="/client/cases" element={<Layout roles={['client']}><ClientCases /></Layout>} />
        <Route path="/client/cases/:id" element={<Layout roles={['client']}><ParamClientCaseDetails /></Layout>} />
        <Route path="/client/billing" element={<Layout roles={['client']}><ClientBilling /></Layout>} />
        <Route path="/client/billing/pay/:id" element={<Layout roles={['client']}><ParamPayNow /></Layout>} />
        <Route path="/client/transactions" element={<Layout roles={['client']}><Transactions /></Layout>} />

        {/* Firm portal */}
        <Route path="/firm/dashboard" element={<Layout roles={['firmadmin', 'lawyer', 'intern']}><FirmDashboard /></Layout>} />
        <Route path="/firm/cases" element={<Layout roles={['firmadmin', 'lawyer', 'intern']}><FirmCases /></Layout>} />
        <Route path="/firm/cases/:id" element={<Layout roles={['firmadmin', 'lawyer', 'intern']}><ParamFirmCaseDetails /></Layout>} />
        <Route path="/firm/tasks" element={<Layout roles={['firmadmin', 'lawyer', 'intern']}><ParamFirmTasks /></Layout>} />
        <Route path="/firm/tasks/:caseId" element={<Layout roles={['firmadmin', 'lawyer', 'intern']}><ParamFirmTasks /></Layout>} />
        <Route path="/firm/billing" element={<Layout roles={['firmadmin']}><FirmBilling /></Layout>} />
        <Route path="/firm/users" element={<Layout roles={['firmadmin']}><FirmUsers /></Layout>} />

        {/* Documents / activity log */}
        <Route path="/documents" element={<Layout><DocumentsMain /></Layout>} />
        <Route path="/documents/:caseId" element={<Layout><ParamCaseDocuments /></Layout>} />
        <Route path="/activity-log" element={<Layout><ActivityLog /></Layout>} />

        {/* Superadmin console */}
        <Route path="/superadmin/dashboard" element={<Layout roles={['superadmin']}><SADashboard /></Layout>} />
        <Route path="/superadmin/revenue" element={<Layout roles={['superadmin']}><SARevenue /></Layout>} />
        <Route path="/superadmin/firms" element={<Layout roles={['superadmin']}><SAFirms /></Layout>} />
        <Route path="/superadmin/lawyers" element={<Layout roles={['superadmin']}><SALawyers /></Layout>} />
        <Route path="/superadmin/users" element={<Layout roles={['superadmin']}><SAUsers /></Layout>} />
        <Route path="/superadmin/consultations" element={<Layout roles={['superadmin']}><SAConsultations /></Layout>} />
        <Route path="/superadmin/invoices" element={<Layout roles={['superadmin']}><SAInvoices /></Layout>} />
        <Route path="/superadmin/settings" element={<Layout roles={['superadmin']}><SASettings /></Layout>} />

        {/* 404 Fallback */}
        <Route
          path="*"
          element={
            <div className="flex min-h-screen items-center justify-center">
              <div className="text-center">
                <p className="text-4xl font-bold text-slate-300">404</p>
                <p className="mt-2 text-slate-500">Page not found.</p>
                <Link to="/" className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:underline">
                  Back to home
                </Link>
              </div>
            </div>
          }
        />
      </Routes>
    </AppProvider>
  );
}
