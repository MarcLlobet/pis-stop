import './styles/globals.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/app';
import { followSystemColorScheme } from './platform/browser';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('Missing #root element');
}

followSystemColorScheme();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
