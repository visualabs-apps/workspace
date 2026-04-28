// Dropdown Manager - ensures only one dropdown is open at a time
function createDropdownManager() {
    let activeDropdown = $state(null);

    return {
        get activeDropdown() {
            return activeDropdown;
        },

        // Register a dropdown and close others
        setActive(dropdownId) {
            if (activeDropdown && activeDropdown !== dropdownId) {
                // Close the previously active dropdown
                document.dispatchEvent(new CustomEvent('closeDropdown', { 
                    detail: { except: dropdownId } 
                }));
            }
            activeDropdown = dropdownId;
        },

        // Close specific dropdown
        close(dropdownId) {
            if (activeDropdown === dropdownId) {
                activeDropdown = null;
            }
        },

        // Close all dropdowns
        closeAll() {
            if (activeDropdown) {
                document.dispatchEvent(new CustomEvent('closeDropdown', { 
                    detail: { except: null } 
                }));
                activeDropdown = null;
            }
        }
    };
}

export const dropdownManager = createDropdownManager();

// Make it globally accessible
if (typeof window !== 'undefined') {
    window.dropdownManager = dropdownManager;
}
