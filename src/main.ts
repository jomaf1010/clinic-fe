import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/globals.css'
import { registerPwa } from './composables/usePwaUpdate'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Register the service worker after mount so the first paint isn't
// blocked on Workbox initialization. No-op in dev via a PROD guard.
registerPwa()
