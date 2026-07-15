export const FILTER_COLUMNS: Record<string, string> = {
  estado: "estado",
  municipio: "municipio",
  tecnologia: "tecnologia",
  status: "status_normalizado",
  detentor: "detentor_infra",
  tipoInfra: "tipo_infra",
  operadora: "operadora_classificada",
};

export function whereFrom(params: URLSearchParams) {
  const clauses: string[] = [];
  const values: string[] = [];
  for (const [key, column] of Object.entries(FILTER_COLUMNS)) {
    const value = params.get(key)?.trim();
    if (value) {
      clauses.push(`${column} = ?`);
      values.push(value);
    }
  }
  const search = params.get("q")?.trim();
  if (search) {
    clauses.push("(site_id LIKE ? OR site LIKE ? OR municipio LIKE ? OR estado LIKE ? OR uf LIKE ? OR operadora_classificada LIKE ? OR operadora_origem LIKE ? OR endereco LIKE ? OR endereco_id LIKE ?)");
    values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  return { clauses, sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", values };
}

export function withClause(clauses: string[], clause: string) {
  return `WHERE ${[...clauses, clause].join(" AND ")}`;
}
