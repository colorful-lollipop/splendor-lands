import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initStore } from './store';
import './styles/base.css';
import './styles/cards.css';
import './styles/game.css';
import './styles/lobby.css';
import './styles/extra.css';
import './styles/collection.css';
import './styles/artskins.css';
import './styles/mobile.css';

initStore();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);