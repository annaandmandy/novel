# How to convert to iOS/Android App

This project is built with React + Vite, which is perfect for Capacitor.

## Steps to add Capacitor:

1. **Initialize Capacitor**
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init
   ```
   - Name: DogBlood AI
   - ID: com.dogblood.app
   - Web Dir: dist

2. **Install Platforms**
   ```bash
   npm install @capacitor/android @capacitor/ios
   npx cap add android
   npx cap add ios
   ```

3. **Build the Web App**
   ```bash
   npm run build
   ```

4. **Sync to Native**
   ```bash
   npx cap sync
   ```

5. **Open Native IDE**
   ```bash
   npx cap open ios
   # or
   npx cap open android
   ```

## Important Configuration
In `capacitor.config.ts`, ensure `webDir` is set to `dist`.

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dogblood.app',
  appName: 'DogBlood AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
```
