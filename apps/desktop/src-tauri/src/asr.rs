//! Local speech recognition with whisper.cpp (tiny English weights).
//!
//! The model is loaded on the first transmission, not at start-up, so an idle app does not hold it.
//! Audio stays in memory: nothing here writes a file or logs what was heard.
//! Decoding is greedy at temperature 0 with no fallback, so the same samples give the same text.

use std::path::Path;
use whisper_rs::{
    FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters, WhisperState,
};

/// Samples per second the recognizer expects. The webview resamples to this before sending.
pub const SAMPLE_RATE: usize = 16_000;
/// Holds shorter than this are a click on the button, not a call.
const MIN_SAMPLES: usize = SAMPLE_RATE * 3 / 10;
/// Longer than any radio call; the webview caps its capture at the same length.
const MAX_SAMPLES: usize = SAMPLE_RATE * 30;
/// RMS below this is a closed mic or room noise.
const SILENCE_RMS: f32 = 0.005;

/// A loaded model with its decoding buffers. One per app; calls take turns.
pub struct Recognizer {
    state: WhisperState,
}

impl Recognizer {
    pub fn load(model: &Path) -> Result<Self, String> {
        // Send whisper.cpp's own console output nowhere; it would otherwise print load details to stderr.
        whisper_rs::install_logging_hooks();
        let path = model.to_str().ok_or("the model path is not valid text")?;
        let context = WhisperContext::new_with_params(path, WhisperContextParameters::default())
            .map_err(|error| format!("the speech model did not load: {error}"))?;
        let state = context
            .create_state()
            .map_err(|error| format!("the speech model did not start: {error}"))?;
        Ok(Self { state })
    }

    /// Text heard in 16 kHz mono samples. Empty when the hold was too short or silent.
    pub fn transcribe(&mut self, samples: &[f32]) -> Result<String, String> {
        if !worth_decoding(samples) {
            return Ok(String::new());
        }
        let samples = &samples[..samples.len().min(MAX_SAMPLES)];
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("en"));
        params.set_temperature(0.0);
        params.set_temperature_inc(0.0);
        params.set_no_context(true);
        params.set_single_segment(true);
        params.set_suppress_blank(true);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        self.state
            .full(params, samples)
            .map_err(|error| format!("recognition failed: {error}"))?;
        let text: String = self
            .state
            .as_iter()
            .map(|segment| segment.to_string())
            .collect();
        Ok(clean_transcript(&text))
    }
}

/// True when the hold is long enough and loud enough to hold speech.
pub fn worth_decoding(samples: &[f32]) -> bool {
    if samples.len() < MIN_SAMPLES {
        return false;
    }
    let energy: f64 = samples.iter().map(|s| f64::from(*s) * f64::from(*s)).sum();
    (energy / samples.len() as f64).sqrt() as f32 >= SILENCE_RMS
}

/// Radio words whisper writes hyphenated, and the one word the intent parser knows.
const JOINED: [(&str, &str); 3] = [
    ("take-off", "takeoff"),
    ("fox-trot", "foxtrot"),
    ("x-ray", "xray"),
];

/// Drops whisper's non-speech tags such as `[BLANK_AUDIO]` or `(static)`, joins the hyphenated
/// radio words in [`JOINED`], and squeezes the spaces.
pub fn clean_transcript(text: &str) -> String {
    let mut kept = String::with_capacity(text.len());
    let mut depth = 0usize;
    for ch in text.chars() {
        match ch {
            '[' | '(' => depth += 1,
            ']' | ')' => depth = depth.saturating_sub(1),
            _ if depth == 0 => kept.push(ch),
            _ => {}
        }
    }
    for (hyphenated, joined) in JOINED {
        kept = replace_ascii_ci(&kept, hyphenated, joined);
    }
    kept.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Replaces every case-insensitive match of the ASCII `from`.
fn replace_ascii_ci(text: &str, from: &str, to: &str) -> String {
    let lower = text.to_ascii_lowercase();
    let mut out = String::with_capacity(text.len());
    let mut rest = 0;
    while let Some(found) = lower[rest..].find(from) {
        out.push_str(&text[rest..rest + found]);
        out.push_str(to);
        rest += found + from.len();
    }
    out.push_str(&text[rest..]);
    out
}

/// Little-endian f32 samples from the webview's raw request body. A trailing partial sample is dropped.
pub fn samples_from_bytes(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_click_or_a_silent_hold_is_not_decoded() {
        assert!(!worth_decoding(&[]));
        assert!(!worth_decoding(&vec![0.2; MIN_SAMPLES - 1]));
        assert!(!worth_decoding(&vec![0.001; SAMPLE_RATE]));
        let tone: Vec<f32> = (0..SAMPLE_RATE)
            .map(|i| 0.1 * (i as f32 * 0.2).sin())
            .collect();
        assert!(worth_decoding(&tone));
    }

    #[test]
    fn non_speech_tags_are_dropped() {
        assert_eq!(clean_transcript(" [BLANK_AUDIO] "), "");
        assert_eq!(
            clean_transcript(" N123AB, (static) request taxi.  [Music]"),
            "N123AB, request taxi."
        );
        assert_eq!(
            clean_transcript("ready for departure"),
            "ready for departure"
        );
    }

    #[test]
    fn hyphenated_radio_words_are_joined() {
        assert_eq!(
            clean_transcript("Request Take-Off, Kilo Juliet Fox-Trot, X-ray."),
            "Request takeoff, Kilo Juliet foxtrot, xray."
        );
        assert_eq!(
            clean_transcript("hold short, left-hand"),
            "hold short, left-hand"
        );
    }

    #[test]
    fn raw_bytes_become_samples() {
        let mut bytes = Vec::new();
        for sample in [0.5f32, -0.25, 1.0] {
            bytes.extend_from_slice(&sample.to_le_bytes());
        }
        bytes.push(7);
        assert_eq!(samples_from_bytes(&bytes), vec![0.5, -0.25, 1.0]);
    }

    /// The P1a accuracy bar: 20 calls read by the macOS voice, recognized, then parsed.
    /// Needs the model and the WAVs from `scripts/make-asr-fixtures.sh`; it fails when either is missing.
    /// Run: `cargo test --release -p aurelia-radio -- --ignored spoken_calls`
    #[test]
    #[ignore = "needs the whisper model and the generated WAV fixtures"]
    fn spoken_calls_clear_the_accuracy_bar() {
        use radio_core::{parse_intent, PilotRequest};
        use std::path::PathBuf;

        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("fixtures")
            .join("asr");
        let model = std::env::var_os("AURELIA_ASR_MODEL")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                PathBuf::from(std::env::var_os("HOME").expect("HOME"))
                    .join("Library/Application Support/com.aurelia.radio/models")
                    .join(crate::SPEECH_MODEL_FILE)
            });
        assert!(
            model.is_file(),
            "no model at {} (scripts/fetch-asr-model.sh)",
            model.display()
        );
        let lines = std::fs::read_to_string(fixtures.join("lines.tsv")).expect("lines.tsv");
        let mut recognizer = Recognizer::load(&model).expect("model loads");

        let mut hits = 0;
        let mut total = 0;
        for row in lines
            .lines()
            .filter(|row| !row.trim().is_empty() && !row.starts_with('#'))
        {
            let mut cols = row.split('\t');
            let (id, expect, said) = (
                cols.next().expect("id"),
                cols.next().expect("kind"),
                cols.next().expect("text"),
            );
            let wav = fixtures.join(format!("{id}.wav"));
            let mut reader = hound::WavReader::open(&wav).unwrap_or_else(|_| {
                panic!(
                    "no fixture {} (scripts/make-asr-fixtures.sh)",
                    wav.display()
                )
            });
            let spec = reader.spec();
            assert_eq!(
                (spec.sample_rate, spec.channels),
                (SAMPLE_RATE as u32, 1),
                "{id}.wav format"
            );
            let samples: Vec<f32> = reader
                .samples::<i16>()
                .map(|s| f32::from(s.expect("sample")) / 32_768.0)
                .collect();
            let heard = recognizer.transcribe(&samples).expect("transcribes");
            let got = match parse_intent(&heard) {
                Some(PilotRequest::Clearance { .. }) => "clearance",
                Some(PilotRequest::Readback(_)) => "readback",
                Some(PilotRequest::RequestTaxi) => "taxi",
                Some(PilotRequest::RequestTakeoff) => "takeoff",
                Some(PilotRequest::RequestDeparture) => "departure",
                None => "none",
            };
            total += 1;
            if got == expect {
                hits += 1;
            } else {
                eprintln!("{id}: said {said:?}, heard {heard:?}, parsed {got}, wanted {expect}");
            }
        }
        assert_eq!(total, 20, "lines.tsv holds the 20 scripted calls");
        eprintln!("{hits}/{total} spoken calls parsed to the right intent");
        assert!(hits * 100 / total >= 95, "{hits}/{total} spoken calls");
    }
}
