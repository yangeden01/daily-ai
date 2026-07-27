import {
  BrowserCacheLocation,
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type Configuration,
} from '@azure/msal-browser'

const graphScopes = ['User.Read', 'Files.ReadWrite']

export class MicrosoftAuthService {
  private client: PublicClientApplication | null = null
  private initialization: Promise<PublicClientApplication> | null = null

  private async getClient(): Promise<PublicClientApplication> {
    if (this.client) return this.client
    if (this.initialization) return this.initialization

    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID
    const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'

    if (!clientId) {
      throw new Error('Missing VITE_MICROSOFT_CLIENT_ID')
    }

    const configuration: Configuration = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: BrowserCacheLocation.MemoryStorage,
      },
    }

    this.initialization = (async () => {
      const client = new PublicClientApplication(configuration)
      await client.initialize()
      this.client = client
      return client
    })()

    return this.initialization
  }

  async login(): Promise<AccountInfo> {
    const client = await this.getClient()
    const result = await client.loginPopup({ scopes: graphScopes })
    client.setActiveAccount(result.account)
    return result.account
  }

  async logout(): Promise<void> {
    const client = await this.getClient()
    const account = client.getActiveAccount() ?? client.getAllAccounts()[0]
    await client.logoutPopup({ account })
  }

  async getAccessToken(): Promise<string> {
    const client = await this.getClient()
    const account = client.getActiveAccount() ?? client.getAllAccounts()[0]

    if (!account) {
      throw new Error('Microsoft account is not signed in')
    }

    client.setActiveAccount(account)

    try {
      const result = await client.acquireTokenSilent({ account, scopes: graphScopes })
      return result.accessToken
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        const result = await client.acquireTokenPopup({ account, scopes: graphScopes })
        return result.accessToken
      }
      throw error
    }
  }

  async getCurrentUser(): Promise<AccountInfo | null> {
    const client = await this.getClient()
    const account = client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null
    if (account) client.setActiveAccount(account)
    return account
  }
}

export const microsoftAuthService = new MicrosoftAuthService()
