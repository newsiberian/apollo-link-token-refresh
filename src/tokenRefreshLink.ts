import {
  ApolloLink,
  Observable,
  Operation,
  NextLink,
  FetchResult,
  fromPromise,
} from '@apollo/client/core';

import { OperationQueuing } from './queuing';

export { OperationQueuing, QueuedRequest } from './queuing';

export type FetchAccessToken = (...args: any[]) => Promise<Response>;
export type HandleFetch<AccessTokenPayloadType> = (accessTokenPayload: AccessTokenPayloadType, operation: Operation) => void;
export type HandleResponse = (operation: Operation, accessTokenField: string) => any;
export type HandleError = (err: Error, operation: Operation) => void;
export type IsTokenValidOrUndefined = (operation: Operation, ...args: any[]) => Promise<boolean>;

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

export namespace TokenRefreshLink {
  export interface Options<AccessTokenPayloadType> {
    /**
     * This is a name of access token field in response.
     * In some scenarios we want to pass additional payload with access token,
     * i.e. new refresh token, so this field could be the object's name.
     *
     * Default: "access_token".
     */
    accessTokenField?: string;

    /**
     * Indicates the current state of access token expiration. If the token is not yet expired or the user does not require a token (guest), then true should be returned.
     */
    isTokenValidOrUndefined: IsTokenValidOrUndefined;

    /**
     * When the new access token is retrieved, an app might persist it in memory (consider avoiding local storage) for use in subsequent requests.
     */
    handleFetch: HandleFetch<AccessTokenPayloadType>;

    /**
     * Callback which receives a fresh token from Response
     */
    fetchAccessToken: FetchAccessToken;

    /**
     * Optional. Override internal function to manually parse and extract your token from server response
     */
    handleResponse?: HandleResponse;

    /**
     * Token fetch error callback. Allows to run additional actions like logout. Don't forget to handle Error if you are using this option
     */
    handleError?: HandleError;
  }
}


export class TokenRefreshLink<AccessTokenPayloadType = string> extends ApolloLink {
  private accessTokenField: string;
  private isTokenValidOrUndefined: IsTokenValidOrUndefined;
  private fetchAccessToken: FetchAccessToken;
  private handleFetch: HandleFetch<AccessTokenPayloadType>;
  private handleResponse: HandleResponse;
  private handleError: HandleError;
  private fetching: boolean;
  private queue: OperationQueuing;

  constructor(params: TokenRefreshLink.Options<AccessTokenPayloadType>) {
    super();

    this.accessTokenField = params.accessTokenField || 'access_token';
    this.isTokenValidOrUndefined = params.isTokenValidOrUndefined;
    this.fetchAccessToken = params.fetchAccessToken;
    this.handleFetch = params.handleFetch;
    this.handleResponse = params.handleResponse || parseAndCheckResponse;
    this.handleError = typeof params.handleError === 'function'
      ? params.handleError
      : err => {
        console.error(err)
      };

    this.fetching = false;
    this.queue = new OperationQueuing();
  }

  public request(
    operation: Operation,
    forward: NextLink,
  ): Observable<FetchResult> | null {
    if (typeof forward !== 'function') {
      throw new Error('[Token Refresh Link]: Token Refresh Link is a non-terminating link and should not be the last in the composed chain');
    }
    
    return fromPromise(
      this.isTokenValidOrUndefined(operation).then((tokenValidOrUndefined) => {
        // If token does not exist, which could mean that this is a not registered
        // user request, or if it is not expired -- act as always
        if (tokenValidOrUndefined) {
          return forward(operation);
        } else {
          if (!this.fetching) {
            this.fetching = true;
            this.fetchAccessToken()
              .then(this.handleResponse(operation, this.accessTokenField))
              .then((body) => {
                const token = this.extractToken(body);
                if (!token) {
                  throw new Error(
                    "[Token Refresh Link]: Unable to retrieve new access token"
                  );
                }
                return token;
              })
              .then((payload) => {
                this.handleFetch(payload, operation)})
              .catch((error) => this.handleError(error, operation))
              .finally(() => {
                this.fetching = false;
                this.queue.consumeQueue();
              });
          }

          return this.queue.enqueueRequest({
            operation,
            forward,
          });
        }
      })
    ).flatMap(val => val)
  }

  /**
   * An attempt to extract token from body.data. This allows us to use apollo query
   * for auth token refreshing
   * @param body {Object} response body
   * @return {string} access token
   */
  private extractToken = (body: any): AccessTokenPayloadType => {
    if (body.data) {
      return body.data[this.accessTokenField];
    }
    return body[this.accessTokenField];
  };
}
