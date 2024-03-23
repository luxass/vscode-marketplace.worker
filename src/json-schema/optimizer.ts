import { uniqBy } from "lodash";
import { generateType } from "./generator";
import type { AST } from "./types";
import { T_ANY, T_UNKNOWN } from "./types";

export function optimize(ast: AST, processed = new Set<AST>()): AST {
  if (processed.has(ast)) {
    return ast;
  }

  processed.add(ast);

  switch (ast.type) {
    case "INTERFACE":
      return Object.assign(ast, {
        params: ast.params.map((_) =>
          Object.assign(_, { ast: optimize(_.ast, processed) }),
        ),
      });
    case "INTERSECTION":
    case "UNION":
      // Start with the leaves...
      // eslint-disable-next-line no-case-declarations
      const optimizedAST = Object.assign(ast, {
        params: ast.params.map((_) => optimize(_, processed)),
      });

      // [A, B, C, Any] -> Any
      if (optimizedAST.params.some((_) => _.type === "ANY")) {
        console.warn("optimizer", "[A, B, C, Any] -> Any", optimizedAST);
        return T_ANY;
      }

      // [A, B, C, Unknown] -> Unknown
      if (optimizedAST.params.some((_) => _.type === "UNKNOWN")) {
        console.warn(
          "optimizer",
          "[A, B, C, Unknown] -> Unknown",
          optimizedAST,
        );
        return T_UNKNOWN;
      }

      // [A (named), A] -> [A (named)]
      if (
        optimizedAST.params.every((_) => {
          const a = generateType(omitStandaloneName(_));
          const b = generateType(omitStandaloneName(optimizedAST.params[0]));
          return a === b;
        })
        && optimizedAST.params.some((_) => _.standaloneName !== undefined)
      ) {
        console.warn(
          "optimizer",
          "[A (named), A] -> [A (named)]",
          optimizedAST,
        );
        optimizedAST.params = optimizedAST.params.filter(
          (_) => _.standaloneName !== undefined,
        );
      }

      // [A, B, B] -> [A, B]
      // eslint-disable-next-line no-case-declarations
      const params = uniqBy(optimizedAST.params, (_) => generateType(_));
      if (params.length !== optimizedAST.params.length) {
        console.warn("optimizer", "[A, B, B] -> [A, B]", optimizedAST);
        optimizedAST.params = params;
      }

      return Object.assign(optimizedAST, {
        params: optimizedAST.params.map((_) => optimize(_, processed)),
      });
    default:
      return ast;
  }
}

// TODO: More clearly disambiguate standalone names vs. aliased names instead.
function omitStandaloneName<A extends AST>(ast: A): A {
  switch (ast.type) {
    case "ENUM":
      return ast;
    default:
      return { ...ast, standaloneName: undefined };
  }
}
