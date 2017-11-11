import {
  ApolloLink,
  execute,
  Observable,
  Operation,
  FetchResult,
} from 'apollo-link';
import gql from 'graphql-tag';
import { print } from 'graphql/language/printer';
import { mockResponse } from 'jest-fetch-mock';

import {
  TokenRefreshLink,
  OperationQueuing,
  QueuedRequest,
} from '../tokenRefreshLink';

interface MockedResponse {
  request: Operation;
  result?: FetchResult;
  error?: Error;
  delay?: number;
}

// const MockedNewTokenResponse = () =>

function requestToKey(request: Operation): string {
  const queryString =
    typeof request.query === 'string' ? request.query : print(request.query);

  return JSON.stringify({
    variables: request.variables || {},
    query: queryString,
  });
}

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

  it('passes forward on', () => {
    /*fetch.*/mockResponse(JSON.stringify({access_token: '12345' }));
    const link = ApolloLink.from([
      new TokenRefreshLink({
        isTokenValidOrUndefined: () => false,
        fetchAccessToken: () => fetch('localhost'),
        handleFetch: () => void 0
      }),
    ]);
    execute(link, {
      query: gql`
        {
          id
        }
      `,
    });


  });
});

describe('OperationQueuing', () => {
  it('should be able to add to the queue', () => {
    const queue = new OperationQueuing();
    const query = gql`
      query {
        id
      }
    `;
    const request: QueuedRequest = {
      operation: { query },
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
      lastName: 'Smith',
    },
  };
  const operation: Operation = {
    query,
  };

  it('should be able to consume from a queue containing a single query', done => {
    const queue = new OperationQueuing();

    queue.enqueueRequest({ operation }).subscribe(resultObj => {
      expect(queue.queuedRequests.length).toBe(0);
      expect(resultObj).toEqual({ data });
      done();
    });
    const observables: (
      | Observable<FetchResult>
      | undefined)[] = queue.consumeQueue()!;

    expect(observables.length).toBe(1);
  });
});
