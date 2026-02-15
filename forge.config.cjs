module.exports = {
  packagerConfig: {
    name: 'V-LEB Workspace',
    executableName: 'vleb-workspace',
    icon: './public/icon', // Path to icon (without extension, will use .ico on Windows)
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-nsis',
      config: {
        name: 'V-LEB Workspace',
        authors: 'V-LEB Technology',
        description: 'V-LEB Workspace - Multi-Service Management Platform',
        version: '1.0.0',
        
        // Installer configuration
        oneClick: false, // Allow user to choose install location
        perMachine: true, // Install for all users
        allowToChangeInstallationDirectory: true,
        
        // UI customization
        installerIcon: './public/icon.ico',
        uninstallerIcon: './public/icon.ico',
        installerHeader: './public/installer-header.bmp', // Optional: 150x57 BMP
        installerSidebar: './public/installer-sidebar.bmp', // Optional: 164x314 BMP
        
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
        name: 'vleb-workspace',
        authors: 'V-LEB Technology',
        description: 'V-LEB Workspace',
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
          name: 'vleb-workspace',
          productName: 'V-LEB Workspace',
          genericName: 'Workspace Manager',
          description: 'V-LEB Workspace - Multi-Service Management Platform',
          categories: ['Utility', 'Development'],
          maintainer: 'V-LEB Technology',
          homepage: 'https://v-leb.com',
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          name: 'vleb-workspace',
          productName: 'V-LEB Workspace',
          genericName: 'Workspace Manager',
          description: 'V-LEB Workspace - Multi-Service Management Platform',
          categories: ['Utility', 'Development'],
          license: 'MIT',
          homepage: 'https://v-leb.com',
        },
      },
    },
  ],
};
