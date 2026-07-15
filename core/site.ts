export const SITE_UNIFIED_COLUMNS = [
  "id",
  "site",
  "operadora_origem",
  "municipio",
  "uf",
  "regional",
  "latitude",
  "longitude",
  "endereco",
  "status",
  "projeto",
  "tecnologia",
  "tipo_site",
  "data_importacao",
  "arquivo_origem",
] as const;

export type UnifiedSiteColumn = (typeof SITE_UNIFIED_COLUMNS)[number];
