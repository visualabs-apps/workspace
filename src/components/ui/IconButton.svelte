<script>
    let {
        icon,
        size = "md", // sm, md, lg
        variant = "ghost", // ghost, primary, danger, success
        disabled = false,
        title = "",
        onclick = () => {},
        class: className = ""
    } = $props();

    const sizeClasses = {
        sm: "p-1 rounded",
        md: "p-1.5 rounded-lg",
        lg: "p-2 rounded-lg"
    };

    const iconSizes = {
        sm: 14,
        md: 16,
        lg: 20
    };

    const variantClasses = {
        ghost: "hover:bg-gray-100 text-gray-600 hover:text-gray-800",
        primary: "hover:bg-blue-100 text-blue-600 hover:text-blue-700",
        danger: "hover:bg-red-100 text-red-600 hover:text-red-700",
        success: "hover:bg-green-100 text-green-600 hover:text-green-700"
    };
</script>

<button
    type="button"
    {disabled}
    {title}
    {onclick}
    class="transition-colors disabled:opacity-50 disabled:cursor-not-allowed {sizeClasses[size]} {variantClasses[variant]} {className}"
>
    <svelte:component this={icon} size={iconSizes[size]} />
</button>




