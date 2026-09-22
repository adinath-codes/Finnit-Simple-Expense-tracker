import { PgParser } from "npm:@supabase/pg-parser@0.1.7";

const parser = new PgParser({ version: 17 });
const VIEW_COLUMNS = new Set([
  "id", "entry_id", "occurred_on", "currency", "direction", "cash_flow",
  "category_id", "category_name", "merchant_id", "merchant_name", "description",
  "raw_text", "search_text", "person_names", "context_names",
  "stated_amount_minor", "user_share_minor", "group_total_minor",
  "paid_by_user_minor", "owed_to_user_minor", "user_owes_minor",
  "reimbursed_minor", "gross_spend_minor",
]);
const ANSWER_COLUMNS = new Set([
  "id", "entry_id", "occurred_on", "currency", "direction", "category_id",
  "category_name", "merchant_id", "merchant_name", "description", "metric_minor",
  "value_minor", "value_date", "value_count", "label",
]);
const NODE_TAGS = new Set([
  "SelectStmt", "ResTarget", "ColumnRef", "String", "A_Star", "A_Expr",
  "BoolExpr", "NullTest", "TypeCast", "TypeName", "A_Const", "FuncCall",
  "SortBy", "BooleanTest", "RangeVar", "Integer", "Float",
]);
const FORBIDDEN_FIELDS = new Set([
  "withClause", "intoClause", "lockingClause", "valuesLists", "larg", "rarg",
  "windowClause", "distinctClause", "groupingSets", "fromClause2", "havingClause2",
]);
const OPERATORS = new Set(["=", "<>", "<", ">", "<=", ">=", "~~*", "!~~*", "~~", "!~~"]);
const ANSWER_FUNCTIONS = new Set(["sum", "count", "min", "max", "date_trunc"]);
const TARGETS = new Set(["value_minor", "value_date", "value_count", "currency", "label"]);

type Json = Record<string, any>;
function fail(): never { throw new Error("unsafe_sql"); }
function isObject(value: unknown): value is Json { return !!value && typeof value === "object" && !Array.isArray(value); }
function strings(nodes: unknown): string[] {
  if (!Array.isArray(nodes)) fail();
  return nodes.map((node) => {
    if (!isObject(node) || !isObject(node.String) || typeof node.String.sval !== "string") fail();
    return node.String.sval;
  });
}
function nameOf(call: Json): string {
  const names = strings(call.funcname);
  if (names.length !== 1) fail();
  return names[0].toLowerCase();
}
function visit(value: unknown, mode: "cohort" | "answer") {
  if (Array.isArray(value)) { value.forEach((item) => visit(item, mode)); return; }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(key) && child != null) fail();
    if (/^[A-Z]/.test(key) && !NODE_TAGS.has(key)) fail();
    if (key === "RangeVar") {
      const relation = child as Json;
      if (relation.catalogname || relation.relpersistence !== "p") fail();
      if (mode === "cohort" && !(relation.schemaname === "ask_read" && relation.relname === "transactions")) fail();
      if (mode === "answer" && !(relation.schemaname === "" && relation.relname === "matched")) fail();
    }
    if (key === "ColumnRef") {
      const fields = strings((child as Json).fields);
      if (fields.length !== 1 || !(mode === "cohort" ? VIEW_COLUMNS : ANSWER_COLUMNS).has(fields[0])) fail();
    }
    if (key === "FuncCall") {
      if (mode === "cohort" || !ANSWER_FUNCTIONS.has(nameOf(child as Json))) fail();
      if ((child as Json).agg_filter || (child as Json).over || (child as Json).agg_order) fail();
    }
    if (key === "A_Expr") {
      const op = strings((child as Json).name);
      if (op.length !== 1 || !OPERATORS.has(op[0])) fail();
    }
    if (key === "TypeCast") {
      const names = strings((child as Json).typeName?.names);
      if (names.length !== 1 || !["date", "text", "numeric"].includes(names[0].toLowerCase())) fail();
    }
    visit(child, mode);
  }
}

/** PostgreSQL AST validation. Unknown statement and expression nodes fail closed. */
export async function validateAskSql(sql: string, mode: "cohort" | "answer"): Promise<string> {
  if (typeof sql !== "string" || sql.length < 10 || sql.length > 4096 || /;|--|\/\*/.test(sql)) fail();
  const parsed = await parser.parse(sql);
  if (parsed.error || parsed.tree?.stmts?.length !== 1) fail();
  const statement = (parsed.tree.stmts[0] as Json).stmt?.SelectStmt as Json | undefined;
  if (!statement || !Array.isArray(statement.fromClause) || statement.fromClause.length !== 1 || !Array.isArray(statement.targetList)) fail();
  const range = statement.fromClause[0]?.RangeVar;
  if (!range) fail();
  if (statement.op !== "SETOP_NONE" || statement.withClause || statement.intoClause || statement.lockingClause) fail();
  if (mode === "cohort") {
    if (statement.groupClause || statement.sortClause || statement.limitCount || statement.havingClause) fail();
    if (statement.targetList.length !== 1) fail();
    const target = statement.targetList[0]?.ResTarget;
    if (target?.name || target?.val?.ColumnRef?.fields?.[0]?.String?.sval !== "id") fail();
  } else {
    if (statement.targetList.length < 1 || statement.targetList.length > 4) fail();
    if (statement.whereClause || statement.havingClause) fail();
    for (const targetNode of statement.targetList) {
      const target = targetNode.ResTarget;
      const outputName = target?.name || target?.val?.ColumnRef?.fields?.[0]?.String?.sval;
      if (!target || !TARGETS.has(outputName) || target.val?.A_Const) fail();
    }
    if (statement.limitCount?.A_Const?.ival?.ival > 5) fail();
  }
  visit(statement, mode);
  return sql;
}
