# Chill Mate — Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Zero PII in Public User Documents**: `/users/{userId}` stores only public display metadata (`id`, `displayName`, `photoUrl`, `status`, `watchingTitle`, `activeTeamId`, `createdAt`, `updatedAt`). No `email`, `phone`, or `address` fields are allowed.
2. **Team Membership Gate**: Only members of a `teamId` (verified via `/teamMembers/$(teamId + '_' + request.auth.uid)`) can read or create `libraryItems` and `movieHalls` belonging to that team.
3. **Host-Only Authoritative Hall Controls**: Only the `hostId` of a `/movieHalls/{hallId}` document can update playback state (`isPlaying`, `positionMs`, `durationMs`, `playbackSpeed`, `status`, `shareType`, `videoUrl`, `title`, `hostConnected`, `endedAt`) or accept/decline `/hallJoinRequests/{requestId}`.
4. **Approved Hall Membership Gate**: Only approved Hall members (verified via `/hallMembers/$(hallId + '_' + request.auth.uid)`) or the Hall host can read/create `/hallMessages` and `/hallActivity` for that `hallId`.
5. **Strict Server Timestamps & Immutable Identifiers**: All `createdAt`/`startedAt`/`joinedAt` fields must equal `request.time` on creation and remain immutable on update. All `updatedAt` fields must equal `request.time` on update.

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing on User Profile**: Authenticated user `uid_A` attempts to create `/users/uid_B` with `id: "uid_B"`. -> `PERMISSION_DENIED`
2. **Shadow Field Injection on Team Creation**: Authenticated user sends valid `/teams/team_1` payload plus `"isSuperTeam": true`. -> `PERMISSION_DENIED` (`hasOnly` check fails)
3. **Role Escalation on TeamMember Update**: Regular member updates their own `/teamMembers/team_1_uid_A` `role` from `"MEMBER"` to `"OWNER"`. -> `PERMISSION_DENIED`
4. **Unverified Email Write**: User with `email_verified == false` attempts to create a team or library item. -> `PERMISSION_DENIED`
5. **Cross-Team Library Scraping**: User not in `team_secret` attempts to create a library item in `team_secret`. -> `PERMISSION_DENIED`
6. **Viewer Hijacking Host Playback**: Approved viewer `uid_viewer` attempts to update `/movieHalls/hall_1` with `isPlaying: false, positionMs: 0`. -> `PERMISSION_DENIED` (`existing().hostId == request.auth.uid` fails)
7. **Terminal Hall Resurrection**: Host attempts to update a `/movieHalls/hall_1` document whose `status` is already `"ENDED"`. -> `PERMISSION_DENIED` (Terminal State Lock)
8. **Self-Approving Join Request**: Viewer `uid_viewer` updates `/hallJoinRequests/hall_1_uid_viewer` `status` from `"PENDING"` to `"ACCEPTED"`. -> `PERMISSION_DENIED` (Only `hostId` can transition to `ACCEPTED`/`DECLINED`)
9. **Unapproved Viewer Posting Chat**: User without `/hallMembers/hall_1_uid_intruder` attempts to create a `/hallMessages` document for `hall_1`. -> `PERMISSION_DENIED`
10. **Oversized String DoW Attack**: User sends a `5000`-character string in `HallMessage.text` (limit 500). -> `PERMISSION_DENIED`
11. **Timestamp Forgery**: User sends a past or future timestamp in `createdAt` instead of `request.time`. -> `PERMISSION_DENIED`
12. **ID Poisoning Attack**: User attempts to create a document with path ID containing spaces or special characters (`hall../admin`). -> `PERMISSION_DENIED` (`isValidId` regex guard)

## 3. Red Team Audit & Conflict Report

| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning | Validation Helper in Update |
| :--- | :--- | :--- | :--- | :--- |
| `users` | Blocked (`userId == request.auth.uid && incoming().id == userId`) | Enforced enum `ONLINE/WATCHING/OFFLINE` | Bounded strings & `isValidId` | `isValidUser(incoming())` present |
| `teams` | Blocked (`incoming().ownerId == request.auth.uid`) | Immutable `ownerId`, `createdAt` | Bounded strings & `isValidId` | `isValidTeam(incoming())` present |
| `teamMembers` | Blocked (`memberId == incoming().teamId + '_' + incoming().userId`) | Role changes restricted to Team Owner | Bounded strings & `isValidId` | `isValidTeamMember(incoming())` present |
| `libraryItems` | Blocked (`incoming().addedById == request.auth.uid`) | Immutable `teamId`, `addedById`, `createdAt` | Bounded URLs/titles & `isValidId` | `isValidLibraryItem(incoming())` present |
| `movieHalls` | Blocked (`incoming().hostId == request.auth.uid`) | Terminal lock on `ENDED`; host-only playback | Bounded fields & `isValidId` | `isValidMovieHall(incoming())` present |
| `hallMembers` | Blocked (`memberId == incoming().hallId + '_' + incoming().userId`) | Requires host or accepted join request | Bounded fields & `isValidId` | `isValidHallMember(incoming())` present |
| `hallJoinRequests` | Blocked (`incoming().requesterId == request.auth.uid`) | Terminal lock; host-only accept/decline | Bounded fields & `isValidId` | `isValidHallJoinRequest(incoming())` present |
| `hallMessages` | Blocked (`incoming().senderId == request.auth.uid`) | Immutable (no updates allowed) | `text.size() <= 500` & `isValidId` | Updates disabled (`allow update: if false`) |
| `hallActivity` | Blocked (`incoming().actorId == request.auth.uid`) | Immutable (no updates allowed) | `message.size() <= 240` & `isValidId` | Updates disabled (`allow update: if false`) |
| `notifications` | Blocked (`incoming().senderId == request.auth.uid`) | Recipient-only `read` toggle | Bounded fields & `isValidId` | `isValidNotification(incoming())` present |
