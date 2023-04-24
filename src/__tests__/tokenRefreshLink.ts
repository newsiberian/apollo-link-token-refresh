import {
  ApolloLink,
  execute,
  Observable,
  Operation,
  // FetchResult,
  GraphQLRequest
} from '@apollo/client/core';
import gql from 'graphql-tag';
import fetch from 'jest-fetch-mock';

// import { print } from 'graphql/language/printer';

import {
  TokenRefreshLink,
  OperationQueuing,
  QueuedRequest,
} from '../tokenRefreshLink';



// interface MockedResponse {
//   request: Operation;
//   result?: FetchResult;
//   error?: Error;
//   delay?: number;
// }

// const mockedNewTokenResponse = () =>
//   fetch.mockResponse(JSON.stringify({ access_token: '12345' }));

// function requestToKey(request: Operation): string {
//   const queryString =
//     typeof request.query === 'string' ? request.query : print(request.query);

//   return JSON.stringify({
//     variables: request.variables || {},
//     query: queryString,
//   });
// }

function getKey(operation: GraphQLRequest) {
  // XXX We're assuming here that query and variables will be serialized in
  // the same order, which might not always be true.
  const { query, variables, operationName } = operation;
  return JSON.stringify([operationName, query, variables]);
}

export function createOperation(
  starting: any,
  operation: GraphQLRequest,
): Operation {
  let context = { ...starting };
  const setContext = (next: any) => {
    if (typeof next === 'function') {
      context = { ...context, ...next(context) };
    } else {
      context = { ...context, ...next };
    }
  };
  const getContext = () => ({ ...context });

  Object.defineProperty(operation, 'setContext', {
    enumerable: false,
    value: setContext,
  });

  Object.defineProperty(operation, 'getContext', {
    enumerable: false,
    value: getContext,
  });

  Object.defineProperty(operation, 'toKey', {
    enumerable: false,
    value: () => getKey(operation),
  });

  return operation as Operation;
}


const query = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

const mockLink = new ApolloLink(() => {
  return new Observable(() => {
    throw new Error('This is a mocked link');
  });
});

const mockedFetching = jest.fn(() => () => {
  return fetch('http://localhost')
})

describe('TokenRefreshLink', () => {
  it('should construct when required arguments are passed to constructor', () => {
    expect(
      () => new TokenRefreshLink({
        isTokenValidOrUndefined: async () => true,
        fetchAccessToken: () => new Promise(() => { }),
        handleFetch: () => void 0
      }),
    ).not.toThrow();
  });

  it('should construct when using generic type for access token payload', () => {
    expect(
      () => new TokenRefreshLink<{ accessToken: string }>({
        isTokenValidOrUndefined: async () => true,
        fetchAccessToken: () => new Promise(() => { }),
        handleFetch: () => void 0
      }),
    ).not.toThrow();
  });

  it('should throw an exception if link is the last in composed chain', () => {
    const link = ApolloLink.from([
      new TokenRefreshLink({
        isTokenValidOrUndefined: async () => false,
        fetchAccessToken: () => fetch('http://localhost'),
        handleFetch: () => void 0
      })
    ]);

    expect(() => execute(link, { query })).toThrow();
  });

  it('passes forward on', () => {
    const link = ApolloLink.from([
      new TokenRefreshLink({
        // token is valid, so we are passing forward immediately
        isTokenValidOrUndefined: async () => true,
        fetchAccessToken: () => fetch('http://localhost'),
        handleFetch: () => void 0
      }),
      mockLink
    ]);
    execute(link, { query });
  });

  it('should throw an exception if it was thrown inside the promise', () => {
    fetch.mockResponse(JSON.stringify({ bad_token: '12345' }));
    const link = ApolloLink.from([
      new TokenRefreshLink({
        isTokenValidOrUndefined: async () => false,
        fetchAccessToken: () => fetch('http://localhost'),
        handleFetch: () => void 0
      })
    ]);
    expect(() => execute(link, { query })).toThrow()
  });

  it('should properly execute async code in token validation and subsequent code in request method', () => {
    fetch.mockResponse(JSON.stringify({access_token: 'c1b2d3'}), {url: 'http://localhost'})
    fetch.mockResponse(JSON.stringify({access_token: '12345', expired: true}), {url: 'http://token_from_storage'})
    const fetchAccessToken = new mockedFetching
    const refreshLink = new TokenRefreshLink({
        isTokenValidOrUndefined: async () => {
          const expToken = await fetch('http://token_from_storage').then(res => {
            return res.json()
          })

          if (expToken.expired === true) {
            return false
          } else {
            return true
          }
        },
        fetchAccessToken,
        handleFetch: () => void 0
    })
    const link = ApolloLink.from([
      refreshLink,
      mockLink
    ]);
    expect(() => execute(link, {query})).not.toThrow()
    expect(mockedFetching.mock.calls.length).toBe(1)
  })
});

  // it('should allow fetch to REST endpoint and to apollo-server endpoint', () => {
  //
  // });


describe('OperationQueuing', () => {
  it('should construct', () => {
    expect(() => new OperationQueuing()).not.toThrow();
  })

  it('should be able to add to the queue', () => {
    const queue = new OperationQueuing();
    const request: QueuedRequest = {
      operation: createOperation({}, { query }),
    };

    expect(queue.queuedRequests.length).toBe(0);
    queue.enqueueRequest(request).subscribe({});
    expect(queue.queuedRequests.length).toBe(1);
    queue.enqueueRequest(request).subscribe({});
    expect(queue.queuedRequests.length).toBe(2);
  });
});

// describe('request queue', () => {
//   const query = gql`
//       query {
//         author {
//           firstName
//           lastName
//         }
//       }
//     `;
//   const data = {
//     author: {
//       firstName: 'John',
//       lastName: 'Smith'
//     },
//   };
//   const operation: Operation = {
//     query
//   };
// });