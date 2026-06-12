/**
 * Supabase HTTP adapter — pg Pool interface 호환
 * DNS/pooler 없이 Management API로 직접 SQL 실행
 */

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'gzapjfzsntarufwfkcvn';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

function escapeLiteral(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function interpolate(sql: string, params: any[]): string {
  if (!params || params.length === 0) return sql;
  return sql.replace(/\$(\d+)/g, (_, idx) => escapeLiteral(params[Number(idx) - 1]));
}

async function executeQuery(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number | null }> {
  const finalSql = interpolate(sql, params || []);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: finalSql }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DB query failed (${response.status}): ${errText}`);
  }

  const data: any = await response.json();

  if (data && data.message) {
    throw new Error(data.message);
  }

  const rows: any[] = Array.isArray(data) ? data : [];
  return { rows, rowCount: rows.length };
}

// pg Pool 호환 인터페이스
const pool = {
  query: executeQuery,
  connect: async () => ({
    query: executeQuery,
    release: () => {},
  }),
  end: async () => {},
  on: (_event: string, _handler: any) => {},
};

export async function testConnection(): Promise<boolean> {
  try {
    await executeQuery('SELECT 1');
    console.log('✅ 데이터베이스 연결 성공 (HTTP)');
    return true;
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error);
    return false;
  }
}

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  return executeQuery(text, params) as Promise<{ rows: T[]; rowCount: number | null }>;
}

export default pool as any;
