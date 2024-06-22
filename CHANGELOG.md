# Change log

### 0.7.0
[BREAKING CHANGES]: Don't attempt to run queued requests if obtaining a new token fails.

### 0.6.1
- inject sources into `sourcesContent` into source maps

### 0.6.0
- `handleFetch` now also can be async

### 0.5.0
[BREAKING CHANGES]: Prop `IsTokenValidOrUndefined` now async. You have to modify your callback by making it `async`.

```ts
isTokenValidOrUndefined: async () => {/* ... */}
```


### 0.4.0
[BREAKING CHANGES]: Callbacks `HandleFetch`, `HandleError` and prop `IsTokenValidOrUndefined` now receives `operation` as additional argument

### 0.3.4
- added graphql v16 support

### 0.3.3
- `@apollo/client` moved to peer dependencies

### 0.3.1
- Allow generic typing of access token payload

### 0.3.0
[BREAKING CHANGES]: Starting from this release we support Apollo v3 only. If you need Apollo v2 support, please use
0.2.x version.

- Experimental Apollo 3.0 support

### 0.2.7
- Call `consumeQueue` in any way (on Error)

### 0.2.6
- Fixed endless `fetching` after receiving error

### 0.2.4
- updated `graphql` peerDependency

### 0.2.3
- Token could be an object with a payload

### 0.2.2
- Allowed to pass an object as `accessTokenField`, not only as strict string

### 0.2.1
- Added a possibility to use apollo query to refresh token

### 0.2.0
- Added new parameter `handleResponse` that allows user to manually parse response with token and handle errors
