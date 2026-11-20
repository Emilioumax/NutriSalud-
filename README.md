# NutriSalud+

Portal de seguimiento nutricional y citas con perfiles de paciente y consultorio.

Consulta [`GUIA_PUESTA_EN_MARCHA.md`](GUIA_PUESTA_EN_MARCHA.md) para el esquema, autenticación y publicación.

## Inicio local

```powershell
npm ci
npm run dev
```

Abre la URL que indica Vite. Para compilar producción ejecuta `npm run build`; el resultado queda en `dist/`.

La configuración local de Supabase vive en `.env.local`, excluido de Git. Nunca publiques claves `Secret` o `service_role`. El cliente solo debe usar la clave pública `anon`/Publishable con RLS habilitado.