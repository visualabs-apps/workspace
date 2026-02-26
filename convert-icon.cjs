const sharp = require('sharp');
const fs = require('fs');

async function convertToIco() {
  try {
    // Read the PNG file
    const pngBuffer = fs.readFileSync('public/workspace_icon.png');
    
    // Convert to ICO format (256x256)
    await sharp(pngBuffer)
      .resize(256, 256)
      .toFile('public/icon.ico');
    
    console.log('Icon converted successfully!');
  } catch (error) {
    console.error('Error converting icon:', error);
  }
}

convertToIco();
