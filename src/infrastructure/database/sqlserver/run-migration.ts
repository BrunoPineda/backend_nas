import { query } from './connection.js';

async function run() {
  console.log('Starting database schema upgrade...');
  try {
    // 1. Add columns
    console.log('Adding columns to NASTM_USUARIOS...');
    await query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.NASTM_USUARIOS') AND name = N'NU_DNI')
      BEGIN
          ALTER TABLE dbo.NASTM_USUARIOS ADD
              NU_DNI VARCHAR(20) NULL,
              NO_NOMBRE VARCHAR(100) NULL,
              AP_PATERNO VARCHAR(100) NULL,
              AP_MATERNO VARCHAR(100) NULL,
              NO_USUARIO VARCHAR(100) NULL,
              NU_TELEFONO VARCHAR(50) NULL;
          PRINT 'Columns added successfully.';
      END
      ELSE
      BEGIN
          PRINT 'Columns already exist.';
      END
    `);

    // 1.5 Add NU_NUMERO_DOCUMENTO column, populate, and set NOT NULL
    console.log('Adding NU_NUMERO_DOCUMENTO to NASTM_USUARIOS...');
    await query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.NASTM_USUARIOS') AND name = N'NU_NUMERO_DOCUMENTO')
      BEGIN
          ALTER TABLE dbo.NASTM_USUARIOS ADD NU_NUMERO_DOCUMENTO VARCHAR(20) NULL;
          PRINT 'Column NU_NUMERO_DOCUMENTO added as NULL.';
      END
    `);

    await query(`
      UPDATE dbo.NASTM_USUARIOS 
      SET NU_NUMERO_DOCUMENTO = COALESCE(NU_DNI, '00000000') 
      WHERE NU_NUMERO_DOCUMENTO IS NULL;
    `);

    await query(`
      ALTER TABLE dbo.NASTM_USUARIOS ALTER COLUMN NU_NUMERO_DOCUMENTO VARCHAR(20) NOT NULL;
      PRINT 'Column NU_NUMERO_DOCUMENTO altered to NOT NULL.';
    `);

    // 2. Add Unique Index
    console.log('Creating unique index UX_NASTM_USUARIOS_DNI...');
    await query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.NASTM_USUARIOS') AND name = N'UX_NASTM_USUARIOS_DNI')
      BEGIN
          CREATE UNIQUE INDEX UX_NASTM_USUARIOS_DNI 
          ON dbo.NASTM_USUARIOS (NU_DNI) 
          WHERE NU_DNI IS NOT NULL;
          PRINT 'Index UX_NASTM_USUARIOS_DNI created successfully.';
      END
      ELSE
      BEGIN
          PRINT 'Index already exists.';
      END
    `);

    // 2.5 Add Unique Index for NU_NUMERO_DOCUMENTO
    console.log('Creating unique index UX_NASTM_USUARIOS_NUMERO_DOCUMENTO...');
    await query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.NASTM_USUARIOS') AND name = N'UX_NASTM_USUARIOS_NUMERO_DOCUMENTO')
      BEGIN
          CREATE UNIQUE INDEX UX_NASTM_USUARIOS_NUMERO_DOCUMENTO 
          ON dbo.NASTM_USUARIOS (NU_NUMERO_DOCUMENTO);
          PRINT 'Index UX_NASTM_USUARIOS_NUMERO_DOCUMENTO created successfully.';
      END
      ELSE
      BEGIN
          PRINT 'Index already exists.';
      END
    `);

    console.log('Schema upgrade completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to run schema upgrade:', error);
    process.exit(1);
  }
}

run();
