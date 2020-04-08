import {
  ApolloLink,
  execute,
  Observable,
  Operation,
  FetchResult,
} from '@apollo/client';
import gql from 'graphql-tag';
import { print } from 'graphql/language/printer';
import { mockResponse, mockRejectOnce } from 'jest-fetch-mock';

import {
  TokenRefreshLink,
  OperationQueuing,
  QueuedRequest,
} from '../tokenRefreshLink';

const fetch = require('jest-fetch-mock');

interface MockedResponse {
  request: Operation;
  result?: FetchResult;
  error?: Error;
  delay?: number;
}

const mockedNewTokenResponse = () =>
  fetch.mockResponse(JSON.stringify({ access_token: '12345' }));

function requestToKey(request: Operation): string {
  const queryString =
    typeof request.query === 'string' ? request.query : print(request.query);

  return JSON.stringify({
    variables: request.variables || {},
    query: queryString,
  });
}

const sampleQuery = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

const mockLink = new ApolloLink(() => {
  return new Observable(() => {
    throw new Error('This is mocked link');
  });
});

describe('TokenRefreshLink', () => {
  it('need constructor arguments', () => {
    expect(
      () => new TokenRefreshLink(),
    ).toThrow();
  });

  it('should construct with required arguments', () => {
    expect(
      () => new TokenRefreshLink({
        isTokenValidOrUndefined: () => true,
        fetchAccessToken: () => new Promise(),
        handleFetch: () => void 0
      }),
    ).not.toThrow();
  });

  it('should throw an exception if link is the last in composed chain', () => {
    const link = ApolloLink.from([
      new TokenRefreshLink({
        isTokenValidOrUndefined: () => false,
        fetchAccessToken: () => fetch('http://localhost'),
        handleFetch: () => void 0
      })
    ]);

    expect(
      execute(link, {
        query: sampleQuery
      }),
      done()
    ).toThrow();
  });

  it('passes forward on', () => {
    const link = ApolloLink.from([
      new TokenRefreshLink({
        // token is valid, so we are passing forward immediately
        isTokenValidOrUndefined: () => true,
        fetchAccessToken: () => fetch('http://localhost'),
        handleFetch: () => void 0
      }),
      mockLink
    ]);
    execute(link, {
      query: sampleQuery
    });
  });

  it('should throw an exception if it was thrown inside the promise', () => {
    fetch.mockResponse(JSON.stringify({ bad_token: '12345' }));
    const link = ApolloLink.from([
      new TokenRefreshLink({
        isTokenValidOrUndefined: () => false,
        fetchAccessToken: () => fetch('http://localhost'),
        handleFetch: () => void 0
      }),
    ]);
    expect(
      execute(link, {
        query: sampleQuery
      })
    ).toThrow();
  });

  // it('should allow fetch to REST endpoint and to apollo-server endpoint', () => {
  //
  // });
});

describe('OperationQueuing', () => {
  it('should be able to add to the queue', () => {
    const queue = new OperationQueuing();
    const request: QueuedRequest = {
      operation: { sampleQuery },
    };

    expect(queue.queuedRequests.length).toBe(0);
    queue.enqueueRequest(request).subscribe({});
    expect(queue.queuedRequests.length).toBe(1);
    queue.enqueueRequest(request).subscribe({});
    expect(queue.queuedRequests.length).toBe(2);
  });
});

describe('request queue', () => {
  const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
  const data = {
    author: {
      firstName: 'John',
      lastName: 'Smith'
    },
  };
  const operation: Operation = {
    query
  };
});
