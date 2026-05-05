<script>
    import { Search } from "lucide-svelte";

    let {
        value = $bindable(""),
        placeholder = "Search...",
        disabled = false,
        onInput = () => {},
        onFocus = () => {},
        onBlur = () => {},
        class: className = ""
    } = $props();

    function handleInput(e) {
        value = e.target.value;
        onInput(e);
    }
</script>

<div class="relative {className}">
    <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
    <input
        type="text"
        bind:value
        {placeholder}
        {disabled}
        oninput={handleInput}
        onfocus={onFocus}
        onblur={onBlur}
        class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed"
    />
</div>




