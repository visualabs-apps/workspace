/**
 * Test suite for VBox API fixes
 * 
 * Tests all the fixes applied to ensure:
 * 1. Click visibility checks work
 * 2. Type default clear behavior is correct
 * 3. WaitForElement has proper error messages
 * 4. Evaluate is removed
 * 5. API wrapper normalizes errors
 */

describe('VBox API Fixes', () => {
    let vbox;
    let wrapper;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="visible-btn">Visible Button</div>
            <div id="hidden-btn" style="display: none;">Hidden Button</div>
            <button id="disabled-btn" disabled>Disabled Button</button>
            <input id="test-input" type="text" value="initial" />
            <div id="dynamic-content"></div>
        `;

        // Get vbox API (assuming it's injected)
        vbox = window.vbox || window.__VBOX_API__;
        
        // Create wrapper
        if (typeof VBoxAPIWrapper !== 'undefined') {
            wrapper = new VBoxAPIWrapper(vbox, {
                timeout: 5000,
                maxRetries: 1,
                retryDelay: 100
            });
        }
    });

    describe('1. Click Visibility Checks', () => {
        test('should click visible element successfully', () => {
            expect(() => {
                vbox.click('#visible-btn');
            }).not.toThrow();
        });

        test('should throw error for hidden element', () => {
            expect(() => {
                vbox.click('#hidden-btn');
            }).toThrow('Element is hidden');
        });

        test('should throw error for disabled element', () => {
            expect(() => {
                vbox.click('#disabled-btn');
            }).toThrow('Element is disabled');
        });

        test('should throw error for non-existent element', () => {
            expect(() => {
                vbox.click('#non-existent');
            }).toThrow('Element not found');
        });
    });

    describe('2. Type Default Clear Behavior', () => {
        test('should clear input by default', () => {
            const input = document.getElementById('test-input');
            expect(input.value).toBe('initial');
            
            vbox.type('#test-input', 'new text');
            expect(input.value).toBe('new text');
        });

        test('should not clear when clear=false', () => {
            const input = document.getElementById('test-input');
            expect(input.value).toBe('initial');
            
            vbox.type('#test-input', ' appended', { clear: false });
            expect(input.value).toBe('initial appended');
        });

        test('should trigger input and change events', (done) => {
            const input = document.getElementById('test-input');
            let inputFired = false;
            let changeFired = false;

            input.addEventListener('input', () => { inputFired = true; });
            input.addEventListener('change', () => { changeFired = true; });

            vbox.type('#test-input', 'test');

            setTimeout(() => {
                expect(inputFired).toBe(true);
                expect(changeFired).toBe(true);
                done();
            }, 50);
        });
    });

    describe('3. WaitForElement Error Messages', () => {
        test('should include selector in timeout error', async () => {
            try {
                await vbox.waitForElement('#never-appears', 100);
                fail('Should have thrown error');
            } catch (error) {
                expect(error.message).toContain('#never-appears');
                expect(error.message).toContain('Timeout');
            }
        });

        test('should resolve immediately if element exists', async () => {
            const result = await vbox.waitForElement('#visible-btn', 1000);
            expect(result).toBe(true);
        });

        test('should wait for dynamically added element', async () => {
            setTimeout(() => {
                const div = document.createElement('div');
                div.id = 'dynamic-element';
                document.getElementById('dynamic-content').appendChild(div);
            }, 100);

            const result = await vbox.waitForElement('#dynamic-element', 1000);
            expect(result).toBe(true);
        });
    });

    describe('4. Evaluate Removed', () => {
        test('evaluate should not exist', () => {
            expect(vbox.evaluate).toBeUndefined();
        });

        test('should use safe alternatives instead', () => {
            // getText instead of evaluate('document.querySelector(...).textContent')
            expect(vbox.getText).toBeDefined();
            expect(vbox.getText('#visible-btn')).toBe('Visible Button');

            // getAttribute instead of evaluate('document.querySelector(...).getAttribute(...)')
            expect(vbox.getAttribute).toBeDefined();
            
            // extractData instead of evaluate with complex logic
            expect(vbox.extractData).toBeDefined();
        });
    });

    describe('5. API Wrapper Error Normalization', () => {
        if (typeof VBoxAPIWrapper === 'undefined') {
            test.skip('VBoxAPIWrapper not available in this context', () => {});
            return;
        }

        test('should normalize successful sync call', () => {
            const result = wrapper.getText('#visible-btn');
            expect(result).toEqual({
                success: true,
                data: 'Visible Button'
            });
        });

        test('should normalize error from sync call', () => {
            const result = wrapper.getText('#non-existent');
            expect(result).toEqual({
                success: false,
                error: expect.stringContaining('not found')
            });
        });

        test('should normalize successful async call', async () => {
            const result = await wrapper.waitForElement('#visible-btn', 1000);
            expect(result).toEqual({
                success: true,
                data: true
            });
        });

        test('should normalize error from async call', async () => {
            const result = await wrapper.waitForElement('#never-appears', 100);
            expect(result).toEqual({
                success: false,
                error: expect.stringContaining('Timeout')
            });
        });

        test('should validate CSS selector', () => {
            const result = wrapper.click('invalid[[[selector');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid CSS selector');
        });

        test('should validate required parameters', async () => {
            const result = await wrapper.type('#test-input', null);
            expect(result.success).toBe(false);
            expect(result.error).toContain('must be a string');
        });

        test('should retry on transient failures', async () => {
            let attempts = 0;
            const mockFn = jest.fn(async () => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('Transient error');
                }
                return { success: true };
            });

            // Mock a retryable operation
            const result = await wrapper.wrapAsync(mockFn);
            expect(attempts).toBe(2);
            expect(result.success).toBe(true);
        });

        test('should not retry on non-retryable errors', async () => {
            let attempts = 0;
            const mockFn = jest.fn(async () => {
                attempts++;
                throw new Error('Element not found');
            });

            const result = await wrapper.wrapAsync(mockFn);
            expect(attempts).toBe(1); // Should not retry
            expect(result.success).toBe(false);
        });

        test('should timeout long operations', async () => {
            const mockFn = jest.fn(async () => {
                await new Promise(resolve => setTimeout(resolve, 10000));
                return { success: true };
            });

            const result = await wrapper.wrapAsync(mockFn, [], { timeout: 100 });
            expect(result.success).toBe(false);
            expect(result.error).toContain('timeout');
        });
    });

    describe('6. Integration Tests', () => {
        test('safe click pattern with waitForElement', async () => {
            // Add element after delay
            setTimeout(() => {
                const btn = document.createElement('button');
                btn.id = 'delayed-btn';
                btn.textContent = 'Click me';
                document.body.appendChild(btn);
            }, 100);

            // Wait then click
            await vbox.waitForElement('#delayed-btn', 1000);
            expect(() => vbox.click('#delayed-btn')).not.toThrow();
        });

        test('type with framework compatibility', () => {
            const input = document.getElementById('test-input');
            
            // Simulate React-style value tracking
            let reactValue = input.value;
            input.addEventListener('input', (e) => {
                reactValue = e.target.value;
            });

            vbox.type('#test-input', 'React test');
            expect(reactValue).toBe('React test');
        });

        test('error recovery pattern', async () => {
            if (!wrapper) {
                return; // Skip if wrapper not available
            }

            // Try to click hidden element
            let result = await wrapper.click('#hidden-btn');
            expect(result.success).toBe(false);

            // Make it visible and retry
            document.getElementById('hidden-btn').style.display = 'block';
            result = await wrapper.click('#hidden-btn');
            expect(result.success).toBe(true);
        });
    });

    describe('7. Regression Tests', () => {
        test('autoScroll should not have race conditions', async () => {
            // Mock infinite scroll page
            let scrollCount = 0;
            const originalScrollHeight = document.body.scrollHeight;
            
            Object.defineProperty(document.body, 'scrollHeight', {
                get: () => originalScrollHeight + (scrollCount * 100),
                configurable: true
            });

            window.scrollTo = jest.fn((x, y) => {
                scrollCount++;
            });

            const result = await vbox.autoScroll({ delay: 50, maxScrolls: 3 });
            expect(result).toBe(3);
            expect(scrollCount).toBe(3);
        });

        test('extractTable should return consistent format', () => {
            document.body.innerHTML = `
                <table id="test-table">
                    <thead>
                        <tr><th>Name</th><th>Age</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>John</td><td>30</td></tr>
                        <tr><td>Jane</td><td>25</td></tr>
                    </tbody>
                </table>
            `;

            const result = vbox.extractTable('#test-table');
            expect(result).toEqual({
                headers: ['Name', 'Age'],
                rows: [
                    { Name: 'John', Age: '30' },
                    { Name: 'Jane', Age: '25' }
                ]
            });
        });

        test('scrapeImages should handle unloaded images', () => {
            document.body.innerHTML = `
                <img id="loaded" src="test1.jpg" width="100" height="100" />
                <img id="unloaded" src="test2.jpg" />
            `;

            // Simulate loaded image
            const loaded = document.getElementById('loaded');
            Object.defineProperty(loaded, 'complete', { value: true });
            Object.defineProperty(loaded, 'naturalWidth', { value: 100 });
            Object.defineProperty(loaded, 'naturalHeight', { value: 100 });

            const images = vbox.scrapeImages();
            expect(images.length).toBe(2);
            expect(images[0].loaded).toBe(true);
            expect(images[1].loaded).toBe(false);
        });
    });
});

// Run tests
if (typeof jest !== 'undefined') {
    console.log('Running VBox API Fixes tests...');
}
