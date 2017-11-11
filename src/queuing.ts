import { Observable, Operation, NextLink, FetchResult } from 'apollo-link';
// import { Observable as ZenObservable } from 'zen-observable';

export interface QueuedRequest {
  operation: Operation;
  forward?: NextLink;

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

  // private subscription: ZenObservable.Subscription;

  constructor() {
    this.queuedRequests = [];
  }

  public enqueueRequest(request: QueuedRequest): Observable<FetchResult> {
    const requestCopy = { ...request };

    requestCopy.observable =
      requestCopy.observable ||
      new Observable<FetchResult>(observer => {
        this.queuedRequests.push(requestCopy);

        requestCopy.next = requestCopy.next || observer.next.bind(observer);
        requestCopy.error = requestCopy.error || observer.error.bind(observer);
        requestCopy.complete =
          requestCopy.complete || observer.complete.bind(observer);
      });

    return requestCopy.observable;
  }

  public consumeQueue(): /*(Observable<FetchResult> | undefined)[] | void*/ void {
    this.queuedRequests.forEach(request => {
      const /*this.*/subscription =
        request.forward(request.operation).subscribe(request.observable);

      return () => {
        /*this.*/subscription.unsubscribe();
      };
    });

    this.queuedRequests = [];
  }
}
