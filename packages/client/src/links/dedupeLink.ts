import { AnyRouter } from '@trpc/server';
import { Observable } from 'rxjs';
import { share } from 'rxjs';
import { OperationResult, TRPCLink } from './types';

export function dedupeLink<
  TRouter extends AnyRouter = AnyRouter,
>(): TRPCLink<TRouter> {
  // initialized config
  const hi: TRPCLink<TRouter> = () => {
    // initialized in app
    const pending: Record<string, Observable<any>> = {};
    return ({ op, next }) => {
      // initialized for request

      if (op.type !== 'query') {
        // pass through
        return next(op);
      }
      const key = JSON.stringify([op.path, op.input]);
      if (pending[key]) {
        // console.log('hooking into pending', { op });
        return new Observable((observer) => pending[key].subscribe(observer));
      }

      const shared$ = new Observable<OperationResult<TRouter, unknown>>(
        (observer) => {
          function reset() {
            delete pending[key];
          }
          const next$ = next(op).subscribe({
            next(v) {
              observer.next(v);
            },
            error(e) {
              reset();
              observer.error(e);
            },
            complete() {
              reset();
              observer.complete();
            },
          });
          return () => {
            reset();
            next$.unsubscribe();
          };
        },
      ).pipe(share());
      pending[key] = shared$;
      return shared$;
    };
  };

  return hi;
}
