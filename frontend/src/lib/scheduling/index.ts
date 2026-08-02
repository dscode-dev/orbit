/**
 * Modelo do Scheduling Workspace — TypeScript puro, sem React.
 *
 * `import { buildViewWindow, groupByDay } from "@/lib/scheduling";`
 *
 * A divisão importa: `timezone` é aritmética de calendário em fuso nomeado,
 * `view-window` decide o recorte de cada visão e `normalize` transforma as
 * ocorrências recebidas no que as grades consomem. Nenhum deles decide o que
 * é conflito, como a recorrência se expande ou quem está disponível — isso é
 * do backend.
 */
export * from "./timezone";
export * from "./view-window";
export * from "./normalize";
