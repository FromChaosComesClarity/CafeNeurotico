# Cafe Neurotico

The unified suite — **Manager** (game library hub), **GRINDER** (GOG/Epic install engine),
and **CREMA** (fullscreen gamepad interface) in a single Electron app and a single AppImage.

One Electron runtime, one `better-sqlite3`, one copy of the helper binaries — replacing the
three separate AppImages that previously shipped from
[CafeNeuroticoGameManager](https://github.com/shampoo-is-a-lie/CafeNeuroticoGameManager),
[GRINDER](https://github.com/shampoo-is-a-lie/GRINDER), and
[CREMA](https://github.com/shampoo-is-a-lie/CREMA) (now archived as the source of this merge).

## Architecture

```
cafeneurotico/
├── main.js            single Electron entry — argv dispatch + window factory
├── packages/
│   └── core/          shared: db, metadata, grinder engine, trailers, settings, i18n
└── apps/
    ├── manager/       Manager face (formerly CNGM)
    ├── grinder/       GRINDER engine + GUI
    └── crema/         CREMA fullscreen face
```

### Launch modes
| Invocation | Face |
|------------|------|
| `cafeneurotico` | Manager (windowed library hub) |
| `cafeneurotico grinder <cmd>` | GRINDER engine (headless) / GUI |
| `cafeneurotico --crema` | CREMA (fullscreen, gamepad) |

## Build

```sh
npm install        # installs deps + rebuilds better-sqlite3 for Electron's ABI
npm start          # run the Manager face
npm run start:crema # run the CREMA face
npm run dist       # build CafeNeurotico.AppImage
```

## Status

Built up in phases — see the project roadmap. **Phase 0:** monorepo scaffold,
Manager-only AppImage. GRINDER and CREMA are folded in subsequently.

## License

GPL-3.0-or-later
