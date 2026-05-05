<script>
  // Mock LoginPage component for testing
  export let email = '';
  export let password = '';
  export let error = '';
  export let loading = false;
  
  function handleSubmit() {
    // Mock submit logic
  }
</script>

<div class="login-form">
  <input type="email" bind:value={email} placeholder="Email" />
  <input type="password" bind:value={password} placeholder="Password" />
  <button onclick={handleSubmit} disabled={loading}>
    {loading ? 'Loading...' : 'Login'}
  </button>
  {#if error}
    <div class="error">{error}</div>
  {/if}
</div>
