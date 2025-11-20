import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ResearchForm } from './components/features/ResearchForm';
import { TemplatesPage } from './components/features/TemplatesPage';
import { ResearchWizard } from './components/features/ResearchWizard';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ResearchForm />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/research/:templateId" element={<ResearchWizard />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App
