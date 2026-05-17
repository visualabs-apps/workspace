const { app } = require('electron');
const fs = require('fs');
const path = require('path');

class FileController {
    // Save text/HTML file to Downloads folder
    static async saveFile(event, { content, filename, type = 'text/html' }) {
        try {
            
            const downloadsPath = app.getPath('downloads');
            let filePath = path.join(downloadsPath, filename);
            
            // Handle file collision — append timestamp if file exists
            if (fs.existsSync(filePath)) {
                const ext = path.extname(filename);
                const baseName = path.basename(filename, ext);
                const timestamp = Date.now();
                const newFilename = `${baseName}_${timestamp}${ext}`;
                filePath = path.join(downloadsPath, newFilename);
            }
            
            // Write file
            fs.writeFileSync(filePath, content, 'utf-8');
            
            
            const stats = fs.statSync(filePath);
            const finalFilename = path.basename(filePath);
            
            return {
                success: true,
                path: filePath,
                filename: finalFilename,
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
