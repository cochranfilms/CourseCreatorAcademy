# CSV Importer

Upload a single CSV at `/admin/import` with these columns (header required):

```
row_type,course_id,course_title,module_id,module_index,lesson_id,lesson_index,title,description,free_preview,mux_input_url,creator_id,asset_category,asset_tag,asset_image
```

Examples:

```
course,film101,Film 101,,,,,Film 101,Intro to film,,,
module,film101,,mod-1,1,,,,,,,
lesson,film101,,mod-1,1,les-1,1,What is Exposure?,Basics,true,https://storage.googleapis.com/...,,,
asset_overlay,,,,,,,GK - Flux Essence,, , ,creator-abc,overlays,transitions,https://.../image.jpg
asset_sfx,,,,,,,GK - Swoosh Pack,, , ,creator-abc,sfx,wooshes,https://.../image.jpg
```

Notes:
- Lessons trigger Mux ingest with `playback_policy: ['signed']`. The Mux webhook fills `muxPlaybackId` and `durationSec`.
- Assets are appended to `legacy_creators/{creatorId}.assets.{overlays|sfx}` with de‑dupe by `(title, tag)`.
- Dry‑run mode validates and returns a summary without writes.


