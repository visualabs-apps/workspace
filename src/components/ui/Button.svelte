<script>
    let {
        variant = "primary", // primary, secondary, danger, ghost
        size = "md", // sm, md, lg
        disabled = false,
        loading = false,
        fullWidth = false,
        type = "button",
        onclick = () => {},
        class: className = "",
        children
    } = $props();

    const variantClasses = {
        primary: "bg-blue-600 hover:bg-blue-700 text-white",
        secondary: "bg-gray-200 hover:bg-gray-300 text-gray-700",
        danger: "bg-red-600 hover:bg-red-700 text-white",
        ghost: "bg-transparent hover:bg-gray-100 text-gray-700"
    };

    const sizeClasses = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base"
    };
</script>

<button
    {type}
    {disabled}
    {onclick}
    class="rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2
        {variantClasses[variant]} 
        {sizeClasses[size]} 
        {fullWidth ? 'w-full' : ''} 
        {className}"
>
    {#if loading}
        <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
    {/if}
    {#if children}
        {@render children()}
    {/if}
</button>
