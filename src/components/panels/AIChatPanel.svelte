<script>
    import { Bot, X, Send, Trash2, History, ChevronDown, Loader2, Shield } from "lucide-svelte";
    import { aiChatStore } from "../../lib/stores/aiChatStore.svelte.js";
    import { kieaiGateway } from "../../lib/api/kieaiGateway.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { mcpService } from "../../lib/services/mcpService.js";
    import MCPQuickActions from "./MCPQuickActions.svelte";
    import MCPApprovalDialog from "./MCPApprovalDialog.svelte";
    import ToolStatusIcon from "../ui/ToolStatusIcon.svelte";
    import { onMount } from "svelte";
    import { marked } from "marked";

    let isOpen = $derived(aiChatStore.isOpen);
    let messages = $derived(aiChatStore.messages);
    let isProcessing = $derived(aiChatStore.isProcessing);
    let selectedModel = $derived(aiChatStore.selectedModel);
    let availableModels = $derived(aiChatStore.availableModels);
    let pollStatus = $derived(aiChatStore.pollStatus);
    let approvalMode = $derived(aiChatStore.approvalMode);
    let pendingAction = $derived(aiChatStore.pendingAction);
    
    let inputText = $state("");
    let chatContainer;
    let inputElement; // Reference to textarea
    let showHistory = $state(false);
    let showModelDropdown = $state(false);
    let showApprovalModeDropdown = $state(false);
    let lastFailedMessage = $state(null); // Store failed message for retry
    let loadedWorkspaceId = $state(null); // Track which workspace history was loaded for
    let mcpAvailable = $state(false);
    let developerMode = $state(false);
    let shouldStopAutoContinue = $state(false); // Flag to stop auto-continue loop
    let isAutoContinueSending = $state(false); // Flag to prevent duplicate auto-continue
    
    // Automation mode and context awareness are always ON
    const automationMode = true;
    const contextAware = true;

    // Load available models on mount
    onMount(async () => {
        // Configure marked for better rendering
        marked.setOptions({
            breaks: true, // Convert \n to <br>
            gfm: true, // GitHub Flavored Markdown
        });

        // Check MCP availability
        mcpAvailable = mcpService.isAvailable();

        // Load developer mode setting
        if (window.api?.settings?.getDeveloperMode) {
            const devModeResult = await window.api.settings.getDeveloperMode();
            if (devModeResult.success) {
                developerMode = devModeResult.enabled;
            }
        }

        // Listen for settings updates
        const handleSettingsUpdate = async () => {
            if (window.api?.settings?.getDeveloperMode) {
                const devModeResult = await window.api.settings.getDeveloperMode();
                if (devModeResult.success) {
                    developerMode = devModeResult.enabled;
                }
            }
        };
        window.addEventListener('settings-updated', handleSettingsUpdate);

        const result = await kieaiGateway.getModels();
        if (result.success) {
            aiChatStore.setAvailableModels(result.models);
        } else {
            toastStore.error("Failed to load AI models");
        }

        // Load chat history on mount if panel is already open
        if (isOpen) {
            loadChatHistory();
        }

        // Cleanup
        return () => {
            window.removeEventListener('settings-updated', handleSettingsUpdate);
        };
    });

    // Load chat history when panel opens
    $effect(() => {
        if (isOpen) {
            loadChatHistory();
        }
    });

    async function loadChatHistory() {
        // Get current workspace/profile ID
        const workspace = workspaceStore.activeWorkspace;
        if (!workspace?.id) return;
        
        // Prevent loading multiple times for same workspace
        if (loadedWorkspaceId === workspace.id) return;
        
        aiChatStore.setProfileId(workspace.id);
        await aiChatStore.loadMessages(workspace.id);
        loadedWorkspaceId = workspace.id;
        
        // Scroll to bottom after loading
        setTimeout(() => {
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 100);
    }

    // Handle MCP quick action results
    function handleMCPActionResult(action, data) {
        // Format MCP result as a system message
        const formattedData = JSON.stringify(data, null, 2);
        const message = `**MCP Action: ${action}**\n\n\`\`\`json\n${formattedData}\n\`\`\``;
        
        aiChatStore.addMessage("assistant", message, { 
            isMCPResult: true,
            mcpAction: action 
        });
        
        // Scroll to bottom
        setTimeout(() => {
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 50);
    }

    // Generate tool status icon HTML
    function getToolStatusIcon(status) {
        const icons = {
            success: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block" style="color: #16a34a;"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            error: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block" style="color: #dc2626;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            waiting: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block" style="color: #ca8a04;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
            disabled: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block" style="color: #6b7280;"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>'
        };
        return icons[status] || '';
    }

    // Detect and execute MCP tool from AI response
    async function detectAndExecuteMCPTool(content) {
        try {
            // Try to parse structured format: {"tool_calls": [...], "message": "..."}
            const structuredMatch = content.match(/\{[\s\S]*?"tool_calls"[\s\S]*?\[[\s\S]*?\][\s\S]*?\}/);
            
            if (structuredMatch) {
                // Parse structured format
                const parsed = JSON.parse(structuredMatch[0]);
                if (!parsed.tool_calls || !Array.isArray(parsed.tool_calls)) return null;

                const results = [];

                // Execute all tool calls sequentially
                for (const toolCall of parsed.tool_calls) {
                    if (!toolCall.tool || !toolCall.params) continue;

                    // Check approval mode
                    if (approvalMode === 'ask') {
                        // For multiple tools, ask approval for all at once
                        if (results.length === 0) {
                            // First tool - set pending and ask approval
                            aiChatStore.setPendingAction({ tools: parsed.tool_calls, message: parsed.message });
                            const toolsList = parsed.tool_calls.map(t => t.tool).join(', ');
                            const response = (parsed.message || '') + 
                                `\n\n**Waiting for approval to execute ${parsed.tool_calls.length} tool(s): ${toolsList}**`;
                            return { response, toolCall: { tools: parsed.tool_calls }, result: null, pending: true };
                        }
                    }

                    if (result.success) {
                        const resultText = JSON.stringify(result.data, null, 2);
                        results.push(`${getToolStatusIcon('success')} **Tool Executed: ${toolCall.tool}**\n\`\`\`json\n${resultText}\n\`\`\``);
                        toastStore.success(`MCP tool executed: ${toolCall.tool}`);
                        
                        // Send result back to AI for next step (only after last tool)
                        if (toolCall === parsed.tool_calls[parsed.tool_calls.length - 1]) {
                            setTimeout(() => {
                                sendToolResultToAI(toolCall, result);
                            }, 1000);
                        }
                    } else {
                        results.push(`${getToolStatusIcon('error')} **Tool Failed: ${toolCall.tool}**\nError: ${result.error}`);
                        toastStore.error(`MCP tool failed: ${toolCall.tool}`);
                    }
                }

                // Combine message with results
                const finalResponse = (parsed.message || '') + '\n\n' + results.join('\n\n');
                return { response: finalResponse, toolCall: null, result: null };
            }

            // Fallback: Try old format (single tool call mixed with text)
            const toolCallRegex = /\{[\s\S]*?"tool"[\s\S]*?"params"[\s\S]*?\}/g;
            const matches = content.match(toolCallRegex);
            
            if (!matches || matches.length === 0) return null;

            let modifiedContent = content;
            const results = [];

            // Execute all tool calls sequentially
            for (const match of matches) {
                try {
                    const toolCall = JSON.parse(match);
                    if (!toolCall.tool || !toolCall.params) continue;

                    // Check approval mode
                    if (approvalMode === 'ask') {
                        aiChatStore.setPendingAction(toolCall);
                        const response = content.replace(match, '') + 
                            `\n\n**Waiting for approval to execute: ${toolCall.tool}**`;
                        return { response, toolCall, result: null, pending: true };
                    }

                    if (result.success) {
                        const resultText = JSON.stringify(result.data, null, 2);
                        modifiedContent = modifiedContent.replace(match, '');
                        results.push(`${getToolStatusIcon('success')} **Tool Executed: ${toolCall.tool}**\n\`\`\`json\n${resultText}\n\`\`\``);
                        toastStore.success(`MCP tool executed: ${toolCall.tool}`);
                        
                        // Send result back to AI for next step (only after last tool)
                        if (match === matches[matches.length - 1]) {
                            setTimeout(() => {
                                sendToolResultToAI(toolCall, result);
                            }, 1000);
                        }
                    } else {
                        modifiedContent = modifiedContent.replace(match, '');
                        results.push(`${getToolStatusIcon('error')} **Tool Failed: ${toolCall.tool}**\nError: ${result.error}`);
                        toastStore.error(`MCP tool failed: ${toolCall.tool}`);
                    }
                } catch (parseError) {
                    console.error('[AI Chat] Error parsing tool call:', parseError);
                }
            }

            // Combine modified content with results
            const finalResponse = modifiedContent + '\n\n' + results.join('\n\n');
            return { response: finalResponse, toolCall: null, result: null };
        } catch (error) {
            console.error('[AI Chat] Error detecting/executing MCP tool:', error);
            return null;
        }
    }

    // Execute MCP tool
    async function executeMCPTool(toolCall, originalContent, matchedJson) {
        const result = await mcpService.executeTool(toolCall.tool, toolCall.params);

        if (result.success) {
            const resultText = JSON.stringify(result.data, null, 2);
            const response = originalContent.replace(matchedJson, '') + 
                `\n\n✅ **Tool Executed: ${toolCall.tool}**\n\n\`\`\`json\n${resultText}\n\`\`\``;
            
            toastStore.success(`MCP tool executed: ${toolCall.tool}`);
            
            // Auto-continue: Always send result back to AI for next step
            setTimeout(() => {
                sendToolResultToAI(toolCall, result);
            }, 1000);
            
            return { response, toolCall, result };
        } else {
            const response = originalContent.replace(matchedJson, '') + 
                `\n\n❌ **Tool Failed: ${toolCall.tool}**\nError: ${result.error}`;
            
            toastStore.error(`MCP tool failed: ${toolCall.tool}`);
            return { response, toolCall, result };
        }
    }

    // Send tool result back to AI for confirmation and next step
    async function sendToolResultToAI(toolCall, result) {
        // Check if stop was requested
        if (shouldStopAutoContinue) {
            return;
        }
        
        const feedbackMessage = `[TOOL RESULT]\nTool: ${toolCall.tool}\nParams: ${JSON.stringify(toolCall.params)}\nResult: ${JSON.stringify(result.data, null, 2)}\n\nPlease confirm the result and continue with the next step if needed.`;
        
        // Add user message with tool result
        aiChatStore.addMessage("user", feedbackMessage, { isToolFeedback: true });
        
        // Auto-send to AI
        await sendMessage(feedbackMessage);
    }

    // Handle approval
    async function handleApprove() {
        if (!pendingAction) return;

        const action = pendingAction;
        aiChatStore.setPendingAction(null);

        // Check if multiple tools
        if (action.tools && Array.isArray(action.tools)) {
            // Execute all tools
            const results = [];
            const toolResults = []; // Clean results for AI
            
            for (const toolCall of action.tools) {
                const result = await mcpService.executeTool(toolCall.tool, toolCall.params);
                
                if (result.success) {
                    const resultText = JSON.stringify(result.data, null, 2);
                    results.push(`${getToolStatusIcon('success')} **Tool Executed: ${toolCall.tool}**\n\`\`\`json\n${resultText}\n\`\`\``);
                    toastStore.success(`Executed: ${toolCall.tool}`);
                    
                    toolResults.push({
                        tool: toolCall.tool,
                        status: 'success',
                        result: result.data
                    });
                } else {
                    results.push(`${getToolStatusIcon('error')} **Tool Failed: ${toolCall.tool}**\nError: ${result.error}`);
                    toastStore.error(`Failed: ${toolCall.tool}`);
                    
                    toolResults.push({
                        tool: toolCall.tool,
                        status: 'error',
                        error: result.error
                    });
                }
            }
            
            // Add combined result
            const message = (action.message || '') + '\n\n' + results.join('\n\n');
            aiChatStore.addMessage("assistant", message, { isMCPResult: true });
            
            // Auto-continue: send tool results back to AI
            if (!shouldStopAutoContinue && toolResults.length > 0 && !isAutoContinueSending) {
                isAutoContinueSending = true;
                setTimeout(() => {
                    const feedbackMessage = `<tool_results>\n${JSON.stringify(toolResults, null, 2)}\n</tool_results>\n\nThe tools have been executed. Please analyze the results and continue with the next step if needed.`;
                    console.log('[AI Chat] Tool feedback:', toolResults);
                    // Don't add to UI, just send to AI
                    sendMessage(feedbackMessage, true);
                    isAutoContinueSending = false;
                }, 1000);
            }
        } else {
            // Single tool (legacy)
            const result = await mcpService.executeTool(action.tool, action.params);

            if (result.success) {
                const resultText = JSON.stringify(result.data, null, 2);
                const message = `${getToolStatusIcon('success')} **Tool Executed: ${action.tool}**\n\n\`\`\`json\n${resultText}\n\`\`\``;
                aiChatStore.addMessage("assistant", message, { isMCPResult: true });
                toastStore.success(`Executed: ${action.tool}`);
                
                // Auto-continue: send tool result back to AI
                if (!shouldStopAutoContinue && !isAutoContinueSending) {
                    isAutoContinueSending = true;
                    setTimeout(() => {
                        const toolResult = {
                            tool: action.tool,
                            status: 'success',
                            result: result.data
                        };
                        const feedbackMessage = `<tool_results>\n${JSON.stringify([toolResult], null, 2)}\n</tool_results>\n\nThe tool has been executed. Please analyze the result and continue with the next step if needed.`;
                        console.log('[AI Chat] Tool feedback:', [toolResult]);
                        // Don't add to UI, just send to AI
                        sendMessage(feedbackMessage, true);
                        isAutoContinueSending = false;
                    }, 1000);
                }
            } else {
                const message = `${getToolStatusIcon('error')} **Tool Failed: ${action.tool}**\nError: ${result.error}`;
                aiChatStore.addMessage("assistant", message, { isMCPResult: true, isError: true });
                toastStore.error(`Failed: ${action.tool}`);
            }
        }

        // Scroll to bottom
        setTimeout(() => {
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 50);
    }

    // Handle decline
    function handleDecline() {
        if (!pendingAction) return;

        const action = pendingAction;
        aiChatStore.setPendingAction(null);

        // Add declined message
        const toolName = action.tools ? `${action.tools.length} tool(s)` : action.tool;
        const message = `${getToolStatusIcon('error')} **Action Declined: ${toolName}**\nYou chose not to execute this action.`;
        aiChatStore.addMessage("assistant", message, { isMCPResult: true });
        toastStore.info('Action declined');

        // Scroll to bottom
        setTimeout(() => {
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 50);
    }

    // Change approval mode
    function setApprovalMode(mode) {
        aiChatStore.setApprovalMode(mode);
        showApprovalModeDropdown = false;
    }

    // Get approval mode display
    function getApprovalModeDisplay() {
        const modes = {
            'ask': 'Ask',
            'auto': 'Auto'
        };
        return modes[approvalMode] || 'Ask';
    }

    function handleClose() {
        aiChatStore.close();
    }

    function handleStop() {
        shouldStopAutoContinue = true;
        aiChatStore.setProcessing(false);
        aiChatStore.setPollStatus(null);
        
        // Force update last message if it's loading
        setTimeout(() => {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && (lastMsg.isLoading || lastMsg.role === 'assistant')) {
                aiChatStore.updateLastMessage({
                    content: "Stopped by user",
                    isLoading: false
                });
            }
        }, 100);
        
        toastStore.info('AI stopped');
    }

    function handleClearChat() {
        if (confirm("Clear all chat messages?")) {
            aiChatStore.clearMessages();
            // Focus input after clearing
            window.api?.resetWindowHitTest?.();
            setTimeout(() => {
                if (inputElement) {
                    inputElement.focus();
                }
            }, 100);
        }
    }

    function forceFocus(event) {
        setTimeout(() => {
            event.target.focus();
        }, 10);
    }

    function toggleHistory() {
        showHistory = !showHistory;
        toastStore.info("History feature coming soon");
    }

    function selectModel(modelId) {
        aiChatStore.setSelectedModel(modelId);
        showModelDropdown = false;
    }

    async function handleSend() {
        if (!inputText.trim() || isProcessing) return;

        const userMessage = inputText.trim();
        inputText = "";
        
        // Reset flags when user sends new message
        shouldStopAutoContinue = false;
        isAutoContinueSending = false;
        
        await sendMessage(userMessage);
    }

    async function sendMessage(userMessage, skipAddMessage = false) {
        // Check if stop was requested
        if (shouldStopAutoContinue) {
            return;
        }
        
        // Ensure profile ID is set BEFORE adding any message
        const workspace = workspaceStore.activeWorkspace;
        if (workspace?.id) {
            aiChatStore.setProfileId(workspace.id);
        }
        
        // Check if this is the first message BEFORE adding to store
        const isFirstMessage = messages.length === 0;
        
        // Add user message (skip if this is tool feedback)
        if (!skipAddMessage) {
            aiChatStore.addMessage("user", userMessage);
        }
        
        // Scroll to bottom
        setTimeout(() => {
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 50);

        // Set processing state
        aiChatStore.setProcessing(true);
        aiChatStore.setPollStatus(null);
        lastFailedMessage = null;

        try {
            // Inject page context if context-aware mode is enabled
            let contextPrefix = '';
            if (contextAware && mcpAvailable) {
                const pageInfo = await mcpService.getPageInfo();
                if (pageInfo.success && pageInfo.data) {
                    contextPrefix = `[Current Page Context]\nURL: ${pageInfo.data.url || 'N/A'}\nTitle: ${pageInfo.data.title || 'N/A'}\n\n`;
                }
            }

            // Add MCP tools context if MCP available (always inject so AI knows capabilities)
            let toolsContext = '';
            let nativeTools = null;
            
            if (mcpAvailable) {
                if (automationMode) {
                    // Try native tools format first (for Claude/GPT)
                    nativeTools = mcpService.getToolsForAPI();
                    
                    // Also prepare fallback context for models that don't support native tools
                    toolsContext = mcpService.getToolsContext();
                } else {
                    // Inject limited context so AI knows capabilities exist
                    toolsContext = `
[BROWSER AUTOMATION CAPABILITIES]
You have access to browser automation tools, but Automation Mode is currently OFF.
To use these tools, user needs to enable Automation Mode (⚡ button in chat header).

Available capabilities when Automation Mode is ON:
- Create new tabs (create_tab)
- Navigate to URLs (navigate)
- List and switch tabs (list_tabs, switch_tab)
- Get page information (get_page_info)
- Click, type, and interact with page elements
- Extract data, take screenshots, manage cookies
- And 28 total automation tools

If user asks about browser automation, inform them to enable Automation Mode first.
`;
                }
            }

            // Prepare messages for API - include ALL previous messages for context
            const apiMessages = [];
            
            // Add system message with tools context when automation mode is ON
            if (mcpAvailable && toolsContext && automationMode) {
                apiMessages.push({
                    role: "system",
                    content: toolsContext
                });
            }
            
            // Get conversation history (exclude current message which was just added)
            const conversationHistory = messages
                .filter(m => m.role === "user" || m.role === "assistant")
                .filter(m => !m.isError && !m.isLoading && !m.isMCPResult)
                .slice(0, -1); // Exclude the last message (current user message)
            
            // Add conversation history
            conversationHistory.forEach(m => {
                apiMessages.push({
                    role: m.role,
                    content: m.content
                });
            });

            // Add current user message with page context
            const fullMessage = `${contextPrefix}${userMessage}`;
            apiMessages.push({ role: "user", content: fullMessage });

            // Add placeholder for assistant response
            aiChatStore.addMessage("assistant", "Thinking...", { isLoading: true });

            // Scroll to show loading message
            setTimeout(() => {
                if (chatContainer) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }, 50);

            // Prepare submit options
            const submitOptions = {};
            
            // Add native tools if available (for Claude/GPT native tool calling)
            if (nativeTools && nativeTools.length > 0) {
                submitOptions.tools = nativeTools;
                submitOptions.tool_choice = { type: "auto" }; // Let AI decide when to use tools
            }

            // Call API with polling
            const result = await kieaiGateway.chat(
                selectedModel,
                apiMessages,
                {
                    submitOptions,
                    pollOptions: {
                        onProgress: (progress) => {
                            aiChatStore.setPollStatus(progress);
                            
                            // Fun loading messages - single word, random
                            const funMessages = [
                                'Thinking',
                                'Processing',
                                'Analyzing',
                                'Computing',
                                'Pondering',
                                'Crafting',
                                'Brewing',
                                'Cooking',
                                'Mixing',
                                'Blending',
                                'Weaving',
                                'Painting',
                                'Sculpting',
                                'Composing',
                                'Dreaming',
                                'Imagining',
                                'Exploring',
                                'Discovering',
                                'Surfing',
                                'Diving'
                            ];
                            
                            // Pick random message
                            const randomIndex = Math.floor(Math.random() * funMessages.length);
                            const statusText = funMessages[randomIndex];
                            
                            aiChatStore.updateLastMessage({ 
                                content: statusText,
                                isLoading: true 
                            });
                        }
                    }
                }
            );

            // Check if user stopped the request BEFORE processing result
            if (shouldStopAutoContinue) {
                // Ensure last message is updated
                const lastMsg = messages[messages.length - 1];
                if (lastMsg && lastMsg.isLoading) {
                    aiChatStore.updateLastMessage({
                        content: "Stopped by user",
                        isLoading: false
                    });
                }
                return;
            }

            if (result.success) {
                const responseData = result.data;
                
                // Check if response contains tool use (native format)
                // Path bisa result.data.content atau result.data.data.content
                let hasToolUse = false;
                let toolUseBlocks = [];
                let contentArray = null;
                
                // Try different paths for content
                if (responseData.data?.content && Array.isArray(responseData.data.content)) {
                    contentArray = responseData.data.content;
                } else if (Array.isArray(responseData.content)) {
                    contentArray = responseData.content;
                }
                
                if (contentArray) {
                    // Check for tool_use blocks in content array
                    toolUseBlocks = contentArray.filter(block => block.type === 'tool_use');
                    hasToolUse = toolUseBlocks.length > 0;
                }
                
                // Extract text content
                let responseContent = '';
                if (contentArray) {
                    // Extract text from content array
                    responseContent = contentArray
                        .filter(item => item.type === 'text')
                        .map(item => item.text || '')
                        .join('');
                } else if (typeof responseData.content === 'string') {
                    responseContent = responseData.content;
                } else if (responseData.message) {
                    // Fallback to message field
                    responseContent = responseData.message;
                } else if (responseData.data?.message) {
                    // Another fallback - nested data.message
                    responseContent = responseData.data.message;
                } else if (responseData.data?.content && typeof responseData.data.content === 'string') {
                    responseContent = responseData.data.content;
                } else {
                    console.error('[AI Chat] Unexpected content format:', responseData);
                    responseContent = 'Error: Unexpected response format';
                }
                
                const pricing = responseData.pricing || responseData.data?.pricing;

                // Handle native tool use blocks
                if (hasToolUse && automationMode && mcpAvailable) {
                    const results = [];
                    let shouldAskApproval = false;
                    
                    // Check approval mode first
                    if (approvalMode === 'ask') {
                        // Ask approval for all tools at once
                        aiChatStore.setPendingAction({ 
                            tools: toolUseBlocks.map(t => ({ tool: t.name, params: t.input })),
                            message: responseContent 
                        });
                        const toolsList = toolUseBlocks.map(t => t.name).join(', ');
                        const response = (responseContent || '') + 
                            `\n\n${getToolStatusIcon('waiting')} **Waiting for approval to execute ${toolUseBlocks.length} tool(s): ${toolsList}**`;
                        
                        aiChatStore.updateLastMessage({
                            content: response,
                            isLoading: false,
                            pricing: pricing,
                            model: selectedModel
                        });
                        
                        // Scroll to bottom
                        setTimeout(() => {
                            if (chatContainer) {
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                            }
                        }, 50);
                        
                        return;
                    }
                    
                    // Execute tools
                    const toolResults = []; // Store clean results for AI feedback
                    for (const toolBlock of toolUseBlocks) {
                        const toolName = toolBlock.name;
                        const toolParams = toolBlock.input || {};
                        
                        console.log('[AI Chat] Executing tool:', toolName, 'with params:', toolParams);
                        
                        // Execute tool
                        const execResult = await mcpService.executeTool(toolName, toolParams);
                        
                        if (execResult.success) {
                            const resultText = JSON.stringify(execResult.data, null, 2);
                            results.push(`<details class="tool-result-accordion">
<summary class="tool-result-summary">${getToolStatusIcon('success')} <strong>Tool Executed: ${toolName}</strong></summary>
<div class="tool-result-content">

\`\`\`json
${resultText}
\`\`\`

</div>
</details>`);
                            toastStore.success(`Executed: ${toolName}`);
                            
                            // Store clean result for AI
                            toolResults.push({
                                tool: toolName,
                                status: 'success',
                                result: execResult.data
                            });
                        } else {
                            results.push(`<details class="tool-result-accordion">
<summary class="tool-result-summary">${getToolStatusIcon('error')} <strong>Tool Failed: ${toolName}</strong></summary>
<div class="tool-result-content">
Error: ${execResult.error}
</div>
</details>`);
                            toastStore.error(`Failed: ${toolName}`);
                            
                            // Store clean result for AI
                            toolResults.push({
                                tool: toolName,
                                status: 'error',
                                error: execResult.error
                            });
                        }
                    }
                    
                    // Combine message with results
                    const finalResponse = (responseContent || '') + '\n\n' + results.join('\n\n');
                    
                    aiChatStore.updateLastMessage({
                        content: finalResponse,
                        isLoading: false,
                        pricing: pricing,
                        model: selectedModel
                    });
                    
                    // Scroll to bottom
                    setTimeout(() => {
                        if (chatContainer) {
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        }
                    }, 50);
                    
                    // Auto-continue: send tool results back to AI
                    if (!shouldStopAutoContinue && toolResults.length > 0 && !isAutoContinueSending) {
                        isAutoContinueSending = true;
                        
                        setTimeout(() => {
                            const feedbackMessage = `<tool_results>\n${JSON.stringify(toolResults, null, 2)}\n</tool_results>\n\nThe tools have been executed. Please analyze the results and continue with the next step if needed.`;
                            console.log('[AI Chat] Tool feedback:', toolResults);
                            // Don't add to UI, just send to AI
                            sendMessage(feedbackMessage, true);
                            isAutoContinueSending = false;
                        }, 1000);
                    }
                    
                    return;
                }

                // Fallback: Check if AI wants to use MCP tool (JSON format in text)
                let finalContent = responseContent;
                if (automationMode && mcpAvailable && !hasToolUse) {
                    const toolMatch = await detectAndExecuteMCPTool(responseContent);
                    if (toolMatch) {
                        finalContent = toolMatch.response;
                    }
                }

                // Update last message with actual response
                aiChatStore.updateLastMessage({
                    content: finalContent,
                    isLoading: false,
                    pricing: pricing,
                    model: selectedModel
                });
            } else {
                // Store failed message for retry
                lastFailedMessage = userMessage;
                
                // Update with error message - make it more user friendly
                let errorMessage = result.error || 'Unknown error';
                let canRetry = false;
                
                // Simplify technical errors
                if (errorMessage.includes('Invalid response from KIE AI')) {
                    errorMessage = 'AI service is having trouble processing your request. Please try again or use a different model.';
                    canRetry = true;
                } else if (errorMessage.includes('timeout')) {
                    errorMessage = 'Request timed out. Please try again.';
                    canRetry = true;
                } else if (errorMessage.includes('rate limit')) {
                    errorMessage = 'Too many requests. Please wait a moment and try again.';
                    canRetry = true;
                } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
                    errorMessage = 'Request not found. The request may have expired. Click retry to send again.';
                    canRetry = true;
                }
                
                aiChatStore.updateLastMessage({
                    content: errorMessage,
                    isLoading: false,
                    isError: true,
                    canRetry: canRetry
                });
                toastStore.error('AI request failed');
            }
            
            // Scroll to bottom after response
            setTimeout(() => {
                if (chatContainer) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }, 50);
        } catch (error) {
            console.error("AI Chat error:", error);
            lastFailedMessage = userMessage;
            aiChatStore.updateLastMessage({
                content: `Error: ${error.message}`,
                isLoading: false,
                isError: true,
                canRetry: true
            });
            toastStore.error("Failed to get AI response");
        } finally {
            aiChatStore.setProcessing(false);
            aiChatStore.setPollStatus(null);
        }
    }

    async function handleRetry() {
        if (!lastFailedMessage || isProcessing) return;
        
        // Remove the error message
        const filteredMessages = messages.filter(m => !m.isError);
        aiChatStore.clearMessages();
        filteredMessages.forEach(m => {
            // Only copy serializable properties
            const metadata = {};
            if (m.pricing) metadata.pricing = m.pricing;
            if (m.model) metadata.model = m.model;
            if (m.tools) metadata.tools = m.tools;
            
            aiChatStore.addMessage(m.role, m.content, metadata);
        });
        
        // Retry sending the message
        await sendMessage(lastFailedMessage);
    }

    function handleKeydown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    // Get model display name
    function getModelDisplayName(modelId) {
        return modelId;
    }

    // Format pricing
    function formatPrice(usd) {
        return `$${usd.toFixed(6)}`;
    }

    // Render markdown to HTML
    function renderMarkdown(text) {
        return marked.parse(text);
    }

    // Group models by family
    function getModelsByFamily() {
        const grouped = {};
        availableModels.forEach(model => {
            if (!grouped[model.family]) {
                grouped[model.family] = [];
            }
            grouped[model.family].push(model);
        });
        return grouped;
    }
</script>

<!-- AI Chat Panel - Slides from right and pushes content -->
<div 
    class="ai-chat-panel h-full bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out"
    style="width: {isOpen ? '320px' : '0'}; min-width: {isOpen ? '320px' : '0'}; overflow: hidden;"
>
    <!-- Compact Header with History Icon -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 select-none">
        <div class="flex items-center gap-2">
            <button
                onclick={toggleHistory}
                class="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="View chat history"
            >
                <History size={18} class="text-gray-600 dark:text-gray-400" />
            </button>
        </div>
        
        <div class="flex items-center gap-2">
            <button
                onclick={handleClearChat}
                class="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Clear chat"
            >
                <Trash2 size={16} class="text-gray-600 dark:text-gray-400" />
            </button>
            <button
                onclick={handleClose}
                class="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
                <X size={18} class="text-gray-600 dark:text-gray-400" />
            </button>
        </div>
    </div>

    <!-- MCP Quick Actions (only show if MCP available and developer mode ON) -->
    {#if mcpAvailable && developerMode}
        <MCPQuickActions onActionResult={handleMCPActionResult} />
    {/if}

    <!-- Model Selector -->
    <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 select-none">
        <div class="flex gap-2">
            <!-- Model Dropdown -->
            <div class="relative flex-1">
                <button
                    onclick={() => showModelDropdown = !showModelDropdown}
                    class="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                    <span class="text-gray-700 dark:text-gray-300 font-medium">
                        {getModelDisplayName(selectedModel)}
                    </span>
                    <ChevronDown size={16} class="text-gray-500" />
                </button>

                {#if showModelDropdown}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div 
                    class="fixed inset-0 z-40"
                    onclick={() => showModelDropdown = false}
                ></div>
                
                <div class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                    {#each Object.entries(getModelsByFamily()) as [family, models]}
                        <div class="px-2 py-1">
                            <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 py-1">
                                {family}
                            </div>
                            {#each models as model}
                                <button
                                    onclick={() => selectModel(model.id)}
                                    class="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors {selectedModel === model.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}"
                                >
                                    <div class="text-sm font-medium">
                                        {model.id}
                                    </div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400">
                                        ${model.pricing.input_usd_per_1m.toFixed(2)}/1M in · ${model.pricing.output_usd_per_1m.toFixed(2)}/1M out
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {/each}
                </div>
            {/if}
            </div>
            
            <!-- Approval Mode Selector (only if MCP available and developer mode ON) -->
            {#if mcpAvailable && developerMode}
                <div class="relative w-24">
                    <button
                        onclick={() => showApprovalModeDropdown = !showApprovalModeDropdown}
                        class="w-full flex items-center justify-between px-2 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs"
                        title="Approval mode"
                    >
                        <Shield size={14} class="text-gray-500" />
                        <span class="text-gray-700 dark:text-gray-300 font-medium">{getApprovalModeDisplay()}</span>
                        <ChevronDown size={12} class="text-gray-500" />
                    </button>

                    {#if showApprovalModeDropdown}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div 
                            class="fixed inset-0 z-40"
                            onclick={() => showApprovalModeDropdown = false}
                        ></div>
                        
                        <div class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50">
                            <button
                                onclick={() => setApprovalMode('ask')}
                                class="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t transition-colors {approvalMode === 'ask' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}"
                            >
                                <div class="text-xs font-medium">Ask</div>
                                <div class="text-[10px] text-gray-500 dark:text-gray-400">Confirm before executing</div>
                            </button>
                            <button
                                onclick={() => setApprovalMode('auto')}
                                class="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b transition-colors {approvalMode === 'auto' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}"
                            >
                                <div class="text-xs font-medium">Auto</div>
                                <div class="text-[10px] text-gray-500 dark:text-gray-400">Execute immediately</div>
                            </button>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>

    <!-- Pending Action Approval Dialog -->
    {#if pendingAction}
        <div class="px-3">
            <MCPApprovalDialog 
                action={pendingAction}
                onApprove={handleApprove}
                onDecline={handleDecline}
            />
        </div>
    {/if}

    <!-- Messages Container - Allow text selection for copy/paste -->
    <div 
        bind:this={chatContainer}
        class="flex-1 overflow-y-auto px-3 py-4 space-y-4 select-text"
        style="scrollbar-width: thin; scrollbar-color: #cbd5e0 transparent;"
    >
        {#if messages.length === 0}
            <div class="flex flex-col items-center justify-center h-full text-center px-4">
                <Bot size={48} class="text-gray-400 dark:text-gray-600 mb-4" />
                <p class="text-gray-600 dark:text-gray-400 text-sm">
                    Start a conversation with AI
                </p>
                <p class="text-gray-500 dark:text-gray-500 text-xs mt-2">
                    Ask anything, I'm here to help!
                </p>
            </div>
        {:else}
            {#each messages.filter(m => !m.isToolFeedback) as message (message.id)}
                <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[85%] {message.role === 'user' ? 'bg-blue-500 text-white' : message.isError ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'} rounded-lg px-3 py-2">
                        {#if message.isLoading}
                            <div class="flex items-center gap-2">
                                <div class="flex gap-1">
                                    <span class="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                                    <span class="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                                    <span class="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style="animation-delay: 300ms"></span>
                                </div>
                                <span class="text-sm">{message.content}</span>
                            </div>
                        {:else}
                            {#if message.role === 'assistant' && !message.isError}
                                <!-- Render markdown for assistant messages -->
                                <div class="text-sm markdown-content">
                                    {@html renderMarkdown(message.content)}
                                </div>
                            {:else}
                                <!-- Plain text for user messages and errors -->
                                <p class="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                            {/if}
                            {#if message.canRetry}
                                <button
                                    onclick={handleRetry}
                                    disabled={isProcessing}
                                    class="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs rounded transition-colors disabled:cursor-not-allowed"
                                >
                                    Retry
                                </button>
                            {/if}
                            {#if message.pricing}
                                <div class="text-xs opacity-70 mt-1 pt-1 border-t border-current/20">
                                    Cost: {formatPrice(message.pricing.cost_usd.total)} · Tokens: {message.pricing.total_tokens}
                                </div>
                            {/if}
                        {/if}
                    </div>
                </div>
            {/each}
        {/if}
    </div>

    <!-- Input Area - Allow text selection for editing -->
    <div class="border-t border-gray-200 dark:border-gray-700 p-3 select-text">
        <div class="flex gap-2">
            <textarea
                bind:this={inputElement}
                bind:value={inputText}
                onkeydown={handleKeydown}
                onmousedown={forceFocus}
                onclick={forceFocus}
                placeholder="Type your message..."
                disabled={isProcessing}
                class="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                rows="2"
            ></textarea>
            <button
                onclick={isProcessing ? handleStop : handleSend}
                disabled={!isProcessing && !inputText.trim()}
                class="px-4 py-2 {isProcessing ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center"
                title={isProcessing ? "Stop AI" : "Send message"}
            >
                {#if isProcessing}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2"/>
                    </svg>
                {:else}
                    <Send size={18} />
                {/if}
            </button>
        </div>
    </div>
</div>

<style>
    /* Custom scrollbar for chat messages */
    .ai-chat-panel ::-webkit-scrollbar {
        width: 6px;
    }

    .ai-chat-panel ::-webkit-scrollbar-track {
        background: transparent;
    }

    .ai-chat-panel ::-webkit-scrollbar-thumb {
        background: #cbd5e0;
        border-radius: 10px;
    }

    .dark .ai-chat-panel ::-webkit-scrollbar-thumb {
        background: #4b5563;
    }

    .ai-chat-panel ::-webkit-scrollbar-thumb:hover {
        background: #a0aec0;
    }

    .dark .ai-chat-panel ::-webkit-scrollbar-thumb:hover {
        background: #6b7280;
    }

    /* Markdown content styling */
    .markdown-content {
        word-break: break-word;
        overflow-wrap: break-word;
    }

    .markdown-content :global(p) {
        margin: 0.5em 0;
    }

    .markdown-content :global(p:first-child) {
        margin-top: 0;
    }

    .markdown-content :global(p:last-child) {
        margin-bottom: 0;
    }

    .markdown-content :global(strong) {
        font-weight: 600;
    }

    .markdown-content :global(em) {
        font-style: italic;
    }

    .markdown-content :global(code) {
        background: rgba(0, 0, 0, 0.1);
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 0.9em;
    }

    .dark .markdown-content :global(code) {
        background: rgba(255, 255, 255, 0.1);
    }

    .markdown-content :global(pre) {
        background: rgba(0, 0, 0, 0.1);
        padding: 0.75em;
        border-radius: 6px;
        overflow-x: auto;
        margin: 0.5em 0;
    }

    .dark .markdown-content :global(pre) {
        background: rgba(255, 255, 255, 0.1);
    }

    .markdown-content :global(pre code) {
        background: transparent;
        padding: 0;
    }

    .markdown-content :global(ul),
    .markdown-content :global(ol) {
        margin: 0.5em 0;
        padding-left: 1.5em;
    }

    .markdown-content :global(li) {
        margin: 0.25em 0;
    }

    .markdown-content :global(a) {
        color: #3b82f6;
        text-decoration: underline;
        word-break: break-all;
        overflow-wrap: break-word;
    }

    .dark .markdown-content :global(a) {
        color: #60a5fa;
    }

    .markdown-content :global(blockquote) {
        border-left: 3px solid rgba(0, 0, 0, 0.2);
        padding-left: 1em;
        margin: 0.5em 0;
        font-style: italic;
    }

    .dark .markdown-content :global(blockquote) {
        border-left-color: rgba(255, 255, 255, 0.2);
    }

    .markdown-content :global(h1),
    .markdown-content :global(h2),
    .markdown-content :global(h3),
    .markdown-content :global(h4),
    .markdown-content :global(h5),
    .markdown-content :global(h6) {
        font-weight: 600;
        margin: 0.75em 0 0.5em 0;
    }

    .markdown-content :global(h1) { font-size: 1.5em; }
    .markdown-content :global(h2) { font-size: 1.3em; }
    .markdown-content :global(h3) { font-size: 1.1em; }
</style>
