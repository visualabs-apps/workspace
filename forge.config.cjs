module.exports = {
  packagerConfig: {
    name: 'VisualBox',
    executableName: 'visualbox',
    icon: './public/VBOXICON', // Path to icon (without extension, electron-forge auto-detects format)
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-nsis',
      config: {
        name: 'VisualBox',
        authors: 'VisualBox Technology',
        description: 'VisualBox - Multi-Service Management Platform',
        version: '1.0.0',
        
        // Installer configuration
        oneClick: false, // Allow user to choose install location
        perMachine: true, // Install for all users
        allowToChangeInstallationDirectory: true,
        
        // UI customization
        installerIcon: './public/VBOXICON.png',
        uninstallerIcon: './public/VBOXICON.png',
        
        // Shortcuts
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        
        // License
        // license: './LICENSE.txt', // Optional: path to license file
        
        // Additional options
        deleteAppDataOnUninstall: false, // Keep user data on uninstall
        runAfterFinish: true, // Launch app after installation
        
        // Language
        language: '1033', // English (US)
      },
    },
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'visualbox',
        authors: 'VisualBox Technology',
        description: 'VisualBox',
        iconUrl: 'https://example.com/icon.ico', // Update with your icon URL
        setupIcon: './public/icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          name: 'visualbox',
          productName: 'VisualBox',
          genericName: 'Workspace Manager',
          description: 'VisualBox - Multi-Service Management Platform',
          categories: ['Utility', 'Development'],
          maintainer: 'VisualBox Technology',
          homepage: 'https://visualbox.app',
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          name: 'visualbox',
          productName: 'VisualBox',
          genericName: 'Workspace Manager',
          description: 'VisualBox - Multi-Service Management Platform',
          categories: ['Utility', 'Development'],
          license: 'MIT',
          homepage: 'https://visualbox.app',
        },
      },
    },
  ],
};
