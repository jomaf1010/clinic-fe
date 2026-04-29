interface GoogleCredentialResponse {
  credential?: string
}

interface GoogleIdentityButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  type?: 'standard' | 'icon'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  width?: number
}

interface GoogleIdentity {
  initialize(options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
  }): void
  renderButton(parent: HTMLElement, options: GoogleIdentityButtonOptions): void
}

interface Window {
  google?: {
    accounts: {
      id: GoogleIdentity
    }
  }
}
