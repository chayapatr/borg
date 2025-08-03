# Firebase Migration Guide

This guide explains how to migrate your Borg project from localStorage to Firebase and switch between service modes.

## Service Architecture

The project now supports two service modes:

- **Local Mode**: Uses localStorage for data persistence (original implementation)
- **Firebase Mode**: Uses Firebase Firestore for data persistence with real-time sync

## Service Structure

```
src/lib/services/
├── interfaces/          # Service interfaces
├── local/              # localStorage implementations
├── firebase/           # Firebase implementations
├── migration/          # Migration utilities
└── ServiceFactory.ts   # Factory to switch between modes
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Service Mode Configuration
VITE_SERVICE_MODE=local  # or 'firebase'

# Firebase Configuration (only needed for firebase mode)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
# ... other Firebase config
```

### Switching Modes

1. **Local Mode** (default):
   ```bash
   VITE_SERVICE_MODE=local
   ```

2. **Firebase Mode**:
   ```bash
   VITE_SERVICE_MODE=firebase
   ```

After changing the mode, restart your development server.

## Migration Process

### Before Migration

1. Ensure you have Firebase project set up
2. Configure Firebase credentials in `.env`
3. Your current data is in localStorage

### Running Migration

1. Start the app in local mode
2. Navigate to the migration panel (admin component)
3. Export your current data (backup)
4. Run the migration to Firebase
5. Switch to Firebase mode in `.env`
6. Restart the app

### What Gets Migrated

- ✅ Projects metadata
- ✅ Canvas nodes and edges
- ✅ Tasks (separate storage)
- ✅ People (project-scoped and global)
- ⏳ Timeline events (planned)

### Authentication

Firebase mode requires user authentication:

- Google Sign-in only
- Manual user approval required
- Admin must approve new users in Firebase console

## Firestore Schema

```
/users/{userId}
  - name, email, isApproved, etc.

/projects/{projectId}
  - title, slug, status, etc.
  
/projects/{projectId}/nodes/{nodeId}
  - position, templateType, nodeData, etc.
  
/projects/{projectId}/edges/{edgeId}
  - source, target, type, etc.

/tasks/{taskId}
  - title, assignee, projectSlug, nodeId, etc.

/people/{personId}
  - name, email, usageCount, etc.

/projects/{projectId}/people/{personId}
  - name, email, addedBy, etc.
```

## Development

### Adding New Services

1. Create interface in `interfaces/`
2. Implement in both `local/` and `firebase/`
3. Add to `ServiceFactory.ts`
4. Update migration if needed

### Testing

- Local mode: Works offline, no auth required
- Firebase mode: Requires internet, auth, and Firebase setup

## Troubleshooting

### Common Issues

1. **Migration fails**: Check Firebase permissions and network
2. **Auth issues**: Verify Firebase config and user approval
3. **Data not syncing**: Check Firestore rules and network

### Rollback

If Firebase mode has issues:

1. Switch back to local mode: `VITE_SERVICE_MODE=local`
2. Restart the app
3. Your original localStorage data should still be available

## Security

### Firestore Rules

The project uses security rules requiring:
- User authentication
- Manual approval by admin
- Approved users can read/write all data

### User Approval Process

1. User signs in with Google
2. User document created with `isApproved: false`
3. Admin manually sets `isApproved: true` in Firebase console
4. User can then access the app

## Performance

### Local Mode
- ✅ Fast, offline-first
- ❌ No real-time sync
- ❌ Single-user only

### Firebase Mode
- ✅ Real-time sync
- ✅ Multi-user collaboration
- ✅ Cloud backup
- ❌ Requires internet
- ❌ Firebase costs for large usage

## Next Steps

1. Implement remaining Firebase services (People, Nodes)
2. Add real-time collaboration features
3. Implement proper error handling
4. Add offline support for Firebase mode
5. Set up Firebase hosting for deployment