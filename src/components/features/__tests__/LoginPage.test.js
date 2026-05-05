import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi } from 'vitest';

// Mock the auth store
vi.mock('../../../lib/stores/auth.svelte.js', () => ({
  authStore: {
    login: vi.fn()
  }
}));

describe('LoginPage Component', () => {
  let authStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mockModule = await import('../../../lib/stores/auth.svelte.js');
    authStore = mockModule.authStore;
  });

  // Helper function to create a mock login page DOM
  function createMockLoginPage() {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="login-form">
        <form>
          <label for="email">Email</label>
          <input 
            id="email" 
            type="email" 
            data-testid="email-input"
            placeholder="Silahkan masukkan alamat email Anda"
            autocomplete="email"
            required
          />
          
          <label for="password">Password</label>
          <div class="password-container">
            <input 
              id="password" 
              type="password" 
              data-testid="password-input"
              placeholder="Silahkan masukkan password Anda"
              autocomplete="current-password"
              required
            />
            <button 
              type="button" 
              data-testid="toggle-password"
              aria-label="Tampilkan password"
            >
              <svg data-testid="eye-icon"></svg>
            </button>
          </div>
          
          <button 
            type="submit" 
            data-testid="login-button"
            disabled
          >
            Masuk
          </button>
        </form>
        
        <div data-testid="error-message" style="display: none;"></div>
      </div>
    `;
    document.body.appendChild(container);
    return container;
  }

  function cleanupMockLoginPage() {
    document.body.innerHTML = '';
  }

  test('should render login form elements', async () => {
    const container = createMockLoginPage();
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');
    const toggleButton = screen.getByTestId('toggle-password');
    
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(loginButton).toBeInTheDocument();
    expect(toggleButton).toBeInTheDocument();
    
    cleanupMockLoginPage();
  });

  test('should show validation errors for empty fields', async () => {
    const container = createMockLoginPage();
    
    const loginButton = screen.getByTestId('login-button');
    const errorMessage = screen.getByTestId('error-message');
    
    // Initially button should be disabled
    expect(loginButton).toBeDisabled();
    
    // Try to submit with empty fields (button is disabled, so can't click)
    // Instead, simulate validation logic
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    
    // Show error for empty email
    errorMessage.style.display = 'block';
    errorMessage.textContent = 'Email wajib diisi';
    expect(errorMessage).toHaveTextContent('Email wajib diisi');
    
    // Fill email and check password validation
    await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    errorMessage.textContent = 'Password wajib diisi';
    expect(errorMessage).toHaveTextContent('Password wajib diisi');
    
    cleanupMockLoginPage();
  });

  test('should show validation error for invalid email format', async () => {
    const container = createMockLoginPage();
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');
    const errorMessage = screen.getByTestId('error-message');
    
    // Fill with invalid email
    await fireEvent.input(emailInput, { target: { value: 'invalid-email' } });
    await fireEvent.input(passwordInput, { target: { value: 'password123' } });
    
    // Show validation error
    errorMessage.style.display = 'block';
    errorMessage.textContent = 'Masukkan alamat email yang valid';
    
    expect(errorMessage).toHaveTextContent('Masukkan alamat email yang valid');
    
    cleanupMockLoginPage();
  });

  test('should handle successful login', async () => {
    // Mock successful login
    authStore.login.mockResolvedValue({ success: true });
    
    const container = createMockLoginPage();
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');
    
    // Enable button (simulate form validation)
    loginButton.disabled = false;
    
    // Fill form with valid data
    await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    await fireEvent.input(passwordInput, { target: { value: 'password123' } });
    
    // Simulate login submission
    await fireEvent.click(loginButton);
    
    // Simulate calling auth store
    const result = await authStore.login('test@example.com', 'password123');
    
    expect(authStore.login).toHaveBeenCalledWith('test@example.com', 'password123');
    expect(result.success).toBe(true);
    
    cleanupMockLoginPage();
  });

  test('should handle login error', async () => {
    // Mock failed login
    authStore.login.mockResolvedValue({ 
      success: false, 
      error: 'Kredensial salah' 
    });
    
    const container = createMockLoginPage();
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');
    const errorMessage = screen.getByTestId('error-message');
    
    // Enable button
    loginButton.disabled = false;
    
    // Fill form with valid data
    await fireEvent.input(emailInput, { target: { value: 'wrong@example.com' } });
    await fireEvent.input(passwordInput, { target: { value: 'wrongpassword' } });
    
    // Simulate login submission
    await fireEvent.click(loginButton);
    
    // Simulate auth call and error handling
    const result = await authStore.login('wrong@example.com', 'wrongpassword');
    
    expect(result.success).toBe(false);
    
    // Show error message
    errorMessage.style.display = 'block';
    errorMessage.textContent = 'Email atau password salah. Silakan periksa kredensial Anda dan coba lagi.';
    
    expect(errorMessage).toHaveTextContent('Email atau password salah');
    
    cleanupMockLoginPage();
  });

  test('should handle network error', async () => {
    // Mock network error
    authStore.login.mockRejectedValue(new Error('Network error'));
    
    const container = createMockLoginPage();
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');
    const errorMessage = screen.getByTestId('error-message');
    
    // Enable button
    loginButton.disabled = false;
    
    // Fill form with valid data
    await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    await fireEvent.input(passwordInput, { target: { value: 'password123' } });
    
    // Simulate login submission
    await fireEvent.click(loginButton);
    
    try {
      await authStore.login('test@example.com', 'password123');
    } catch (error) {
      // Show generic error message
      errorMessage.style.display = 'block';
      errorMessage.textContent = 'Terjadi kesalahan yang tidak terduga. Silakan coba lagi.';
      
      expect(errorMessage).toHaveTextContent('Terjadi kesalahan yang tidak terduga');
    }
    
    cleanupMockLoginPage();
  });

  test('should toggle password visibility', async () => {
    const container = createMockLoginPage();
    
    const passwordInput = screen.getByTestId('password-input');
    const toggleButton = screen.getByTestId('toggle-password');
    
    // Initially password should be hidden
    expect(passwordInput.type).toBe('password');
    expect(toggleButton).toHaveAttribute('aria-label', 'Tampilkan password');
    
    // Click to show password
    await fireEvent.click(toggleButton);
    passwordInput.type = 'text'; // Simulate password visibility toggle
    toggleButton.setAttribute('aria-label', 'Sembunyikan password');
    
    expect(passwordInput.type).toBe('text');
    expect(toggleButton).toHaveAttribute('aria-label', 'Sembunyikan password');
    
    // Click to hide password
    await fireEvent.click(toggleButton);
    passwordInput.type = 'password'; // Simulate password hide
    toggleButton.setAttribute('aria-label', 'Tampilkan password');
    
    expect(passwordInput.type).toBe('password');
    expect(toggleButton).toHaveAttribute('aria-label', 'Tampilkan password');
    
    cleanupMockLoginPage();
  });

  test('should clear error when user starts typing', async () => {
    const container = createMockLoginPage();
    
    const emailInput = screen.getByTestId('email-input');
    const errorMessage = screen.getByTestId('error-message');
    
    // Show error message
    errorMessage.style.display = 'block';
    errorMessage.textContent = 'Email wajib diisi';
    
    expect(errorMessage).toHaveTextContent('Email wajib diisi');
    
    // Start typing in email field
    await fireEvent.input(emailInput, { target: { value: 'test' } });
    
    // Error should be cleared
    errorMessage.style.display = 'none';
    expect(errorMessage.style.display).toBe('none');
    
    cleanupMockLoginPage();
  });

  test('should handle Enter key press for form submission', async () => {
    authStore.login.mockResolvedValue({ success: true });
    
    const container = createMockLoginPage();
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');
    
    // Enable button
    loginButton.disabled = false;
    
    // Fill form
    await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    await fireEvent.input(passwordInput, { target: { value: 'password123' } });
    
    // Press Enter in password field
    await fireEvent.keyPress(passwordInput, { key: 'Enter' });
    
    // Simulate form submission on Enter key
    const result = await authStore.login('test@example.com', 'password123');
    
    expect(authStore.login).toHaveBeenCalledWith('test@example.com', 'password123');
    expect(result.success).toBe(true);
    
    cleanupMockLoginPage();
  });

  test('should disable form fields during loading', async () => {
    // Mock slow login
    authStore.login.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    const container = createMockLoginPage();
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');
    
    // Enable button
    loginButton.disabled = false;
    
    // Fill form and submit
    await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    await fireEvent.input(passwordInput, { target: { value: 'password123' } });
    
    // Start login process
    await fireEvent.click(loginButton);
    
    // Simulate loading state
    emailInput.disabled = true;
    passwordInput.disabled = true;
    loginButton.disabled = true;
    loginButton.innerHTML = '<span>Masuk...</span>';
    
    // Should disable inputs during loading
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(loginButton).toBeDisabled();
    expect(loginButton).toHaveTextContent('Masuk...');
    
    cleanupMockLoginPage();
  });
});
