/**
 * Rótulos dos literais de equipamento (recurso `assets` no backend).
 *
 * Ficam aqui, e não em um componente, porque o Entity Registry precisa deles e
 * o registry não deve depender de árvore de componentes. `AssetStatus` e
 * `AssetCategory` são listas fechadas nos contratos sincronizados
 * (`backend/src/contracts/literals`); o mapa cobre exatamente esses valores e
 * qualquer outro é exibido cru.
 */
import type { AssetCategory, AssetStatus } from "@/types/contracts";

export const ASSET_STATUS_LABELS: Readonly<
  Record<AssetStatus | string, string>
> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  MAINTENANCE: "Em manutenção",
  RETIRED: "Baixado",
};

export const ASSET_CATEGORY_LABELS: Readonly<
  Record<AssetCategory | string, string>
> = {
  EQUIPMENT: "Equipamento",
  VEHICLE: "Veículo",
  TOOL: "Ferramenta",
  FACILITY: "Instalação",
  OTHER: "Outro",
};

/** Como o identificador do ativo foi gravado (`AssetIdentifierType`). */
export const ASSET_IDENTIFIER_LABELS: Readonly<Record<string, string>> = {
  SERIAL_NUMBER: "Número de série",
  QR_CODE: "QR Code",
  NFC: "NFC",
  INTERNAL_CODE: "Código interno",
  BARCODE: "Código de barras",
  RFID: "RFID",
  CUSTOM: "Personalizado",
};
