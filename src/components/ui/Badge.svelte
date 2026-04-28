<script>
    let {
        variant = "default", // default, primary, success, warning, danger
        size = "md", // sm, md, lg
        children
    } = $props();

    const variantClasses = {
        default: "bg-gray-100 text-gray-700",
        primary: "bg-blue-100 text-blue-700",
        success: "bg-green-100 text-green-700",
        warning: "bg-orange-100 text-orange-700",
        danger: "bg-red-100 text-red-700"
    };

    const sizeClasses = {
        sm: "px-1.5 py-0.5 text-xs",
        md: "px-2 py-0.5 text-xs",
        lg: "px-2.5 py-1 text-sm"
    };
</script>

<span class="inline-flex items-center rounded-md font-medium {variantClasses[variant]} {sizeClasses[size]}">
    {#if children}
        {@render children()}
    {/if}
</span>
