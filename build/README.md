# Build Assets

This directory contains assets needed for building the installer.

## Required Files

### icon.ico
- Windows application icon
- Required sizes: 16x16, 32x32, 48x48, 256x256
- Format: ICO file

### installer-header.bmp (Optional)
- NSIS installer header image
- Size: 150x57 pixels
- Format: BMP (24-bit)

### installer-sidebar.bmp (Optional)
- NSIS installer sidebar image
- Size: 164x314 pixels
- Format: BMP (24-bit)

## Creating Icons

You can use online tools or software like:
- GIMP (free)
- IcoFX (Windows)
- Online converters: https://convertio.co/png-ico/

## Temporary Solution

If you don't have icons yet, electron-builder will use default icons.
Copy your icon.png from public/ and convert it to .ico format.
