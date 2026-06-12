-- Script opcional: crea base de datos en SQL Server (ejecutar como administrador si hace falta)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'DB_NAS')
BEGIN
    CREATE DATABASE DB_NAS;
END
GO

USE DB_NAS;
GO

-- El esquema lo genera Hibernate (ddl-auto: update) al arrancar Spring Boot.
-- Ajuste usuario/clave en backend/src/main/resources/application.yml
