# Frontend Integration Guide - Firm Onboarding

## Quick Start

When a FIRMADMIN user is created, direct them to the onboarding flow using these API endpoints:

## Step-by-Step Integration

### Step 0: Removed
(Note: creating a user beforehand is no longer necessary as the user is created in Step 3 simultaneously with the firm)

### Step 1: Initialize Onboarding Session (LawFirmOnboardingStep1.html)
```javascript
// Start the onboarding session when entering onboarding
const startOnboarding = async () => {
  const response = await fetch(`http://localhost:3000/users/firm-onboarding/start`, {
    method: 'POST',
    headers: {
      'role': 'firmadmin'
    }
  });
  const data = await response.json();
  
  // Save sessionId for next steps
  localStorage.setItem('onboardingSessionId', data.sessionId);
  
  return data.sessionId;
};

// Call this when user lands on LawFirmOnboardingStep1.html
window.addEventListener('load', async () => {
  let sessionId = localStorage.getItem('onboardingSessionId');
  if (!sessionId) {
    await startOnboarding();
  }
});
```

### Step 2: Submit Step 1 Form (LawFirmOnboardingStep1.html)
```javascript
const submitStep1 = async (formData) => {
  const sessionId = localStorage.getItem('onboardingSessionId');
  
  const response = await fetch(`http://localhost:3000/users/firm-onboarding/step1/${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'role': 'firmadmin'
    },
    body: JSON.stringify({
      fullName: formData.querySelector('#full-name').value,
      email: formData.querySelector('#email').value,
      phone: formData.querySelector('#phone').value,
      street: formData.querySelector('#street').value,
      city: formData.querySelector('#city').value,
      state: formData.querySelector('#state').value,
      pinCode: formData.querySelector('#zip').value,
      logo: formData.querySelector('#logo-upload').value // or handle file upload
    })
  });
  
  const result = await response.json();
  if (response.ok) {
    // Redirect to Step 2
    window.location.href = 'Lawfirmonboardingstep2.html';
  } else {
    alert('Error: ' + result.message);
  }
};

// Update form submission
document.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await submitStep1(e.target);
});
```

### Step 3: Submit Step 2 Form (Lawfirmonboardingstep2.html)
```javascript
const submitStep2 = async (formData) => {
  const sessionId = localStorage.getItem('onboardingSessionId');
  
  const response = await fetch(`http://localhost:3000/users/firm-onboarding/step2/${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'role': 'firmadmin'
    },
    body: JSON.stringify({
      primaryEmail: formData.querySelector('#primary-email').value,
      phone: formData.querySelector('#phone').value,
      website: formData.querySelector('#website').value
    })
  });
  
  const result = await response.json();
  if (response.ok) {
    // Redirect to Step 3
    window.location.href = 'lawfirmonboardingstep3.html';
  } else {
    alert('Error: ' + result.message);
  }
};

// Update form submission
document.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await submitStep2(e.target);
});
```

### Step 4: Submit Step 3 Form (lawfirmonboardingstep3.html)
```javascript
const submitStep3 = async (formData) => {
  const sessionId = localStorage.getItem('onboardingSessionId');
  
  // Validate password match
  const password = formData.querySelector('#password').value;
  const confirmPassword = formData.querySelector('#confirm-password').value;
  
  if (password !== confirmPassword) {
    alert('Passwords do not match!');
    return;
  }
  
  const response = await fetch(`http://localhost:3000/users/firm-onboarding/step3/${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'role': 'firmadmin'
    },
    body: JSON.stringify({
      adminName: formData.querySelector('#admin-name').value,
      adminEmail: formData.querySelector('#admin-email').value,
      password: password,
      confirmPassword: confirmPassword
    })
  });
  
  const result = await response.json();
  if (response.ok) {
    // Save firm info
    localStorage.setItem('firmId', result.firmId);
    localStorage.setItem('adminUserId', result.adminUserId);
    localStorage.setItem('firmName', result.name);
    
    // Redirect to dashboard with success message
    window.location.href = `firm-consultation-dashboard.html?firmCreated=true&firmId=${result.firmId}`;
  } else {
    alert('Error: ' + result.message);
  }
};

// Update form submission
document.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await submitStep3(e.target);
});
```

### Step 5: Display Success Message (firm-consultation-dashboard.html)
```javascript
// On dashboard load, show success message if onboarding just completed
window.addEventListener('load', () => {
  const params = new URLSearchParams(window.location.search);
  
  if (params.get('firmCreated') === 'true') {
    const firmName = localStorage.getItem('firmName');
    const firmId = localStorage.getItem('firmId');
    
    const message = `
      <div style="background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <h3 style="color: #065f46; margin: 0 0 8px 0;">✓ Firm Setup Complete!</h3>
        <p style="color: #047857; margin: 0;">Welcome to ${firmName}. You can now manage your law firm.</p>
      </div>
    `;
    
    document.body.insertAdjacentHTML('afterbegin', message);
    
    // Clean up URL
    window.history.replaceState({}, document.title, 'firm-consultation-dashboard.html');
  }
});
```

## Complete File: `lawfirm-onboarding.js`

```javascript
// lawfirm-onboarding.js - Complete implementation

const API_BASE = 'http://localhost:3000';

// Initialize onboarding session
export async function startOnboarding() {
  try {
    const response = await fetch(`${API_BASE}/users/firm-onboarding/start`, {
      method: 'POST',
      headers: { 'role': 'firmadmin' }
    });
    
    if (!response.ok) throw new Error('Failed to start onboarding');
    
    const data = await response.json();
    localStorage.setItem('onboardingSessionId', data.sessionId);
    
    return data.sessionId;
  } catch (error) {
    console.error('Onboarding start error:', error);
    throw error;
  }
}

// Submit Step 1
export async function submitStep1(formData) {
  const sessionId = localStorage.getItem('onboardingSessionId');
  
  try {
    const response = await fetch(`${API_BASE}/users/firm-onboarding/step1/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'role': 'firmadmin'
      },
      body: JSON.stringify({
        fullName: formData.get('fullName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        street: formData.get('street'),
        city: formData.get('city'),
        state: formData.get('state'),
        pinCode: formData.get('pinCode')
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Step 1 submission error:', error);
    throw error;
  }
}

// Submit Step 2
export async function submitStep2(formData) {
  const sessionId = localStorage.getItem('onboardingSessionId');
  
  try {
    const response = await fetch(`${API_BASE}/users/firm-onboarding/step2/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'role': 'firmadmin'
      },
      body: JSON.stringify({
        primaryEmail: formData.get('primaryEmail'),
        phone: formData.get('phone'),
        website: formData.get('website') || undefined
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Step 2 submission error:', error);
    throw error;
  }
}

// Submit Step 3 (Final)
export async function submitStep3(formData) {
  const sessionId = localStorage.getItem('onboardingSessionId');
  
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');
  
  if (password !== confirmPassword) {
    throw new Error('Passwords do not match');
  }
  
  try {
    const response = await fetch(`${API_BASE}/users/firm-onboarding/step3/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'role': 'firmadmin'
      },
      body: JSON.stringify({
        adminName: formData.get('adminName'),
        adminEmail: formData.get('adminEmail'),
        password: password,
        confirmPassword: confirmPassword
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    const result = await response.json();
    
    // Save firm info
    localStorage.setItem('firmId', result.firmId);
    localStorage.setItem('adminUserId', result.adminUserId);
    localStorage.setItem('firmName', result.name);
    
    return result;
  } catch (error) {
    console.error('Step 3 submission error:', error);
    throw error;
  }
}
```

## API Endpoints Summary

| Step | Endpoint | Method | Body |
|------|----------|--------|------|
| Start | `/users/firm-onboarding/start` | POST | - |
| 1 | `/users/firm-onboarding/step1/:sessionId` | POST | FirmOnboardingStep1Dto |
| 2 | `/users/firm-onboarding/step2/:sessionId` | POST | FirmOnboardingStep2Dto |
| 3 | `/users/firm-onboarding/step3/:sessionId` | POST | FirmOnboardingStep3Dto |

## Response Examples

### Start Onboarding Success
```json
{
  "sessionId": "session-1619827245123"
}
```

### Step 3 Success
```json
{
  "firmId": "firm-1",
  "name": "Sharma & Associates",
  "primaryEmail": "contact@firm.com",
  "adminUserId": "user-5",
  "adminEmail": "rahul.verma@lawfirm.in",
  "message": "Firm and admin account created successfully",
  "createdAt": "2026-04-30T10:30:00Z"
}
```

## Error Handling

All endpoints return proper error responses:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

Common errors:
- 404: User not found / Session not found
- 400: Invalid input / Incomplete previous steps / Duplicate email
- 409: Email already registered

## Testing Checklist

- [ ] FIRMADMIN user creation works
- [ ] Onboarding session starts correctly
- [ ] Step 1 form submission works
- [ ] Step 2 form submission works (requires Step 1)
- [ ] Step 3 form submission works (requires Steps 1 & 2)
- [ ] Password confirmation validation works
- [ ] Duplicate email prevention works
- [ ] Success redirect to dashboard works
- [ ] Firm data is saved in localStorage
