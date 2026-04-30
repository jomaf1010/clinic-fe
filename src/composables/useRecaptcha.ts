const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string

let readyPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (readyPromise) return readyPromise

  readyPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`
    script.async = true
    script.onload = () => {
      window.grecaptcha.ready(() => resolve())
    }
    script.onerror = () => {
      readyPromise = null
      reject(new Error('Failed to load reCAPTCHA script'))
    }
    document.head.appendChild(script)
  })

  return readyPromise
}

export function useRecaptcha() {
  function load(): void {
    loadScript().catch(() => {})
  }

  async function execute(action: string): Promise<string> {
    await loadScript()
    return window.grecaptcha.execute(SITE_KEY, { action })
  }

  return { load, execute }
}
