export function bindClientMethod<TOwner extends object, TArgs extends unknown[], TResult>(
  owner: TOwner,
  method: (this: TOwner, ...args: TArgs) => TResult
) {
  return method.bind(owner);
}
