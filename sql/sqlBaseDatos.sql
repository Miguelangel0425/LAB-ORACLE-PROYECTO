--------------------------------------------------------------------------------
-- SCRIPT COMPLETO Y CONSOLIDADO - Sistema de Gestion Empresarial
-- Incluye: esquema base + roles de usuario + CRUD de productos + registro
-- de ventas con control de stock + auditoria de clientes y de ventas.
--
-- MOTOR: Oracle Database 21c XE
--
-- ORDEN DE EJECUCION:
--   1) Crear un usuario/esquema propio (ver seccion 0 de instrucciones abajo).
--   2) Conectarse con ese usuario, dentro del PDB (ej. XEPDB1).
--   3) Ejecutar este script COMPLETO de una sola pasada (Run Script / F5).
--
-- ------------------------------------------------------------------------
-- INSTRUCCIONES PREVIAS (ejecutar esto ANTES, conectado como SYSTEM o SYS,
-- dentro del PDB correcto):
--
--   ALTER SESSION SET CONTAINER = XEPDB1;
--   CREATE USER PROYECTO_BD IDENTIFIED BY tu_password;
--   GRANT CONNECT, RESOURCE, CREATE VIEW, CREATE SEQUENCE, CREATE TRIGGER
--         TO PROYECTO_BD;
--   ALTER USER PROYECTO_BD QUOTA UNLIMITED ON USERS;
--
-- Luego conectate como PROYECTO_BD (en su propia conexion de SQL Developer,
-- Service name = XEPDB1) y ejecuta TODO lo que sigue.
-- ------------------------------------------------------------------------
--------------------------------------------------------------------------------

--------------------------------------------------------------------------------
-- 0. LIMPIEZA (por si ya existia un intento anterior en este mismo usuario)
--------------------------------------------------------------------------------
BEGIN
   FOR t IN (SELECT trigger_name FROM user_triggers) LOOP
      EXECUTE IMMEDIATE 'DROP TRIGGER ' || t.trigger_name;
   END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
   FOR p IN (SELECT object_name, object_type FROM user_objects
             WHERE object_type IN ('PROCEDURE','VIEW','PACKAGE')) LOOP
      EXECUTE IMMEDIATE 'DROP ' || p.object_type || ' ' || p.object_name;
   END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
   FOR t IN (SELECT table_name FROM user_tables) LOOP
      EXECUTE IMMEDIATE 'DROP TABLE ' || t.table_name || ' CASCADE CONSTRAINTS PURGE';
   END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
   FOR s IN (SELECT sequence_name FROM user_sequences) LOOP
      EXECUTE IMMEDIATE 'DROP SEQUENCE ' || s.sequence_name;
   END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

--------------------------------------------------------------------------------
-- 1. DDL - TABLAS
--------------------------------------------------------------------------------

-- Usuarios del sistema (login / registro), ya con ROL incluido desde el inicio
CREATE TABLE USUARIOS (
    ID_USUARIO        NUMBER          NOT NULL,
    USERNAME          VARCHAR2(50)    NOT NULL,
    PASSWORD_HASH     VARCHAR2(256)   NOT NULL,
    NOMBRE_COMPLETO   VARCHAR2(150),
    ACTIVO            NUMBER(1)       DEFAULT 1 NOT NULL,
    ROL               VARCHAR2(20)    DEFAULT 'USUARIO' NOT NULL,
    FECHA_REGISTRO    DATE            DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_USUARIOS PRIMARY KEY (ID_USUARIO),
    CONSTRAINT UQ_USUARIOS_USERNAME UNIQUE (USERNAME),
    CONSTRAINT CK_USUARIOS_ACTIVO CHECK (ACTIVO IN (0,1)),
    CONSTRAINT CK_USUARIOS_ROL CHECK (ROL IN ('ADMIN','USUARIO'))
);

-- Clientes (entidad CRUD principal), ya con ACTIVO para activar/desactivar
CREATE TABLE CLIENTES (
    ID_CLIENTE          NUMBER          NOT NULL,
    NOMBRE              VARCHAR2(80)    NOT NULL,
    APELLIDO            VARCHAR2(80)    NOT NULL,
    EMAIL               VARCHAR2(150)   NOT NULL,
    TELEFONO            VARCHAR2(20),
    DIRECCION           VARCHAR2(200),
    ACTIVO              NUMBER(1)       DEFAULT 1 NOT NULL,
    FECHA_CREACION      DATE            DEFAULT SYSDATE NOT NULL,
    FECHA_MODIFICACION  DATE,
    CONSTRAINT PK_CLIENTES PRIMARY KEY (ID_CLIENTE),
    CONSTRAINT UQ_CLIENTES_EMAIL UNIQUE (EMAIL),
    CONSTRAINT CK_CLIENTES_ACTIVO CHECK (ACTIVO IN (0,1))
);

-- Productos
CREATE TABLE PRODUCTOS (
    ID_PRODUCTO         NUMBER          NOT NULL,
    NOMBRE              VARCHAR2(120)   NOT NULL,
    DESCRIPCION         VARCHAR2(300),
    PRECIO              NUMBER(10,2)    NOT NULL,
    STOCK               NUMBER(8)       DEFAULT 0 NOT NULL,
    FECHA_CREACION      DATE            DEFAULT SYSDATE NOT NULL,
    FECHA_MODIFICACION  DATE,
    CONSTRAINT PK_PRODUCTOS PRIMARY KEY (ID_PRODUCTO),
    CONSTRAINT CK_PRODUCTOS_PRECIO CHECK (PRECIO >= 0),
    CONSTRAINT CK_PRODUCTOS_STOCK CHECK (STOCK >= 0)
);

-- Ventas (encabezado), ya con el vendedor incluido desde el inicio
CREATE TABLE VENTAS (
    ID_VENTA              NUMBER          NOT NULL,
    ID_CLIENTE            NUMBER          NOT NULL,
    ID_USUARIO_VENDEDOR   NUMBER,
    FECHA_VENTA           DATE            DEFAULT SYSDATE NOT NULL,
    TOTAL                 NUMBER(12,2)    DEFAULT 0 NOT NULL,
    CONSTRAINT PK_VENTAS PRIMARY KEY (ID_VENTA),
    CONSTRAINT FK_VENTAS_CLIENTE FOREIGN KEY (ID_CLIENTE)
        REFERENCES CLIENTES (ID_CLIENTE),
    CONSTRAINT FK_VENTAS_USUARIO FOREIGN KEY (ID_USUARIO_VENDEDOR)
        REFERENCES USUARIOS (ID_USUARIO)
);

-- Detalle de ventas (lineas de producto por venta)
CREATE TABLE DETALLE_VENTA (
    ID_DETALLE       NUMBER          NOT NULL,
    ID_VENTA         NUMBER          NOT NULL,
    ID_PRODUCTO      NUMBER          NOT NULL,
    CANTIDAD         NUMBER(6)       NOT NULL,
    PRECIO_UNITARIO  NUMBER(10,2)    NOT NULL,
    SUBTOTAL         NUMBER(12,2)    NOT NULL,
    CONSTRAINT PK_DETALLE_VENTA PRIMARY KEY (ID_DETALLE),
    CONSTRAINT FK_DETALLE_VENTA FOREIGN KEY (ID_VENTA)
        REFERENCES VENTAS (ID_VENTA),
    CONSTRAINT FK_DETALLE_PRODUCTO FOREIGN KEY (ID_PRODUCTO)
        REFERENCES PRODUCTOS (ID_PRODUCTO),
    CONSTRAINT CK_DETALLE_CANTIDAD CHECK (CANTIDAD > 0)
);

-- Auditoria de cambios sobre CLIENTES (poblada por trigger AFTER UPDATE)
CREATE TABLE AUDITORIA_CLIENTES (
    ID_AUDITORIA      NUMBER          NOT NULL,
    ID_CLIENTE        NUMBER          NOT NULL,
    CAMPO_MODIFICADO  VARCHAR2(50)    NOT NULL,
    VALOR_ANTERIOR    VARCHAR2(300),
    VALOR_NUEVO       VARCHAR2(300),
    FECHA_CAMBIO      DATE            DEFAULT SYSDATE NOT NULL,
    USUARIO_DB        VARCHAR2(50)    DEFAULT USER NOT NULL,
    CONSTRAINT PK_AUDITORIA_CLIENTES PRIMARY KEY (ID_AUDITORIA)
);

-- Auditoria de creacion/eliminacion de VENTAS (poblada por triggers)
CREATE TABLE AUDITORIA_VENTAS (
    ID_AUDITORIA          NUMBER          NOT NULL,
    ID_VENTA              NUMBER          NOT NULL,
    ACCION                VARCHAR2(20)    NOT NULL,   -- 'CREACION' | 'ELIMINACION'
    ID_CLIENTE            NUMBER,
    TOTAL                 NUMBER(12,2),
    ID_USUARIO_VENDEDOR   NUMBER,
    ID_USUARIO_ACCION     NUMBER,
    FECHA_EVENTO          DATE            DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_AUDITORIA_VENTAS PRIMARY KEY (ID_AUDITORIA),
    CONSTRAINT CK_AUDITORIA_VENTAS_ACCION CHECK (ACCION IN ('CREACION','ELIMINACION'))
);

--------------------------------------------------------------------------------
-- 2. SECUENCIAS
--------------------------------------------------------------------------------
CREATE SEQUENCE SEQ_USUARIOS         START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_CLIENTES         START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_PRODUCTOS        START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_VENTAS           START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_DETALLE_VENTA    START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_AUDITORIA        START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_AUDITORIA_VENTAS START WITH 1 INCREMENT BY 1 NOCACHE;

--------------------------------------------------------------------------------
-- 3. INDICES
--------------------------------------------------------------------------------
CREATE INDEX IX_CLIENTES_NOMBRE_APELLIDO ON CLIENTES (NOMBRE, APELLIDO);
CREATE INDEX IX_VENTAS_FECHA             ON VENTAS (FECHA_VENTA);
CREATE INDEX IX_VENTAS_CLIENTE_FECHA     ON VENTAS (ID_CLIENTE, FECHA_VENTA);
CREATE INDEX IX_DETALLE_VENTA_VENTA      ON DETALLE_VENTA (ID_VENTA);
CREATE INDEX IX_DETALLE_VENTA_PRODUCTO   ON DETALLE_VENTA (ID_PRODUCTO);
CREATE INDEX IX_AUDITORIA_CLIENTE        ON AUDITORIA_CLIENTES (ID_CLIENTE);
CREATE INDEX IX_AUDITORIA_VENTAS_VENTA   ON AUDITORIA_VENTAS (ID_VENTA);

--------------------------------------------------------------------------------
-- 4. PAQUETE DE CONTEXTO (usado por el trigger BEFORE DELETE de VENTAS para
--    saber que usuario de la aplicacion esta ejecutando la eliminacion)
--------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE PKG_CONTEXTO_AUDITORIA AS
    g_id_usuario_accion NUMBER;
END PKG_CONTEXTO_AUDITORIA;
/

--------------------------------------------------------------------------------
-- 5. DML - DATOS DE PRUEBA
--------------------------------------------------------------------------------

-- Usuario administrador de prueba: username = admin / password = Admin123
INSERT INTO USUARIOS (ID_USUARIO, USERNAME, PASSWORD_HASH, NOMBRE_COMPLETO, ACTIVO, ROL)
VALUES (SEQ_USUARIOS.NEXTVAL, 'admin',
        STANDARD_HASH('Admin123', 'SHA256'), 'Administrador del Sistema', 1, 'ADMIN');

INSERT INTO CLIENTES (ID_CLIENTE, NOMBRE, APELLIDO, EMAIL, TELEFONO, DIRECCION)
VALUES (SEQ_CLIENTES.NEXTVAL, 'Maria', 'Perez', 'maria.perez@correo.com', '0991234567', 'Quito, Ecuador');

INSERT INTO CLIENTES (ID_CLIENTE, NOMBRE, APELLIDO, EMAIL, TELEFONO, DIRECCION)
VALUES (SEQ_CLIENTES.NEXTVAL, 'Carlos', 'Suarez', 'carlos.suarez@correo.com', '0987654321', 'Sangolqui, Ecuador');

INSERT INTO CLIENTES (ID_CLIENTE, NOMBRE, APELLIDO, EMAIL, TELEFONO, DIRECCION)
VALUES (SEQ_CLIENTES.NEXTVAL, 'Lucia', 'Ramirez', 'lucia.ramirez@correo.com', '0978889900', 'Ambato, Ecuador');

INSERT INTO PRODUCTOS (ID_PRODUCTO, NOMBRE, DESCRIPCION, PRECIO, STOCK)
VALUES (SEQ_PRODUCTOS.NEXTVAL, 'Teclado Mecanico', 'Teclado mecanico retroiluminado', 45.99, 30);

INSERT INTO PRODUCTOS (ID_PRODUCTO, NOMBRE, DESCRIPCION, PRECIO, STOCK)
VALUES (SEQ_PRODUCTOS.NEXTVAL, 'Mouse Inalambrico', 'Mouse ergonomico inalambrico', 19.50, 50);

INSERT INTO PRODUCTOS (ID_PRODUCTO, NOMBRE, DESCRIPCION, PRECIO, STOCK)
VALUES (SEQ_PRODUCTOS.NEXTVAL, 'Monitor 24 pulgadas', 'Monitor Full HD 24"', 159.00, 15);

COMMIT;

-- Ventas de ejemplo, vendidas por el usuario admin (para poblar reportes y
-- dejar evidencia de la auditoria de ventas desde el primer momento)
DECLARE
    v_id_admin  NUMBER;
    v_id_venta  NUMBER;
BEGIN
    SELECT ID_USUARIO INTO v_id_admin FROM USUARIOS WHERE USERNAME = 'admin';

    v_id_venta := SEQ_VENTAS.NEXTVAL;
    INSERT INTO VENTAS (ID_VENTA, ID_CLIENTE, ID_USUARIO_VENDEDOR, FECHA_VENTA, TOTAL)
    VALUES (v_id_venta, 1, v_id_admin, SYSDATE - 10, 0);

    INSERT INTO DETALLE_VENTA (ID_DETALLE, ID_VENTA, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL)
    VALUES (SEQ_DETALLE_VENTA.NEXTVAL, v_id_venta, 1, 2, 45.99, 91.98);

    UPDATE VENTAS SET TOTAL = 91.98 WHERE ID_VENTA = v_id_venta;

    v_id_venta := SEQ_VENTAS.NEXTVAL;
    INSERT INTO VENTAS (ID_VENTA, ID_CLIENTE, ID_USUARIO_VENDEDOR, FECHA_VENTA, TOTAL)
    VALUES (v_id_venta, 2, v_id_admin, SYSDATE - 3, 0);

    INSERT INTO DETALLE_VENTA (ID_DETALLE, ID_VENTA, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL)
    VALUES (SEQ_DETALLE_VENTA.NEXTVAL, v_id_venta, 3, 1, 159.00, 159.00);

    UPDATE VENTAS SET TOTAL = 159.00 WHERE ID_VENTA = v_id_venta;

    COMMIT;
END;
/

--------------------------------------------------------------------------------
-- 6. VISTAS (reportes de solo lectura)
--------------------------------------------------------------------------------
CREATE OR REPLACE VIEW VW_VENTAS_TOTALES_CLIENTE AS
SELECT c.ID_CLIENTE,
       c.NOMBRE,
       c.APELLIDO,
       c.EMAIL,
       COUNT(v.ID_VENTA)            AS NUMERO_VENTAS,
       NVL(SUM(v.TOTAL), 0)         AS TOTAL_COMPRADO
FROM CLIENTES c
LEFT JOIN VENTAS v ON v.ID_CLIENTE = c.ID_CLIENTE
GROUP BY c.ID_CLIENTE, c.NOMBRE, c.APELLIDO, c.EMAIL;

CREATE OR REPLACE VIEW VW_REPORTE_VENTAS_DETALLADO AS
SELECT v.ID_VENTA,
       v.FECHA_VENTA,
       c.ID_CLIENTE,
       c.NOMBRE || ' ' || c.APELLIDO   AS CLIENTE,
       p.ID_PRODUCTO,
       p.NOMBRE                        AS PRODUCTO,
       d.CANTIDAD,
       d.PRECIO_UNITARIO,
       d.SUBTOTAL,
       v.TOTAL                         AS TOTAL_VENTA
FROM VENTAS v
JOIN CLIENTES c        ON c.ID_CLIENTE  = v.ID_CLIENTE
JOIN DETALLE_VENTA d   ON d.ID_VENTA    = v.ID_VENTA
JOIN PRODUCTOS p       ON p.ID_PRODUCTO = d.ID_PRODUCTO;

CREATE OR REPLACE VIEW VW_CLIENTES_ACTIVOS AS
SELECT ID_CLIENTE, NOMBRE, APELLIDO, EMAIL, TELEFONO, DIRECCION, FECHA_CREACION
FROM CLIENTES
WHERE ACTIVO = 1;

--------------------------------------------------------------------------------
-- 7. PROCEDIMIENTOS ALMACENADOS
--------------------------------------------------------------------------------

-- 7.1 Login (devuelve tambien el rol del usuario)
CREATE OR REPLACE PROCEDURE SP_LOGIN (
    p_username     IN  VARCHAR2,
    p_password     IN  VARCHAR2,
    o_estado       OUT VARCHAR2,   -- 'OK', 'CREDENCIALES_INVALIDAS', 'INACTIVO'
    o_id_usuario   OUT NUMBER,
    o_nombre       OUT VARCHAR2,
    o_rol          OUT VARCHAR2
) AS
    v_hash          VARCHAR2(256);
    v_hash_input    VARCHAR2(256);
    v_activo        NUMBER;
    v_id            NUMBER;
    v_nombre        VARCHAR2(150);
    v_rol           VARCHAR2(20);
BEGIN
    SELECT PASSWORD_HASH, ACTIVO, ID_USUARIO, NOMBRE_COMPLETO, ROL
      INTO v_hash, v_activo, v_id, v_nombre, v_rol
      FROM USUARIOS
     WHERE UPPER(USERNAME) = UPPER(p_username);

    -- STANDARD_HASH es una funcion "solo SQL": PL/SQL no permite invocarla
    -- directamente como expresion (IF/:=), por eso se resuelve primero con
    -- un SELECT ... INTO ... FROM DUAL y luego se compara la variable.
    SELECT STANDARD_HASH(p_password, 'SHA256') INTO v_hash_input FROM DUAL;

    IF v_hash != v_hash_input THEN
        o_estado := 'CREDENCIALES_INVALIDAS';
        o_id_usuario := NULL; o_nombre := NULL; o_rol := NULL;
    ELSIF v_activo = 0 THEN
        o_estado := 'INACTIVO';
        o_id_usuario := NULL; o_nombre := NULL; o_rol := NULL;
    ELSE
        o_estado := 'OK';
        o_id_usuario := v_id;
        o_nombre := v_nombre;
        o_rol := v_rol;
    END IF;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        o_estado := 'CREDENCIALES_INVALIDAS';
        o_id_usuario := NULL; o_nombre := NULL; o_rol := NULL;
END SP_LOGIN;
/

-- 7.2 Registro de usuario (SIEMPRE crea con ROL = 'USUARIO')
CREATE OR REPLACE PROCEDURE SP_REGISTRO_USUARIO (
    p_username    IN  VARCHAR2,
    p_password    IN  VARCHAR2,
    p_nombre      IN  VARCHAR2,
    o_estado      OUT VARCHAR2
) AS
    v_existe      NUMBER;
    v_hash_input  VARCHAR2(256);
BEGIN
    SELECT COUNT(*) INTO v_existe FROM USUARIOS WHERE UPPER(USERNAME) = UPPER(p_username);

    IF v_existe > 0 THEN
        o_estado := 'USUARIO_DUPLICADO';
        RETURN;
    END IF;

    SELECT STANDARD_HASH(p_password, 'SHA256') INTO v_hash_input FROM DUAL;

    INSERT INTO USUARIOS (ID_USUARIO, USERNAME, PASSWORD_HASH, NOMBRE_COMPLETO, ACTIVO, ROL)
    VALUES (SEQ_USUARIOS.NEXTVAL, p_username, v_hash_input, p_nombre, 1, 'USUARIO');

    COMMIT;
    o_estado := 'OK';
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        o_estado := 'ERROR: ' || SQLERRM;
END SP_REGISTRO_USUARIO;
/

-- 7.3 Administracion de usuarios (uso pensado solo para un ADMIN)
CREATE OR REPLACE PROCEDURE SP_USUARIO_SELECT_ALL (
    o_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN o_cursor FOR
        SELECT ID_USUARIO, USERNAME, NOMBRE_COMPLETO, ROL, ACTIVO, FECHA_REGISTRO
          FROM USUARIOS
         ORDER BY ID_USUARIO;
END SP_USUARIO_SELECT_ALL;
/

CREATE OR REPLACE PROCEDURE SP_USUARIO_CAMBIAR_ROL (
    p_id_usuario  IN  NUMBER,
    p_nuevo_rol   IN  VARCHAR2,
    o_estado      OUT VARCHAR2
) AS
BEGIN
    IF UPPER(p_nuevo_rol) NOT IN ('ADMIN', 'USUARIO') THEN
        o_estado := 'ROL_INVALIDO';
        RETURN;
    END IF;

    UPDATE USUARIOS SET ROL = UPPER(p_nuevo_rol) WHERE ID_USUARIO = p_id_usuario;

    IF SQL%ROWCOUNT = 0 THEN
        o_estado := 'NO_ENCONTRADO';
    ELSE
        COMMIT;
        o_estado := 'OK';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        o_estado := 'ERROR: ' || SQLERRM;
END SP_USUARIO_CAMBIAR_ROL;
/

CREATE OR REPLACE PROCEDURE SP_USUARIO_CAMBIAR_ESTADO (
    p_id_usuario  IN  NUMBER,
    p_activo      IN  NUMBER,
    o_estado      OUT VARCHAR2
) AS
BEGIN
    IF p_activo NOT IN (0,1) THEN
        o_estado := 'VALOR_INVALIDO';
        RETURN;
    END IF;

    UPDATE USUARIOS SET ACTIVO = p_activo WHERE ID_USUARIO = p_id_usuario;

    IF SQL%ROWCOUNT = 0 THEN
        o_estado := 'NO_ENCONTRADO';
    ELSE
        COMMIT;
        o_estado := 'OK';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        o_estado := 'ERROR: ' || SQLERRM;
END SP_USUARIO_CAMBIAR_ESTADO;
/

-- 7.4 Ventas totales por cliente
CREATE OR REPLACE PROCEDURE SP_VENTAS_TOTALES_CLIENTE (
    p_id_cliente   IN  NUMBER,
    o_total        OUT NUMBER,
    o_num_ventas   OUT NUMBER
) AS
BEGIN
    SELECT NVL(SUM(TOTAL), 0), COUNT(*)
      INTO o_total, o_num_ventas
      FROM VENTAS
     WHERE ID_CLIENTE = p_id_cliente;
END SP_VENTAS_TOTALES_CLIENTE;
/

-- 7.5 Ventas por rango de fechas
CREATE OR REPLACE PROCEDURE SP_VENTAS_RANGO_FECHAS (
    p_fecha_inicio  IN  DATE,
    p_fecha_fin     IN  DATE,
    o_cursor        OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN o_cursor FOR
        SELECT v.ID_VENTA, v.FECHA_VENTA, c.NOMBRE || ' ' || c.APELLIDO AS CLIENTE, v.TOTAL
          FROM VENTAS v
          JOIN CLIENTES c ON c.ID_CLIENTE = v.ID_CLIENTE
         WHERE TRUNC(v.FECHA_VENTA) BETWEEN TRUNC(p_fecha_inicio) AND TRUNC(p_fecha_fin)
         ORDER BY v.FECHA_VENTA;
END SP_VENTAS_RANGO_FECHAS;
/

-- 7.6 CRUD de CLIENTES mediante procedimientos almacenados
CREATE OR REPLACE PROCEDURE SP_CLIENTE_INSERT (
    p_nombre      IN  VARCHAR2,
    p_apellido    IN  VARCHAR2,
    p_email       IN  VARCHAR2,
    p_telefono    IN  VARCHAR2,
    p_direccion   IN  VARCHAR2,
    o_id_cliente  OUT NUMBER,
    o_estado      OUT VARCHAR2
) AS
BEGIN
    o_id_cliente := SEQ_CLIENTES.NEXTVAL;
    INSERT INTO CLIENTES (ID_CLIENTE, NOMBRE, APELLIDO, EMAIL, TELEFONO, DIRECCION)
    VALUES (o_id_cliente, p_nombre, p_apellido, p_email, p_telefono, p_direccion);
    COMMIT;
    o_estado := 'OK';
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        o_estado := 'ERROR: ' || SQLERRM;
END SP_CLIENTE_INSERT;
/

CREATE OR REPLACE PROCEDURE SP_CLIENTE_UPDATE (
    p_id_cliente  IN  NUMBER,
    p_nombre      IN  VARCHAR2,
    p_apellido    IN  VARCHAR2,
    p_email       IN  VARCHAR2,
    p_telefono    IN  VARCHAR2,
    p_direccion   IN  VARCHAR2,
    o_estado      OUT VARCHAR2
) AS
BEGIN
    UPDATE CLIENTES
       SET NOMBRE = p_nombre,
           APELLIDO = p_apellido,
           EMAIL = p_email,
           TELEFONO = p_telefono,
           DIRECCION = p_direccion
     WHERE ID_CLIENTE = p_id_cliente;

    IF SQL%ROWCOUNT = 0 THEN
        o_estado := 'NO_ENCONTRADO';
    ELSE
        COMMIT;
        o_estado := 'OK';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        o_estado := 'ERROR: ' || SQLERRM;
END SP_CLIENTE_UPDATE;
/

CREATE OR REPLACE PROCEDURE SP_CLIENTE_DELETE (
    p_id_cliente  IN  NUMBER,
    o_estado      OUT VARCHAR2
) AS
BEGIN
    DELETE FROM CLIENTES WHERE ID_CLIENTE = p_id_cliente;
    COMMIT;
    o_estado := 'OK';
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        o_estado := 'ERROR: ' || SQLERRM;
END SP_CLIENTE_DELETE;
/

CREATE OR REPLACE PROCEDURE SP_CLIENTE_CAMBIAR_ESTADO (
    p_id_cliente  IN  NUMBER,
    p_activo      IN  NUMBER,
    o_estado      OUT VARCHAR2
) AS
BEGIN
    IF p_activo NOT IN (0,1) THEN
        o_estado := 'VALOR_INVALIDO';
        RETURN;
    END IF;

    UPDATE CLIENTES SET ACTIVO = p_activo WHERE ID_CLIENTE = p_id_cliente;

    IF SQL%ROWCOUNT = 0 THEN
        o_estado := 'NO_ENCONTRADO';
    ELSE
        COMMIT;
        o_estado := 'OK';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        o_estado := 'ERROR: ' || SQLERRM;
END SP_CLIENTE_CAMBIAR_ESTADO;
/

CREATE OR REPLACE PROCEDURE SP_CLIENTE_SELECT_ALL (
    o_cursor  OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN o_cursor FOR
        SELECT ID_CLIENTE, NOMBRE, APELLIDO, EMAIL, TELEFONO, DIRECCION,
               ACTIVO, FECHA_CREACION, FECHA_MODIFICACION
          FROM CLIENTES
         ORDER BY ID_CLIENTE;
END SP_CLIENTE_SELECT_ALL;
/

CREATE OR REPLACE PROCEDURE SP_CLIENTE_SELECT_BY_ID (
    p_id_cliente IN  NUMBER,
    o_cursor     OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN o_cursor FOR
        SELECT ID_CLIENTE, NOMBRE, APELLIDO, EMAIL, TELEFONO, DIRECCION,
               ACTIVO, FECHA_CREACION, FECHA_MODIFICACION
          FROM CLIENTES
         WHERE ID_CLIENTE = p_id_cliente;
END SP_CLIENTE_SELECT_BY_ID;
/

-- 7.7 CRUD de PRODUCTOS
CREATE OR REPLACE PROCEDURE SP_PRODUCTO_INSERT (
    p_nombre        IN  VARCHAR2,
    p_descripcion   IN  VARCHAR2,
    p_precio        IN  NUMBER,
    p_stock         IN  NUMBER,
    o_id_producto   OUT NUMBER,
    o_estado        OUT VARCHAR2
) AS
BEGIN
    o_id_producto := SEQ_PRODUCTOS.NEXTVAL;
    INSERT INTO PRODUCTOS (ID_PRODUCTO, NOMBRE, DESCRIPCION, PRECIO, STOCK)
    VALUES (o_id_producto, p_nombre, p_descripcion, p_precio, NVL(p_stock, 0));
    COMMIT;
    o_estado := 'OK';
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        o_estado := 'ERROR: ' || SQLERRM;
END SP_PRODUCTO_INSERT;
/

CREATE OR REPLACE PROCEDURE SP_PRODUCTO_UPDATE (
    p_id_producto   IN  NUMBER,
    p_nombre        IN  VARCHAR2,
    p_descripcion   IN  VARCHAR2,
    p_precio        IN  NUMBER,
    p_stock         IN  NUMBER,
    o_estado        OUT VARCHAR2
) AS
BEGIN
    IF TRIM(p_nombre) IS NULL THEN
        o_estado := 'ERROR: El nombre del producto es obligatorio.';
        RETURN;
    END IF;
    IF p_precio IS NULL OR p_precio < 0 THEN
        o_estado := 'ERROR: El precio no puede ser negativo.';
        RETURN;
    END IF;

    UPDATE PRODUCTOS
       SET NOMBRE = p_nombre,
           DESCRIPCION = p_descripcion,
           PRECIO = p_precio,
           STOCK = NVL(p_stock, 0)
     WHERE ID_PRODUCTO = p_id_producto;

    IF SQL%ROWCOUNT = 0 THEN
        o_estado := 'NO_ENCONTRADO';
    ELSE
        COMMIT;
        o_estado := 'OK';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        o_estado := 'ERROR: ' || SQLERRM;
END SP_PRODUCTO_UPDATE;
/

CREATE OR REPLACE PROCEDURE SP_PRODUCTO_DELETE (
    p_id_producto  IN  NUMBER,
    o_estado       OUT VARCHAR2
) AS
BEGIN
    DELETE FROM PRODUCTOS WHERE ID_PRODUCTO = p_id_producto;
    COMMIT;
    o_estado := 'OK';
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        IF SQLCODE = -2292 THEN
            o_estado := 'ERROR: No se puede eliminar el producto porque ya tiene ventas registradas.';
        ELSE
            o_estado := 'ERROR: ' || SQLERRM;
        END IF;
END SP_PRODUCTO_DELETE;
/

CREATE OR REPLACE PROCEDURE SP_PRODUCTO_SELECT_ALL (
    o_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN o_cursor FOR
        SELECT ID_PRODUCTO, NOMBRE, DESCRIPCION, PRECIO, STOCK,
               FECHA_CREACION, FECHA_MODIFICACION
          FROM PRODUCTOS
         ORDER BY ID_PRODUCTO;
END SP_PRODUCTO_SELECT_ALL;
/

CREATE OR REPLACE PROCEDURE SP_PRODUCTO_SELECT_BY_ID (
    p_id_producto  IN  NUMBER,
    o_cursor       OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN o_cursor FOR
        SELECT ID_PRODUCTO, NOMBRE, DESCRIPCION, PRECIO, STOCK,
               FECHA_CREACION, FECHA_MODIFICACION
          FROM PRODUCTOS
         WHERE ID_PRODUCTO = p_id_producto;
END SP_PRODUCTO_SELECT_BY_ID;
/

-- 7.8 Registro de Ventas (encabezado + lineas, con control de stock)
CREATE OR REPLACE PROCEDURE SP_VENTA_INSERT_ENCABEZADO (
    p_id_cliente            IN  NUMBER,
    p_id_usuario_vendedor   IN  NUMBER,
    o_id_venta              OUT NUMBER,
    o_estado                OUT VARCHAR2
) AS
    v_activo NUMBER;
BEGIN
    SELECT ACTIVO INTO v_activo FROM CLIENTES WHERE ID_CLIENTE = p_id_cliente;

    IF v_activo = 0 THEN
        o_estado := 'ERROR: El cliente esta inactivo y no puede recibir nuevas ventas.';
        RETURN;
    END IF;

    o_id_venta := SEQ_VENTAS.NEXTVAL;
    INSERT INTO VENTAS (ID_VENTA, ID_CLIENTE, FECHA_VENTA, TOTAL, ID_USUARIO_VENDEDOR)
    VALUES (o_id_venta, p_id_cliente, SYSDATE, 0, p_id_usuario_vendedor);
    COMMIT;
    o_estado := 'OK';
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        o_estado := 'ERROR: El cliente indicado no existe.';
    WHEN OTHERS THEN
        ROLLBACK;
        o_estado := 'ERROR: ' || SQLERRM;
END SP_VENTA_INSERT_ENCABEZADO;
/

CREATE OR REPLACE PROCEDURE SP_VENTA_DETALLE_INSERT (
    p_id_venta     IN  NUMBER,
    p_id_producto  IN  NUMBER,
    p_cantidad     IN  NUMBER,
    o_estado       OUT VARCHAR2
) AS
    v_precio    NUMBER;
    v_stock     NUMBER;
    v_subtotal  NUMBER;
BEGIN
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        o_estado := 'ERROR: La cantidad debe ser mayor a cero.';
        RETURN;
    END IF;

    SELECT PRECIO, STOCK INTO v_precio, v_stock
      FROM PRODUCTOS WHERE ID_PRODUCTO = p_id_producto
      FOR UPDATE;

    IF v_stock < p_cantidad THEN
        o_estado := 'ERROR: Stock insuficiente (disponible: ' || v_stock || ').';
        RETURN;
    END IF;

    v_subtotal := v_precio * p_cantidad;

    INSERT INTO DETALLE_VENTA (ID_DETALLE, ID_VENTA, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL)
    VALUES (SEQ_DETALLE_VENTA.NEXTVAL, p_id_venta, p_id_producto, p_cantidad, v_precio, v_subtotal);

    UPDATE PRODUCTOS SET STOCK = STOCK - p_cantidad WHERE ID_PRODUCTO = p_id_producto;

    UPDATE VENTAS SET TOTAL = TOTAL + v_subtotal WHERE ID_VENTA = p_id_venta;

    COMMIT;
    o_estado := 'OK';
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        ROLLBACK;
        o_estado := 'ERROR: El producto indicado no existe.';
    WHEN OTHERS THEN
        ROLLBACK;
        o_estado := 'ERROR: ' || SQLERRM;
END SP_VENTA_DETALLE_INSERT;
/

CREATE OR REPLACE PROCEDURE SP_VENTA_SELECT_ALL (
    o_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN o_cursor FOR
        SELECT v.ID_VENTA, v.FECHA_VENTA, v.ID_CLIENTE,
               c.NOMBRE || ' ' || c.APELLIDO AS CLIENTE, v.TOTAL
          FROM VENTAS v
          JOIN CLIENTES c ON c.ID_CLIENTE = v.ID_CLIENTE
         ORDER BY v.ID_VENTA DESC;
END SP_VENTA_SELECT_ALL;
/

CREATE OR REPLACE PROCEDURE SP_VENTA_SELECT_DETALLE (
    p_id_venta  IN  NUMBER,
    o_cursor    OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN o_cursor FOR
        SELECT d.ID_DETALLE, p.NOMBRE AS PRODUCTO, d.CANTIDAD,
               d.PRECIO_UNITARIO, d.SUBTOTAL
          FROM DETALLE_VENTA d
          JOIN PRODUCTOS p ON p.ID_PRODUCTO = d.ID_PRODUCTO
         WHERE d.ID_VENTA = p_id_venta
         ORDER BY d.ID_DETALLE;
END SP_VENTA_SELECT_DETALLE;
/

CREATE OR REPLACE PROCEDURE SP_VENTA_DELETE (
    p_id_venta            IN  NUMBER,
    p_id_usuario_elimina  IN  NUMBER,
    o_estado              OUT VARCHAR2
) AS
BEGIN
    -- Deja el id de quien elimina disponible para el trigger BEFORE DELETE
    PKG_CONTEXTO_AUDITORIA.g_id_usuario_accion := p_id_usuario_elimina;

    FOR r IN (SELECT ID_PRODUCTO, CANTIDAD FROM DETALLE_VENTA WHERE ID_VENTA = p_id_venta) LOOP
        UPDATE PRODUCTOS SET STOCK = STOCK + r.CANTIDAD WHERE ID_PRODUCTO = r.ID_PRODUCTO;
    END LOOP;

    DELETE FROM DETALLE_VENTA WHERE ID_VENTA = p_id_venta;
    DELETE FROM VENTAS WHERE ID_VENTA = p_id_venta;

    IF SQL%ROWCOUNT = 0 THEN
        o_estado := 'NO_ENCONTRADO';
        ROLLBACK;
    ELSE
        COMMIT;
        o_estado := 'OK';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        o_estado := 'ERROR: ' || SQLERRM;
END SP_VENTA_DELETE;
/

--------------------------------------------------------------------------------
-- 8. TRIGGERS
--------------------------------------------------------------------------------

-- 8.1 CLIENTES: BEFORE INSERT -> validacion de datos
CREATE OR REPLACE TRIGGER TRG_CLIENTES_BI
BEFORE INSERT ON CLIENTES
FOR EACH ROW
BEGIN
    IF :NEW.EMAIL IS NULL OR INSTR(:NEW.EMAIL, '@') = 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'El email del cliente no tiene un formato valido.');
    END IF;

    IF TRIM(:NEW.NOMBRE) IS NULL OR TRIM(:NEW.APELLIDO) IS NULL THEN
        RAISE_APPLICATION_ERROR(-20002, 'El nombre y el apellido del cliente son obligatorios.');
    END IF;

    :NEW.EMAIL := LOWER(:NEW.EMAIL);
    :NEW.FECHA_CREACION := SYSDATE;
END TRG_CLIENTES_BI;
/

-- 8.2 CLIENTES: AFTER UPDATE -> auditoria de cambios
CREATE OR REPLACE TRIGGER TRG_CLIENTES_AU
AFTER UPDATE ON CLIENTES
FOR EACH ROW
BEGIN
    IF :OLD.NOMBRE != :NEW.NOMBRE THEN
        INSERT INTO AUDITORIA_CLIENTES (ID_AUDITORIA, ID_CLIENTE, CAMPO_MODIFICADO, VALOR_ANTERIOR, VALOR_NUEVO)
        VALUES (SEQ_AUDITORIA.NEXTVAL, :NEW.ID_CLIENTE, 'NOMBRE', :OLD.NOMBRE, :NEW.NOMBRE);
    END IF;

    IF :OLD.APELLIDO != :NEW.APELLIDO THEN
        INSERT INTO AUDITORIA_CLIENTES (ID_AUDITORIA, ID_CLIENTE, CAMPO_MODIFICADO, VALOR_ANTERIOR, VALOR_NUEVO)
        VALUES (SEQ_AUDITORIA.NEXTVAL, :NEW.ID_CLIENTE, 'APELLIDO', :OLD.APELLIDO, :NEW.APELLIDO);
    END IF;

    IF :OLD.EMAIL != :NEW.EMAIL THEN
        INSERT INTO AUDITORIA_CLIENTES (ID_AUDITORIA, ID_CLIENTE, CAMPO_MODIFICADO, VALOR_ANTERIOR, VALOR_NUEVO)
        VALUES (SEQ_AUDITORIA.NEXTVAL, :NEW.ID_CLIENTE, 'EMAIL', :OLD.EMAIL, :NEW.EMAIL);
    END IF;

    IF NVL(:OLD.TELEFONO,'-') != NVL(:NEW.TELEFONO,'-') THEN
        INSERT INTO AUDITORIA_CLIENTES (ID_AUDITORIA, ID_CLIENTE, CAMPO_MODIFICADO, VALOR_ANTERIOR, VALOR_NUEVO)
        VALUES (SEQ_AUDITORIA.NEXTVAL, :NEW.ID_CLIENTE, 'TELEFONO', :OLD.TELEFONO, :NEW.TELEFONO);
    END IF;

    IF NVL(:OLD.DIRECCION,'-') != NVL(:NEW.DIRECCION,'-') THEN
        INSERT INTO AUDITORIA_CLIENTES (ID_AUDITORIA, ID_CLIENTE, CAMPO_MODIFICADO, VALOR_ANTERIOR, VALOR_NUEVO)
        VALUES (SEQ_AUDITORIA.NEXTVAL, :NEW.ID_CLIENTE, 'DIRECCION', :OLD.DIRECCION, :NEW.DIRECCION);
    END IF;

    IF NVL(:OLD.ACTIVO,-1) != NVL(:NEW.ACTIVO,-1) THEN
        INSERT INTO AUDITORIA_CLIENTES (ID_AUDITORIA, ID_CLIENTE, CAMPO_MODIFICADO, VALOR_ANTERIOR, VALOR_NUEVO)
        VALUES (SEQ_AUDITORIA.NEXTVAL, :NEW.ID_CLIENTE, 'ACTIVO', :OLD.ACTIVO, :NEW.ACTIVO);
    END IF;
END TRG_CLIENTES_AU;
/

-- 8.3 CLIENTES: BEFORE UPDATE -> actualiza automaticamente FECHA_MODIFICACION
CREATE OR REPLACE TRIGGER TRG_CLIENTES_BU_FECHA
BEFORE UPDATE ON CLIENTES
FOR EACH ROW
BEGIN
    :NEW.FECHA_MODIFICACION := SYSDATE;
END TRG_CLIENTES_BU_FECHA;
/

-- 8.4 CLIENTES: BEFORE DELETE -> restriccion por relaciones (ventas asociadas)
CREATE OR REPLACE TRIGGER TRG_CLIENTES_BD
BEFORE DELETE ON CLIENTES
FOR EACH ROW
DECLARE
    v_num_ventas NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_num_ventas FROM VENTAS WHERE ID_CLIENTE = :OLD.ID_CLIENTE;

    IF v_num_ventas > 0 THEN
        RAISE_APPLICATION_ERROR(-20003,
            'No se puede eliminar el cliente ' || :OLD.ID_CLIENTE ||
            ': tiene ' || v_num_ventas || ' venta(s) asociada(s).');
    END IF;
END TRG_CLIENTES_BD;
/

-- 8.5 PRODUCTOS: BEFORE INSERT -> validacion de datos
CREATE OR REPLACE TRIGGER TRG_PRODUCTOS_BI
BEFORE INSERT ON PRODUCTOS
FOR EACH ROW
BEGIN
    IF TRIM(:NEW.NOMBRE) IS NULL THEN
        RAISE_APPLICATION_ERROR(-20010, 'El nombre del producto es obligatorio.');
    END IF;

    IF :NEW.PRECIO IS NULL OR :NEW.PRECIO < 0 THEN
        RAISE_APPLICATION_ERROR(-20011, 'El precio del producto no puede ser negativo.');
    END IF;

    IF :NEW.STOCK IS NULL OR :NEW.STOCK < 0 THEN
        :NEW.STOCK := 0;
    END IF;

    :NEW.FECHA_CREACION := SYSDATE;
END TRG_PRODUCTOS_BI;
/

-- 8.6 PRODUCTOS: BEFORE DELETE -> restriccion por relaciones (mismo patron que CLIENTES)
CREATE OR REPLACE TRIGGER TRG_PRODUCTOS_BD
BEFORE DELETE ON PRODUCTOS
FOR EACH ROW
DECLARE
    v_num_ventas NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_num_ventas FROM DETALLE_VENTA WHERE ID_PRODUCTO = :OLD.ID_PRODUCTO;

    IF v_num_ventas > 0 THEN
        RAISE_APPLICATION_ERROR(-20012,
            'No se puede eliminar el producto ' || :OLD.ID_PRODUCTO ||
            ': tiene ' || v_num_ventas || ' venta(s) asociada(s).');
    END IF;
END TRG_PRODUCTOS_BD;
/

-- 8.7 PRODUCTOS: AFTER INSERT/UPDATE -> actualizacion automatica de fechas
-- Nota tecnica: un trigger AFTER no puede modificar directamente :NEW de la
-- misma fila (ORA-04091 tabla mutante). Se usa una transaccion autonoma que
-- hace un UPDATE independiente de la misma fila ya confirmada.
CREATE OR REPLACE TRIGGER TRG_PRODUCTOS_AU_FECHA
AFTER INSERT OR UPDATE ON PRODUCTOS
FOR EACH ROW
DECLARE
    PRAGMA AUTONOMOUS_TRANSACTION;
BEGIN
    UPDATE PRODUCTOS
       SET FECHA_MODIFICACION = SYSDATE
     WHERE ID_PRODUCTO = :NEW.ID_PRODUCTO;
    COMMIT;
END TRG_PRODUCTOS_AU_FECHA;
/

-- 8.8 VENTAS: AFTER INSERT -> auditoria de creacion (quien vendio)
CREATE OR REPLACE TRIGGER TRG_VENTAS_AI_AUDITORIA
AFTER INSERT ON VENTAS
FOR EACH ROW
BEGIN
    INSERT INTO AUDITORIA_VENTAS (
        ID_AUDITORIA, ID_VENTA, ACCION, ID_CLIENTE, TOTAL,
        ID_USUARIO_VENDEDOR, ID_USUARIO_ACCION
    ) VALUES (
        SEQ_AUDITORIA_VENTAS.NEXTVAL, :NEW.ID_VENTA, 'CREACION', :NEW.ID_CLIENTE, :NEW.TOTAL,
        :NEW.ID_USUARIO_VENDEDOR, :NEW.ID_USUARIO_VENDEDOR
    );
END TRG_VENTAS_AI_AUDITORIA;
/

-- 8.9 VENTAS: BEFORE DELETE -> auditoria de eliminacion (quien vendio y quien elimino)
CREATE OR REPLACE TRIGGER TRG_VENTAS_BD_AUDITORIA
BEFORE DELETE ON VENTAS
FOR EACH ROW
BEGIN
    INSERT INTO AUDITORIA_VENTAS (
        ID_AUDITORIA, ID_VENTA, ACCION, ID_CLIENTE, TOTAL,
        ID_USUARIO_VENDEDOR, ID_USUARIO_ACCION
    ) VALUES (
        SEQ_AUDITORIA_VENTAS.NEXTVAL, :OLD.ID_VENTA, 'ELIMINACION', :OLD.ID_CLIENTE, :OLD.TOTAL,
        :OLD.ID_USUARIO_VENDEDOR, PKG_CONTEXTO_AUDITORIA.g_id_usuario_accion
    );
END TRG_VENTAS_BD_AUDITORIA;
/

--------------------------------------------------------------------------------
-- 9. VERIFICACION RAPIDA (opcional, sirve como evidencia de ejecucion)
--------------------------------------------------------------------------------
-- SELECT OBJECT_NAME, OBJECT_TYPE, STATUS FROM USER_OBJECTS WHERE STATUS != 'VALID';
--
-- DECLARE
--   v_estado VARCHAR2(30); v_id NUMBER; v_nombre VARCHAR2(150); v_rol VARCHAR2(20);
-- BEGIN
--   SP_LOGIN('admin','Admin123', v_estado, v_id, v_nombre, v_rol);
--   DBMS_OUTPUT.PUT_LINE('Estado: '||v_estado||' Id: '||v_id||' Rol: '||v_rol);
-- END;
-- /
--
-- SELECT * FROM VW_VENTAS_TOTALES_CLIENTE;
-- SELECT * FROM AUDITORIA_VENTAS ORDER BY ID_AUDITORIA DESC;
--------------------------------------------------------------------------------
-- FIN DEL SCRIPT
--------------------------------------------------------------------------------