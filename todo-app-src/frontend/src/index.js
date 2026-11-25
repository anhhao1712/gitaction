import React from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';

import './custom.scss';

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

axios.interceptors.request.use((config) => {
  const headers = config.headers || {};
  if (!headers['X-Request-Id']) {
    headers['X-Request-Id'] = randomHex(16);
  }
  if (!headers.traceparent) {
    headers.traceparent = `00-${randomHex(16)}-${randomHex(8)}-01`;
  }
  config.headers = headers;
  return config;
});

ReactDOM.render(<App />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
