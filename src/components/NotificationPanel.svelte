<script>
    import { notificationStore } from "../lib/notifications.svelte.js";
    import {
        Bell,
        X,
        Check,
        CheckCheck,
        Trash2,
        Clock,
        AlertTriangle,
    } from "lucide-svelte";

    let notifications = $derived(notificationStore.notifications);
    let unreadCount = $derived(notificationStore.unreadCount);

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = (now - date) / 1000; // seconds

        if (diff < 60) return "Just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    }

    function handleMarkRead(notification) {
        notificationStore.markAsRead(notification.id);
    }

    function handleRemove(notification) {
        notificationStore.removeNotification(notification.id);
    }

    function handleClearAll() {
        notificationStore.clearAll();
    }

    function handleMarkAllRead() {
        notificationStore.markAllAsRead();
    }

    function handleClick(notification) {
        notificationStore.clickNotification(notification.id);
        // TODO: Navigate to the service/url
        console.log("Navigate to", notification.url);
    }
</script>

<div
    class="fixed top-16 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50 max-h-[600px] flex flex-col"
>
    <!-- Header -->
    <div
        class="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex items-center justify-between"
    >
        <div class="flex items-center gap-2">
            <Bell size={20} />
            <h3 class="font-semibold">Notifications</h3>
            {#if unreadCount > 0}
                <span
                    class="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold shadow-sm"
                >
                    {unreadCount}
                </span>
            {/if}
        </div>
        <button
            onclick={() => notificationStore.closeNotificationCenter()}
            class="p-1 hover:bg-white/20 rounded-lg transition-colors"
        >
            <X size={18} />
        </button>
    </div>

    <!-- Toolbar -->
    {#if notifications.length > 0}
        <div
            class="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/50"
        >
            <button
                onclick={handleMarkAllRead}
                class="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                disabled={unreadCount === 0}
                class:opacity-50={unreadCount === 0}
            >
                <CheckCheck size={14} />
                Mark all read
            </button>
            <button
                onclick={handleClearAll}
                class="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
                <Trash2 size={14} />
                Clear all
            </button>
        </div>
    {/if}

    <!-- Notifications List -->
    <div class="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/30">
        {#if notifications.length === 0}
            <div
                class="p-8 text-center text-gray-400 flex flex-col items-center"
            >
                <div
                    class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3"
                >
                    <Bell size={32} class="opacity-20" />
                </div>
                <p class="text-sm font-medium text-gray-500">
                    No notifications
                </p>
                <p class="text-xs text-gray-400 mt-1">
                    We'll let you know when something arrives.
                </p>
            </div>
        {:else}
            <div class="p-2 space-y-2">
                {#each notifications as notification (notification.id)}
                    <div
                        class="relative group bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer
                               {notification.read
                            ? 'opacity-70'
                            : 'border-indigo-100'}"
                        role="button"
                        tabindex="0"
                        onclick={() => handleClick(notification)}
                        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick(notification)}
                    >
                        <!-- Unread Indicator -->
                        {#if !notification.read}
                            <div
                                class="absolute top-3 right-3 w-2 h-2 bg-indigo-500 rounded-full"
                            ></div>
                        {/if}

                        <div class="flex items-start gap-3">
                            <div class="relative shrink-0">
                                {#if notification.icon}
                                    <img
                                        src={notification.icon}
                                        alt=""
                                        class="w-10 h-10 rounded-lg object-contain bg-gray-50 p-1"
                                    />
                                {:else}
                                    <div
                                        class="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-500"
                                    >
                                        <Bell size={18} />
                                    </div>
                                {/if}
                                {#if notification.isUrgent}
                                    <div
                                        class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 border-2 border-white"
                                    >
                                        <AlertTriangle size={10} />
                                    </div>
                                {/if}
                            </div>

                            <div class="flex-1 min-w-0 pr-6">
                                <div
                                    class="flex items-baseline justify-between mb-0.5"
                                >
                                    <h4
                                        class="text-sm font-semibold text-gray-900 truncate pr-2"
                                    >
                                        {notification.serviceName || "System"}
                                    </h4>
                                    <span
                                        class="text-[10px] text-gray-400 shrink-0 flex items-center gap-0.5"
                                    >
                                        <Clock size={10} />
                                        {formatTime(notification.timestamp)}
                                    </span>
                                </div>
                                <p
                                    class="text-sm text-gray-600 line-clamp-2 leading-relaxed"
                                >
                                    {notification.title}
                                </p>
                                {#if notification.body}
                                    <p
                                        class="text-xs text-gray-500 mt-1 line-clamp-1"
                                    >
                                        {notification.body}
                                    </p>
                                {/if}
                            </div>
                        </div>

                        <!-- Hover Actions -->
                        <div
                            class="absolute right-2 bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg p-0.5"
                        >
                            {#if !notification.read}
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleMarkRead(notification);
                                    }}
                                    class="p-1.5 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-md transition-colors"
                                    title="Mark as read"
                                >
                                    <Check size={14} />
                                </button>
                            {/if}
                            <button
                                onclick={(e) => {
                                    e.stopPropagation();
                                    handleRemove(notification);
                                }}
                                class="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-md transition-colors"
                                title="Remove"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.1);
        border-radius: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.2);
    }
</style>
