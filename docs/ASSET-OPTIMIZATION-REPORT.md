# Asset Optimization Report (`vidaenlosextremos-vr-2` / `ws-u39.2`)

Generated from offline asset pipeline (`scripts/optimize-models.mjs` and `scripts/optimize-media.mjs`) into Tier 2 staging (`/home/pfefferi/workspace-next/data/vidaenlosextremos-vr-2/r2-staging/v2/`).

## 1. 3D Production Models (`gltf-transform` v4.5.1)

Pipeline executed: `metalrough` -> `dedup` -> `prune` -> `resize (<=2048x2048)` -> `webp (quality=85)` -> `meshopt` (with `--ktx2` CLI flag scaffolded for future Meta Quest pass; `simplify` threshold `<= 15 MB` / `15,728,640` bytes).

| Model | Raw Size (glTF + bin + textures) | Optimized GLB | Reduction | Triangles (Before -> After) | Vertices (Before -> After) | `doubleSided` Materials | `KHR_materials_pbrSpecularGlossiness` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `whale-fall` (`S0883`) | 29,218,875 B (27.87 MB) | `v2/models/whale-fall.5fbb94cd.glb` — **5,039,704 B (4.81 MB)** | -82.8% | 747,516 -> 747,516 (no simplification needed) | 440,290 -> 440,290 | 4 / 4 | **0 (Removed)** |
| `clam-bed` (`S0889`) | 58,912,393 B (56.18 MB) | `v2/models/clam-bed.89a9fb10.glb` — **12,253,440 B (11.69 MB)** | -79.2% | 1,084,674 -> 1,084,674 (no simplification needed) | 1,191,243 -> 1,191,243 | 4 / 4 | **0 (Removed)** |

### `gltf-transform inspect` Summary

- **`whale-fall.5fbb94cd.glb`**:
  - `extensionsUsed`: `EXT_meshopt_compression`, `EXT_texture_webp`, `KHR_materials_ior`, `KHR_materials_specular`, `KHR_mesh_quantization`
  - `extensionsRequired`: `EXT_meshopt_compression`, `EXT_texture_webp`, `KHR_mesh_quantization`
  - Textures: 4x `2048x2048` `image/webp` (`195.3 KB`, `179.55 KB`, `179.15 KB`, `197.61 KB`)
- **`clam-bed.89a9fb10.glb`**:
  - `extensionsUsed`: `EXT_meshopt_compression`, `EXT_texture_webp`, `KHR_materials_ior`, `KHR_materials_specular`, `KHR_mesh_quantization`
  - `extensionsRequired`: `EXT_meshopt_compression`, `EXT_texture_webp`, `KHR_mesh_quantization`
  - Textures: 4x `2048x2048` `image/webp` (`258.28 KB`, `301.22 KB`, `262.27 KB`, `268.01 KB`)

Both GLBs passed `<= 15 MB` (`15,728,640` bytes) without requiring lossy `simplify`.

## 2. Habitat Cards (`sharp` WebP, `600x360` & `1200x720`)

All `600x360` card variants are verified `< 60 KB` (`61,440` bytes).

| Source JPEG | Raw Bytes | `600x360` WebP | `1200x720` WebP |
| --- | --- | --- | --- |
| `whale_fall.jpg` | 535,758 B | `whale-fall-env-600.c6b70ca4.webp` (**11,968 B**) | `whale-fall-env-1200.64bca441.webp` (44,978 B) |
| `whale_fall_close.jpg` | 3,270,882 B | `whale-fall-close-600.9ec26cb4.webp` (**28,282 B**) | `whale-fall-close-1200.6ac4e21b.webp` (112,392 B) |
| `clam_bed.jpg` | 3,270,103 B | `clam-bed-env-600.e8bb6c4e.webp` (**37,896 B**) | `clam-bed-env-1200.dc10f383.webp` (137,220 B) |
| `clam_bed_close.jpg` | 3,089,895 B | `clam-bed-close-600.f9b17fc8.webp` (**9,196 B**) | `clam-bed-close-1200.b2028fc5.webp` (27,712 B) |
| `giant_corals.jpg` | 3,403,373 B | `giant-corals-env-600.b8af0318.webp` (**39,450 B**) | `giant-corals-env-1200.cc4ebdd3.webp` (144,008 B) |
| `giant_corals_close.jpg` | 3,436,580 B | `giant-corals-close-600.1aac4335.webp` (**35,302 B**) | `giant-corals-close-1200.8eb3bf10.webp` (107,332 B) |

## 3. Gallery Photos & Brand Assets (`sharp`)

| Source Asset | Raw Bytes | Thumb / Favicon | Full / Header |
| --- | --- | --- | --- |
| `fkt251206_crew.jpg` | 334,456 B | `400x266` WebP — 23,906 B | `1600x1065` WebP — 237,904 B |
| `isopods_macro.jpg` | 157,156 B | `400x225` WebP — 8,578 B | `1600x900` WebP — 107,662 B |
| `labo_vertebra.jpg` | 217,592 B | `400x533` WebP — 42,822 B | `960x1280` WebP — 231,118 B |
| `labo_vertebra2.jpg` | 146,116 B | `400x533` WebP — 32,872 B | `960x1280` WebP — 133,360 B |
| `labo_vertebra3.jpg` | 3,269,711 B | `400x300` WebP — 22,852 B | `1600x1200` WebP — 411,972 B |
| `rov_subastian_arms.jpg` | 239,440 B | `400x225` WebP — 14,532 B | `1600x900` WebP — 161,612 B |
| `whalefall_crinoid_vertebra.jpg` | 156,619 B | `400x225` WebP — 9,618 B | `1600x900` WebP — 104,234 B |
| `whalefall_sponge_arthropods.jpg` | 153,217 B | `400x225` WebP — 9,658 B | `1600x900` WebP — 83,494 B |
| `logo-vidaenextremos.png` | 57,034 B | `public/favicon.png` (`64x64` PNG) — **2,863 B** | `v2/brand/logo-vidaenextremos.2087829d.webp` (`256x256` WebP) — 11,932 B |

## 4. Vertebra VR Video Clip Status (`NqnWDBwp-k8`)

- **Target:** `https://www.youtube.com/watch?v=NqnWDBwp-k8`
- **Status:** `vrVideoKey: null` (graceful fallback; `youtubeId: "NqnWDBwp-k8"` preserved on `wp-vertebra-sample`).
- **`yt-dlp` inspection & probe findings:**
  - Title: `Waypoint 7: Salado-Colorado Kilometer scarp | SOI Divestream 883 - Part 2`
  - Duration: **`10:44:35`** (full 10.7-hour ROV dive livestream; `136+140` 720p stream is **1.87 GiB**, `filesize_approx: 11729651934`)
  - Chapters: `null` (no timestamp markers in YouTube metadata or legacy v1 data)
  - Warning emitted by `yt-dlp`: `WARNING: [youtube] [jsc] Remote components challenge solver script (deno) and NPM package (deno) were skipped... WARNING: [youtube] NqnWDBwp-k8: n challenge solving failed: Some formats may be missing.`
- **Reason for fallback:** `NqnWDBwp-k8` is an un-chaptered 10h44m35s full dive livestream (1.87 GiB at 720p) with no extraction start/end timestamp in either YouTube chapters or legacy v1 metadata. Downloading and transcoding a 1.87 GiB 10.7-hour stream for an in-VR `<Video>` clip is unsuitable for static R2 delivery; the desktop UI falls back to the YouTube embed (`youtubeId: "NqnWDBwp-k8"`) and the VR UI displays `vr.video_unavailable`.
