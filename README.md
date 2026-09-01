# Samlade Försäkringar

Försäkringshantering – en samlad översikt av försäkringar och skadeärenden.

- **Frontend:** React + TypeScript + Vite, Tailwind CSS (deploy: Vercel)
- **Backend:** Node.js + Express + Prisma + PostgreSQL (deploy: Railway)

## Struktur

```
Samladeforsakringar/
├── frontend/          React + TypeScript + Vite app
├── backend/           Express + Prisma API
├── docker-compose.yml Lokal PostgreSQL för utveckling
├── railway.json       Railway build/deploy-konfiguration för backend
└── nixpacks.toml      Nixpacks-inställningar för Railway
```

## Kom igång

### Förutsättningar

- Node.js 22.x
- Docker (för lokal PostgreSQL) eller en egen PostgreSQL-instans

### 1. Installera beroenden

```bash
npm install
```

Detta installerar beroenden för både `frontend` och `backend` via npm workspaces.

### 2. Starta en lokal databas

```bash
docker compose up -d
```

### 3. Konfigurera miljövariabler

Kopiera `.env.example` till `.env` i respektive mapp och fyll i värden:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**Viktigt:** Committa aldrig `.env`-filer med riktiga hemligheter. Endast `.env.example` ska ligga i versionshanteringen.

Sätt ett eget slumpmässigt värde för `JWT_SECRET` i `backend/.env` innan du kör mot en riktig databas.

### 4. Kör databasmigrationer

```bash
npm run prisma:migrate --workspace=backend
```

### 5. (Valfritt) Seeda en adminanvändare

```bash
npm run prisma:seed --workspace=backend
```

### 6. Starta utvecklingsservrarna

```bash
npm run dev
```

Detta startar backend på `http://localhost:4000` och frontend på `http://localhost:5173` samtidigt.

## Bygga för produktion

```bash
npm run build
```

## Deployment

### Backend (Railway)

- `railway.json` pekar på workspace-scriptet `build`/`start` för `backend`.
- Sätt miljövariablerna `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN` och `TRUST_PROXY=true` i Railways projektinställningar.
- `npm run start` kör `prisma migrate deploy` innan servern startar.

### Frontend (Vercel)

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Sätt `VITE_API_BASE_URL` till backendens publika URL (t.ex. `https://din-backend.up.railway.app/api`).

## Datamodell

Prisma-schemat (`backend/prisma/schema.prisma`) modellerar:

- **User** – autentisering, roller (`SystemRole`: `USER` / `ADMIN`)
- **InsurancePolicy** – försäkringar med typ (`PolicyType`), status (`PolicyStatus`) och betalningsfrekvens (`PaymentFrequency`)
- **Claim** – skadeärenden kopplade till en försäkring, med status (`ClaimStatus`)
- **Document** – uppladdade dokument kopplade till försäkring eller skadeärende
- **Notification**, **ActivityLog**, **AuditLog**, **PasswordReset**, **AuthEvent** – stödjande infrastruktur

## Säkerhet

- Lösenord hashas med bcrypt.
- Autentisering sker via JWT (`Authorization: Bearer <token>`).
- Inga API-nycklar eller hemligheter ska någonsin committas – använd `.env` (gitignorat) lokalt och plattformens miljövariabler i produktion.

### Kända beroende-sårbarheter (npm audit)

`npm audit` flaggade ursprungligen 7 sårbarheter (2 moderate, 4 high, 1 critical). Den moderata (`react-router`, öppen redirect / constructor injection) är åtgärdad genom att uppgradera `react-router-dom` till v7. Två kvarstår och kan **inte** åtgärdas med `npm audit fix`:

| Paket | Severity | Var det kommer ifrån | Varför det inte kan auto-fixas |
|---|---|---|---|
| `tar` | Critical | `bcrypt → @mapbox/node-pre-gyp`, som pinnar `tar` till `^6.1.11` | Den patchade versionen (7.5.22/8.0.2) ligger utanför det intervall `node-pre-gyp` tillåter. Fixen kräver att `node-pre-gyp` (uppströms, ej under vår kontroll) släpper en version som tillåter tar 7/8. |
| `deepmerge-ts` | High | `prisma → @prisma/config`, som pinnar `deepmerge-ts` till exakt `7.1.5` | Ingen range, exakt pin – kan bara lösas av en ny Prisma-release. Fixen finns för närvarande bara i Prisma 8 (release candidate, större/brytande uppgradering).

**Riskbedömning för MVP:** Båda paketen används endast under `npm install` (native-binär-hämtning för bcrypt respektive Prismas CLI-konfiguration) – de körs inte i produktionens request-path och exponeras inte mot internet. Risken bedöms som låg för en MVP, men bör monitoreras: kör `npm audit` regelbundet och uppgradera `prisma`/`bcrypt` så fort uppströmsprojekten släpper fixade versioner.
