/**
 * Ensures exhaustiveness of the switch statements over enums. Example:
 *
 * ```ts
 * enum Theme { Dark, Light };
 *
 * function getCssClass(theme: Theme): string {
 *   switch (theme) {
 *     case Theme.Light: return 'ag-theme-balham';
 *     case Theme.Dark: return 'ag-theme-balham-dark';
 *     default: throw new UnreachableCaseError(theme);
 *   }
 * }
 * ```
 *
 * The code above forces TypeScript compiler to check whether
 * all of the enum's members have a corresponding case statement.
 */
export class UnreachableCaseError extends Error {
  constructor(value: never) {
    super(`Unreachable case: ${value}`);
  }
}
