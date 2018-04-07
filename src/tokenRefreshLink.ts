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
export type HandleResponse = (operation: Operation, accessTokenField: string) => any;
export type HandleError = (err: Error) => void;
export type IsTokenValidOrUndefined = (...args: any[]) => boolean;

// Used for any Error for data from the server
// on a request with a Status >= 300
// response contains no data or errors
type ServerError = Error & {
  response: Response;
  result: Record<string, any>;
  statusCode: number;
};

// Thrown when server's response is cannot be parsed
type ServerParseError = Error & {
  response: Response;
  statusCode: number;
  bodyText: string;
};

const throwServerError = (response, result, message) => {
  const error = new Error(message) as ServerError;

  error.response = response;
  error.statusCode = response.status;
  error.result = result;

  throw error;
};

const parseAndCheckResponse = (operation: Operation, accessTokenField: string) => (response: Response) => {
  return response
    .text()
    .then(bodyText => {
      if (typeof bodyText !== 'string' || !bodyText.length) {
        // return empty body immediately
        return bodyText || '';
      }

      try {
        return JSON.parse(bodyText);
      } catch (err) {
        const parseError = err as ServerParseError;
        parseError.response = response;
        parseError.statusCode = response.status;
        parseError.bodyText = bodyText;
        return Promise.reject(parseError);
      }
    })
    .then(parsedBody => {
      if (response.status >= 300) {
        // Network error
        throwServerError(
          response,
          parsedBody,
          `Response not successful: Received status code ${response.status}`,
        );
      }
      // token can be delivered via apollo query (body.data) or as usual
      if (
        !parsedBody.hasOwnProperty(accessTokenField)
        && (parsedBody.data && !parsedBody.data.hasOwnProperty(accessTokenField))
        && !parsedBody.hasOwnProperty('errors')
      ) {
        // Data error
        throwServerError(
          response,
          parsedBody,
          `Server response was missing for query '${operation.operationName}'.`,
        );
      }

      return parsedBody;
    });
};

export class TokenRefreshLink extends ApolloLink {
  private accessTokenField: string;
  private fetching: boolean;
  private isTokenValidOrUndefined: IsTokenValidOrUndefined;
  private fetchAccessToken: FetchAccessToken;
  private handleFetch: HandleFetch;
  private handleResponse: HandleResponse;
  private handleError: HandleError;
  private queue: OperationQueuing;

  constructor(params: {
    accessTokenField?: string;
    isTokenValidOrUndefined: IsTokenValidOrUndefined;
    fetchAccessToken: FetchAccessToken;
    handleFetch: HandleFetch;
    handleResponse?: HandleResponse;
    handleError?: HandleError;
  }) {
    super();

    this.accessTokenField = (params && params.accessTokenField) || 'access_token';
    this.fetching = false;
    this.isTokenValidOrUndefined = params.isTokenValidOrUndefined;
    this.fetchAccessToken = params.fetchAccessToken;
    this.handleFetch = params.handleFetch;
    this.handleResponse = params.handleResponse || parseAndCheckResponse;
    this.handleError = typeof params.handleError === 'function'
      ? params.handleError
      : err => {
        console.error(err)
      };

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
      this.fetchAccessToken()
        .then(this.handleResponse(operation, this.accessTokenField))
        .then(body => {
          const token = this.extractToken(body);

          if (!token) {
            throw new Error('[Token Refresh Link]: Unable to retrieve new access token');
          }
          return token;
        })
        .then(this.handleFetch)
        .then(() => {
          this.fetching = false;
          this.queue.consumeQueue();
        })
        .catch(this.handleError);
    }

    return this.queue.enqueueRequest({
      operation,
      forward,
    });
  }

  /**
   * An attempt to extract token from body.data. This allows us to use apollo query
   * for auth token refreshing
   * @param body {Object} response body
   * @return {string} access token
   */
  private extractToken = (body: any): string => {
    if (body.data) {
      return body.data[this.accessTokenField];
    }
    return body[this.accessTokenField];
  };
}
