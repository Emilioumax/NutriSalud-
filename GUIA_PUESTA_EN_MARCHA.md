# Guía de puesta en marcha de NutriSalud+

Esta guía deja claro qué ya está preparado y qué pasos faltan para activar la app con tu proyecto de Supabase.

## Estado actual

- La página tiene una identidad visual renovada y conserva los flujos de paciente y consultorio.
- El acceso usa Supabase Auth: registro, inicio de sesión, confirmación de correo y recuperación de contraseña.
- La app guarda perfiles, mediciones, IMC y citas en Supabase; las consultas dependen de permisos RLS.
- La clave pública Publishable que compartiste está guardada en `.env.local`. Ese archivo está excluido de Git.
- La app está configurada con la URL y la clave pública del proyecto `pvsxoscfybljmvqejowg`; la referencia fue verificada desde la clave `anon` que compartiste.
- El esquema `supabase/schema.sql` ya se aplicó en el proyecto remoto. Supabase reconoce `profiles`, `measurements` y `appointments`; la API niega correctamente el acceso anónimo. Falta una prueba de inicio de sesión con una contraseña válida.
- `npm run build` terminó correctamente después de integrar la clave pública.

## A. Lo que debes hacer en Supabase

### 1. Confirma el proyecto correcto

La app usa el proyecto `pvsxoscfybljmvqejowg`. La URL y la clave pública `anon` deben seguir perteneciendo a ese proyecto.

No mezcles la URL de un proyecto con la clave pública de otro.

La clave que compartiste es pública y puede aparecer en el navegador. La clave **Secret** o `service_role` es distinta: no la pegues en la página, en `.env.local` ni en una variable que empiece por `VITE_`. Supabase recomienda usar una clave Publishable con RLS bien configurado; las claves Secret omiten esas políticas. [Documentación oficial de claves y seguridad](https://supabase.com/docs/guides/database/secure-data)

### 2. Comprueba si ya hay tablas con estos nombres

Antes de instalar el esquema, verifica en **Table Editor** si ya existen `profiles`, `measurements` o `appointments`.

- Si no existen, continúa al siguiente paso.
- Si existen o ya contienen pacientes, **no ejecutes el archivo todavía**. El script no borra tablas, pero nombres o columnas previas podrían entrar en conflicto. Conserva esos datos y solicita una revisión de migración antes de continuar.

### 3. Instala tablas y permisos

1. Abre **SQL Editor → New query**.
2. Abre `supabase/schema.sql` desde esta carpeta, copia todo su contenido y pégalo en la consulta nueva.
3. Ejecuta el script una vez y espera a que finalice sin errores.
4. En **Table Editor**, confirma que aparezcan `profiles`, `measurements` y `appointments`.
5. Revisa en cada tabla que Row Level Security (RLS) esté habilitado.

El esquema crea políticas para que los pacientes consulten su propio expediente y para que la cuenta confirmada del consultorio consulte los expedientes necesarios. El IMC y los valores recientes de peso/estatura se sincronizan desde las mediciones.

### 4. Configura el correo y las redirecciones

En **Authentication → Sign In / Providers → Email** (el nombre puede variar en el panel):

1. Permite el registro de usuarios por correo.
2. Mantén activada la confirmación de correo.
3. Para desarrollo local, agrega `http://127.0.0.1:5173` a **Redirect URLs**.
4. Si el panel pide una **Site URL**, usa también `http://127.0.0.1:5173` mientras desarrollas localmente.

El enlace para recuperar contraseña vuelve al origen de la página, así que cada origen que uses debe estar permitido en Redirect URLs. Al publicar la app, agrega allí el dominio de producción y cambia Site URL a ese dominio. [Configuración de URL de Auth](https://supabase.com/docs/guides/auth/redirect-urls)

Para una prueba inicial puedes usar el servicio de correo de Supabase. Para uso real, configura un proveedor SMTP propio: el envío predeterminado es limitado y de mejor esfuerzo. [Auth por correo y contraseñas](https://supabase.com/docs/guides/auth/passwords)

## B. Cómo arrancarla en tu computadora

La forma más sencilla es abrir `INICIAR_NUTRISALUD.bat` dentro de la carpeta del proyecto. Si es la primera vez en esa computadora, instalará dependencias; después iniciará la web y abrirá el navegador. Deja la ventana negra abierta mientras uses la página.

También puedes hacerlo manualmente desde PowerShell:

```powershell
cd "C:\Users\daniel\Desktop\NutriSalud+"
npm ci
npm run dev
```

La terminal mostrará una URL local. Con la configuración actual, abre:

```text
http://127.0.0.1:5173
```

No abras `index.html` directamente con doble clic; esta versión usa módulos y necesita que Vite la sirva. Si lo abres así, aparecerá un aviso con la instrucción de usar `INICIAR_NUTRISALUD.bat`.

`.env.local` ya contiene la URL de este proyecto y la clave pública. Si algún día lo tienes que rehacer, usa este formato, sin copiar una clave Secret:

```text
VITE_SUPABASE_URL=https://pvsxoscfybljmvqejowg.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA_PUBLISHABLE
```

Después de cambiar `.env.local`, detén el servidor (`Ctrl+C`) y vuelve a ejecutar `npm run dev`.

## C. Configura el acceso del consultorio

1. En la página, selecciona **Crear mi espacio**.
2. Registra la cuenta con `gustavo.godoy2357@alumnos.udg.mx` y una contraseña nueva de al menos 8 caracteres.
3. Abre el correo de confirmación y confirma la cuenta.
4. Vuelve a la página e inicia sesión. El esquema asigna el rol de consultorio a esa dirección confirmada.

Si esa dirección ya tiene una cuenta en **Supabase Auth**, no la vuelvas a crear: usa **¿Olvidaste tu contraseña?** para establecer una contraseña nueva. La antigua cuenta local con contraseña `admin` no se convierte ni se migra automáticamente.

Los pacientes pueden registrarse con su propio correo, confirmar la cuenta e iniciar sesión. Cada uno verá su propio perfil y sus mediciones; el consultorio verá los expedientes en su panel.

## D. Prueba antes de usarla

Haz la primera prueba únicamente con datos ficticios:

1. Crea y confirma una cuenta de prueba de paciente.
2. Inicia sesión y guarda un peso con estatura, y otra medición con presión sistólica y diastólica.
3. Revisa los indicadores, la tabla de historial y la gráfica de peso.
4. Solicita una cita para una fecha futura.
5. Cierra sesión e inicia con la cuenta del consultorio.
6. Busca al paciente, abre su expediente y confirma la cita.
7. Cierra la sesión del consultorio y vuelve al paciente; confirma que vea el mismo estado de cita.
8. Comprueba **¿Olvidaste tu contraseña?** con una cuenta de prueba.

Si aparece un error `relation does not exist` o `table not found`, el esquema no quedó instalado correctamente. Si aparece un error de permisos, confirma que RLS y el SQL terminaron de aplicarse y que estás usando la clave Publishable del proyecto correcto.

## E. Publicarla en Internet

1. Sube el proyecto al repositorio público de GitHub sin incluir `.env`, `.env.local`, `node_modules` ni `dist`; `.gitignore` ya excluye esos archivos.
2. GitHub Pages está configurado para publicar automáticamente cada actualización de `main` mediante `.github/workflows/deploy-pages.yml`.
3. En GitHub, configura **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. En **Settings → Secrets and variables → Actions → Variables**, define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores del proyecto `pvsxoscfybljmvqejowg`. La clave `anon`/Publishable es de cliente; nunca publiques una clave `Secret` ni `service_role`.
5. GitHub Pages publica en `https://emilioumax.github.io/NutriSalud-/`.
6. En **Supabase → Authentication → URL Configuration**, agrega `https://emilioumax.github.io/NutriSalud-/` a Redirect URLs y establécelo como Site URL.
7. Después de publicar, prueba confirmación de correo, acceso del paciente, panel del consultorio, citas y recuperación de contraseña.

Vite genera el sitio de producción en `dist/`; `npm run preview` permite previsualizar esa compilación localmente. [Guía oficial de publicación de Vite](https://vite.dev/guide/static-deploy.html)

## Límites y datos anteriores

- El esquema remoto ya está aplicado. No se completó un inicio de sesión autenticado: la contraseña de prueba escrita tenía menos de 8 caracteres y la app la rechazó localmente.
- Las cuentas, citas y mediciones que se guardaron en el navegador en la versión anterior no se trasladan a Supabase. No borres ese navegador ni su almacenamiento hasta decidir si necesitas conservar esos datos de demostración.
- Antes de cargar información real de pacientes, revisa el aviso de privacidad, consentimiento, retención de datos y controles operativos del consultorio con las personas responsables.
- La app organiza seguimiento y citas; no reemplaza la valoración ni las indicaciones de un profesional de salud.
