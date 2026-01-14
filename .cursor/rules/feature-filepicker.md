# Feature: Google Drive File Picker

## Problem Statement

When dealing with google drive integration, Users currently can only select the file by manually entering the fileID for the input schema fields. When working with Google Docs, Sheets, or other Google Drive files, they need a native way to browse and select files directly from their Google Drive without manually copying/pasting file IDs or downloading files locally first.

## User Stories

1. **As a user**, I want to click a "Pick from Google Drive" button on file input fields so I can browse my Drive and select files without leaving the app.
2. **As a user**, I want to see a familiar Google Picker popup (native Google UI) so the experience feels secure and trustworthy.
3. **As a user**, I want the selected file's ID and metadata to be automatically populated into the input field so I can use it in my workflow.

## Requirements

### Must Have

- [x] Add a "Google Drive" icon button on input fields that have `canBeGoogleDrive: true` in their schema
- [x] Integrate Google Picker API to show native file selection popup
- [x] Support picking: Google Docs, Google Sheets, Google Slides, PDFs, images, and other Drive files
- [x] Return file ID to the input field (just the ID string)
- [x] Use the credential from the flow's Google Drive bubble (not just any credential)
- [x] Handle OAuth token refresh if token is expired when opening picker

### Nice to Have

- [ ] Allow filtering by file type based on the input field's accepted types
- [ ] Show recently accessed files in picker
- [ ] Support folder navigation
- [ ] Support multi-file selection for array input fields

### Out of Scope

- Uploading files TO Google Drive from this picker (existing upload flow handles this)
- Editing Google Drive files in-app
- Google Drive folder picker (files only for now)

## Technical Details

### Relevant Files to Modify

1. **`apps/bubble-studio/src/components/flow_visualizer/FlowVisualizer.tsx`**
   - Extract Google Drive credential ID from `savedCredentials`
   - Pass `googleDriveCredentialId` to InputSchemaNode data

2. **`apps/bubble-studio/src/components/flow_visualizer/nodes/InputSchemaNode.tsx`**
   - Accept `googleDriveCredentialId` in node data
   - Pass it to InputFieldsRenderer

3. **`apps/bubble-studio/src/components/InputFieldsRenderer.tsx`**
   - Accept `googleDriveCredentialId` prop
   - Show Google Drive icon when `googleDriveCredentialId` is set AND field has `canBeGoogleDrive: true`
   - Handle picker result and update input value

4. **`apps/bubble-studio/src/hooks/useGooglePicker.ts`** (new file)
   - Custom hook to manage Google Picker initialization
   - Handle OAuth token retrieval
   - Manage picker lifecycle

5. **`apps/bubblelab-api/src/routes/oauth.ts`**
   - Endpoint to get access token for picker (already added)

### Existing Assets to Reuse

- **`apps/bubble-studio/src/lib/integrations.ts`** - Import `SERVICE_LOGOS['Google Drive']` for the icon
- **`apps/bubble-studio/public/integrations/google-drive.svg`** - The actual icon asset

### How Credential ID is Obtained

The credential ID comes from `savedCredentials` in FlowVisualizer.tsx:

```typescript
// savedCredentials structure:
// { "bubbleName": { "GOOGLE_DRIVE_CRED": 123 } }

// Find Google Drive credential from any bubble in the flow
const googleDriveCredentialId = Object.values(savedCredentials)
  .map((creds) => creds['GOOGLE_DRIVE_CRED'])
  .find((id) => id !== undefined);
```

This is then passed through:

1. FlowVisualizer → InputSchemaNode (via node data)
2. InputSchemaNode → InputFieldsRenderer (via prop)

### Schema Changes

Add a new property to indicate Google Drive picker support:

```typescript
interface SchemaField {
  name: string;
  type?: string;
  // ... existing properties
  canBeFile?: boolean;
  canBeGoogleDrive?: boolean; // NEW: enables Google Drive picker
  googleDriveFileTypes?: string[]; // NEW: filter by MIME types
}
```

### Google Picker API Integration

The Google Picker API requires:

1. **API Key** - For Google Picker API (public, client-side)
2. **OAuth Token** - User's access token from existing `GOOGLE_DRIVE_CRED`
3. **App ID** - Google Cloud project number

```typescript
// Picker configuration
const picker = new google.picker.PickerBuilder()
  .addView(google.picker.ViewId.DOCS)
  .addView(google.picker.ViewId.SPREADSHEETS)
  .setOAuthToken(accessToken)
  .setDeveloperKey(apiKey)
  .setAppId(appId)
  .setCallback(pickerCallback)
  .build();
```

### Data Flow

```
Flow contains Google Drive bubble with credential selected
        ↓
Input schema field has canBeGoogleDrive: true
        ↓
InputSchemaNode passes the flow's Google Drive credential ID to InputFieldsRenderer
        ↓
User sees Google Drive icon on the input field
        ↓
User clicks "Google Drive" icon
        ↓
Fetch valid OAuth access token from backend using credential ID
        ↓
Initialize Google Picker with token
        ↓
User selects file in native Google UI
        ↓
Picker returns: { id, name, mimeType, url, ... }
        ↓
Store file ID in input field (just the string)
```

### Key Architecture Decision

The Google Drive credential ID must come from the **flow's configuration** (the credential selected in the Google Drive bubble), NOT from a generic lookup of the user's credentials. This ensures:

1. The picker uses the same credential the workflow will use at runtime
2. Users with multiple Google Drive credentials get the right one
3. The icon only appears when the flow actually has Google Drive integration

### Input Value Format

When a Google Drive file is selected, the input value should be structured to work with the existing `google-drive` bubble:

```typescript
// Option A: Just the file ID (simple, works with download_file operation)
"1ABC123xyz..."

// Option B: Structured metadata (for richer use cases)
{
  "source": "google_drive",
  "fileId": "1ABC123xyz...",
  "fileName": "My Document.docx",
  "mimeType": "application/vnd.google-apps.document",
  "url": "https://docs.google.com/document/d/1ABC123xyz..."
}
```

### API Endpoints Needed

```typescript
// Get access token for Google Picker (may already exist)
GET /api/oauth/google/token
Response: { accessToken: string, expiresAt: string }

// Or extend existing credential endpoint
GET /api/credentials/:id/token
Response: { accessToken: string }
```

### Environment Variables Needed

```bash
# For Google Picker API (client-side)
VITE_GOOGLE_PICKER_API_KEY=AIza...
VITE_GOOGLE_APP_ID=123456789
```

### Dependencies

```json
{
  "@types/google.picker": "^0.0.42" // TypeScript types for Google Picker
}
```

Load Google Picker API script dynamically:

```typescript
const loadGooglePickerApi = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      gapi.load('picker', resolve);
    };
    document.body.appendChild(script);
  });
};
```

## UI/UX

### Google Drive Icon

Reuse the existing Google Drive icon from the integrations dashboard:

- **Asset path**: `/integrations/google-drive.svg`
- **Import**: `SERVICE_LOGOS['Google Drive']` from `apps/bubble-studio/src/lib/integrations.ts`

### File Input Field (Updated)

The Google Drive icon appears as a clickable button next to the text input:

```
┌─────────────────────────────────────────────────────────┐
│ file_id *                                               │
│ ┌─────────────────────────────────────────┐ ┌────────┐ │
│ │ Enter file ID or select from Drive...   │ │ [icon] │ │
│ └─────────────────────────────────────────┘ └────────┘ │
│                                      Google Drive icon ↗ │
└─────────────────────────────────────────────────────────┘
```

- Icon button is subtle but recognizable (Google Drive colors)
- Hover state: slight highlight/scale effect
- Tooltip on hover: "Select from Google Drive"

### After Selection

```
┌─────────────────────────────────────────────────────────┐
│ file_id *                                               │
│ ┌─────────────────────────────────────────┐ ┌────────┐ │
│ │ 📄 My Report.docx              [✕]      │ │ [icon] │ │
│ └─────────────────────────────────────────┘ └────────┘ │
│ Selected from Google Drive                              │
└─────────────────────────────────────────────────────────┘
```

- Show file name with a document icon
- "✕" button to clear selection
- Subtitle indicates source is Google Drive
- Google Drive icon remains clickable to change selection

### Google Picker Popup (Native Google UI)

This is Google's native picker - we don't style it, but configure which views to show:

- Recent files
- My Drive
- Shared with me
- Starred

## User Flow

1. User creates a flow with a Google Drive bubble and selects a credential for it
2. The input schema for the flow has a field with `canBeGoogleDrive: true` (e.g., `fileId`)
3. User sees the fileId input with Google Drive icon button on the right
4. User clicks the Google Drive icon
5. Google Picker popup opens (using the flow's Google Drive credential)
6. User browses and selects file in native Google UI
7. Picker closes, file ID populates the input field
8. User can see file name displayed and clear selection with ✕ button
9. User can click icon again to change selection
10. When workflow runs, file ID is used with `google-drive` bubble operations

## Resolved Questions

1. **Token endpoint**: Created `GET /oauth/google/picker-token?credentialId=X` endpoint

2. **Input value format**: Just the file ID (string) - works directly with google-drive bubble

3. **When to show icon**: Only when input field has `canBeGoogleDrive: true` in schema

4. **Which credential to use**: The credential from the flow's Google Drive bubble (via savedCredentials)

## Open Questions

1. **Multi-select**: For array fields, should the picker allow selecting multiple files at once?

2. **Fallback behavior**: If Google Picker fails to load, should we show a manual file ID input? (Currently: just shows error)

3. **File type filtering**: How granular should MIME type filtering be?

## References

- [Google Picker API Documentation](https://developers.google.com/picker/docs)
- [Existing InputFieldsRenderer.tsx](apps/bubble-studio/src/components/InputFieldsRenderer.tsx)
- [Google Drive Bubble](packages/bubble-core/src/bubbles/service-bubble/google-drive.ts)
- [OAuth Service](apps/bubblelab-api/src/services/oauth-service.ts)
- [Credential Schema](packages/bubble-shared-schemas/src/credential-schema.ts)
