import type { ReactNode } from "react";
import type {
  Formatter,
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

/**
 * Converte um formatter "estrito" (que assume value:number/name:string sem undefined)
 * em um formatter compatível com a assinatura oficial do Recharts.
 *
 * Tooltip do Recharts pode chamar com value/name undefined em transições — coagimos
 * para tipos seguros antes de delegar à função de domínio.
 */
export function tooltipFormatter<TValue extends number | string = number>(
  fn: (value: TValue, name: string) => ReactNode | [ReactNode, string],
): Formatter<ValueType, NameType> {
  return ((value, name) => {
    if (value === undefined) return "" as ReactNode;
    const v = (typeof value === "number" || typeof value === "string"
      ? value
      : Array.isArray(value)
        ? value[0]
        : value) as TValue;
    return fn(v, (name ?? "").toString()) as
      | ReactNode
      | [ReactNode, NameType];
  }) as Formatter<ValueType, NameType>;
}
