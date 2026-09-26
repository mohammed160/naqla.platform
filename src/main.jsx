import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import '@fontsource-variable/readex-pro';
import './styles.css';
import './responsive-optimizations.css';
import './project-showcase-v2.css';
import './mobile-nav-fix.css';
import './project-management-v3.css';
import './project-interactions.css';
import './premium-motion-reviews.css';
import './student-projects-voyage.css';
import './naqla.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found inside index.html');
}

ReactDOM.createRoot(rootElement).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
);
