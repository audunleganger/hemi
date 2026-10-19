# Hemi

A self-hosted migraine diary. Log attacks with severity readings over time, the medication you take, and how
well it worked. Hemi checks your doses against limits you set yourself per active ingredient, and warns before
you go over them. It has a web app and a small Kotlin server that keeps everything in one SQLite file; an Android
app comes later.

> Work in progress. What's here so far: accounts, administration and backups. The diary itself is being built;
> see `REQUIREMENTS.md` for the plan.

## Running it

### Docker

Each push to `main` is published as `ghcr.io/audunleganger/hemi:main` (the newest) and `sha-<commit>`. Version
tags will be published as `<version>` and `latest`.

```sh
docker run -d --name hemi -p 8080:8080 -v hemi-data:/data ghcr.io/audunleganger/hemi:main
```

Open http://localhost:8080. The first visit shows a setup screen that creates the administrator account. The
admin can add more users under **Admin**. Each user's diary is private: administrators manage accounts but can't
see anyone's health data.

With Docker Compose:

```yaml
services:
  hemi:
    image: ghcr.io/audunleganger/hemi:main
    ports:
      - "8080:8080"
    volumes:
      - data:/data
    restart: unless-stopped

volumes:
  data:
```

To build the image yourself instead, run `docker build -t hemi .` in a checkout. The image runs as a non-root
user. To use a host directory instead of a named volume (`./data:/data`), add `user: "<uid>:<gid>"` with the
owner of that directory.

### Without Docker

Needs Java 21 or newer and Node.js 22.12 or newer.

```sh
./gradlew :server:buildFatJar
(cd web && npm ci && npm run build)
HEMI_WEB_DIR=web/dist java -jar server/build/libs/hemi-server.jar
```

### Configuration

The server reads these environment variables:

| Variable | Default | |
|---|---|---|
| `HEMI_HOST` | `0.0.0.0` | Bind address |
| `HEMI_PORT` | `8080` | Port |
| `HEMI_DATA_DIR` | `data` (`/data` in the Docker image) | Directory for the SQLite database and `backups/` |
| `HEMI_WEB_DIR` | *(unset; set in the Docker image)* | Directory with the built web GUI. Unset means API only |
| `HEMI_TOKEN_LIFETIME_DAYS` | `30` | How long a login lasts without use |
| `HEMI_VERSION` | *(set in published images)* | The version `/api/health` and Settings show. Unset means the version in the source |

### Backups

An admin can make a consistent copy of the database under **Admin → Backup**. It's saved in
`$HEMI_DATA_DIR/backups/`. Copying the database file while the server is stopped works too.

### Upgrading

A newer server upgrades the database on start: it first saves a copy as
`$HEMI_DATA_DIR/backups/pre-migration-v<N>-<time>.db`, then migrates in one transaction, so a failed upgrade
changes nothing. An older server refuses to open a newer database, so going back to an older version means
restoring that copy.

### Remote access

The server speaks plain HTTP. Health data deserves better: to reach it from outside your network, put it behind a
VPN (WireGuard, Tailscale) or a reverse proxy with TLS (Caddy, nginx, Traefik).

## Development

| Module | What | Tech |
|---|---|---|
| `shared/` | Domain rules (limits, day cutoff, recurrences, rating prefill, work impact, statistics), services, API types and the database schema. Used by the server and, later, the Android app's on-device mode | Kotlin (JVM), SQLDelight |
| `server/` | REST API under `/api/v1`, and serves the built web GUI | Kotlin, Ktor, SQLite |
| `web/` | Web GUI | React, TypeScript, Vite, TanStack Query, react-i18next |

### Prerequisites

- **Java** of any recent version, to launch `./gradlew`. Gradle downloads JDK 21 itself
  (`gradle/gradle-daemon-jvm.properties`), so a JRE is enough.
- **Node.js** 22.12 or newer, for `web/`.

### Commands

```sh
./gradlew build                    # build and test shared and server
./gradlew :server:run              # API on http://localhost:8080, data in ./data
./gradlew :shared:test -PupdateTsTypes=true   # regenerate web/src/api/types.gen.ts after changing API types

cd web
npm install
npm run dev                        # web GUI on http://localhost:5173, sends /api to :8080
npm test                           # unit tests (Vitest)
npm run lint                       # oxlint
npm run e2e                        # browser walkthrough against a fresh server (needs Chromium; set CHROMIUM_PATH to override)
```

### Continuous integration

`.github/workflows/ci.yml` runs on every pull request, every push to `main` and every version tag: `./gradlew build`,
the web lint, tests and build, and the browser walkthrough. For a push to `main` or a version tag, once everything
passes, it also publishes the Docker image to ghcr.io.

## License

[AGPL-3.0](LICENSE).
