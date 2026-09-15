import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.swiftnote.app',
  appName: 'SwiftNote',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
