use std::fmt;

use serde::{Deserialize, Deserializer};

/// A radio frequency in kHz, e.g. 118.450 MHz is 118_450.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Frequency(u32);

impl Frequency {
    pub const MIN_KHZ: u32 = 118_000;
    pub const MAX_KHZ: u32 = 136_990;

    pub const fn from_khz(khz: u32) -> Option<Self> {
        if khz >= Self::MIN_KHZ && khz <= Self::MAX_KHZ {
            Some(Self(khz))
        } else {
            None
        }
    }

    /// Accepts `118.45`, `118.450`, `118.4`, `118450` and an optional `MHz`.
    pub fn parse(input: &str) -> Option<Self> {
        let mut text = input.trim().to_ascii_lowercase();
        if let Some(stripped) = text.strip_suffix("mhz") {
            text = stripped.trim().to_string();
        }
        let text = text.replace([' ', '_'], "");
        if text.is_empty() || !text.is_ascii() {
            return None;
        }

        let (whole, frac) = match text.split_once('.') {
            Some((whole, frac)) => (whole, frac),
            None if text.len() == 6 => (&text[..3], &text[3..]),
            None => return None,
        };

        if whole.is_empty() || frac.is_empty() || frac.len() > 3 {
            return None;
        }
        if !whole.chars().all(|c| c.is_ascii_digit()) || !frac.chars().all(|c| c.is_ascii_digit()) {
            return None;
        }

        let whole: u32 = whole.parse().ok()?;
        let frac = format!("{frac:0<3}");
        let khz = whole * 1000 + frac.parse::<u32>().ok()?;
        Self::from_khz(khz)
    }

    pub const fn khz(self) -> u32 {
        self.0
    }

    pub fn mhz(self) -> String {
        format!("{}.{:03}", self.0 / 1000, self.0 % 1000)
    }
}

impl fmt::Display for Frequency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{:03}", self.0 / 1000, self.0 % 1000)
    }
}

impl<'de> Deserialize<'de> for Frequency {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let text = String::deserialize(deserializer)?;
        Frequency::parse(&text)
            .ok_or_else(|| serde::de::Error::custom(format!("invalid frequency: {text}")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_common_forms() {
        assert_eq!(Frequency::parse("118.450").unwrap().khz(), 118_450);
        assert_eq!(Frequency::parse("118.45").unwrap().khz(), 118_450);
        assert_eq!(Frequency::parse("118.4").unwrap().khz(), 118_400);
        assert_eq!(Frequency::parse("118450").unwrap().khz(), 118_450);
        assert_eq!(Frequency::parse(" 121.800 MHz ").unwrap().khz(), 121_800);
    }

    #[test]
    fn rejects_out_of_band_and_garbage() {
        assert!(Frequency::parse("117.999").is_none());
        assert!(Frequency::parse("137.000").is_none());
        assert!(Frequency::parse("abc").is_none());
        assert!(Frequency::parse("118.").is_none());
    }

    #[test]
    fn formats_with_three_decimals() {
        assert_eq!(Frequency::parse("121.8").unwrap().mhz(), "121.800");
        assert_eq!(Frequency::parse("134.700").unwrap().to_string(), "134.700");
    }
}
