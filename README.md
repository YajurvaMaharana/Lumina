# AI Journal

A private, secure journaling application powered by the Gemini AI and Google Firebase. Reflect on your thoughts, brainstorm ideas, and gain insights with AI, all while keeping your data isolated and secure.

## Features
- **User Authentication**: Secure login via Firebase Authentication (Google Sign-In).
- **Private Dashboard**: Your journal entries are stored securely in Firestore and accessible only to you.
- **AI Companion**: Chat with Gemini to brainstorm, reflect, or summarize your thoughts.
- **Secure Backend**: Full-stack application proxying Gemini API requests server-side to hide API keys from the browser.

## Security Architecture
This application implements strict security controls to protect user data:
1. **Firestore Security Rules**: The Firestore database uses strict owner-bound path checking (`request.auth.uid == userId`) to isolate user data. No other users can read or write your journals.
2. **Backend Authentication Verification**: The Express server verifies Firebase Identity Tokens (`verifyIdToken`) on all requests to ensure they are from authenticated users.
3. **Secret Manager Integration**: The Gemini API Key is kept entirely out of the browser, stored securely in the Cloud Run runtime environment.

## Deployment & Configuration Guide (Google Cloud Run)

### 1. Prerequisites
Ensure you have the Google Cloud SDK (`gcloud`) installed and configured.

```bash
# Set your project ID
gcloud config set project YOUR_PROJECT_ID

# Enable required services
gcloud services enable run.googleapis.com secretmanager.googleapis.com firestore.googleapis.com
```

### 2. Secret Management Setup
Create a Secret Manager secret for your Gemini API key and grant the default compute service account access to read it.

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant the default Cloud Run service account access to read the secret
# Replace YOUR_PROJECT_NUMBER with your actual project number
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Database Security Configuration
Provision your Firestore database (if not already done) and deploy the secure, owner-bound security rules (`firestore.rules`):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/journals/{journalId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

```bash
# Deploy Firebase rules
firebase deploy --only firestore:rules
```

### 4. Cloud Run Deployment Flow
Deploy the full-stack container to Google Cloud Run, injecting the `GEMINI_API_KEY` secret.

```bash
gcloud run deploy ai-journal \
  --source . \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --allow-unauthenticated \
  --region=us-central1
```

### 5. Required Campaign Labeling (Cloud Run AI Challenge)
Apply the mandatory resource label to register the service for automated challenge verification:

```bash
gcloud run services update ai-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```
