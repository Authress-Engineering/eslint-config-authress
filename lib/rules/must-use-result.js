/**
 * @fileoverview Rule to enforce that neverthrow Result/ResultAsync values are always consumed.
 *
 * A Result is "consumed" if the expression is:
 * - Assigned to a variable that is later accessed via .isErr(), .isOk(), .match(), .unwrapOr(),
 *   ._unsafeUnwrap(), .andThen(), .orElse(), or returned from the function.
 * - Directly chained with a terminal method (.match(), .unwrapOr(), ._unsafeUnwrap()).
 * - Returned from the enclosing function (caller becomes responsible).
 * - Passed as an argument to another function.
 *
 * This rule uses type information when available (parserOptions.project must be set).
 * Without type info, the rule is a silent no-op — it does not crash.
 */

const RESULT_TYPE_NAMES = ["Result", "ResultAsync"];

// Methods that "terminate" a Result chain — after calling these, the Result is consumed.
const TERMINAL_METHODS = new Set([
  "match",
  "unwrapOr",
  "_unsafeUnwrap",
  "_unsafeUnwrapErr",
  "isErr",
  "isOk",
]);

// Methods that transform but still produce a Result — chain continues.
const CHAIN_METHODS = new Set([
  "map",
  "mapErr",
  "andThen",
  "andThrough",
  "orElse",
  "tap",
]);

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce that neverthrow Result/ResultAsync values are explicitly consumed",
      recommended: true,
    },
    messages: {
      mustUseResult: "Result value must be consumed — call .isErr(), .match(), .unwrapOr(), or return it. Discarding a Result silently drops the error.",
    },
    schema: [],
  },

  create(context) {
    // Gracefully degrade when type info is not available (JS projects, missing tsconfig, etc.)
    let checker;
    try {
      const services = context.sourceCode?.parserServices;
      if (!services) return {};

      // typescript-eslint v8+ uses hasFullTypeInformation()
      if (typeof services.hasFullTypeInformation === "function" && !services.hasFullTypeInformation()) return {};

      // Older versions expose program directly
      if (services.program) {
        checker = services.program.getTypeChecker();
      } else if (typeof services.getTypeChecker === "function") {
        checker = services.getTypeChecker();
      }

      if (!checker) return {};
    } catch {
      // Any error resolving type services — degrade silently
      return {};
    }

    const services = context.sourceCode.parserServices;

    function isResultType(type) {
      if (!type) return false;

      // Check the type symbol name
      const symbol = type.getSymbol?.() || type.aliasSymbol;
      if (symbol && RESULT_TYPE_NAMES.includes(symbol.getName())) return true;

      // Check stringified type name as fallback
      try {
        const typeStr = checker.typeToString(type);
        if (/^Result</.test(typeStr) || /^ResultAsync</.test(typeStr)) return true;
      } catch {
        return false;
      }

      // Check union members
      if (type.isUnion?.()) {
        return type.types.some(t => isResultType(t));
      }

      return false;
    }

    function getNodeType(node) {
      try {
        const tsNode = services.esTreeNodeToTSNodeMap?.get(node);
        if (!tsNode) return null;
        return checker.getTypeAtLocation(tsNode);
      } catch {
        return null;
      }
    }

    function isConsumedByChain(node) {
      // Walk up MemberExpression → CallExpression chains to see if a terminal is reached
      let current = node;
      while (current.parent) {
        const parent = current.parent;

        if (parent.type === "MemberExpression" && parent.object === current) {
          const prop = parent.property;
          const methodName = prop.type === "Identifier" ? prop.name : null;

          if (methodName && TERMINAL_METHODS.has(methodName)) return true;

          // It's a chain method — keep walking up
          if (methodName && CHAIN_METHODS.has(methodName)) {
            // The chain method call itself is the parent's parent (CallExpression)
            if (parent.parent?.type === "CallExpression" && parent.parent.callee === parent) {
              current = parent.parent;
              continue;
            }
          }
          return false;
        }

        break;
      }
      return false;
    }

    return {
      // Case 1: Bare expression statement — `await fn()` or `fn()` with no assignment
      ExpressionStatement(node) {
        let expr = node.expression;

        // Unwrap `await`
        if (expr.type === "AwaitExpression") {
          expr = expr.argument;
        }

        // Only check call expressions
        if (expr.type !== "CallExpression") return;

        // Check if the call result (or awaited result) is a Result type
        const type = getNodeType(node.expression);
        if (!type || !isResultType(type)) return;

        // Check if consumed by chain
        if (isConsumedByChain(node.expression)) return;

        context.report({ node, messageId: "mustUseResult" });
      },
    };
  },
};
