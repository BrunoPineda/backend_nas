import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

let poolPromise: Promise<sql.ConnectionPool> | null = null;

// Tipos del driver: ISqlType vs factory según versión; `any` evita incompatibilidades @types/mssql.
function inferSqlType(value: unknown): any {
  if (value === null || value === undefined) {
    return sql.NVarChar(sql.MAX);
  }
  if (typeof value === 'boolean') {
    return sql.Bit;
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value) && Math.abs(value) <= 2147483647) {
      return sql.Int;
    }
    return sql.BigInt;
  }
  if (value instanceof Date) {
    return sql.DateTime2;
  }
  if (typeof value === 'string') {
    if (
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
        value
      )
    ) {
      return sql.UniqueIdentifier;
    }
    return sql.NVarChar(sql.MAX);
  }
  return sql.NVarChar(sql.MAX);
}

function collectParamIndices(text: string): number[] {
  const used = new Set<number>();
  const re = /\$(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    used.add(parseInt(m[1], 10));
  }
  return Array.from(used).sort((a, b) => b - a);
}

function buildConfigFromEnv(): string | sql.config {
  const connStr = process.env.MSSQL_CONNECTION_STRING?.trim();
  if (connStr) {
    return connStr;
  }

  const server = process.env.MSSQL_SERVER || 'localhost';
  const instanceName = process.env.MSSQL_INSTANCE?.trim();
  // Instancia por defecto (MSSQLSERVER): suele ir con TCP puerto 1433.
  // Instancia con nombre (p. ej. SQLEXPRESS): no fijar puerto; el Browser (UDP 1434) resuelve el puerto dinámico.
  const port =
    instanceName ? undefined : parseInt(process.env.MSSQL_PORT || '1433', 10);

  const config: sql.config = {
    server,
    ...(port !== undefined ? { port } : {}),
    database: process.env.MSSQL_DATABASE || 'DB_NAS',
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    options: {
      encrypt: process.env.MSSQL_ENCRYPT !== 'false',
      trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== 'false',
      enableArithAbort: true,
      ...(instanceName ? { instanceName } : {}),
    },
  };

  return config;
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const built = buildConfigFromEnv();
    poolPromise = (typeof built === 'string' ? sql.connect(built) : sql.connect(built)).catch(
      (err) => {
        poolPromise = null;
        throw err;
      }
    );
  }
  return poolPromise;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = await getPool();
  const request = pool.request();
  let sqlText = text;
  for (const i of collectParamIndices(text)) {
    const val = params[i - 1];
    request.input(`p${i}`, inferSqlType(val), val);
    sqlText = sqlText.replace(new RegExp(`\\$${i}(?!\\d)`, 'g'), `@p${i}`);
  }
  const start = Date.now();
  try {
    const result = await request.query(sqlText);
    const rows = (result.recordset || []) as T[];
    const ra = result.rowsAffected as number[] | undefined;
    const rowCount = Array.isArray(ra) ? ra.reduce((a, n) => a + (Number(n) || 0), 0) : rows.length;
    console.log('Executed query', { text: text.slice(0, 120), duration: Date.now() - start, rows: rowCount });
    return { rows, rowCount };
  } catch (error) {
    console.error('Database query error', error);
    throw error;
  }
}

export async function closePool(): Promise<void> {
  if (poolPromise) {
    const p = await poolPromise;
    await p.close();
    poolPromise = null;
  }
}
