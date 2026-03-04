import { createRoot } from 'react-dom/client'
import './index.css'
import './localization/i18n';
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
    <App />
)
