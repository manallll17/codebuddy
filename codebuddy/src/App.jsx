import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Spinner from './components/Spinner';
import AuthPage from './pages/AuthPage';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tutor = lazy(() => import('./pages/Tutor'));
const Playground = lazy(() => import('./pages/Playground'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectWorkspace = lazy(() => import('./pages/ProjectWorkspace'));
const Community = lazy(() => import('./pages/Community'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Roadmaps = lazy(() => import('./pages/Roadmaps'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Notes = lazy(() => import('./pages/Notes'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));

// Route guards: authentication (logged in?) and authorization (admin?)
function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
function AdminOnly({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Suspense fallback={<Spinner full />}>
      <Routes>
        <Route path="/login" element={loading ? <Spinner full /> : user ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="tutor" element={<Tutor />} />
          <Route path="tutor/:chatId" element={<Tutor />} />
          <Route path="editor" element={<Playground />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<ProjectWorkspace />} />
          <Route path="community" element={<Community />} />
          <Route path="community/:roomId" element={<Community />} />
          <Route path="quiz" element={<Quiz />} />
          <Route path="roadmaps" element={<Roadmaps />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="notes" element={<Notes />} />
          <Route path="profile" element={<Profile />} />
          <Route path="admin" element={<AdminOnly><Admin /></AdminOnly>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
