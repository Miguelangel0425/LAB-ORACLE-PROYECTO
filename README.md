# Sistema Web de Gestion Empresarial (Oracle + Node.js/Express)

Proyecto de la asignatura **Sistemas de Bases de Datos**. Implementa login,
registro, CRUD de clientes, consultas de ventas y reportes empresariales sobre
una base de datos Oracle, usando DDL, DML, vistas, procedimientos almacenados,
triggers e indices.

## Estructura del proyecto

```
proyecto/
├── sql/
│   └── schema.sql        # Script SQL completo (DDL, DML, vistas, procedimientos, triggers, indices)
├── backend/               # API REST en Node.js / Express
│   ├── server.js
│   ├── config/db.js       # Configuracion de conexion a Oracle (pool)
│   └── routes/            # auth, clientes, ventas, reportes
└── frontend/               # HTML, CSS y JS (servidos por Express)
    ├── login.html
    ├── register.html
    └── menu.html
```

## 1. Preparar la base de datos

1. Instalar y tener corriendo Oracle Database 21c XE.
2. Crear un usuario/esquema propio para el proyecto, por ejemplo:
   ```sql
   CREATE USER PROYECTO_BD IDENTIFIED BY tu_password;
   GRANT CONNECT, RESOURCE, CREATE VIEW, CREATE SEQUENCE, CREATE TRIGGER TO PROYECTO_BD;
   ALTER USER PROYECTO_BD QUOTA UNLIMITED ON USERS;
   ```
3. Conectarse con ese usuario (SQL*Plus, SQL Developer o similar) y ejecutar:
   ```sql
   @sql/schema.sql
   ```
   Esto crea tablas, secuencias, indices, vistas, procedimientos y triggers, y
   deja datos de prueba (incluyendo el usuario `admin` / contrasena `Admin123`).

## 2. Configurar y correr el backend

```bash
cd backend
npm install
```

Configura la conexion a la base de datos mediante variables de entorno (o
edita los valores por defecto en `config/db.js`):

```bash
set DB_USER=PROYECTO_BD
set DB_PASSWORD=tu_password
set DB_CONNECT_STRING=localhost:1521/XEPDB1
```

Luego inicia el servidor:

```bash
npm start
```

El servidor levanta en `http://localhost:3000` y sirve tanto la API
(`/api/...`) como el frontend estatico.

## 3. Usar la aplicacion

1. Abrir `http://localhost:3000` en el navegador (redirige a `login.html`).
2. Ingresar con `admin` / `Admin123`, o registrarse como nuevo usuario.
3. Desde el menu principal:
   - **Gestion de Clientes (CRUD):** crear, editar, listar y eliminar clientes.
   - **Consultas de Ventas:** ventas totales por cliente y ventas por rango de fechas.
   - **Reportes:** vistas de solo lectura (ventas totales por cliente, detalle de ventas, clientes activos).

## Notas tecnicas

- Las contrasenas se almacenan con `STANDARD_HASH(..., 'SHA256')` en Oracle;
  el mismo algoritmo se replica en el procedimiento de login para comparar
  hashes sin exponer la contrasena en texto plano. Para un entorno productivo
  se recomienda una funcion de hash con salting (ej. bcrypt) gestionada en el
  backend.
- El trigger `TRG_PRODUCTOS_AU_FECHA` usa `PRAGMA AUTONOMOUS_TRANSACTION`
  porque Oracle no permite modificar `:NEW` de la misma fila dentro de un
  trigger `AFTER` (evita el error de tabla mutante).
- Todas las operaciones de escritura pasan por procedimientos almacenados,
  nunca por SQL dinamico construido en el backend, cumpliendo el requerimiento
  de "CRUD mediante procedimientos".
