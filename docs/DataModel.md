## Firestore Data Model (proposed)

Collections (top‑level):

1. `users/{userId}`
   - displayName, photoURL, roles: {student:boolean, creator:boolean, admin:boolean}
   - stripeCustomerId, connectAccountId
   - createdAt, updatedAt

2. `courses/{courseId}`
   - title, slug, summary, coverImage, price, isSubscription, featured
   - categories: ["lighting", "composition", "editing", "audio", "business", "gear"]
   - modulesCount, lessonsCount
   - createdBy, createdAt, updatedAt, published

3. `courses/{courseId}/modules/{moduleId}`
   - title, index

4. `courses/{courseId}/modules/{moduleId}/lessons/{lessonId}`
   - title, index, muxAssetId, muxPlaybackId, durationSec, resources: [storagePath], transcriptPath, freePreview:boolean

5. `enrollments/{enrollmentId}`
   - userId, courseId, source: "stripe|admin", purchaseId, active:boolean, createdAt

6. `purchases/{purchaseId}`
   - userId, items:[{type:"course|listing", id, price}], total, currency, status, stripePaymentIntentId

7. `listings/{listingId}` (Marketplace)
   - creatorId, title, slug, price, currency, media, description, files:[{name, storagePath, size}], published

8. `orders/{orderId}` (Marketplace)
   - buyerId, sellerId, listingId, amount, currency, status, stripePaymentIntentId

9. `threads/{threadId}`
   - type: "dm|course|group", members:[userId], courseId?, createdAt, lastMessageAt

10. `threads/{threadId}/messages/{messageId}`
    - senderId, text, attachments:[storagePath], createdAt, readBy:[userId]

11. `reviews/{reviewId}`
    - userId, targetType:"course|listing", targetId, rating, text, createdAt

### Indexes (examples)
- purchases: userId + createdAt desc
- orders: sellerId + createdAt desc; buyerId + createdAt desc
- lessons: courseId + moduleId + index
- threads: members arrayContains userId + lastMessageAt desc

### Storage Layout
- `videos/lessons/{courseId}/{lessonId}/*` (Mux will host playback; Storage may hold originals if desired)
- `thumbnails/courses/{courseId}/*`
- `downloads/listings/{listingId}/{fileName}` (signed URL delivery post‑purchase)
- `messages/{threadId}/{messageId}/attachments/*`

### Firestore Rules (sketch)
```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function uid() { return request.auth.uid; }
    function hasRole(r) { return request.auth.token[r] == true; }

    match /users/{userId} {
      allow read: if isSignedIn() && (userId == uid() || hasRole('admin'));
      allow write: if userId == uid() || hasRole('admin');
    }

    match /enrollments/{id} {
      allow read: if isSignedIn() && (resource.data.userId == uid() || hasRole('admin'));
      allow create, update, delete: if hasRole('admin');
    }

    match /courses/{courseId} {
      allow read: if true; // public catalog
      allow write: if hasRole('admin');

      match /modules/{moduleId} {
        allow read: if true;
        allow write: if hasRole('admin');
        match /lessons/{lessonId} {
          allow read: if resource.data.freePreview == true || 
                       exists(/databases/$(database)/documents/enrollments/$(uid() + '_' + courseId));
          allow write: if hasRole('admin');
        }
      }
    }

    match /listings/{listingId} {
      allow read: if true;
      allow create, update, delete: if isSignedIn() && resource.data.creatorId == uid();
    }

    match /orders/{orderId} {
      allow read: if isSignedIn() && (resource.data.buyerId == uid() || resource.data.sellerId == uid() || hasRole('admin'));
      allow write: if hasRole('admin'); // created by server via webhook
    }

    match /threads/{threadId} {
      allow read, write: if isSignedIn() && (uid() in resource.data.members);
      match /messages/{messageId} {
        allow read, create: if isSignedIn() && (uid() in get(/databases/$(database)/documents/threads/$(threadId)).data.members);
      }
    }
  }
}
```


