import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/observatory.css';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Solar System application root was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
