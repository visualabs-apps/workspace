// Scrape Element, Screenshot, and Add to PowerPoint
// Scrape data dari element, ambil screenshot, lalu masukkan ke PPT

console.log('📊 Starting Scrape + Screenshot to PPT...');
console.log('');

// Check active profile
console.log('👤 Checking Active Profile...');
const profileInfo = await vbox.getActiveProfile();

if (profileInfo.success) {
    console.log('✅ Active Profile:', profileInfo.name);
    console.log('   Profile ID:', profileInfo.id);
    console.log('   Current URL:', profileInfo.url);
    console.log('');
} else {
    console.warn('⚠️ Could not get profile info:', profileInfo.error);
    console.log('');
}

// Get current page info
const pageInfo = vbox.getPageInfo();
console.log('📄 Current Page:', pageInfo.url);
console.log('   Title:', pageInfo.title);
console.log('');

// Target selector
const targetSelector = '.data-dashboard.narrow-card-box';

// Check if element exists
console.log('🔍 Looking for element:', targetSelector);
const element = document.querySelector(targetSelector);
if (!element) {
    console.error('❌ Element not found:', targetSelector);
    console.log('');
    console.log('💡 TROUBLESHOOTING:');
    console.log('   1. Make sure you are on the correct page');
    console.log('   2. Check if the element selector is correct');
    console.log('   3. Run DEBUG-find-dashboard.js to find the correct selector');
    console.log('');
    
    vbox.toast(`Element not found: ${targetSelector}`, 'error');
    return { success: false, message: 'Element not found' };
}

console.log('✅ Element found');
console.log('');

// Get element info
const rect = element.getBoundingClientRect();
console.log('📐 Element size:', rect.width, 'x', rect.height);

// Scrape data from element
console.log('📝 Scraping data...');
const scrapedData = {
    text: element.textContent.trim(),
    html: element.innerHTML,
    attributes: {},
    dimensions: {
        width: rect.width,
        height: rect.height
    }
};

// Get all attributes
for (let attr of element.attributes) {
    scrapedData.attributes[attr.name] = attr.value;
}

console.log('✅ Data scraped:', scrapedData.text.substring(0, 100) + '...');

// Get user input for report details
const inputResult = await vbox.openInput({
    title: 'Generate Dashboard Report',
    fields: [
        {
            name: 'reportTitle',
            label: 'Report Title',
            type: 'text',
            required: true,
            defaultValue: 'Dashboard Report',
            description: 'Judul untuk report'
        },
        {
            name: 'reportPeriod',
            label: 'Report Period',
            type: 'daterange',
            required: true,
            defaultValue: {
                start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
            },
            description: 'Periode report'
        }
    ]
});

// Check if user cancelled
if (!inputResult || !inputResult.success) {
    console.log('⚠️ User cancelled');
    vbox.toast('Report generation cancelled', 'info');
    return { success: false, message: 'Cancelled by user' };
}

const { reportTitle, reportPeriod } = inputResult.data;

// Format date range
const startDate = new Date(reportPeriod.start);
const endDate = new Date(reportPeriod.end);
const dateRangeFormatted = `${startDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} - ${endDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`;

console.log('📅 Date range:', dateRangeFormatted);

// Take screenshot
console.log('📸 Taking screenshot...');
vbox.toast('Taking screenshot...', 'info');

const screenshotFilename = `dashboard-${Date.now()}.png`;
const screenshotResult = await vbox.screenshot(targetSelector, screenshotFilename);

if (!screenshotResult || !screenshotResult.success) {
    console.error('❌ Screenshot failed:', screenshotResult?.error);
    vbox.toast('Screenshot failed: ' + (screenshotResult?.error || 'Unknown error'), 'error');
    return { success: false, message: 'Screenshot failed', error: screenshotResult?.error };
}

console.log('✅ Screenshot saved:', screenshotResult.path);

// Create PowerPoint
console.log('📄 Creating PowerPoint...');
vbox.toast('Creating PowerPoint...', 'info');

const ppt = vbox.ppt.create();

// Add title slide
ppt.addTitleSlide(
    reportTitle,
    dateRangeFormatted
);

// Add dashboard screenshot slide
ppt.addSlide('Dashboard Overview')
    .addText('Dashboard data captured from: ' + vbox.getPageInfo().url, { fontSize: 12 })
    .addImage(screenshotResult.path, { 
        x: 0.5, 
        y: 1.5, 
        width: 9, 
        height: 5 
    });

// Add data summary slide
const dataPreview = scrapedData.text.substring(0, 500);
ppt.addSlide('Data Summary')
    .addText(dataPreview, { fontSize: 14 });

// Download PowerPoint
const pptFilename = `${reportTitle.replace(/\s+/g, '_')}_${Date.now()}.pptx`;
const pptResult = await ppt.download(pptFilename);

if (pptResult && pptResult.success) {
    console.log('✅ PowerPoint generated:', pptResult.path);
    vbox.toast(`PowerPoint generated: ${pptFilename}`, 'success');
    
    return {
        success: true,
        message: 'Report generated successfully',
        data: {
            screenshot: {
                filename: screenshotResult.filename,
                path: screenshotResult.path,
                size: screenshotResult.size
            },
            powerpoint: {
                filename: pptFilename,
                path: pptResult.path
            },
            scrapedData: {
                textLength: scrapedData.text.length,
                dimensions: scrapedData.dimensions
            }
        }
    };
} else {
    console.error('❌ PowerPoint generation failed:', pptResult?.error);
    vbox.toast('PowerPoint generation failed', 'error');
    return { success: false, message: 'PowerPoint generation failed', error: pptResult?.error };
}
