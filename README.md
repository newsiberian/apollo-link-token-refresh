# Token Refresh Link [![npm version](https://badge.fury.io/js/apollo-link-token-refresh.svg)](https://badge.fury.io/js/apollo-link-token-refresh)

## Purpose

An Apollo Link that performs renew expired JWT (access tokens)

## Installation

`npm install apollo-link-token-refresh --save`

## Usage

Token Refresh Link is `non-terminating` link, which means that this link shouldn't be the last link in the composed chain.

## Warning

If you need the Apollo v2 support, please use [release 0.2.x](https://github.com/newsiberian/apollo-link-token-refresh/tree/v0.2)

```tsx
import { TokenRefreshLink } from "apollo-link-token-refresh";

const link = new TokenRefreshLink({
    accessTokenField: 'accessToken',
    isTokenValidOrUndefined: (operation: Operation) => Promise<boolean>,
    fetchAccessToken: () => Promise<Response>,
    handleFetch: (accessToken: string, operation: Operation) => void,
    handleResponse? : (operation: Operation, accessTokenField) => response => any,
    handleError? : (err: Error, operation: Operation) => void,
});
```

## Options

The Token Refresh Link takes an object with four options on it to customize the behavior of the link.

|name| value                                                          |explanation|
|---|----------------------------------------------------------------|---|
|accessTokenField?| `string`                                                       |**Default:** `access_token`. This is a name of access token field in response. In some scenarios we want to pass additional payload with access token, i.e. new refresh token, so this field could be the object's name|
|isTokenValidOrUndefined| `(operation: Operation, ...args: any[]) => Promise<boolean>`   |Indicates the current state of access token expiration. If the token is not yet expired or the user does not require a token (guest), then `true` should be returned|
|fetchAccessToken| `(...args: any[]) => Promise<Response>`                        |Function covers fetch call with request fresh access token|
|handleFetch| `(accessToken: string, operation: Operation) => Promise<void>` |Callback which receives a fresh token from Response. From here we can save token to the storage|
|handleResponse?| `(operation, accessTokenField) => response => any`             |This is optional. It could be used to override internal function to manually parse and extract your token from server response|
|handleError?| `(err: Error, operation: Operation) => void`                   |Token fetch error callback. Allows to run additional actions like logout. Don't forget to handle Error if you are using this option|

## Example

```js
import { TokenRefreshLink } from 'apollo-link-token-refresh';

link: ApolloLink.from([
  new TokenRefreshLink({
    isTokenValidOrUndefined: async () => !isTokenExpired() || typeof getAccessToken() !== 'string',
    fetchAccessToken: () => {
      return fetch(getEndpoint('getAccessTokenPath'), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
          'refresh-token': getRefreshToken()
        }
      });
    },
    handleFetch: accessToken => {
      const accessTokenDecrypted = jwtDecode(accessToken);
      setAccessToken(accessToken);
      setExpiresIn(parseExp(accessTokenDecrypted.exp).toString());
    },
    handleResponse: (operation, accessTokenField) => response => {
      // here you can parse response, handle errors, prepare returned token to
      // further operations

      // returned object should be like this:
      // {
      //    access_token: 'token string here'
      // }
    },
    handleError: err => {
       // full control over handling token fetch Error
       console.warn('Your refresh token is invalid. Try to relogin');
       console.error(err);
       
       // When the browser is offline and an error occurs we don’t want the user to be logged out of course.
       // We also don’t want to delete a JWT token from the `localStorage` in this case of course.
       if (
         !navigator.onLine ||
         (err instanceof TypeError &&
           err.message === "Network request failed")
       ) {
         console.log("Offline -> do nothing 🍵")
       } else {
         console.log("Online -> log out 👋")

         // your custom action here
         user.logout();
      }       
    }
  }),
  errorLink,
  requestLink,
  ...
])
```

## Custom access token payload

In a scenario where you're using Typescript and your the return of your refresh token is a custom object rather then a single string you can construct the link using a generic type, i.e. :

```ts
  new TokenRefreshLink<{token, refreshToken}>({
    // rest omitted for brevity
    handleFetch: newTokens => {
      const {token, refreshToken} = newTokens;
      const accessTokenDecrypted = jwtDecode(token);
      setAccessToken(token);
      setRefreshToken(refreshToken);
      setExpiresIn(parseExp(accessTokenDecrypted.exp).toString());
    },
  })
```

## Storing access token in Redux

If access token is stored in Redux state, `operation` object allows to reach the state and dispatch needed actions, i.e. :

```ts
    new TokenRefreshLink({
        // rest omitted for brevity
        isTokenValidOrUndefined: async (operation) => {
            const { getState } = operation.getContext();
            const accessToken = accessTokenSelector(getState());
            // validate access token and return true/false
        },
        handleFetch: (accessToken, operation) => {
            const { dispatch } = operation.getContext();
            dispatch(setAccessToken(accessToken));
        },
        ...
    });
```

## Context

The Token Refresh Link does not use the context for anything.
