import { Observable, Operation, NextLink, FetchResult } from '@apollo/client';
import { print } from 'graphql/language/printer';

export interface SubscriberInterface {
  next?: (result: FetchResult) => void;
  error?: (error: Error) => void;
  complete?: () => void;
}

export interface QueuedRequest {
  operation: Operation;
  forward?: NextLink;
  subscriber?: SubscriberInterface;

  // promise is created when the query fetch request is
  // added to the queue and is resolved once the result is back
  // from the server.
  observable?: Observable<FetchResult>;
  next?: (result: FetchResult) => void;
  error?: (error: Error) => void;
  complete?: () => void;
}

export class OperationQueuing {
  public queuedRequests: QueuedRequest[] = [];

  private subscriptions: { [key: string]: ZenObservable.Subscription } = {};

  constructor() {
    this.queuedRequests = [];
  }

  public enqueueRequest(request: QueuedRequest): Observable<FetchResult> {
    const requestCopy = { ...request };

    requestCopy.observable =
      requestCopy.observable ||
      new Observable<FetchResult>(observer => {
        this.queuedRequests.push(requestCopy);

        if (typeof requestCopy.subscriber === 'undefined') {
          requestCopy.subscriber = {};
        }

        requestCopy.subscriber.next = requestCopy.next || observer.next.bind(observer);
        requestCopy.subscriber.error = requestCopy.error || observer.error.bind(observer);
        requestCopy.subscriber.complete =
          requestCopy.complete || observer.complete.bind(observer);
      });

    return requestCopy.observable;
  }

  public consumeQueue(): void {
    this.queuedRequests.forEach(request => {
      const key = requestToKey(request)
      this.subscriptions[key] =
        request.forward(request.operation).subscribe(request.subscriber);

      return () => {
        this.subscriptions[key].unsubscribe();
      };
    });

    this.queuedRequests = [];
  }
}

function requestToKey(request: QueuedRequest): string {
  const queryString =
    typeof request.operation.query === 'string' ? request.operation.query : print(request.operation.query);

  return JSON.stringify({
    variables: request.operation.variables || {},
    query: queryString,
  });
}