import { Routes, Route } from 'react-router-dom';
import TaskManager from './components/TaskManager';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Routes>
      <Route path="/" element={<TaskManager />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
