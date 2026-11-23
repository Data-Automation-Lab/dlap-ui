# DLAP UI

The operator interface of [DLAP](https://github.com/Data-Automation-Lab/dlap), the Data Lifecycle Automation Platform.
React, TypeScript and Vite under `frontend/`, with a small Spring Boot shell under `src/`
that serves the built app. Apache License 2.0 (see [LICENSE](LICENSE)).

**Status: early evaluation release**, like the platform. The UI is verified only as part
of the DLAP stack, against the seeded development realm. It is not known to run in
production anywhere.

## How it is used

This repository is the `new-ui` git submodule of the main repository. The supported way
to run it is the quickstart of the main repository, which builds this UI into its Compose
stack and serves it behind the gateway:

```bash
git clone --recurse-submodules https://github.com/Data-Automation-Lab/dlap.git
cd dlap
bash scripts/quickstart.sh
```

Then open `http://localhost:8081` and sign in as described in the main README. Business
logic stays in the services: the UI calls their REST APIs through the gateway and holds no
rules of its own.

## Develop

Node 22 or later.

```bash
cd frontend
npm ci
npm run dev         # Vite dev server
npm run typecheck   # tsc --noEmit
npm run lint        # eslint, zero warnings allowed
npm run test:ci     # vitest run
npm run build       # production bundle
```

The API types under `frontend/src/api/generated/` are generated from the OpenAPI files of
the main repository (`npm run gen:api`, with this repository checked out as `new-ui`
inside it). `npm run gen:api:check` fails when they have drifted.

## Other documents in this repository

`docs/`, `dev-setup/`, `scripts/` and `src/main/docker/` hold older material from the time
this UI was developed on its own: a standalone Keycloak and PostgreSQL setup, sample users
and how-to notes. They have not been verified against this release. Where they disagree
with the main repository's README, the main repository is right.

## Contributing and security

Follow [CONTRIBUTING.md](https://github.com/Data-Automation-Lab/dlap/blob/main/CONTRIBUTING.md) of the main repository,
including the DCO sign-off. Report vulnerabilities as described in its
[SECURITY.md](https://github.com/Data-Automation-Lab/dlap/blob/main/SECURITY.md), not in a public issue.
