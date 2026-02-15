# Icon Requirements for V-LEB Workspace

## Required Icons

### 1. App Icon (icon.ico)
- **Format**: ICO (Windows Icon)
- **Recommended Size**: 256x256 pixels
- **Multi-resolution**: Should contain multiple sizes (16x16, 32x32, 48x48, 64x64, 128x128, 256x256)
- **Usage**: 
  - Application icon
  - Taskbar icon
  - Window title bar icon
  - Installer icon
  - Uninstaller icon

### 2. Installer Header (installer-header.bmp) - Optional
- **Format**: BMP (24-bit)
- **Size**: 150x57 pixels
- **Usage**: Top banner in NSIS installer
- **Note**: Should match your brand colors

### 3. Installer Sidebar (installer-sidebar.bmp) - Optional
- **Format**: BMP (24-bit)
- **Size**: 164x314 pixels
- **Usage**: Left sidebar in NSIS installer
- **Note**: Should match your brand colors

## How to Create Icons

### Using Online Tools
1. **ICO Converter**: https://convertio.co/png-ico/
   - Upload your PNG logo
   - Select "ICO" as output format
   - Download and rename to `icon.ico`

2. **Favicon Generator**: https://realfavicongenerator.net/
   - Upload your logo
   - Generate all sizes
   - Download ICO file

### Using Photoshop/GIMP
1. Create a 256x256 canvas
2. Design your icon
3. Save as PNG
4. Use a plugin to export as ICO with multiple sizes

### Using ImageMagick (Command Line)
```bash
# Convert PNG to ICO with multiple sizes
magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Create installer header (150x57)
magick convert logo.png -resize 150x57 -background white -gravity center -extent 150x57 installer-header.bmp

# Create installer sidebar (164x314)
magick convert logo.png -resize 164x314 -background white -gravity center -extent 164x314 installer-sidebar.bmp
```

## Icon Design Guidelines

### App Icon
- **Simple and recognizable**: Should be clear at small sizes (16x16)
- **Consistent branding**: Use your brand colors
- **No text**: Avoid text in icons (hard to read at small sizes)
- **Transparent background**: Use transparency for non-square logos
- **High contrast**: Ensure icon is visible on both light and dark backgrounds

### Installer Graphics
- **Professional look**: Use high-quality graphics
- **Brand consistency**: Match your website/app design
- **Readable text**: If using text, ensure it's large enough
- **Safe colors**: Avoid very bright or neon colors

## Current Setup

Place your icons in this folder (`workspace/public/`):
```
workspace/
  public/
    icon.ico                    # Required
    installer-header.bmp        # Optional
    installer-sidebar.bmp       # Optional
```

## Testing Icons

### Test App Icon
1. Build the app: `npm run make`
2. Install the app
3. Check:
   - Desktop shortcut icon
   - Start menu icon
   - Taskbar icon (when app is running)
   - Window title bar icon

### Test Installer Graphics
1. Build the installer: `npm run make`
2. Run the installer
3. Check:
   - Installer window shows header and sidebar
   - Graphics are not stretched or pixelated
   - Colors match your brand

## Fallback

If you don't provide custom icons, Electron Forge will use default Electron icons. However, for a professional app, custom icons are highly recommended.

## Resources

- [Icon Design Best Practices](https://docs.microsoft.com/en-us/windows/apps/design/style/iconography)
- [Windows Icon Guidelines](https://docs.microsoft.com/en-us/windows/win32/uxguide/vis-icons)
- [NSIS Modern UI Documentation](https://nsis.sourceforge.io/Docs/Modern%20UI%202/Readme.html)
