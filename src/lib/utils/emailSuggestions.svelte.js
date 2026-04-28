// Email Suggestions Store - manages previously used emails for login suggestions
function createEmailSuggestionsStore() {
    let emails = $state([]);
    
    // Load from localStorage on initialization
    try {
        const stored = localStorage.getItem('visualbox_email_suggestions');
        if (stored) {
            emails = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load email suggestions:', e);
        emails = [];
    }

    // Save to localStorage effect
    $effect.root(() => {
        $effect(() => {
            localStorage.setItem('visualbox_email_suggestions', JSON.stringify(emails));
        });
    });

    return {
        get emails() {
            return emails;
        },

        // Add email to suggestions (on successful login)
        addEmail(email) {
            if (!email || typeof email !== 'string') return;
            
            const cleanedEmail = email.trim().toLowerCase();
            if (!cleanedEmail) return;

            // Remove if already exists
            emails = emails.filter(e => e !== cleanedEmail);
            
            // Add to beginning
            emails.unshift(cleanedEmail);
            
            // Keep only last 10 emails
            if (emails.length > 10) {
                emails = emails.slice(0, 10);
            }
        },

        // Get filtered suggestions based on input
        getSuggestions(query) {
            if (!query || typeof query !== 'string') return [];
            
            const lowerQuery = query.toLowerCase().trim();
            if (lowerQuery.length === 0) return emails.slice(0, 5);
            
            return emails.filter(email => 
                email.startsWith(lowerQuery) || email.includes(lowerQuery)
            ).slice(0, 5);
        },

        // Remove specific email
        removeEmail(email) {
            if (!email) return;
            const cleanedEmail = email.trim().toLowerCase();
            emails = emails.filter(e => e !== cleanedEmail);
        },

        // Clear all suggestions
        clearAll() {
            emails = [];
        }
    };
}

export const emailSuggestionsStore = createEmailSuggestionsStore();