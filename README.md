# V-Leb Workspace

Electron-based desktop application for V-Leb platform built with Vite + Svelte + Tailwind CSS.

## Installation

### Prerequisites
- Node.js 16+
- npm

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   
   Configure your API endpoint in `.env`:
   ```env
   VITE_API_URL=https://your-api-url.com/api
   ```

3. **Development**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   # Build installer
   npm run make
   
   # Build portable version
   npm run build:portable
   ```

## Build Output

Built files will be in:
- `dist-electron/` - Installer and unpacked app
- Portable version will be copied to `../laravel/public/downloads/workspace/`

## License
MIT