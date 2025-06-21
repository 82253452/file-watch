import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// import "virtual:neutralino-dev";
import { app, events, init, window as neuWindow } from '@neutralinojs/lib';

init();
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


function onWindowClose() {
    app.exit();
}

events.on('windowClose', onWindowClose);

neuWindow.focus();