import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { NotificationsProvider } from './lib/notifications';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Visits from './pages/Visits';
import VisitHistory from './pages/VisitHistory';
import Inventory from './pages/Inventory';
import Purchases from './pages/Purchases';
import Tests from './pages/Tests';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Receipt from './pages/Receipt';
import Settings from './pages/Settings';
import LabResults from './pages/LabResults';
import LabResultsEntry from './pages/LabResultsEntry';
import LabResultsView from './pages/LabResultsView';
import TestResults from './pages/TestResults';
import Communication from './pages/Communication';

function AppContent() {
  const { user, profile, loading, profileError, connectionError, retryConnection } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [receiptVisitId, setReceiptVisitId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedVisitTestId, setSelectedVisitTestId] = useState<string | null>(null);
  const [labResultsMode, setLabResultsMode] = useState<'list' | 'enter' | 'view'>('list');
  const [labResultsRefreshTrigger, setLabResultsRefreshTrigger] = useState(0);
  const [testResultsMode, setTestResultsMode] = useState<'list' | 'view'>('list');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && !profile && profileError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded">
            <p className="font-bold text-lg mb-2">
              {connectionError ? 'Connection Error' : 'Profile Error'}
            </p>

            {connectionError ? (
              <div>
                <p className="text-sm mb-3">
                  Unable to connect to the database. This may be due to:
                </p>
                <ul className="text-sm mb-3 text-left list-disc list-inside space-y-1">
                  <li>Your Supabase project is paused (check your dashboard)</li>
                  <li>Network connectivity issues</li>
                  <li>Server temporarily unavailable</li>
                </ul>
                <button
                  onClick={retryConnection}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            ) : (
              <p className="text-sm mb-3">Unable to load user profile. Please contact support.</p>
            )}

            {profileError && (
              <div className="mt-3 p-3 bg-red-50 rounded text-xs text-left">
                <p className="font-semibold mb-1">Technical Details:</p>
                <p className="font-mono break-words">{profileError}</p>
              </div>
            )}

            {connectionError && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-xs text-left">
                <p className="font-semibold mb-1">How to fix if Supabase is paused:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Log into your Supabase dashboard</li>
                  <li>Find your project: rbeltvowusiorqddzkek</li>
                  <li>Click to resume the project if it shows as paused</li>
                  <li>Wait a moment for it to become active</li>
                  <li>Click the "Retry Connection" button above</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Login />;
  }

  function handleStartVisit(patientId: string) {
    setSelectedPatientId(patientId);
    setCurrentPage('visits');
  }

  function handleViewReceipt(visitId: string) {
    setReceiptVisitId(visitId);
    setCurrentPage('receipt');
  }

  function handleNavigate(page: string) {
    setCurrentPage(page);
    setSelectedPatientId(null);
    setReceiptVisitId(null);
    setSelectedVisitTestId(null);
    setLabResultsMode('list');
    setTestResultsMode('list');
  }

  function handleEnterResults(visitTestId: string) {
    setSelectedVisitTestId(visitTestId);
    setLabResultsMode('enter');
  }

  function handleViewResults(visitTestId: string) {
    setSelectedVisitTestId(visitTestId);
    setLabResultsMode('view');
  }

  function handleBackToLabResults() {
    setLabResultsMode('list');
    setSelectedVisitTestId(null);
    setLabResultsRefreshTrigger(prev => prev + 1);
  }

  function handleViewTestResults(visitTestId: string) {
    setSelectedVisitTestId(visitTestId);
    setTestResultsMode('view');
    setCurrentPage('test-results');
  }

  function handleBackToTestResults() {
    setTestResultsMode('list');
    setSelectedVisitTestId(null);
  }

  function renderPage() {
    if (currentPage === 'receipt' && receiptVisitId) {
      return <Receipt key={receiptVisitId} visitId={receiptVisitId} onClose={() => handleNavigate('dashboard')} />;
    }

    if (currentPage === 'lab-results') {
      // Lab Results is only accessible to admin and lab_tech
      if (profile?.role === 'doctor') {
        return <Dashboard />;
      }

      if (labResultsMode === 'enter' && selectedVisitTestId) {
        return (
          <LabResultsEntry
            visitTestId={selectedVisitTestId}
            onBack={handleBackToLabResults}
            onSaved={handleBackToLabResults}
          />
        );
      }
      if (labResultsMode === 'view' && selectedVisitTestId) {
        return (
          <LabResultsView
            visitTestId={selectedVisitTestId}
            onBack={handleBackToLabResults}
            onEdit={() => handleEnterResults(selectedVisitTestId)}
          />
        );
      }
      return (
        <LabResults
          onEnterResults={handleEnterResults}
          onViewResults={handleViewResults}
          refreshTrigger={labResultsRefreshTrigger}
        />
      );
    }

    if (currentPage === 'test-results') {
      if (profile?.role !== 'doctor' && profile?.role !== 'admin') {
        return <Dashboard />;
      }

      if (testResultsMode === 'view' && selectedVisitTestId) {
        return (
          <LabResultsView
            visitTestId={selectedVisitTestId}
            onBack={handleBackToTestResults}
            onEdit={() => {}}
          />
        );
      }

      return (
        <TestResults
          onViewResults={handleViewTestResults}
        />
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'patients':
        // Only accessible to admin and doctor
        if (profile?.role === 'lab_tech') {
          return <Dashboard />;
        }
        return <Patients onStartVisit={handleStartVisit} onViewTestResult={handleViewTestResults} />;
      case 'visits':
        // Only accessible to admin and doctor
        if (profile?.role === 'lab_tech') {
          return <Dashboard />;
        }
        return (
          <Visits
            initialPatientId={selectedPatientId || undefined}
            onViewReceipt={handleViewReceipt}
          />
        );
      case 'visit-history':
        // Only accessible to admin and doctor
        if (profile?.role === 'lab_tech') {
          return <Dashboard />;
        }
        return <VisitHistory onViewReceipt={handleViewReceipt} />;
      case 'inventory':
        return profile?.role === 'admin' ? <Inventory /> : <Dashboard />;
      case 'purchases':
        return profile?.role === 'admin' ? <Purchases /> : <Dashboard />;
      case 'tests':
        return profile?.role === 'admin' ? <Tests /> : <Dashboard />;
      case 'reports':
        return profile?.role === 'admin' ? <Reports /> : <Dashboard />;
      case 'communication':
        return profile?.role === 'admin' ? <Communication /> : <Dashboard />;
      case 'users':
        return profile?.role === 'admin' ? <Users /> : <Dashboard />;
      case 'settings':
        return profile?.role === 'admin' ? <Settings /> : <Dashboard />;
      default:
        return <Dashboard />;
    }
  }

  if (currentPage === 'receipt' && receiptVisitId) {
    return renderPage();
  }

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <AppContent />
      </NotificationsProvider>
    </AuthProvider>
  );
}
