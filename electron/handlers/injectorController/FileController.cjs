const { app } = require('electron');
const fs = require('fs');
const path = require('path');

class FileController {
    // Save text/HTML file to Downloads folder
    static async saveFile(event, { content, filename, type = 'text/html' }) {
        try {
            console.log('💾 Saving file:', filename);
            
            const downloadsPath = app.getPath('downloads');
            const filePath = path.join(downloadsPath, filename);
            
            // Write file
            fs.writeFileSync(filePath, content, 'utf-8');
            
            console.log('✅ File saved:', filePath);
            
            const stats = fs.statSync(filePath);
            
            return {
                success: true,
                path: filePath,
                filename: filename,
                size: stats.size
            };
        } catch (error) {
            console.error('❌ Failed to save file:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = { FileController };
