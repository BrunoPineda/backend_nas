import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

let nasPoolPromise: Promise<sql.ConnectionPool> | null = null;
let userPoolPromise: Promise<sql.ConnectionPool> | null = null;

/** Base corporativa ConectaJuntos (usuarios/roles Intranet). */
export function userDatabaseName(): string {
  return process.env.MSSQL_USERDATABASE?.trim() || 'BDJUNTOS';
}

/** Lectura de identidad/roles desde BDJUNTOS cuando MSSQL_USERDATABASE está definido. */
export function useIntranetUserDatabase(): boolean {
  return Boolean(process.env.MSSQL_USERDATABASE?.trim());
}

/** Servidor SQL dedicado a BDJUNTOS (distinto del de DB_NAS). */
export function useSeparateUserSqlServer(): boolean {
  return Boolean(process.env.MSSQL_USER_SERVER?.trim());
}

/** Tabla fully-qualified en BDJUNTOS.INTRANET */
export function intranetTable(tableName: string): string {
  const db = userDatabaseName().replace(/[\[\]]/g, '');
  const table = tableName.replace(/[\[\]]/g, '');
  return `[${db}].[INTRANET].[${table}]`;
}

/** Credenciales legacy (vClave). Esquema VIATICO en BDJUNTOS. */
export function viaticoTable(tableName: string): string {
  const db = userDatabaseName().replace(/[\[\]]/g, '');
  const table = tableName.replace(/[\[\]]/g, '');
  return `[${db}].[VIATICO].[${table}]`;
}

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

type SqlEnvPrefix = 'NAS' | 'USER';

function readEnv(prefix: SqlEnvPrefix, suffix: string, legacy?: string): string | undefined {
  const v = process.env[`MSSQL_${prefix}_${suffix}`]?.trim();
  if (v) return v;
  if (legacy) return process.env[legacy]?.trim();
  return undefined;
}

function buildConfig(prefix: SqlEnvPrefix): string | sql.config {
  if (prefix === 'NAS') {
    const connStr =
      process.env.MSSQL_NAS_CONNECTION_STRING?.trim() ?? process.env.MSSQL_CONNECTION_STRING?.trim();
    if (connStr) return connStr;
  } else {
    const connStr = process.env.MSSQL_USER_CONNECTION_STRING?.trim();
    if (connStr) return connStr;
  }

  const server =
    readEnv(prefix, 'SERVER', prefix === 'NAS' ? 'MSSQL_SERVER' : 'MSSQL_USER_SERVER') ??
    (prefix === 'USER' && !useSeparateUserSqlServer()
      ? readEnv('NAS', 'SERVER', 'MSSQL_SERVER')
      : undefined) ??
    'localhost';

  const instanceName = readEnv(
    prefix,
    'INSTANCE',
    prefix === 'NAS' ? 'MSSQL_INSTANCE' : 'MSSQL_USER_INSTANCE'
  );
  const portRaw = readEnv(prefix, 'PORT', prefix === 'NAS' ? 'MSSQL_PORT' : 'MSSQL_USER_PORT');
  const port = instanceName
    ? undefined
    : portRaw
      ? parseInt(portRaw, 10)
      : prefix === 'NAS'
        ? 1433
        : undefined;

  const database =
    prefix === 'NAS'
      ? readEnv('NAS', 'DATABASE', 'MSSQL_DATABASE') || 'DB_NAS'
      : userDatabaseName();

  const user =
    readEnv(prefix, 'USER', prefix === 'NAS' ? 'MSSQL_USER' : 'MSSQL_USER_USER') ??
    (prefix === 'USER' ? readEnv('NAS', 'USER', 'MSSQL_USER') : undefined);

  const password =
    readEnv(prefix, 'PASSWORD', prefix === 'NAS' ? 'MSSQL_PASSWORD' : 'MSSQL_USER_PASSWORD') ??
    (prefix === 'USER' ? readEnv('NAS', 'PASSWORD', 'MSSQL_PASSWORD') : undefined);

  const encrypt =
    readEnv(prefix, 'ENCRYPT', prefix === 'NAS' ? 'MSSQL_ENCRYPT' : 'MSSQL_USER_ENCRYPT') !== 'false';
  const trustServerCertificate =
    readEnv(
      prefix,
      'TRUST_SERVER_CERTIFICATE',
      prefix === 'NAS' ? 'MSSQL_TRUST_SERVER_CERTIFICATE' : 'MSSQL_USER_TRUST_SERVER_CERTIFICATE'
    ) !== 'false';

  const config: sql.config = {
    server,
    ...(port !== undefined ? { port } : {}),
    database,
    user,
    password,
    options: {
      encrypt,
      trustServerCertificate,
      enableArithAbort: true,
      ...(instanceName ? { instanceName } : {}),
    },
  };

  return config;
}

async function getOrCreatePool(
  prefix: SqlEnvPrefix,
  getPromise: () => Promise<sql.ConnectionPool> | null,
  setPromise: (p: Promise<sql.ConnectionPool> | null) => void
): Promise<sql.ConnectionPool> {
  let promise = getPromise();
  if (!promise) {
    promise = (async () => {
      const built = buildConfig(prefix);
      if (typeof built === 'string') {
        const pool = new sql.ConnectionPool(built);
        await pool.connect();
        return pool;
      }
      const pool = new sql.ConnectionPool(built);
      await pool.connect();
      return pool;
    })().catch((err) => {
      setPromise(null);
      throw err;
    });
    setPromise(promise);
  }
  return promise;
}

/** Pool DB_NAS (lectura/escritura del módulo). */
export async function getNasPool(): Promise<sql.ConnectionPool> {
  return getOrCreatePool(
    'NAS',
    () => nasPoolPromise,
    (p) => {
      nasPoolPromise = p;
    }
  );
}

/** Pool BDJUNTOS / ConectaJuntos (solo lectura en el módulo NAS). */
export async function getUserPool(): Promise<sql.ConnectionPool> {
  if (!useSeparateUserSqlServer()) {
    return getNasPool();
  }
  return getOrCreatePool(
    'USER',
    () => userPoolPromise,
    (p) => {
      userPoolPromise = p;
    }
  );
}

/** Alias de getNasPool. */
export async function getPool(): Promise<sql.ConnectionPool> {
  return getNasPool();
}

async function runQuery<T>(
  pool: sql.ConnectionPool,
  text: string,
  params: unknown[],
  label: string
): Promise<{ rows: T[]; rowCount: number }> {
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
    console.log('Executed query', {
      db: label,
      text: text.slice(0, 120),
      duration: Date.now() - start,
      rows: rowCount,
    });
    return { rows, rowCount };
  } catch (error) {
    console.error('Database query error', { db: label, error });
    throw error;
  }
}

/** Consultas sobre DB_NAS. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = await getNasPool();
  return runQuery<T>(pool, text, params, 'DB_NAS');
}

/** Consultas sobre BDJUNTOS (Intranet / VIATICO). Solo lectura en este módulo. */
export async function queryUserDb<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = await getUserPool();
  const label = useSeparateUserSqlServer() ? 'BDJUNTOS' : 'DB_NAS(cross-db)';
  return runQuery<T>(pool, text, params, label);
}

export async function closePool(): Promise<void> {
  await closeAllPools();
}

export async function closeAllPools(): Promise<void> {
  if (nasPoolPromise) {
    await (await nasPoolPromise).close();
    nasPoolPromise = null;
  }
  if (userPoolPromise) {
    await (await userPoolPromise).close();
    userPoolPromise = null;
  }
}
