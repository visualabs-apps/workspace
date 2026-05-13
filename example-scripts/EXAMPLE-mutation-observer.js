// Example: MutationObserver - Monitor DOM Changes
// Demo berbagai cara pakai MutationObserver untuk scraping dynamic content

console.log('🔍 MutationObserver Examples');
console.log('');

// Example 1: Watch for changes and log them
console.log('📌 Example 1: Watch Changes');
console.log('Monitoring body for any changes (will run for 5 seconds)...');

const observer1 = vbox.watchChanges('body', (mutations, observer) => {
    console.log(`  ✓ Detected ${mutations.length} change(s)`);
    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            console.log('    - Child nodes changed');
        } else if (mutation.type === 'attributes') {
            console.log('    - Attribute changed:', mutation.attributeName);
        }
    });
}, {
    childList: true,
    subtree: true,
    attributes: true
});

// Stop after 5 seconds
setTimeout(() => {
    observer1.disconnect();
    console.log('  ⏹️ Stopped watching');
    console.log('');
}, 5000);

// Wait for observer to finish
await new Promise(resolve => setTimeout(resolve, 5500));

// Example 2: Wait for specific element to change
console.log('📌 Example 2: Wait for Element Change');
console.log('Waiting for title to change (timeout: 10s)...');

try {
    // This will wait until page title changes
    const result = await vbox.waitForChange('title', {
        type: 'text',
        timeout: 10000
    });
    
    console.log('  ✓ Title changed!');
    console.log('  New title:', document.title);
} catch (error) {
    console.log('  ⏱️ Timeout - title did not change');
}
console.log('');

// Example 3: Wait until condition is met
console.log('📌 Example 3: Wait Until Condition');
console.log('Waiting for body to have more than 10 child elements...');

try {
    await vbox.waitUntil('body', (element) => {
        return element.children.length > 10;
    }, {
        timeout: 5000
    });
    
    console.log('  ✓ Condition met!');
    console.log('  Body has', document.body.children.length, 'children');
} catch (error) {
    console.log('  ⏱️ Timeout - condition not met');
    console.log('  Body has', document.body.children.length, 'children');
}
console.log('');

// Example 4: Real-world use case - Monitor dashboard updates
console.log('📌 Example 4: Real-World Use Case');
console.log('Monitoring dashboard for data updates...');

// Check if dashboard exists
if (vbox.exists('.dashboard, [class*="dashboard"]')) {
    const dashboardSelector = document.querySelector('.dashboard') ? '.dashboard' : '[class*="dashboard"]';
    console.log('  Found dashboard:', dashboardSelector);
    
    let updateCount = 0;
    const observer4 = vbox.watchChanges(dashboardSelector, (mutations) => {
        updateCount++;
        console.log(`  📊 Dashboard update #${updateCount}`);
        
        // Auto-scrape on update
        const data = vbox.extractData({
            title: 'h1, h2, .title',
            value: '.value, .count, .number'
        });
        
        if (Object.keys(data).length > 0) {
            console.log('  Data:', data);
        }
        
        // Stop after 3 updates
        if (updateCount >= 3) {
            observer4.disconnect();
            console.log('  ⏹️ Stopped monitoring (reached 3 updates)');
        }
    }, {
        childList: true,
        subtree: true,
        characterData: true
    });
    
    // Stop after 10 seconds
    setTimeout(() => {
        observer4.disconnect();
        console.log('  ⏹️ Stopped monitoring (timeout)');
    }, 10000);
    
    console.log('  Monitoring for 10 seconds or 3 updates...');
} else {
    console.log('  ⚠️ No dashboard found on this page');
}

console.log('');
console.log('============================================================');
console.log('✅ MutationObserver examples completed!');
console.log('');
console.log('💡 Use Cases:');
console.log('   - Monitor real-time dashboards');
console.log('   - Wait for lazy-loaded content');
console.log('   - Track data changes in SPA');
console.log('   - Auto-scrape on updates');
console.log('============================================================');

return {
    success: true,
    message: 'MutationObserver examples completed'
};
