<script>
    import { onMount, onDestroy } from 'svelte';
    import { EditorView, basicSetup } from 'codemirror';
    import { javascript } from '@codemirror/lang-javascript';
    import { EditorState } from '@codemirror/state';
    import { oneDark } from '@codemirror/theme-one-dark';

    let { 
        value = $bindable(''),
        placeholder = '',
        readonly = false,
        height = '400px'
    } = $props();

    let editorElement;
    let editorView;

    onMount(() => {
        const startState = EditorState.create({
            doc: value,
            extensions: [
                basicSetup,
                javascript(),
                oneDark,
                EditorView.lineWrapping,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        value = update.state.doc.toString();
                    }
                }),
                EditorState.readOnly.of(readonly),
                EditorView.theme({
                    "&": { 
                        height: height,
                        display: "flex",
                        flexDirection: "column"
                    },
                    ".cm-scroller": { 
                        overflow: "auto",
                        flex: "1",
                        minHeight: "0"
                    }
                })
            ]
        });

        editorView = new EditorView({
            state: startState,
            parent: editorElement
        });
    });

    onDestroy(() => {
        if (editorView) {
            editorView.destroy();
        }
    });

    // Update editor when value changes externally
    $effect(() => {
        if (editorView && value !== editorView.state.doc.toString()) {
            editorView.dispatch({
                changes: {
                    from: 0,
                    to: editorView.state.doc.length,
                    insert: value
                }
            });
        }
    });

    // Expose format method
    export function format() {
        if (!editorView) return;
        
        try {
            // Simple beautifier - add proper indentation
            const code = editorView.state.doc.toString();
            const formatted = beautifyCode(code);
            
            editorView.dispatch({
                changes: {
                    from: 0,
                    to: editorView.state.doc.length,
                    insert: formatted
                }
            });
        } catch (error) {
            console.error('Format error:', error);
        }
    }

    function beautifyCode(code) {
        // Simple beautifier
        let indent = 0;
        const lines = code.split('\n');
        const formatted = [];

        for (let line of lines) {
            const trimmed = line.trim();
            
            // Decrease indent for closing braces
            if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
                indent = Math.max(0, indent - 1);
            }

            // Add indented line
            if (trimmed) {
                formatted.push('  '.repeat(indent) + trimmed);
            } else {
                formatted.push('');
            }

            // Increase indent for opening braces
            if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
                indent++;
            }
        }

        return formatted.join('\n');
    }
</script>

<div bind:this={editorElement} class="code-editor"></div>

<style>
    .code-editor {
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        overflow: hidden;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    :global(.dark) .code-editor {
        border-color: #374151;
    }

    :global(.cm-editor) {
        font-size: 13px;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    :global(.cm-gutters) {
        background-color: #1e1e1e;
        border-right: 1px solid #333;
    }

    :global(.cm-activeLineGutter) {
        background-color: #2d2d2d;
    }

    :global(.cm-scroller) {
        overflow: auto !important;
    }
</style>
