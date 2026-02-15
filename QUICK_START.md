# V-LEB Workspace - Quick Start Guide

## 🚀 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

The app will open automatically with hot-reload enabled.

## 📦 Building for Production

### NSIS Installer (Recommended)

```bash
npm run dist:nsis
```

Output: `dist-electron/V-LEB Workspace-Setup-1.0.0.exe` (~80MB)

### All Windows Targets

```bash
npm run dist:win
```

Builds both NSIS installer and Portable executable.

### Current Platform

```bash
npm run dist
```

## 📋 Build Output

After building, you'll find the installers in the `dist-electron/` directory:

- `V-LEB Workspace-Setup-1.0.0.exe` - NSIS installer (~80MB)
- `V-LEB Workspace-1.0.0-x64.exe` - Portable version (if built)
- `win-unpacked/` - Unpacked application files

## 🎯 Installation

1. Run the NSIS installer (`V-LEB Workspace-Setup-1.0.0.exe`)
2. Choose installation directory (default: `C:\Program Files\V-LEB Workspace`)
3. Select shortcuts:
   - Desktop shortcut
   - Start Menu shortcut
4. Click Install
5. Launch the app after installation completes

## ✨ Features

- Multi-service workspace management
- Secure token storage with keytar
- Deep link support (`vleb://` protocol)
- System tray integration
- OAuth authentication
- Download management
- Minimize to tray

## 🔧 Configuration

### Custom Icons (Optional)

Place your icons in the `build/` directory:
- `icon.ico` - Application icon (16x16, 32x32, 48x48, 256x256)
- `installer-header.bmp` - NSIS header (150x57, 24-bit BMP)
- `installer-sidebar.bmp` - NSIS sidebar (164x314, 24-bit BMP)

See `build/README.md` for details.

### Code Signing (Production)

For production releases, configure code signing:

1. Get a code signing certificate
2. Set environment variables:
   ```bash
   set CSC_LINK=path\to\certificate.pfx
   set CSC_KEY_PASSWORD=your_password
   ```
3. Remove `CSC_IDENTITY_AUTO_DISCOVERY=false` from scripts

## 🐛 Troubleshooting

### Build fails with keytar error

```bash
# Close all Electron processes
taskkill /F /IM electron.exe

# Clean and reinstall
rmdir /s /q node_modules
npm install
```

### Build is slow

- First build downloads Electron binaries (~120MB)
- Subsequent builds are much faster
- Use `npm run build` to only rebuild frontend

### Missing icons warning

Icons are optional for development builds. The app will use default Electron icons.

## 📝 Notes

- Code signing is disabled by default (for faster dev builds)
- Requires Windows 10 or later
- Node.js 18+ recommended
- First build may take 5-10 minutes

## 🎉 Success!

If you see this message:
```
• building block map  blockMapFile=dist-electron\V-LEB Workspace-Setup-1.0.0.exe.blockmap
```

Your installer is ready at: `dist-electron/V-LEB Workspace-Setup-1.0.0.exe`

## 📚 Next Steps

- Test the installer on a clean machine
- Add custom icons (see `build/README.md`)
- Configure auto-updates
- Set up code signing for production

For detailed build configuration, see `BUILD_GUIDE.md`.
