use quick_xml::{events::Event, Reader};
use std::io::Read;
use std::path::Path;

#[derive(Default)]
pub struct ThreeMfData {
    pub thumbnail_bytes: Option<Vec<u8>>,
    pub estimated_print_time_min: Option<i64>,
    pub estimated_filament_g: Option<f64>,
}

/// Extracts thumbnail PNG and Bambu-Studio print estimates from a 3MF file.
/// Synchronous — call inside `spawn_blocking`.
pub fn extract(path: &Path) -> ThreeMfData {
    let mut data = ThreeMfData::default();

    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return data,
    };
    let mut archive = match zip::ZipArchive::new(file) {
        Ok(a) => a,
        Err(_) => return data,
    };

    data.thumbnail_bytes = extract_thumbnail(&mut archive);

    if let Some((time, filament)) = extract_bambu_estimates(&mut archive) {
        data.estimated_print_time_min = time;
        data.estimated_filament_g = filament;
    }

    data
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

const MAX_THUMBNAIL_BYTES: u64 = 10 * 1024 * 1024; // 10 MB
const MAX_XML_BYTES: u64      =      512 * 1024;   // 512 KB

fn extract_thumbnail(archive: &mut zip::ZipArchive<std::fs::File>) -> Option<Vec<u8>> {
    // Try Bambu-Studio paths first, then generic 3MF spec
    let candidates = [
        "Metadata/plate_1.png",
        "Thumbnails/thumbnail.png",
        "thumbnail.png",
        "Metadata/thumbnail.png",
        "Metadata/preview.png",
    ];

    for name in candidates {
        if let Ok(mut entry) = archive.by_name(name) {
            if entry.size() > MAX_THUMBNAIL_BYTES {
                log::warn!("3MF thumbnail entry '{}' exceeds size limit, skipping", name);
                continue;
            }
            let mut bytes = Vec::new();
            if entry.read_to_end(&mut bytes).is_ok() && !bytes.is_empty() {
                return Some(bytes);
            }
        }
    }
    None
}

// ── Bambu print estimates ─────────────────────────────────────────────────────

fn extract_bambu_estimates(
    archive: &mut zip::ZipArchive<std::fs::File>,
) -> Option<(Option<i64>, Option<f64>)> {
    // slice_info.config carries per-plate estimates; model_settings.config is fallback
    for name in ["Metadata/slice_info.config", "Metadata/model_settings.config"] {
        if let Ok(mut entry) = archive.by_name(name) {
            if entry.size() > MAX_XML_BYTES { continue; }
            let mut content = String::new();
            if entry.read_to_string(&mut content).is_ok() {
                let result = parse_bambu_xml(&content);
                if result.0.is_some() || result.1.is_some() {
                    return Some(result);
                }
            }
        }
    }
    None
}

fn parse_bambu_xml(xml: &str) -> (Option<i64>, Option<f64>) {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut print_time: Option<i64> = None;
    let mut filament_g = 0.0f64;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(e)) | Ok(Event::Start(e)) => {
                match e.name().as_ref() {
                    b"metadata" => {
                        let mut key = String::new();
                        let mut val = String::new();
                        for attr in e.attributes().flatten() {
                            match attr.key.as_ref() {
                                b"key"   => key = String::from_utf8_lossy(&attr.value).into(),
                                b"value" => val = String::from_utf8_lossy(&attr.value).into(),
                                _ => {}
                            }
                        }
                        if key == "estimate_normal_print_time" && print_time.is_none() {
                            print_time = parse_time_str(&val);
                        }
                    }
                    b"filament" => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"used_g" {
                                if let Ok(g) = String::from_utf8_lossy(&attr.value).parse::<f64>() {
                                    filament_g += g;
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    (
        print_time,
        if filament_g > 0.0 { Some(filament_g) } else { None },
    )
}

/// Parses Bambu time strings like "2h 30m", "30m", "1h 2m 30s"
fn parse_time_str(s: &str) -> Option<i64> {
    let mut minutes = 0i64;
    let mut current = String::new();

    for c in s.chars() {
        match c {
            'h' => {
                if let Ok(h) = current.trim().parse::<i64>() {
                    minutes += h * 60;
                }
                current.clear();
            }
            'm' => {
                if let Ok(m) = current.trim().parse::<i64>() {
                    minutes += m;
                }
                current.clear();
            }
            's' | ' ' => current.clear(),
            _ => current.push(c),
        }
    }

    if minutes > 0 { Some(minutes) } else { None }
}
