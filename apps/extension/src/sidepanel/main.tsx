import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Preview } from './preview';
import './index.css';

const preview = new URLSearchParams(window.location.search).get('preview');
const dark = new URLSearchParams(window.location.search).get('theme') === 'dark';
if (preview && dark) document.documentElement.classList.add('dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{preview ? <Preview state={preview} /> : <App />}</React.StrictMode>,
);
