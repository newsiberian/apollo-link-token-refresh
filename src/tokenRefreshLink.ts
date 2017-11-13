import {
  ApolloLink,
  Observable,
  Operation,
  NextLink,
  FetchResult,
} from 'apollo-link';

import { OperationQueuing } from './queuing';

export { OperationQueuing, QueuedRequest } from './queuing';

export type FetchAccessToken = (...args: any[]) => Promise<Response>;
export type HandleFetch = (accessToken: string) => void;
export type IsTokenValidOrUndefined = (...args: any[]) => boolean;

export class TokenRefreshLink extends ApolloLink {
  private accessTokenField: string;
  private fetching: boolean;
  private isTokenValidOrUndefined: IsTokenValidOrUndefined;
  private fetchAccessToken: FetchAccessToken;
  private handleFetch: HandleFetch;
  private queue: OperationQueuing;

  constructor(params: {
    accessTokenField?: string;
    isTokenValidOrUndefined: IsTokenValidOrUndefined;
    fetchAccessToken: FetchAccessToken;
    handleFetch: HandleFetch;
  }) {
    super();

    this.accessTokenField = (params && params.accessTokenField) || 'access_token';
    this.fetching = false;
    this.isTokenValidOrUndefined = params.isTokenValidOrUndefined;
    this.fetchAccessToken = params.fetchAccessToken;
    this.handleFetch = params.handleFetch;

    this.queue = new OperationQueuing();
  }

  public request(
    operation: Operation,
    forward: NextLink,
  ): Observable<FetchResult> {
    if (typeof forward !== 'function') {
      throw new Error('[Token Refresh Link]: Token Refresh Link is non-terminating link and should not be the last in the composed chain');
    }
    // If token does not exists, which could means that this is a not registered
    // user request, or if it is does not expired -- act as always
    if (this.isTokenValidOrUndefined()) {
      return forward(operation);
    }

    if (!this.fetching) {
      this.fetching = true;
      return this.fetchAccessToken()
        .then(res => {
          const json = res.json();
          if (res.ok) {
            return json;
          }
          return json.then(err => Promise.reject(err));
        })
        .then(body => {
          if (!body[this.accessTokenField]) {
            throw new Error('[Token Refresh Link]: Unable to retrieve new access token');
          }
          return body[this.accessTokenField];
        })
        .then(this.handleFetch)
        .then(() => {
          this.fetching = false;
          this.queue.consumeQueue();
        })
        .catch(err => console.error(err));
    }

    return this.queue.enqueueRequest({
      operation,
      forward,
    });
  }
}
