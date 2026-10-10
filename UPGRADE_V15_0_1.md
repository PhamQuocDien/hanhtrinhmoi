# Hành Trình Mới V15.0.1

## Fix: AI Learning Director / AI Personal Courses

### Symptom
- `api.aiDirector is not a function`
- `api.aiPersonalCourses is not a function`

### Root cause
The browser could keep an older cached `assets/js/api.js` while loading the newer dashboard HTML. The older cached client did not expose the AI methods added in the newer platform version.

### Changes
- Added cache-busting query `?v=15.0.1` to all HTML references of `assets/js/api.js`.
- Added `Cache-Control: no-store` for `api.js` and `ai-learning-hub.js` on the Express assets route.
- Added a runtime compatibility guard in `ai-learning-hub.js`; when an old API client is detected it reloads the current API client with a fresh cache-busting token.
- Bumped application/package-lock version to `15.0.1`.
- Added the same API cache-busting reference to the admin application.
- Cache-busted the smart-center `learning-intelligence.js` script as well.

## Verification
- `node -c server.js` ✅
- `node -c assets/js/api.js` ✅
- `node -c assets/js/ai-learning-hub.js` ✅
- `node -c assets/js/learning-intelligence.js` ✅
- `npm test` ✅ V13 + V14 + V15
