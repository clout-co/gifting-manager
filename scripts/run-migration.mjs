import pg from 'pg';

// Supabase PostgreSQL接続
// 接続文字列: postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
const connectionString = process.env.DATABASE_URL ||
  'postgresql://postgres.kznfdqsgtrxpzmmkyahn:@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function runMigration() {
  console.log('Running migration: Add engagement_date column...');

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // カラムを追加
    const sql = `
      ALTER TABLE campaigns
      ADD COLUMN IF NOT EXISTS engagement_date DATE;
    `;

    await client.query(sql);
    console.log('✓ engagement_date column added successfully!');

  } catch (error) {
    console.error('Migration error:', error.message);

    if (error.message.includes('password authentication failed') ||
        error.message.includes('no password supplied')) {
      console.log('\n⚠️  DATABASE_URLが必要です。');
      console.log('Supabaseダッシュボード > Settings > Database > Connection string からコピーしてください。');
      console.log('\n実行方法:');
      console.log('DATABASE_URL="postgresql://postgres.kznfdqsgtrxpzmmkyahn:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres" node scripts/run-migration.mjs');
    }
  } finally {
    await client.end();
  }
}

runMigration();
