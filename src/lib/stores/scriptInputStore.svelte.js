export const scriptInputStore = $state({
    isOpen: false,
    title: 'Script Input',
    fields: [],
    resolveCallback: null,
    
    open(config) {
        return new Promise((resolve) => {
            this.isOpen = true;
            this.title = config.title || 'Script Input';
            this.fields = config.fields || [];
            this.resolveCallback = resolve;
        });
    },
    
    close() {
        this.isOpen = false;
        if (this.resolveCallback) {
            this.resolveCallback({ success: false, message: 'Cancelled', data: null });
            this.resolveCallback = null;
        }
    },
    
    submit(data) {
        this.isOpen = false;
        if (this.resolveCallback) {
            this.resolveCallback({ success: true, data: data });
            this.resolveCallback = null;
        }
    }
});
